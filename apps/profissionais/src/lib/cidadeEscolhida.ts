import { DEFAULT_CITY } from "../types/domain";

/**
 * Em que cidade a pessoa está olhando.
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "o app pode não ter só a abrangência em Itabirito, talvez
 * tenhamos que criar um filtro para a pessoa escolher a cidade (de acordo
 * com as que tem cadastradas) em algum lugar do app. Tanto para os
 * candidatos verem a vaga quanto as empresas verem os candidatos."
 *
 * ── O que estava travado ──────────────────────────────────────────────
 *
 * O banco de talentos pedia `.eq("city", "Itabirito")` direto na consulta.
 * Quem se cadastrou em Ouro Preto existia no banco e não aparecia para
 * ninguém, para sempre, sem nada na tela que explicasse — e sem nada que
 * a pessoa pudesse fazer a respeito. O banco de VAGAS nunca teve essa
 * trava: ele já lê todas as cidades e oferece as que têm vaga.
 *
 * ── Como a cidade é escolhida, em ordem ───────────────────────────────
 *
 *   1. o que está na URL (`?c=`), porque filtro que não mora na URL some
 *      ao voltar de um perfil — defeito que este projeto já pagou caro;
 *   2. o que a pessoa escolheu da última vez, guardado no aparelho;
 *   3. a cidade do próprio cadastro dela;
 *   4. Itabirito.
 *
 * A ordem importa: quem mora em Congonhas e escolheu Congonhas ontem não
 * pode reabrir o app em Itabirito. E quem nunca escolheu nada abre na
 * cidade DELA, não na do app — é a diferença entre "este app é da minha
 * cidade" e "este app é de outro lugar e eu tenho que procurar a minha".
 *
 * ── "Todas as cidades" é uma escolha legítima ─────────────────────────
 *
 * Guardada como string vazia. Numa cidade pequena muita gente aceita
 * trabalhar na vizinha, e uma lista travada na própria cidade esconde
 * justamente a vaga que fica a vinte minutos de ônibus.
 */

const CHAVE = "ei-cidade-escolhida";

/** O que "todas as cidades" vale na URL e no armazenamento. */
export const TODAS_AS_CIDADES = "";

/** A última cidade escolhida neste aparelho, se houver. */
export function cidadeGuardada(): string | null {
  try {
    const v = localStorage.getItem(CHAVE);
    /* `null` é "nunca escolheu"; `""` é "escolheu todas". São coisas
       diferentes, e confundi-las faria "todas" virar a cidade padrão a
       cada recarga. */
    return v === null ? null : v;
  } catch {
    return null;
  }
}

export function guardarCidade(cidade: string): void {
  try {
    localStorage.setItem(CHAVE, cidade);
  } catch {
    /* Navegador com armazenamento bloqueado: a escolha vale só para esta
       navegação, pela URL. Nada quebra. */
  }
}

/**
 * A cidade que a tela deve mostrar agora.
 *
 * `naUrl` é o `?c=` (ou `null` quando não há), e `daPessoa` é a cidade do
 * cadastro dela (ou `null` enquanto não se sabe).
 */
export function cidadeParaMostrar(
  naUrl: string | null,
  daPessoa: string | null
): string {
  if (naUrl !== null) return naUrl;
  const guardada = cidadeGuardada();
  if (guardada !== null) return guardada;
  return daPessoa || DEFAULT_CITY;
}

/** "Itabirito" ou "Todas as cidades", para escrever num botão. */
export function nomeDaCidade(cidade: string): string {
  return cidade || "Todas as cidades";
}
