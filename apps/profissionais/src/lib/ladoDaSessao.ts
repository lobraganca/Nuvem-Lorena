import type { Lado } from "./ladoEscolhido";

/**
 * De que lado a pessoa entrou NESTA sessão.
 *
 * ── A reformulação de 04/09 ───────────────────────────────────────────
 *
 * A dona: "na tela de login a pessoa vai ter que escolher entre quero
 * contratar ou procuro emprego. Serão dois logins diferentes e as
 * funcionalidades serão separadas. Uma pessoa que entra só pra procurar um
 * emprego, só terá as opções para isso."
 *
 * Antes o lado era uma preferência que se trocava a qualquer momento: a
 * tela inicial tinha os dois botões lado a lado, e o app inteiro mudava
 * de cara com um toque. Isso vinha de um pedido anterior, o oposto deste
 * ("logo após fazer login, sempre deve ter opção de escolher o ambiente"),
 * e o resultado é o que ela está desfazendo: um app que mostra as duas
 * metades para todo mundo, o tempo todo, e obriga cada pessoa a passar
 * pela metade que não é dela.
 *
 * Agora o lado é escolhido UMA vez, na porta, e vale até sair.
 *
 * ── Por que uma conta só, e não duas ──────────────────────────────────
 *
 * Ela decidiu assim: "mesma conta, escolhe ao entrar". E é o que cabe
 * neste app — a conta é o número de celular (o login é por SMS), então
 * "dois logins" de verdade exigiria dois chips. Numa cidade onde o dono
 * da loja também é eletricista à noite, isso deixaria metade das pessoas
 * de fora de um dos lados.
 *
 * O que ela quer — e o que isto entrega — é a SEPARAÇÃO: dentro do app só
 * existe o lado escolhido. Para trocar, sai e entra de novo.
 *
 * ── Por que no armazenamento, e não em memória ────────────────────────
 *
 * Porque recarregar a página não pode desfazer a escolha: o app é um PWA
 * que a pessoa abre e fecha o dia inteiro, e várias telas ainda saem por
 * `location.href` (que recarrega tudo). Em memória, cada volta dessas
 * jogaria a pessoa de novo na pergunta.
 *
 * Some no `sair da conta` — ver `signOut`, em `lib/auth.ts`. É o que faz
 * "trocar de lado" ter um caminho: sair e entrar do outro.
 */

const CHAVE = "ei-lado-da-sessao";

/* ── A MARCA DE QUEM SAIU DE PROPÓSITO — 04/09 ────────────────────────
   A dona: "quando sai e entra de novo entra na parte de empresa direto."

   Era uma corrida de tempo. `signOut` apaga o lado e SÓ DEPOIS espera o
   Supabase encerrar a sessão; nesse intervalo o app ainda tem usuário, o
   `useOnboardingStatus` roda o plano B, lê o lado no banco e — desde que
   ele passou a ADOTAR o que lê — grava de volta o lado que o "sair"
   acabou de apagar. A tela de login então já encontrava um lado
   guardado, pulava as duas portas, e a pessoa voltava para o mesmo lado
   de onde tinha saído justamente para trocar.

   Esta marca diz "o apagamento foi de propósito". Enquanto ela estiver
   aqui, o plano B não adota nada — só uma escolha explícita
   (`guardarLadoDaSessao`, chamada pelas duas portas) a tira. */
const CHAVE_SAIU = "ei-saiu-de-proposito";

export function saiuDeProposito(): boolean {
  try {
    return localStorage.getItem(CHAVE_SAIU) === "1";
  } catch {
    return false;
  }
}

export function lerLadoDaSessao(): Lado | null {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === "company" || v === "professional" ? v : null;
  } catch {
    /* Navegador com armazenamento bloqueado: quem chama trata o `null`
       perguntando de novo, que é melhor que travar. */
    return null;
  }
}

export function guardarLadoDaSessao(lado: Lado): void {
  try {
    localStorage.setItem(CHAVE, lado);
    /* Escolha explícita: a marca do "sair" cumpriu o papel e some. */
    localStorage.removeItem(CHAVE_SAIU);
  } catch {
    /* segue sem guardar: a pessoa escolhe de novo na próxima abertura */
  }
}

export function esquecerLadoDaSessao(): void {
  try {
    localStorage.removeItem(CHAVE);
    localStorage.setItem(CHAVE_SAIU, "1");
  } catch {
    /* nada a fazer, e nada que justifique atrapalhar quem está saindo */
  }
}

/** Para onde cada lado abre depois do login. */
export function casaDoLado(lado: Lado): string {
  return lado === "company" ? "/comecar-empresa" : "/comecar-profissional";
}
