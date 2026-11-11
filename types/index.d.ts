/**
 * PixValidatorPro TypeScript Definitions
 * @license MIT
 * @author clepta2
 */

export type PixTipo = 'ESTATICO' | 'DINAMICO';
export type PixTipoChave = 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'EVP' | 'URL' | 'DESCONHECIDO';

export interface PixChaveResultado {
  valor: string;
  tipo: PixTipoChave;
  valida: boolean;
}

export interface PixRecebedor {
  nome: string;
  cidade: string;
  cep: string | null;
  pais: string;
}

export interface PixTransacao {
  valor: number | null;
  valorFormatado: string;
  moeda: string;
  txid: string;
  infoAdicional: string | null;
  urlPayload: string | null;
}

export interface PixSeguranca {
  crcEsperado: string;
  crcCalculado: string;
  crcValido: boolean;
  erros: string[] | null;
}

export interface PixDecodificacaoResultado {
  ok: boolean;
  valido: boolean;
  tipo?: PixTipo;
  chave?: PixChaveResultado;
  recebedor?: PixRecebedor;
  transacao?: PixTransacao;
  seguranca?: PixSeguranca;
  tamanhoPayload?: number;
  payload?: string;
  erro?: string;
}

export interface PixValidacaoChaveResultado {
  valido: boolean;
  tipo: PixTipoChave;
  chaveOriginal: string;
  chaveLimpa: string;
  erro?: string;
}

export interface PixGeracaoOpcoes {
  chave?: string;
  nome?: string;
  cidade?: string;
  valor?: number | null;
  txid?: string;
  infoAdicional?: string;
  cep?: string;
  tipo?: PixTipo;
  urlPayload?: string;
}

export interface PixGeracaoResultado {
  ok: boolean;
  valido: boolean;
  payload: string;
  crc16: string;
  tipo?: PixTipo;
  chave?: string;
  nome?: string;
  cidade?: string;
  valor?: number | null;
  txid?: string;
  erro?: string;
}

export interface PixAuditoria {
  hash: string;
  timestamp: string;
  algoritmo: string;
}

export class PixValidatorPro {
  static calcularCrc16(payload: string): string;
  static sanitizarTexto(text: string): string;
  static formatarTlv(id: string, valor: string | number): string;
  static parseTlv(rawString: string): Array<{ tag: string; length: number; value: string }>;
  static identificarTipoChave(chave: string): PixTipoChave;
  static validarChave(chave: string): PixValidacaoChaveResultado;
  static decodificar(payload: string): PixDecodificacaoResultado;
  static gerarPix(params?: PixGeracaoOpcoes): PixGeracaoResultado;
  static extrairDeTexto(texto: string): PixDecodificacaoResultado[];
  static gerarHashAuditoria(payload: string, ip?: string): PixAuditoria;
}

export default PixValidatorPro;
