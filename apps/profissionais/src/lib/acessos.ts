import { supabase } from "./supabase";

/**
 * Quantas pessoas abriram o app hoje, e por qual porta.
 *
 * ── O PEDIDO ───────────────────────────────────────────────────────────
 *
 * A dona: "quero ter no painel bem claramente 3 coisas: quantidade total
 * de acessos do dia; quantidade de pessoas que entraram em empresa e em
 * candidatos."
 *
 * ── UM ACESSO É UMA ABERTURA, NÃO UMA TELA ────────────────────────────
 *
 * Quem entra e navega por dez telas abriu o app uma vez. Contando telas, o
 * número viraria "quanto o app foi usado" — outra pergunta, que infla
 * sozinha quando alguém fica rolando a lista, e que não responde "quanta
 * gente veio hoje".
 *
 * Quem sabe distinguir isso é o `sessionStorage`: ele vive enquanto a aba
 * (ou o app instalado) está aberta e some quando ela fecha. Minimizar,
 * trocar de app, deixar a tela apagar a noite inteira — nada disso o
 * apaga. É a mesma técnica de `aberturaDoApp.ts`, com marca própria.
 *
 * ── A PORTA CHEGA DEPOIS, E É A MESMA LINHA ───────────────────────────
 *
 * A pessoa abre o app (um acesso), lê, e só então toca em "procuro
 * emprego". São dois momentos e uma visita só. Por isso o registro leva
 * uma marca sorteada: a segunda chamada ACRESCENTA a porta à linha que já
 * existe, em vez de criar outra.
 *
 * Com dois registros o total ficaria o dobro do real — e ninguém
 * desconfiaria, porque número que sobe rápido parece boa notícia.
 *
 * ── NADA DISSO IDENTIFICA NINGUÉM ─────────────────────────────────────
 *
 * A marca é um número sorteado que morre com a aba. Não vai telefone, não
 * vai conta, não vai endereço de rede. Para responder "quantos entraram
 * hoje" não é preciso saber quem — e o que não se guarda não vaza nem
 * precisa ser explicado na Política de Privacidade.
 *
 * ── E FALHAR AQUI NÃO PODE ATRAPALHAR NADA ────────────────────────────
 *
 * Isto é contagem, não funcionalidade. Banco fora do ar, migration ainda
 * não aplicada, armazenamento bloqueado numa aba anônima: em todos os
 * casos o app segue igual e o número é que fica sem saber. O contrário —
 * a tela travar porque o contador falhou — seria trocar o app pelo
 * relatório sobre o app.
 */

const MARCA = "ei-marca-do-acesso";

/** As palavras da DONA, e não as do banco ('company'/'professional'). */
export type PortaDeEntrada = "empresa" | "candidato";

export type AcessosDeHoje = {
  total: number;
  empresa: number;
  candidato: number;
  /** Abriu e não entrou por nenhuma das duas portas. */
  semEscolha: number;
};

/**
 * A marca desta abertura. Nasce sorteada e vive enquanto a aba viver.
 *
 * Devolve `null` quando o armazenamento está bloqueado (aba anônima de
 * alguns navegadores). Aí o acesso não é contado — melhor perder um
 * número do que contar a mesma pessoa a cada tela que ela abre.
 */
function marcaDestaAbertura(): string | null {
  try {
    const guardada = sessionStorage.getItem(MARCA);
    if (guardada) return guardada;
    const nova = crypto.randomUUID();
    sessionStorage.setItem(MARCA, nova);
    return nova;
  } catch {
    return null;
  }
}

/**
 * Registra a abertura, e depois a porta escolhida.
 *
 * Chamada duas vezes na vida de um acesso: uma quando o app abre (sem
 * porta) e outra quando a pessoa escolhe um lado. A segunda não cria
 * acesso novo — quem garante isso é a marca.
 */
export async function registrarAcesso(porta?: PortaDeEntrada): Promise<void> {
  const marca = marcaDestaAbertura();
  if (!marca) return;

  /* Sem porta, uma vez só por abertura: as telas do app chamam isto no
     `AppShell`, que remonta a cada navegação. Sem esta trava seria uma
     chamada de rede por tela — e a linha no banco seria a mesma, mas o
     celular de quem usa pagaria por todas. */
  if (!porta) {
    try {
      if (sessionStorage.getItem(`${MARCA}-registrado`) === "1") return;
      sessionStorage.setItem(`${MARCA}-registrado`, "1");
    } catch {
      /* segue: melhor registrar demais do que não registrar */
    }
  }

  const sb = supabase();
  if (!sb) return;

  const { error } = await sb.rpc("registrar_acesso", {
    p_marca: marca,
    p_lado: porta ?? null,
  });

  if (error) {
    /* Mesma leitura de `numerosDoEi`: 42883 é o Postgres ("function does
       not exist") e PGRST202 é o PostgREST não achando a função. Os dois
       querem dizer "a 0131 ainda não foi colada", que é diferente de "a
       função existe e quebrou" — e as duas coisas apagariam o mesmo
       número do painel. */
    const e = error as { code?: string; message?: string };
    const faltaSQL =
      e.code === "42883" ||
      e.code === "PGRST202" ||
      (e.message ?? "").toLowerCase().includes("could not find the function");
    if (faltaSQL) {
      console.warn(
        "[Ei] Os acessos não estão sendo contados porque a migration 0131 " +
          "ainda não foi aplicada no banco."
      );
    } else {
      console.warn("[Ei] não consegui registrar o acesso:", error);
    }
  }
}

/** Os três números do painel. `null` quando ainda não dá para saber. */
export async function acessosDeHoje(): Promise<AcessosDeHoje | null> {
  const sb = supabase();
  if (!sb) return null;

  const { data, error } = await sb.rpc("acessos_de_hoje");
  if (error) {
    const e = error as { code?: string; message?: string };
    const faltaSQL =
      e.code === "42883" ||
      e.code === "PGRST202" ||
      (e.message ?? "").toLowerCase().includes("could not find the function");
    if (faltaSQL) {
      console.warn("[Ei] o painel não mostra os acessos: falta a migration 0131.");
    } else {
      console.error("[Ei] acessos_de_hoje falhou:", error);
    }
    return null;
  }

  /* Função que devolve `table` chega como lista, mesmo com uma linha só —
     pegar `data` direto poria um objeto estranho na tela em vez de um
     número. É a mesma pegadinha de `numerosDoEi`. */
  const linha = Array.isArray(data) ? data[0] : data;
  if (!linha) return null;

  return {
    total: Number(linha.total ?? 0),
    empresa: Number(linha.empresa ?? 0),
    candidato: Number(linha.candidato ?? 0),
    semEscolha: Number(linha.sem_escolha ?? 0),
  };
}
