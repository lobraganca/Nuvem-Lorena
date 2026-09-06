import { supabase } from "./supabase";
import { gravarTolerando, lerTolerando } from "./colunasNovas";

/**
 * "Ainda está disponível?" — a pergunta para quem sumiu.
 *
 * A dona: "uma pessoa ficou 1 mês sem abrir o app. O Ei manda: 👋 ainda
 * está disponível? Encontramos 4 oportunidades que combinam com seu
 * perfil. [Sim, estou disponível]"
 *
 * ── O GANHO MAIOR NÃO É TRAZER A PESSOA DE VOLTA ──────────────────────
 *
 * É LIMPAR a base. Quem responde "não estou procurando" sai das listas na
 * hora, e a empresa para de ligar para quem já arrumou emprego ou mudou
 * de cidade. Um banco de talentos de 200 pessoas em que 60 não atendem
 * vale menos que um de 140 em que todas atendem — e a empresa que ligou
 * para três pessoas erradas seguidas não liga para a quarta.
 *
 * Por isso a pergunta tem DUAS respostas de verdade, e não um "ok" que só
 * fecha o aviso. A resposta "não" é tão útil quanto a "sim".
 *
 * ── QUANDO ELA APARECE ────────────────────────────────────────────────
 *
 * Ao abrir o app, se a última vez foi há mais de 30 dias. E ela NÃO
 * atualiza a data enquanto está na tela: se atualizasse, bastaria a
 * pessoa recarregar para a pergunta sumir sem resposta — e o cadastro
 * dela continuaria dizendo "disponível" sem ninguém ter confirmado. Só as
 * duas respostas mexem na data.
 *
 * ── O QUE ESTE ARQUIVO NÃO FAZ, E PRECISA ESTAR DITO ──────────────────
 *
 * Ele só age quando a pessoa ABRE o app. Alcançar quem não abre depende
 * de push, e push tem um limite que nenhuma linha de código contorna: só
 * chega a quem instalou E aceitou receber. Quem usa pelo navegador não
 * recebe nada e nunca vai saber que não recebeu (ver `push.ts`).
 *
 * Então esta é a metade que funciona para todo mundo. A outra metade —
 * o empurrão para quem nem abre — é um passo à parte, e vai depender da
 * fila de avisos e da rotina que a esvazia.
 */

/** Depois de quantos dias sem aparecer a pergunta é feita. */
export const DIAS_PARA_PERGUNTAR = 30;

/**
 * Uma vez por dia basta.
 *
 * Sem freio, cada abertura do app viraria uma gravação no banco — e o app
 * é aberto várias vezes por dia. A data serve para responder "faz mais de
 * um mês?", e para essa pergunta a precisão de um dia sobra.
 */
const CHAVE_ULTIMO_TOQUE = "ei-visto-em-gravado";

/** A coluna é da 0127 e pode ainda não existir no banco. */
const NOVAS = ["visto_em"];

export type SituacaoDeVolta = {
  /** Faz mais de 30 dias que a pessoa não aparece. */
  sumiu: boolean;
  /** Quantos dias, para a tela poder dizer. `null` quando não sabe. */
  diasSemAparecer: number | null;
};

/**
 * Faz quanto tempo esta pessoa não aparece?
 *
 * Devolve `sumiu: false` quando não dá para saber — sem a coluna (a 0127
 * não aplicada), sem cadastro, ou com erro. Perguntar "você sumiu?" por
 * causa de uma consulta que falhou é a pior versão desta tela: ela acusa
 * a pessoa de uma coisa que o app é que não sabe.
 */
export async function situacaoDeVolta(ownerId: string): Promise<SituacaoDeVolta> {
  const sb = supabase();
  if (!sb) return { sumiu: false, diasSemAparecer: null };

  const { data, error } = await lerTolerando<Array<Record<string, unknown>>>(
    "id, visto_em",
    NOVAS,
    (colunas) => sb.from("professionals").select(colunas).eq("owner_id", ownerId).limit(1)
  );

  if (error || !data || data.length === 0) return { sumiu: false, diasSemAparecer: null };

  const visto = data[0].visto_em;
  /* Sem a coluna, `lerTolerando` refez a consulta sem ela e o campo chega
     indefinido. Isso é "não sei", e "não sei" não pergunta nada. */
  if (typeof visto !== "string") return { sumiu: false, diasSemAparecer: null };

  const dias = Math.floor((Date.now() - new Date(visto).getTime()) / 86400000);
  if (!Number.isFinite(dias) || dias < 0) return { sumiu: false, diasSemAparecer: null };

  return { sumiu: dias >= DIAS_PARA_PERGUNTAR, diasSemAparecer: dias };
}

/**
 * Carimba "apareci hoje".
 *
 * `forcar` é para as duas respostas da pergunta: elas gravam mesmo que já
 * tenha gravado hoje, senão a pergunta voltaria na próxima abertura.
 */
export async function marcarQueApareci(ownerId: string, forcar = false): Promise<void> {
  if (!forcar) {
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem(CHAVE_ULTIMO_TOQUE) === hoje) return;
      localStorage.setItem(CHAVE_ULTIMO_TOQUE, hoje);
    } catch {
      /* Aba anônima recusa o armazenamento. Sem o freio ele grava a mais,
         que é o lado barato de errar. */
    }
  }

  const sb = supabase();
  if (!sb) return;
  /* Falha em silêncio de propósito: isto é contabilidade interna, e
     derrubar a abertura do app por causa dela seria trocar o essencial
     pelo acessório. `gravarTolerando` já escreve no console quando a
     coluna não existe. */
  await gravarTolerando({ visto_em: new Date().toISOString() }, NOVAS, (c) =>
    sb.from("professionals").update(c).eq("owner_id", ownerId)
  ).catch(() => undefined);
}

/**
 * "Sim, estou disponível."
 *
 * Além de carimbar a data, LIGA a disponibilidade de volta: quem some por
 * dois meses e volta dizendo que está disponível pode ter se marcado
 * indisponível antes de sumir, e a resposta é a mais recente das duas.
 */
export async function continuoDisponivel(ownerId: string): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  await gravarTolerando(
    { visto_em: new Date().toISOString(), disponivel: true },
    NOVAS,
    (c) => sb.from("professionals").update(c).eq("owner_id", ownerId)
  );
}

/**
 * "Não estou procurando agora."
 *
 * Sai das listas e para de receber onda, sem apagar nada: o cadastro
 * continua inteiro e voltar é um toque no próprio perfil. É a mesma
 * chave que a tela do cadastro já oferece — aqui ela só é oferecida no
 * momento em que a pergunta faz sentido.
 */
export async function naoEstouProcurando(ownerId: string): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  await gravarTolerando(
    { visto_em: new Date().toISOString(), disponivel: false },
    NOVAS,
    (c) => sb.from("professionals").update(c).eq("owner_id", ownerId)
  );
}
