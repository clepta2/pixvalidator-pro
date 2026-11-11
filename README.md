# 💠 PixValidator Pro — SDK & Documentação de Integração

> **Cliente SDK e Documentação Oficial de Integração da API PixValidator Pro.**  
> 🔒 **Atenção:** Este repositório destina-se à visualização de documentação técnica, tipos TypeScript e integração do cliente SDK. O serviço de API em nuvem é operado na borda Cloudflare Anycast através do nosso **Site de APIs**.

[![Status](https://img.shields.io/badge/Status-Cloudflare%20Edge%20API-success.svg)](#)
[![CI/CD Tests](https://github.com/clepta2/pixvalidator-pro/actions/workflows/test.yml/badge.svg)](https://github.com/clepta2/pixvalidator-pro/actions)
[![Padrão](https://img.shields.io/badge/Padrão-Bacen%20%2F%20EMVCo%20MPM-blue.svg)](#)
[![Algoritmo](https://img.shields.io/badge/Algoritmo-CRC16--CCITT%200x1021-emerald.svg)](#)
[![Velocidade](https://img.shields.io/badge/Latência-Sub--1ms%20RAM-purple.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## ⚡ O que é o PixValidator Pro?

O **PixValidator Pro** é uma solução de alta performance em borda e SDK de zero dependências para:
- **Decodificação instantânea de Pix Copia e Cola / QR Code EMVCo** (extração de Chave, Valor, Recebedor, Cidade e TXID)
- **Prevenção de Golpes e Fraudes em Pagamentos** (Auditoria de integridade matemática do CRC16-CCITT da Tag 63)
- **Geração Oficial de Códigos Pix Copia e Cola Estáticos e Dinâmicos**
- **Validação Isolada de Chaves Pix** (Dígitos verificadores de CPF e CNPJ, telefones celulares E.164, e-mails RFC e EVPs)
- **Extrator Inteligente de Pix em Conversas** (Captura automática de Pix dentro de mensagens WhatsApp, comprovantes e textos livres)

A validação pode rodar **100% no cliente em memória RAM (<0.1ms)** ou via **API Oficial na nuvem**.

---

## 🚀 Como Integrar em seu Projeto

### 1. Instalação

```bash
npm install pixvalidator-pro
```

*(Ou utilize o arquivo `pixvalidator-pro.js` diretamente no navegador ou Node.js sem necessidade de build ou dependências)*.

### 2. Uso Rápido com o SDK (Local em RAM - 0ms de Rede)

```javascript
import { PixValidatorPro } from 'pixvalidator-pro';

// 1. Decodificar e Auditar Pix Copia e Cola
const resultado = PixValidatorPro.decodificar('00020101021126670014br.gov.bcb.pix0117clepta2@gmail.com520400005303986540549.905802BR5911CLEPTA TECH6009SAO PAULO62140510FATURA102963044AEB');

console.log(resultado.valido); // true
console.log(resultado.transacao.valorFormatado); // "R$ 49,90"
console.log(resultado.chave.valor); // "clepta2@gmail.com"
console.log(resultado.chave.tipo); // "EMAIL"
console.log(resultado.recebedor.nome); // "CLEPTA TECH"
console.log(resultado.seguranca.crcValido); // true (Autêntico e íntegro)

// 2. Gerar Código Pix Copia e Cola Oficial
const novoPix = PixValidatorPro.gerarPix({
  chave: 'sua-chave@empresa.com.br',
  nome: 'MINHA EMPRESA LTDA',
  cidade: 'SAO PAULO',
  valor: 120.00,
  txid: 'PEDIDO9912',
  infoAdicional: 'Assinatura Mensal'
});

console.log(novoPix.payload); // String completa pronta para copiar e colar
```

### 3. Chamadas HTTP Diretas via Curl

```bash
# Decodificar e validar integridade do Pix
curl -X POST "https://pixvalidator-pro-api.diffstore264.workers.dev/api/pix/decodificar" \
  -H "Content-Type: application/json" \
  -d '{"codigo": "00020101021126670014br.gov.bcb.pix0117clepta2@gmail.com520400005303986540549.905802BR5911CLEPTA TECH6009SAO PAULO62140510FATURA102963044AEB"}'

# Gerar novo código Pix Copia e Cola
curl -X POST "https://pixvalidator-pro-api.diffstore264.workers.dev/api/pix/gerar" \
  -H "Content-Type: application/json" \
  -d '{
    "chave": "clepta2@gmail.com",
    "nome": "CLEPTA TECH",
    "cidade": "SAO PAULO",
    "valor": 150.00,
    "txid": "PEDIDO1029"
  }'

# Validação isolada de chave
curl -X GET "https://pixvalidator-pro-api.diffstore264.workers.dev/api/pix/chave?chave=52998224725"
```

---

## 🧪 Bateria de Testes

Para executar os testes unitários com validações de CRC16 e benchmarks de performance:

```bash
npm test
```

---

## 📄 Licença

Distribuído sob a licença [MIT](LICENSE).
