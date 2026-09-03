/**
 * Quando o app conhece uma coluna que o banco ainda não tem.
 *
 * ── O problema, que já custou um dia inteiro ──────────────────────────
 *
 * As migrations deste projeto são aplicadas À MÃO, pela dona, colando SQL
 * no painel do Supabase. O código, não: ele sobe sozinho a cada envio. As
 * duas coisas andam em velocidades diferentes, e é aí que mora o defeito
 * mais caro que este app já teve.
 *
 * A 0060 acrescentou a coluna `uf`. O código que a envia foi publicado às
 * 6h40; a coluna passou a existir por volta das 21h. Nesse intervalo o
 * formulário mandava uma coluna que o banco não conhecia — e o PostgREST
 * não ignora o campo a mais: ele recusa a gravação INTEIRA. Ninguém
 * conseguiu se cadastrar por catorze horas, e a tela dizia só "não
 * consegui salvar".
 *
 * A regra que saiu dali ("SQL primeiro, confirmação, e só então o
 * código") continua valendo e é a ordem certa. Só que ela depende de
 * alguém lembrar, todas as vezes, para sempre — e o preço de esquecer uma
 * vez é o app parado.
 *
 * ── O que este arquivo faz ────────────────────────────────────────────
 *
 * Deixa o app continuar funcionando no intervalo. A gravação (ou a
 * leitura) é tentada com as colunas novas; se o banco responder "não
 * conheço essa coluna", ela é refeita SEM elas. O resto grava, e o campo
 * novo simplesmente não existe até a SQL ser aplicada — que é exatamente
 * o que aconteceria se o app fosse o de ontem.
 *
 * Não substitui a ordem certa: a coluna nova continua sem valer nada
 * enquanto a SQL não for aplicada. O que ele impede é o dano
 * COLATERAL — o cadastro inteiro, a vaga inteira, a lista inteira caindo
 * por causa de um campo que ninguém preencheu ainda.
 *
 * ── Uma tentativa só, e nunca em silêncio ─────────────────────────────
 *
 * A segunda tentativa não repete: se ela falhar, o erro sobe como
 * sempre. E cada retirada escreve no console qual coluna faltou, porque
 * uma coisa é o app aguentar o intervalo, outra é ninguém nunca ficar
 * sabendo que a SQL não foi aplicada.
 */

/**
 * O banco disse "não conheço essa coluna"?
 *
 * São dois jeitos de o Supabase dizer isso, e os dois aparecem:
 *   42703      — o Postgres, na resposta de um `insert`/`update`
 *   PGRST204   — o PostgREST, quando a coluna não está no cache do schema
 *
 * A conferência pelo TEXTO existe porque a mensagem chega em inglês e o
 * código nem sempre vem: `err instanceof Error` também não vale aqui —
 * erro do Supabase é objeto solto com `message` e `code` (ver `erros.ts`).
 */
export function erroDeColunaDesconhecida(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (e.code === "42703" || e.code === "PGRST204") return true;
  const msg = (e.message ?? "").toLowerCase();
  return (
    msg.includes("column") &&
    (msg.includes("does not exist") || msg.includes("could not find") || msg.includes("schema cache"))
  );
}

/**
 * Grava, e refaz sem as colunas novas se o banco não as conhecer.
 *
 * `gravar` recebe os campos e devolve o erro do Supabase (ou nulo) — a
 * mesma forma que `.insert()` e `.update()` devolvem, para quem chama não
 * precisar traduzir nada.
 */
export async function gravarTolerando<T>(
  campos: Record<string, unknown>,
  novas: string[],
  gravar: (campos: Record<string, unknown>) => PromiseLike<any>
): Promise<{ data?: T | null; error: unknown }> {
  const primeira = await gravar(campos);
  if (!primeira.error || !erroDeColunaDesconhecida(primeira.error)) return primeira;

  const enxuto: Record<string, unknown> = { ...campos };
  for (const c of novas) delete enxuto[c];

  console.warn(
    `[colunas novas] o banco não conhece ${novas.join(", ")} — gravando sem elas. ` +
      "Falta aplicar a migration correspondente."
  );
  return gravar(enxuto);
}

/**
 * Lê, e refaz sem as colunas novas se o banco não as conhecer.
 *
 * `ler` recebe a lista de colunas já pronta (uma string, como o
 * `select()` quer) e devolve o mesmo formato do Supabase.
 */
export async function lerTolerando<T>(
  colunas: string,
  novas: string[],
  /* `PromiseLike` e não `Promise`: o construtor de consulta do
     supabase-js não é uma promessa de verdade — ele só tem `then`, e vira
     promessa quando alguém o aguarda. Pedir `Promise` aqui obrigaria toda
     chamada a embrulhar a consulta num `await` extra só para agradar a
     conferência de tipos. */
  /* O retorno é `any` de propósito: com a lista de colunas montada em
     tempo de execução, o supabase-js não consegue inferir o formato da
     resposta e devolve um tipo genérico que não casa com nada. Quem
     chama diz o que espera pelo `T`. */
  ler: (colunas: string) => PromiseLike<any>
): Promise<{ data?: T | null; error: unknown }> {
  const primeira = await ler(colunas);
  if (!primeira.error || !erroDeColunaDesconhecida(primeira.error)) return primeira;

  /* Tira cada coluna nova da lista. A vírgula que sobra é limpa no fim:
     "a, b, c" sem o `b` vira "a, , c", e o PostgREST recusa a lista
     inteira por causa do vazio no meio — o conserto viraria o defeito. */
  let enxuta = colunas;
  for (const c of novas) {
    enxuta = enxuta.replace(new RegExp(`(^|[\\s,])${c}(?=[\\s,]|$)`, "g"), "$1");
  }
  enxuta = enxuta
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .join(", ");

  console.warn(
    `[colunas novas] o banco não conhece ${novas.join(", ")} — lendo sem elas. ` +
      "Falta aplicar a migration correspondente."
  );
  return ler(enxuta);
}

/**
 * Qual lista de colunas o banco aceita hoje: a completa, ou a sem as
 * novas.
 *
 * Existe por causa da leitura em páginas (`lerTudo`): ali a consulta é
 * refeita várias vezes, e descobrir no meio do caminho que uma coluna não
 * existe obrigaria a recomeçar a paginação inteira. Aqui a pergunta é
 * feita UMA vez, com uma linha só, e a resposta serve para todas as
 * páginas.
 */
export async function colunasQueExistem(
  colunas: string,
  novas: string[],
  provar: (colunas: string) => PromiseLike<any>
): Promise<string> {
  const { error } = await provar(colunas);
  if (!error || !erroDeColunaDesconhecida(error)) return colunas;

  let enxuta = colunas;
  for (const c of novas) {
    enxuta = enxuta.replace(new RegExp(`(^|[\\s,])${c}(?=[\\s,]|$)`, "g"), "$1");
  }
  enxuta = enxuta
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .join(", ");

  console.warn(
    `[colunas novas] o banco não conhece ${novas.join(", ")} — lendo sem elas. ` +
      "Falta aplicar a migration correspondente."
  );
  return enxuta;
}
