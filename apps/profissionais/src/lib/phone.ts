/**
 * Telefone no formato que se lê em voz alta: (31) 99999-9999.
 *
 * Antes o campo era texto livre, então cada cadastro guardava de um jeito —
 * "31999999999", "31 9 9999 9999", "(31)99999999". No card do profissional
 * isso vira um borrão de números que a pessoa precisa decifrar antes de
 * ligar, e o link do WhatsApp montado a partir dele fica frágil.
 *
 * A máscara é aplicada enquanto a pessoa digita, e o que é guardado é o texto
 * formatado — apagar continua funcionando porque a função reformata a partir
 * dos dígitos, nunca do que estava escrito antes.
 */

export function onlyPhoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function formatPhone(value: string): string {
  const d = onlyPhoneDigits(value);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  // O corte do meio depende do tamanho: celular tem 9 dígitos depois do DDD,
  // fixo tem 8. Fixar em 5 quebraria o telefone fixo, que ainda é o número da
  // maioria das lojas da cidade.
  const meio = d.length <= 10 ? 4 : 5;
  if (d.length <= 2 + meio) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 2 + meio)}-${d.slice(2 + meio)}`;
}

/** Um telefone só serve se der para ligar: DDD + 8 ou 9 dígitos. */
export function isValidPhone(value: string): boolean {
  const d = onlyPhoneDigits(value);
  return d.length === 10 || d.length === 11;
}
