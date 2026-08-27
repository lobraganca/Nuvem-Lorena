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

/**
 * O telefone como o login o guarda vira o telefone como se lê aqui.
 *
 * Quem entra por SMS tem o número gravado em `auth.users.phone` no formato
 * internacional e sem o "+": `5531999998888`. Jogar isso direto no campo
 * dá `(55) 31999-9988` — o `onlyPhoneDigits` corta nos 11 primeiros
 * dígitos, e os 11 primeiros de um número com código de país são o país,
 * o DDD e metade da linha. O campo então já abre com um número errado, e
 * quem só confere de relance salva o errado.
 *
 * A conta que separa um caso do outro é o tamanho, não o começo: número
 * local tem 10 ou 11 dígitos, com código de país tem 12 ou 13. Olhar só
 * para o "55" inicial estragaria os números de Santa Maria, cujo DDD é
 * justamente 55.
 *
 * É de propósito que ela aceite os dois formatos e não mude nada quando já
 * está local: a coluna `phone` de `profiles` nasceu preenchida pela 0064 a
 * partir do login (internacional) e passa a receber o que a pessoa digita
 * (local), então as duas formas convivem lá dentro.
 */
export function doFormatoDoBanco(valor: string | null | undefined): string {
  const d = String(valor ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.length <= 13 && d.startsWith("55")) return d.slice(2);
  return d;
}

/** Um telefone só serve se der para ligar: DDD + 8 ou 9 dígitos. */
export function isValidPhone(value: string): boolean {
  const d = onlyPhoneDigits(value);
  return d.length === 10 || d.length === 11;
}

/**
 * É celular? DDD + 9 dígitos começando em 9.
 *
 * Desde 2016 todo celular do país tem esse formato, e o telefone fixo tem
 * oito dígitos depois do DDD. A diferença importa em um lugar: o código de
 * confirmação, que chega por SMS ou WhatsApp e portanto não chega nunca num
 * telefone fixo.
 *
 * O silêncio é o que torna isso grave. Mandar um SMS para um fixo não dá
 * erro em lugar nenhum — o provedor aceita o pedido, cobra por ele e a
 * mensagem simplesmente não existe do outro lado. Para quem está esperando,
 * é idêntico a "o app está quebrado": ele apertou o botão, a tela pediu o
 * código, e o código nunca veio.
 */
export function ehCelular(value: string): boolean {
  const d = onlyPhoneDigits(value);
  return d.length === 11 && d[2] === "9";
}
