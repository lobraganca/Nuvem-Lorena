/**
 * O mínimo para escrever teste neste projeto.
 *
 * ── Por que não um framework ──────────────────────────────────────────
 *
 * O app não tem nenhum instalado, e instalar um (vitest, jest) traz
 * dezenas de pacotes para rodar o que cabe em quarenta linhas. O Node 22
 * já executa TypeScript direto (`--experimental-strip-types`), então o
 * teste importa o código de verdade — não uma cópia dele.
 *
 * O que se ganha com isso é o que importa: a conta de compatibilidade, a
 * tolerância a coluna nova e as regras de faixa passam a ter teste que
 * roda em segundos, sem navegador e sem banco.
 */

let passou = 0;
let falhou = 0;
const falhas: string[] = [];
let grupoAtual = "";

export function grupo(nome: string) {
  grupoAtual = nome;
  console.log(`\n── ${nome}`);
}

/**
 * Um teste. Aceita função normal ou `async`.
 *
 * O `await` não é detalhe: sem ele, um teste `async` que falha vira uma
 * promessa recusada que ninguém pega — o runner escreve "ok" e a suíte
 * mente. Foi o primeiro defeito encontrado nesta própria ajuda.
 *
 * Os testes rodam em FILA por isso mesmo: quem chama junta as promessas
 * com `await` no fim (ver `resumo`).
 */
const fila: Promise<void>[] = [];

export function teste(nome: string, fn: () => void | Promise<void>) {
  const rodada = (async () => {
    try {
      await fn();
      passou++;
      console.log(`   ok    ${nome}`);
    } catch (err) {
      falhou++;
      const msg = err instanceof Error ? err.message : String(err);
      falhas.push(`${grupoAtual} › ${nome}: ${msg}`);
      console.log(`   FALHA ${nome}`);
      console.log(`         ${msg}`);
    }
  })();
  fila.push(rodada);
}

export function igual<T>(achado: T, esperado: T, oQue = "") {
  const a = JSON.stringify(achado);
  const e = JSON.stringify(esperado);
  if (a !== e) throw new Error(`${oQue ? oQue + ": " : ""}esperava ${e}, veio ${a}`);
}

export function verdade(condicao: boolean, oQue: string) {
  if (!condicao) throw new Error(oQue);
}

export function entre(achado: number, de: number, ate: number, oQue = "") {
  if (achado < de || achado > ate) {
    throw new Error(`${oQue ? oQue + ": " : ""}esperava entre ${de} e ${ate}, veio ${achado}`);
  }
}

/** Espera a fila e devolve o código de saída (0 = tudo passou). */
export async function resumo(): Promise<number> {
  await Promise.all(fila);
  console.log(`\n${passou} passaram, ${falhou} falharam`);
  for (const f of falhas) console.log(`   ✗ ${f}`);
  return falhou === 0 ? 0 : 1;
}
