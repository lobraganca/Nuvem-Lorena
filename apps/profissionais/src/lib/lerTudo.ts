/**
 * Ler uma tabela inteira, em pedaços, quando o total importa.
 *
 * Existe por um defeito que este próprio projeto introduziu ao se
 * proteger. A migration 0062 pôs um teto de 200 linhas por consulta, para
 * ninguém baixar a base de contatos de uma vez — e o teto vale para TODAS
 * as consultas, inclusive as do painel administrativo, que carregam a
 * tabela e contam no navegador.
 *
 * O efeito seria o pior que existe: nada de erro, nada de aviso. O total
 * de cadastros pararia em 200 e o total recebido pararia no ducentésimo
 * pagamento, para sempre, sem nada na tela sugerindo que aquele número
 * deixou de ser verdade. Quem olha um painel não tem como desconfiar de um
 * número que simplesmente não sobe mais.
 *
 * Aqui a leitura é feita em páginas até acabar. Fica imune ao teto — e
 * também a qualquer teto futuro, que é o ponto: um limite ajustado no
 * painel do Supabase não pode voltar a estragar as contas em silêncio.
 *
 * O `LIMITE_DE_SEGURANCA` não é desconfiança do laço, é desconfiança de
 * mim: um filtro escrito errado que devolvesse sempre a mesma página
 * viraria um laço infinito com o celular da pessoa girando. Estourado, ele
 * ERRA em vez de devolver conta pela metade — porque devolver a metade é
 * de novo o número que mente calado.
 */

const TAMANHO_DA_PAGINA = 1000;
const LIMITE_DE_SEGURANCA = 100_000;

type Consulta<T> = {
  range: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>;
};

export async function lerTudo<T>(fazerConsulta: () => Consulta<T>): Promise<T[]> {
  const tudo: T[] = [];
  let de = 0;

  for (;;) {
    const { data, error } = await fazerConsulta().range(de, de + TAMANHO_DA_PAGINA - 1);
    if (error) throw error;
    const pagina = data ?? [];
    tudo.push(...pagina);

    /* Menos que uma página cheia significa fim. É mais confiável que
       comparar com um total pedido à parte: entre as duas consultas alguém
       pode cadastrar, e aí o total nunca bate e o laço não termina. */
    if (pagina.length < TAMANHO_DA_PAGINA) return tudo;

    de += TAMANHO_DA_PAGINA;
    if (de >= LIMITE_DE_SEGURANCA) {
      throw new Error(
        `Leitura interrompida em ${LIMITE_DE_SEGURANCA} linhas. ` +
          "É muito mais do que o esperado — o número na tela seria mentira, então nenhum é mostrado."
      );
    }
  }
}
