/**
 * worker.js
 * Cloudflare Worker Anycast para PixValidator Pro API
 * 
 * @license MIT
 * @see https://github.com/clepta2/pixvalidator-pro
 */

import { PixValidatorPro } from './pixvalidator-pro.js';
import { STYLES_CSS, HTML_INDEX, OZPRO_MARK_SVG } from './site-assets.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Max-Age': '86400'
};

const ipBuckets = new Map();

function checkRateLimit(ip, limit = 60, windowMs = 60000) {
  const now = Date.now();
  let entry = ipBuckets.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    ipBuckets.set(ip, entry);
    if (ipBuckets.size > 10000) {
      for (const [k, v] of ipBuckets) {
        if (now > v.resetAt) ipBuckets.delete(k);
      }
    }
    return { ok: true, remaining: limit - 1, resetAt: entry.resetAt };
  }
  entry.count++;
  if (entry.count > limit) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt };
  }
  return { ok: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';
    const wantsJson = url.searchParams.get('format') === 'json' ||
      (request.headers.get('Accept') && request.headers.get('Accept').includes('application/json'));

    // 1. Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 2. Blindagem de Métodos HTTP
    if (request.method !== 'GET' && request.method !== 'POST') {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Método não permitido. Esta API opera estritamente com requisições GET e POST.'
      }), {
        status: 405,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
      });
    }

    let bodyJson = null;
    if (request.method === 'POST') {
      try {
        bodyJson = await request.json();
      } catch (_) {}
    }

    // 3. Autenticação e Rate Limit
    const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('x-real-ip') || '127.0.0.1';
    const authHeader = request.headers.get('Authorization') || request.headers.get('x-api-key') || '';
    const cleanKey = authHeader.replace(/^Bearer\s+/i, '').trim();
    const hasApiKey = Boolean(
      cleanKey && (
        cleanKey.startsWith('pix_live_') || 
        cleanKey.startsWith('pix_pro_') || 
        cleanKey.startsWith('pix_master_') || 
        cleanKey.startsWith('pnt_live_') ||
        (env && (env.API_KEY === cleanKey || env.PRO_KEY === cleanKey))
      ) && cleanKey.length >= 16
    );
    const isCommercial = hasApiKey;
    const maxReqs = isCommercial ? 300 : 60;
    const rl = checkRateLimit(clientIp, maxReqs, 60000);

    if (!rl.ok && path !== '/' && path !== '/health' && path !== '/demo') {
      return new Response(JSON.stringify({
        ok: false,
        valido: false,
        error: 'Limite temporário de requisições excedido. Aguarde o período indicado em Retry-After.',
        retryAfterSeconds: Math.ceil((rl.resetAt - Date.now()) / 1000)
      }, null, 2), {
        status: 429,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...CORS_HEADERS,
          'Retry-After': String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
          'X-RateLimit-Limit': String(maxReqs),
          'X-RateLimit-Remaining': String(rl.remaining)
        }
      });
    }

    // ── ROTA: ARQUIVOS ESTÁTICOS DO SITE PRÓPRIO (TEMPLATE PONTE API MARKETPLACE) ──
    if (path === '/styles.css' || path === '/ponte-suite.css') {
      return new Response(STYLES_CSS, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/css; charset=utf-8',
          'Cache-Control': 'public, max-age=604800, s-maxage=2592000'
        }
      });
    }

    if (path === '/brand/ozpro-mark.svg') {
      return new Response(OZPRO_MARK_SVG, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=2592000, s-maxage=2592000'
        }
      });
    }

    // 4. Healthcheck e Status
    if (path === '/health' || path === '/status') {
      return new Response(JSON.stringify({
        ok: true,
        service: 'PixValidator Pro API',
        cluster: 'Cloudflare Edge Anycast',
        version: env?.API_VERSION || '1.0.0',
        status: 'online',
        autenticado: hasApiKey,
        padrao: 'Banco Central do Brasil / EMVCo MPM',
        crcAlgoritmo: 'CRC16-CCITT (False: 0x1021)',
        latency: 'sub-1ms',
        github: 'https://github.com/clepta2/pixvalidator-pro',
        edgeLocation: request.cf ? request.cf.colo : 'Edge',
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
      });
    }

    // 5. Landing Page / Interface Web de Testes
    if (path === '/' || path === '/demo' || path === '/index.html') {
      if (wantsJson) {
        return new Response(JSON.stringify({
          ok: true,
          service: 'PixValidator Pro API',
          cluster: 'Cloudflare Edge Anycast',
          version: env?.API_VERSION || '1.0.0',
          padrao: 'Manual de Iniciação do Pix Bacen / EMVCo MPM',
          rotas: {
            decodificar: 'POST /api/pix/decodificar ou GET /api/pix/decodificar?codigo=...',
            validar: 'GET /api/pix/validar?codigo=...',
            gerar: 'POST /api/pix/gerar ou GET /api/pix/gerar?chave=...&nome=...&valor=...',
            validarChave: 'GET /api/pix/chave?chave=...',
            validarLote: 'POST /api/pix/validar-lote (até 50 itens Pro ou 5 gratuitos)',
            extrairTexto: 'POST /api/pix/extrair'
          },
          github: 'https://github.com/clepta2/pixvalidator-pro'
        }, null, 2), {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
        });
      }
      return new Response(HTML_INDEX, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300, s-maxage=3600'
        }
      });
    }

    // Validação em Lote de Chaves ou Códigos Pix (/api/pix/validar-lote ou /api/pix/lote)
    if (path === '/api/pix/validar-lote' || path === '/api/pix/lote') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ ok: false, error: 'Use POST com um array "chaves" ou "codigos".' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
        });
      }

      const chaves = bodyJson && Array.isArray(bodyJson.chaves) ? bodyJson.chaves : null;
      const codigos = bodyJson && Array.isArray(bodyJson.codigos) ? bodyJson.codigos : null;

      if (!chaves && !codigos) {
        return new Response(JSON.stringify({ ok: false, error: 'Envie um array "chaves" ou "codigos" no corpo JSON.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
        });
      }

      const itens = chaves || codigos;
      const tipoLote = chaves ? 'chaves' : 'codigos';
      const maxItems = isCommercial ? 50 : 5;

      if (itens.length === 0) {
        return new Response(JSON.stringify({ ok: false, error: 'O array informado não pode estar vazio.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
        });
      }

      if (itens.length > maxItems) {
        return new Response(JSON.stringify({
          ok: false,
          error: `O lote aceita até ${maxItems} itens por requisição neste plano.`,
          maxItems
        }), {
          status: 413,
          headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
        });
      }

      const resultados = itens.map((item) => {
        if (tipoLote === 'chaves') {
          const res = PixValidatorPro.validarChave(String(item || ''));
          return {
            chaveInformada: String(item),
            ok: res.valido,
            ...res
          };
        } else {
          const res = PixValidatorPro.decodificar(String(item || ''));
          return {
            codigoInformado: String(item),
            ok: res.valido,
            valido: res.valido,
            tipo: res.tipo || null,
            valor: res.transacao?.valor || null,
            valorFormatado: res.transacao?.valorFormatado || null,
            chave: res.chave?.valor || null,
            recebedor: res.recebedor?.nome || null,
            crcValido: res.seguranca?.crcValido || false,
            motivo: res.seguranca?.erros ? res.seguranca.erros[0] : null
          };
        }
      });

      return new Response(JSON.stringify({
        ok: true,
        tipoLote,
        totalSolicitado: itens.length,
        totalValidos: resultados.filter((i) => i.ok || i.valido).length,
        totalInvalidos: resultados.filter((i) => !i.ok && !i.valido).length,
        resultados
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
      });
    }

    // 6. Decodificar e Auditar Pix Copia e Cola (/api/pix/decodificar ou /api/decodificar)
    if (path === '/api/pix/decodificar' || path === '/api/decodificar') {
      let codigo = url.searchParams.get('codigo') || url.searchParams.get('payload') || url.searchParams.get('pix') || '';

      if (!codigo && bodyJson) {
        codigo = bodyJson.codigo || bodyJson.payload || bodyJson.pix || '';
      }

      if (!codigo) {
        return new Response(JSON.stringify({
          ok: false,
          valido: false,
          erro: 'Código Pix Copia e Cola não informado. Envie o parâmetro "codigo".'
        }, null, 2), {
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
        });
      }

      const resDecod = PixValidatorPro.decodificar(codigo);
      const aud = PixValidatorPro.gerarHashAuditoria(codigo, clientIp);
      resDecod.auditoria = aud;

      const statusHttp = resDecod.valido ? 200 : 422;

      return new Response(JSON.stringify(resDecod, null, 2), {
        status: statusHttp,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Audit-Hash': aud.hash,
          ...CORS_HEADERS
        }
      });
    }

    // 7. Validação Rápida Booleana (/api/pix/validar ou /api/validar)
    if (path === '/api/pix/validar' || path === '/api/validar') {
      let codigo = url.searchParams.get('codigo') || url.searchParams.get('payload') || '';

      if (!codigo && bodyJson) {
        codigo = bodyJson.codigo || bodyJson.payload || '';
      }

      const resDecod = PixValidatorPro.decodificar(codigo);
      return new Response(JSON.stringify({
        ok: true,
        valido: resDecod.valido,
        tipo: resDecod.tipo || null,
        valor: resDecod.transacao?.valor || null,
        valorFormatado: resDecod.transacao?.valorFormatado || null,
        chave: resDecod.chave?.valor || null,
        tipoChave: resDecod.chave?.tipo || null,
        recebedor: resDecod.recebedor?.nome || null,
        crcValido: resDecod.seguranca?.crcValido || false,
        motivo: resDecod.seguranca?.erros ? resDecod.seguranca.erros[0] : null
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
      });
    }

    // 8. Gerador Oficial de Pix Copia e Cola (/api/pix/gerar ou /api/gerar)
    if (path === '/api/pix/gerar' || path === '/api/gerar' || path === '/api/pix/copia-e-cola' || path === '/api/pix/gerar-qrcode') {
      let params = {};
      if (request.method === 'POST') {
        params = bodyJson || {};
      } else {
        params = {
          chave: url.searchParams.get('chave') || '',
          nome: url.searchParams.get('nome') || '',
          cidade: url.searchParams.get('cidade') || '',
          valor: url.searchParams.get('valor') ? parseFloat(url.searchParams.get('valor')) : null,
          txid: url.searchParams.get('txid') || '',
          infoAdicional: url.searchParams.get('infoAdicional') || url.searchParams.get('descricao') || '',
          cep: url.searchParams.get('cep') || '',
          tipo: url.searchParams.get('tipo') || 'ESTATICO',
          urlPayload: url.searchParams.get('urlPayload') || ''
        };
      }

      const resGerar = PixValidatorPro.gerarPix(params);
      const statusHttp = resGerar.ok ? 200 : 400;

      return new Response(JSON.stringify(resGerar, null, 2), {
        status: statusHttp,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
      });
    }

    // 9. Validação Isolada de Chave Pix (/api/pix/chave ou /api/chave)
    if (path === '/api/pix/chave' || path === '/api/chave' || path === '/api/pix/validar-chave') {
      const chave = url.searchParams.get('chave') || url.searchParams.get('valor') || '';
      const resChave = PixValidatorPro.validarChave(chave);
      const statusHttp = resChave.valido ? 200 : 400;

      return new Response(JSON.stringify(resChave, null, 2), {
        status: statusHttp,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
      });
    }

    // 10. Extrator Inteligente de Pix em Textos Livres / OCR (/api/pix/extrair)
    if (path === '/api/pix/extrair' || path === '/api/extrair') {
      let texto = '';
      if (request.method === 'POST') {
        const body = bodyJson || {};
        texto = body.texto || body.mensagem || body.conteudo || '';
      } else {
        texto = url.searchParams.get('texto') || '';
      }

      const extraidos = PixValidatorPro.extrairDeTexto(texto);

      return new Response(JSON.stringify({
        ok: true,
        totalEncontrados: extraidos.length,
        codigos: extraidos
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
      });
    }

    // 11. 404 - Rota Não Encontrada
    return new Response(JSON.stringify({
      ok: false,
      error: 'Endpoint não encontrado.',
      rotasDisponiveis: [
        'POST /api/pix/decodificar',
        'GET /api/pix/validar?codigo=...',
        'POST /api/pix/gerar',
        'GET /api/pix/chave?chave=...',
        'POST /api/pix/extrair',
        'GET /health'
      ]
    }, null, 2), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
    });
  }
};

