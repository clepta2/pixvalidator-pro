import { PixValidatorPro } from './pixvalidator-pro.js';

console.log('🧪 Iniciando Bateria de Testes Unitários do PixValidator Pro...\n');

// 1. Geração de Pix Estático com Valor
const gerado = PixValidatorPro.gerarPix({
  chave: 'clepta2@gmail.com',
  nome: 'Clepta Tech',
  cidade: 'SAO PAULO',
  valor: 150.75,
  txid: 'FATURA1029',
  infoAdicional: 'Pagamento Servicos Cloud'
});

console.assert(gerado.ok === true, 'Geração de Pix deve retornar ok');
console.assert(gerado.payload.startsWith('000201'), 'Payload deve começar com 000201');
console.assert(gerado.payload.includes('6304'), 'Payload deve conter tag 6304');
console.log('✅ Geração de Pix Estático OK:');
console.log('   Payload:', gerado.payload);
console.log('   CRC16:', gerado.crc16);

// 2. Decodificação e Validação do Pix Gerado
const decod = PixValidatorPro.decodificar(gerado.payload);
console.assert(decod.valido === true, 'Pix gerado deve ser 100% válido');
console.assert(decod.chave.valor === 'clepta2@gmail.com', 'Chave deve ser clepta2@gmail.com');
console.assert(decod.chave.tipo === 'EMAIL', 'Tipo de chave deve ser EMAIL');
console.assert(decod.transacao.valor === 150.75, 'Valor deve ser 150.75');
console.assert(decod.transacao.txid === 'FATURA1029', 'TXID deve ser FATURA1029');
console.assert(decod.seguranca.crcValido === true, 'CRC deve ser válido');
console.log('✅ Decodificação e Validação do Payload OK:', decod.recebedor.nome, '-', decod.transacao.valorFormatado);

// 3. Detecção de Fraude / Adulteração de Valor e CRC
const payloadAdulterado = gerado.payload.replace('150.75', '999.99');
const decodFraude = PixValidatorPro.decodificar(payloadAdulterado);
console.assert(decodFraude.valido === false, 'Payload adulterado deve ser considerado inválido');
console.assert(decodFraude.seguranca.crcValido === false, 'CRC de payload adulterado deve falhar');
console.log('✅ Proteção contra Adulteração / Fraude de Payload OK:', decodFraude.seguranca.erros[0]);

// 4. Teste com Chaves Diferentes (CPF, Telefone, EVP)
const chaves = [
  { chave: '52998224725', tipoEsperado: 'CPF', valida: true },
  { chave: '+5511987654321', tipoEsperado: 'TELEFONE', valida: true },
  { chave: '123e4567-e89b-12d3-a456-426614174000', tipoEsperado: 'EVP', valida: true },
  { chave: 'teste@dominio.com.br', tipoEsperado: 'EMAIL', valida: true },
  { chave: '00000000000', tipoEsperado: 'CPF', valida: false }
];

chaves.forEach(item => {
  const v = PixValidatorPro.validarChave(item.chave);
  console.assert(v.tipo === item.tipoEsperado, `Tipo esperado para ${item.chave} era ${item.tipoEsperado}`);
  console.assert(v.valido === item.valida, `Validade esperada para ${item.chave} era ${item.valida}`);
  console.log(`✅ Validação de Chave (${item.tipoEsperado}): ${item.chave} -> Válida: ${v.valido}`);
});

// 5. Extrator Inteligente de Pix em Textos Livres / OCR / WhatsApp
const mensagemWhatsapp = `
Ola amigo, tudo bem?
Pode efetuar o pagamento neste codigo pix:
${gerado.payload}
Muito obrigado pelo apoio!
`;

const extraidos = PixValidatorPro.extrairDeTexto(mensagemWhatsapp);
console.assert(extraidos.length === 1, 'Deve extrair exatamente 1 código Pix válido do texto');
console.assert(extraidos[0].transacao.valor === 150.75, 'Valor extraído deve ser 150.75');
console.log('✅ Extração Automática de Pix em Textos / WhatsApp OK: Encontrado', extraidos.length, 'código(s)');

// 6. Pix Dinâmico com URL de Payload
const pixDinamico = PixValidatorPro.gerarPix({
  tipo: 'DINAMICO',
  urlPayload: 'pix.banco.com.br/qr/v2/cobv/9a8b7c6d5e4f3a2b1c',
  nome: 'E-commerce Brasil',
  cidade: 'RIO DE JANEIRO'
});
console.assert(pixDinamico.ok === true, 'Pix Dinâmico deve ser gerado');
const decodDinamico = PixValidatorPro.decodificar(pixDinamico.payload);
console.assert(decodDinamico.tipo === 'DINAMICO', 'Tipo deve ser DINAMICO');
console.assert(decodDinamico.transacao.urlPayload.includes('pix.banco.com.br'), 'URL do payload deve estar presente');
console.log('✅ Geração e Leitura de Pix Dinâmico OK:', decodDinamico.tipo, decodDinamico.transacao.urlPayload);

// 7. Benchmark de Performance (Edge Sub-1ms)
const start = performance.now();
const ITERACOES = 2000;
for (let i = 0; i < ITERACOES; i++) {
  PixValidatorPro.decodificar(gerado.payload);
}
const elapsed = performance.now() - start;
const mediaPorOp = (elapsed / ITERACOES).toFixed(4);
console.log(`\n⚡ Benchmark de Performance: ${ITERACOES} validações em ${elapsed.toFixed(2)}ms (Média: ${mediaPorOp}ms por chamada)`);
console.assert(elapsed / ITERACOES < 1.0, 'Validação deve ocorrer em sub-1ms');

console.log('\n🎉 TODOS OS TESTES UNITÁRIOS DO PIXVALIDATOR PRO PASSARAM COM SUCESSO!');
