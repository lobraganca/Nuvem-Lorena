/**
 * Telefone celular brasileiro: conferir, arrumar e mostrar.
 *
 * Parece simples e não é. Um conserto anterior de limite de telefone, num
 * projeto vizinho, continuava deixando passar `+55 31 99999-8888` — um
 * número com um dígito a menos que passava porque a checagem contava os
 * caracteres da string, e a string tinha espaços e traço. Contar caractere
 * de telefone digitado é sempre errado: **conte dígito.**
 *
 * O formato que o Supabase Auth (e o Twilio atrás dele) exige é E.164:
 * `+5531999998888`, sem espaço, traço, parêntese ou ponto.
 *
 * Um celular brasileiro em E.164 tem exatamente 13 dígitos:
 *
 *     55        DDD       9 + 8 dígitos
 *     └ país    └ 2       └ 9 do celular
 *
 * O nono dígito é sempre 9 em celular. Fixo não recebe SMS, então fixo
 * aqui é erro — e o recado precisa dizer isso, porque quem digita o fixo
 * de casa não tem como adivinhar sozinho.
 */

/** Só os dígitos, sem nada mais. */
export function somenteDigitos(texto: string): string {
  return (texto ?? '').replace(/\D/g, '');
}

export type ResultadoDoTelefone =
  | { valido: true; e164: string }
  | { valido: false; motivo: string };

/**
 * Confere e devolve no formato que o Auth aceita.
 *
 * Aceita o número com ou sem o 55 na frente, com ou sem enfeite:
 * `(31) 99999-8888`, `31999998888` e `+55 31 99999-8888` viram todos
 * `+5531999998888`.
 */
export function paraE164(digitado: string): ResultadoDoTelefone {
  let d = somenteDigitos(digitado);

  if (d.length === 0) return { valido: false, motivo: 'Digite seu número de celular.' };

  // Alguns teclados mandam o 0 de operadora na frente (0 31 9...). Ele não
  // faz parte do número.
  if (d.length > 11 && d.startsWith('0')) d = d.slice(1);

  // Sem o código do país: 11 dígitos é DDD + celular.
  if (d.length === 11) d = '55' + d;

  // Dez dígitos são DDD + 8, e aí existem DOIS casos completamente
  // diferentes que exigem recados diferentes. A primeira versão tratava os
  // dois como fixo, e a foto da tela mostrou o problema: `(31) 9999-8888`
  // levava "use um celular" — dito para alguém que ESTAVA usando o celular,
  // só que sem o nono dígito. O recado mandava procurar o defeito onde ele
  // não estava.
  //
  // O que separa os dois é o primeiro dígito do número local:
  //   9        -> celular a que falta o nono dígito (o caso comum hoje)
  //   2,3,4,5  -> fixo de verdade
  if (d.length === 10) {
    const primeiroLocal = d[2];
    if (primeiroLocal === '9') {
      return {
        valido: false,
        motivo: 'Falta um dígito. Celular tem 9 dígitos depois do DDD — confira se não esqueceu o 9 da frente.',
      };
    }
    return {
      valido: false,
      motivo: 'Esse parece ser um telefone fixo. Use um celular, porque o código chega por SMS.',
    };
  }

  // A ordem daqui em diante importa, e ela foi corrigida depois do teste:
  // a checagem do país vinha antes da contagem, então um número brasileiro
  // com um dígito a mais (erro de digitação comuníssimo) caía em "só
  // aceitamos número do Brasil" — um recado que manda a pessoa procurar o
  // problema exatamente onde ele não está.
  //
  // Agora quem não começa com 55 recebe um recado que serve para os dois
  // casos possíveis, porque daqui não dá para saber qual é: pode ser um
  // número de fora, pode ser um dedo escorregando. Afirmar um dos dois
  // seria chutar.
  if (!d.startsWith('55')) {
    return {
      valido: false,
      motivo: 'Esse número não parece um celular brasileiro. Confira o DDD e os 9 dígitos.',
    };
  }

  if (d.length !== 13) {
    return {
      valido: false,
      motivo:
        d.length < 13
          ? 'Faltam dígitos no número. Confira o DDD e os 9 dígitos do celular.'
          : 'O número tem dígitos demais. Confira o DDD e os 9 dígitos do celular.',
    };
  }

  const ddd = d.slice(2, 4);
  // DDD brasileiro vai de 11 a 99, e nenhum começa com 0.
  if (Number(ddd) < 11) {
    return { valido: false, motivo: 'O DDD não parece certo. Confira os dois primeiros dígitos.' };
  }

  // Celular sempre começa com 9 depois do DDD. Um 10 dígitos já foi pego
  // acima; isto pega quem digitou 13 dígitos com um a mais no lugar errado.
  if (d[4] !== '9') {
    return { valido: false, motivo: 'Número de celular começa com 9 depois do DDD. Confira o número.' };
  }

  return { valido: true, e164: '+' + d };
}

/**
 * Como mostrar para a pessoa: `(31) 99999-8888`.
 *
 * Guardar em E.164 e mostrar bonito são coisas diferentes — o banco quer o
 * primeiro, os olhos querem o segundo.
 */
export function paraLeitura(e164OuDigitado: string): string {
  const d = somenteDigitos(e164OuDigitado);
  const semPais = d.startsWith('55') && d.length === 13 ? d.slice(2) : d;
  if (semPais.length !== 11) return e164OuDigitado;
  return `(${semPais.slice(0, 2)}) ${semPais.slice(2, 7)}-${semPais.slice(7)}`;
}

/**
 * Vai formatando enquanto a pessoa digita.
 *
 * Sem isto o campo mostra uma fileira de onze dígitos colados, e conferir
 * o próprio número vira trabalho. Formatar durante a digitação é o que faz
 * a pessoa perceber o dígito trocado antes de mandar.
 */
export function formatarEnquantoDigita(texto: string): string {
  const d = somenteDigitos(texto).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