function getHtmlDemo() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PixValidator Pro — Validador EMVCo &amp; Decodificador Pix</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #060913;
      --card: #0d1527;
      --card-inner: #131f38;
      --card-hover: #192847;
      --primary: #10b981;
      --primary-glow: rgba(16, 185, 129, 0.25);
      --accent: #06b6d4;
      --danger: #ef4444;
      --warning: #f59e0b;
      --border: rgba(255, 255, 255, 0.08);
      --border-focus: rgba(16, 185, 129, 0.5);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --code-bg: #030712;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
      padding: 0 20px;
    }
    .container {
      max-width: 1160px;
      margin: 0 auto;
      padding: 40px 0 80px;
    }
    header { text-align: center; margin-bottom: 40px; }
    .badge-top {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 9999px;
      color: var(--primary);
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    .badge-pulse {
      width: 8px;
      height: 8px;
      background: var(--primary);
      border-radius: 50%;
      box-shadow: 0 0 10px var(--primary);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(1.3); }
    }
    h1 {
      font-size: 2.5rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      margin-bottom: 12px;
      background: linear-gradient(135deg, #ffffff 40%, var(--primary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      color: var(--text-muted);
      font-size: 1.05rem;
      max-width: 720px;
      margin: 0 auto;
    }
    .tabs {
      display: flex;
      gap: 10px;
      background: var(--card);
      padding: 6px;
      border-radius: 12px;
      border: 1px solid var(--border);
      margin-bottom: 30px;
    }
    .tab-btn {
      flex: 1;
      padding: 12px 18px;
      background: transparent;
      border: none;
      border-radius: 8px;
      color: var(--text-muted);
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .tab-btn:hover {
      color: var(--text);
      background: rgba(255, 255, 255, 0.03);
    }
    .tab-btn.active {
      background: var(--primary);
      color: #022c22;
      box-shadow: 0 4px 14px var(--primary-glow);
    }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 28px;
      margin-bottom: 24px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }
    .card-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .card-desc {
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-bottom: 20px;
    }
    .input-group { margin-bottom: 20px; }
    label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    textarea, input {
      width: 100%;
      background: var(--card-inner);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px 16px;
      color: var(--text);
      font-size: 0.95rem;
      font-family: inherit;
      outline: none;
      transition: all 0.2s ease;
    }
    textarea {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      resize: vertical;
      min-height: 110px;
    }
    textarea:focus, input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px var(--primary-glow);
    }
    .btn-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 24px;
      background: var(--primary);
      color: #022c22;
      border: none;
      border-radius: 10px;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px var(--primary-glow);
    }
    .btn-secondary {
      background: var(--card-inner);
      color: var(--text);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover {
      background: var(--card-hover);
      color: #fff;
      box-shadow: none;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .grid-4 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-top: 24px;
    }
    .stat-box {
      background: var(--card-inner);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px 20px;
    }
    .stat-label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    .stat-val {
      font-size: 1.15rem;
      font-weight: 700;
      color: #fff;
      word-break: break-all;
    }
    .stat-val.mono { font-family: 'JetBrains Mono', monospace; }
    .tag-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 700;
    }
    .tag-success {
      background: rgba(16, 185, 129, 0.15);
      color: var(--primary);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .tag-danger {
      background: rgba(239, 68, 68, 0.15);
      color: var(--danger);
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      overflow-x: auto;
      color: #cbd5e1;
      margin-top: 16px;
    }
    @media (max-width: 768px) {
      .grid-2 { grid-template-columns: 1fr; }
      .tabs { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="badge-top">
        <span class="badge-pulse"></span>
        Banco Central do Brasil • Padrão EMVCo MPM • Sub-1ms Edge
      </div>
      <h1>PixValidator Pro API</h1>
      <p class="subtitle">Decodificador instantâneo, Validador de Integridade (CRC16-CCITT) e Gerador Oficial de Pix Copia e Cola / QR Code para E-commerce, PDVs e Agentes de IA.</p>
    </header>

    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('tab-decodificar')">🔍 Decodificar &amp; Validar</button>
      <button class="tab-btn" onclick="switchTab('tab-gerar')">⚡ Gerador Pix Copia e Cola</button>
      <button class="tab-btn" onclick="switchTab('tab-chave')">🔑 Validador de Chave</button>
    </div>

    <div id="tab-decodificar" class="tab-content active">
      <div class="card">
        <h2 class="card-title">Análise de Código Pix Copia e Cola</h2>
        <p class="card-desc">Cole uma string Pix completa ou mensagem contendo Pix para inspecionar campos EMVCo, chave, recebedor, valor e autenticidade do CRC16.</p>
        
        <div class="input-group">
          <label for="input-pix">Código Pix Copia e Cola / QR Code</label>
          <textarea id="input-pix" placeholder="00020126...6304..."></textarea>
        </div>

        <div class="btn-row">
          <button class="btn" onclick="analisarPix()">🚀 Analisar Código Pix</button>
          <button class="btn btn-secondary" onclick="carregarExemplo('estatico')">Exemplo Estático</button>
          <button class="btn btn-secondary" onclick="carregarExemplo('dinamico')">Exemplo Dinâmico</button>
          <button class="btn btn-secondary" onclick="carregarExemplo('fraude')">Simular Adulteração/Fraude</button>
        </div>
      </div>

      <div id="resultado-decodificacao" style="display: none;">
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="font-size: 1.2rem;">Resultado da Auditoria EMVCo</h3>
            <span id="badge-status-pix" class="tag-status"></span>
          </div>

          <div class="grid-4">
            <div class="stat-box">
              <div class="stat-label">Valor da Transação</div>
              <div id="res-valor" class="stat-val" style="color: var(--primary);">--</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Chave Pix</div>
              <div id="res-chave" class="stat-val mono">--</div>
              <div id="res-tipo-chave" style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">--</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Beneficiário</div>
              <div id="res-beneficiario" class="stat-val">--</div>
              <div id="res-cidade" style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">--</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Identificador (TXID)</div>
              <div id="res-txid" class="stat-val mono">--</div>
            </div>
          </div>

          <div class="grid-2" style="margin-top: 20px;">
            <div class="stat-box">
              <div class="stat-label">Integridade do CRC16 (Tag 63)</div>
              <div id="res-crc" class="stat-val mono" style="font-size: 1rem;">--</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Tipo de Payload</div>
              <div id="res-tipo-payload" class="stat-val" style="font-size: 1rem;">--</div>
            </div>
          </div>

          <pre id="res-json-view"></pre>
        </div>
      </div>
    </div>

    <div id="tab-gerar" class="tab-content">
      <div class="card">
        <h2 class="card-title">Gerar Código Pix Copia e Cola Oficial</h2>
        <p class="card-desc">Crie payloads Pix 100% compatíveis com todos os bancos com cálculo automático do CRC16 EMVCo.</p>
        
        <div class="grid-2">
          <div class="input-group">
            <label for="gen-chave">Chave Pix</label>
            <input type="text" id="gen-chave" value="contato@empresa.com.br">
          </div>
          <div class="input-group">
            <label for="gen-nome">Nome do Beneficiário (Máx 25 chars)</label>
            <input type="text" id="gen-nome" value="MINHA EMPRESA TECH">
          </div>
        </div>

        <div class="grid-2">
          <div class="input-group">
            <label for="gen-cidade">Cidade do Beneficiário</label>
            <input type="text" id="gen-cidade" value="SAO PAULO">
          </div>
          <div class="input-group">
            <label for="gen-valor">Valor em R$</label>
            <input type="number" id="gen-valor" step="0.01" value="49.90">
          </div>
        </div>

        <div class="btn-row">
          <button class="btn" onclick="gerarCodigoPix()">⚡ Gerar Pix Copia e Cola</button>
        </div>
      </div>

      <div id="resultado-gerador" style="display: none;">
        <div class="card">
          <h3 style="font-size: 1.2rem; margin-bottom: 16px;">Código Gerado</h3>
          <div class="input-group">
            <textarea id="gen-payload-output" readonly></textarea>
          </div>
        </div>
      </div>
    </div>

    <div id="tab-chave" class="tab-content">
      <div class="card">
        <h2 class="card-title">Auditoria e Validação de Chave Pix</h2>
        <div class="input-group">
          <label for="input-chave-teste">Digite a Chave Pix</label>
          <input type="text" id="input-chave-teste" placeholder="CPF, CNPJ, E-mail, Celular ou EVP">
        </div>
        <div class="btn-row">
          <button class="btn" onclick="validarChaveIsolada()">Auditar Chave</button>
        </div>
        <div id="res-chave-box" style="margin-top: 24px; display: none;">
          <pre id="res-chave-json"></pre>
        </div>
      </div>
    </div>
  </div>

  <script>
    function switchTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      const target = document.getElementById(tabId);
      if (target) target.classList.add('active');
      event.currentTarget.classList.add('active');
    }

    const EXEMPLOS = {
      estatico: "00020101021126670014br.gov.bcb.pix0117clepta2@gmail.com0224Pagamento Servicos Cloud5204000053039865406150.755802BR5911CLEPTA TECH6009SAO PAULO62140510FATURA102963044AEB",
      dinamico: "00020101021226760014br.gov.bcb.pix2554pix.banco.com.br/qr/v2/cobv/9a8b7c6d5e4f3a2b1c5204000053039865802BR5916E-COMMERCE BRASIL6014RIO DE JANEIRO62070503***63042079",
      fraude: "00020101021126670014br.gov.bcb.pix0117clepta2@gmail.com0224Pagamento Servicos Cloud5204000053039865406999.995802BR5911CLEPTA TECH6009SAO PAULO62140510FATURA102963044AEB"
    };

    function carregarExemplo(tipo) {
      document.getElementById('input-pix').value = EXEMPLOS[tipo] || '';
      analisarPix();
    }

    async function analisarPix() {
      const code = document.getElementById('input-pix').value.trim();
      if (!code) return alert('Cole um código Pix.');
      const resp = await fetch('/api/pix/decodificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: code })
      });
      const res = await resp.json();

      document.getElementById('resultado-decodificacao').style.display = 'block';
      const badge = document.getElementById('badge-status-pix');
      if (res.valido) {
        badge.className = 'tag-status tag-success';
        badge.innerHTML = '✔ Pix Válido &amp; Autêntico';
      } else {
        badge.className = 'tag-status tag-danger';
        badge.innerHTML = '✖ Inválido ou Adulterado';
      }

      document.getElementById('res-valor').textContent = res.transacao ? res.transacao.valorFormatado : 'R$ 0,00';
      document.getElementById('res-chave').textContent = res.chave && res.chave.valor ? res.chave.valor : (res.transacao && res.transacao.urlPayload ? 'Payload Dinâmico' : '--');
      document.getElementById('res-tipo-chave').textContent = res.chave ? ('Tipo: ' + res.chave.tipo) : '';
      document.getElementById('res-beneficiario').textContent = res.recebedor ? res.recebedor.nome : '--';
      document.getElementById('res-cidade').textContent = res.recebedor ? (res.recebedor.cidade + ' - ' + res.recebedor.pais) : '';
      document.getElementById('res-txid').textContent = res.transacao ? res.transacao.txid : '--';
      document.getElementById('res-crc').textContent = res.seguranca ? ('CRC: ' + res.seguranca.crcEsperado + ' | Calculado: ' + res.seguranca.crcCalculado) : '--';
      document.getElementById('res-tipo-payload').textContent = res.tipo || 'ESTÁTICO';
      document.getElementById('res-json-view').textContent = JSON.stringify(res, null, 2);
    }

    async function gerarCodigoPix() {
      const chave = document.getElementById('gen-chave').value.trim();
      const nome = document.getElementById('gen-nome').value.trim();
      const cidade = document.getElementById('gen-cidade').value.trim();
      const valor = parseFloat(document.getElementById('gen-valor').value || '0');

      const resp = await fetch('/api/pix/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave, nome, cidade, valor })
      });
      const res = await resp.json();

      if (!res.ok) return alert('Erro: ' + res.erro);
      document.getElementById('resultado-gerador').style.display = 'block';
      document.getElementById('gen-payload-output').value = res.payload;
    }

    async function validarChaveIsolada() {
      const chave = document.getElementById('input-chave-teste').value.trim();
      if (!chave) return alert('Informe a chave.');
      const resp = await fetch('/api/pix/chave?chave=' + encodeURIComponent(chave));
      const res = await resp.json();
      document.getElementById('res-chave-box').style.display = 'block';
      document.getElementById('res-chave-json').textContent = JSON.stringify(res, null, 2);
    }
  </script>
</body>
</html>`;
}
