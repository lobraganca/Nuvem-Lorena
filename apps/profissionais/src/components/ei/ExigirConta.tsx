/**
 * Conta para tudo.
 *
 * ── A DECISÃO ──────────────────────────────────────────────────────────
 *
 * A dona: "todos devem criar conta ao entrar, até mesmo pra ver."
 *
 * É uma inversão do que este app fazia desde o começo — a lista de
 * profissionais era livre, sem conta, e havia uma razão escrita para isso:
 * quem só quer achar um eletricista não deve topar com formulário nenhum.
 *
 * A decisão é dela e está tomada; fica aqui o que ela troca, para quem
 * mexer nisto depois saber o que está em jogo:
 *
 *   ganha  · todo mundo que aparece na lista tem telefone confirmado, o
 *            que corta o anúncio de golpe e o número de mentira;
 *          · dá para avisar quem procurou de algo que apareceu depois;
 *          · quem contrata deixa de ser anônimo para quem é contatado.
 *
 *   perde  · o Google não consegue indexar a lista (o robô não faz conta),
 *            então o app deixa de aparecer em busca de "eletricista em
 *            Itabirito" — hoje a porta de entrada mais barata que existe;
 *          · quem chega por indicação de um amigo topa com um cadastro
 *            antes de ver qualquer coisa, e parte vai embora.
 *
 * Se um dia isso precisar voltar atrás, é aqui: `LIVRES` abaixo.
 *
 * ── O QUE FICA LIVRE, E POR QUÊ ────────────────────────────────────────
 *
 * Três coisas, e nenhuma delas é conteúdo do app:
 *
 *   /login          senão não há como entrar — a porta não pode estar
 *                   trancada por dentro;
 *   /termos
 *   /privacidade    exigência da Play Store e da LGPD: precisam ser
 *                   alcançáveis por quem ainda não tem conta, inclusive
 *                   pelo revisor da loja;
 *   /ajuda          a central de dúvidas. A pergunta mais comum do
 *                   suporte é "não recebi o código" — exigir conta para
 *                   ler a resposta seria exigir justamente o que a
 *                   pessoa não consegue fazer.
 */
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { guardarDestinoLogin } from "../../lib/auth";

const LIVRES = [
  "/login",
  "/termos",
  "/privacidade",
  /* A ajuda — 06/09. Não é conteúdo do app: é o socorro. A dúvida número
     um do suporte é "não recebi o código", e trancar a resposta dela
     atrás da conta é trancá-la atrás do próprio problema. */
  "/ajuda",
  /* ── A EXCLUSÃO DE CONTA — 06/09 ────────────────────────────────
     A tela `/excluir-conta` foi ESCRITA para ser pública — o próprio
     comentário dela diz isso, e diz por quê: a Google Play exige um
     endereço, informado na ficha da loja, onde qualquer um entenda como
     apagar a conta. Ela só nunca entrou nesta lista, e o resultado é que
     o endereço exigido pela loja mandava o visitante para o login.

     Quem mais precisa dessa página é justamente quem NÃO consegue mais
     entrar — e é ela que o revisor da Google abre, deslogado, antes de
     aprovar. Medido no navegador: `/excluir-conta` terminava em
     `/login`. */
  "/excluir-conta",

  /* ══════════════════════════════════════════════════════════════════
     A VITRINE — 07/09. Isto DESFAZ o pedido de 01/09 que abre este
     arquivo, e é de propósito.

     A dona: "ao entrar no site a pessoa tem que ter uma tela bonita pra
     ver as vagas e os candidatos. Sem ter que fazer login. Se quiser
     abrir uma vaga ou se candidatar tem que fazer login."

     O cabeçalho lá em cima listou o que a exigência de conta ganhava e o
     que perdia. O que ela perdia acabou decidindo: quem chega por
     indicação topava com um cadastro antes de ver qualquer coisa, e uma
     tela de entrar não responde à única pergunta de quem chega — "tem
     alguma coisa aqui pra mim?".

     O que a exigência GANHAVA não se perde, porque a linha mudou de
     lugar em vez de sumir. Ela agora está na AÇÃO, e não na leitura:

       ver a lista de vagas ....... sem conta
       ver a lista de candidatos .. sem conta, e SEM CONTATO NENHUM
                                    (view separada, migration 0132)
       ler uma vaga inteira ....... sem conta (é um anúncio, e já era
                                    compartilhável por link)
       se candidatar .............. exige conta
       publicar vaga .............. exige conta
       abrir a ficha de alguém .... exige conta, porque é lá que está o
                                    telefone

     A última linha sustenta as outras. A 0118 fechou a lista de
     candidatos para quem não tem conta porque a view carregava telefone,
     WhatsApp e e-mail — e a chave do site é pública, então a lista de
     contatos de todos os desempregados da cidade saía com uma linha de
     `curl`. Isso continua fechado. O que abriu foi uma view sem nenhuma
     dessas colunas.

     `/profissional/:id` NÃO entra aqui, por isso mesmo: é a ficha, e a
     ficha tem o contato. É também o que mantém o plano pago de pé — a
     empresa paga para falar com as pessoas, não para saber que existem.
     ══════════════════════════════════════════════════════════════════ */
  /* `"/"` casa só com a raiz exata: a conferência é `caminho === t` ou
     `caminho.startsWith(t + "/")`, e nenhum caminho começa com "//". Se
     casasse por prefixo, esta única linha abriria o app inteiro. */
  "/",
  "/inicio",
  "/vagas",
  "/vaga-aberta",
  "/profissionais",
  /* A empresa vista por quem procura trabalho, com as vagas dela no ar.
     Vem junto porque é para onde o cartão da vaga leva, e uma vitrine com
     um link que cai no login é pior que uma vitrine sem link. */
  "/empresa",
  "/como-funciona",
];

export function ehTelaLivre(caminho: string): boolean {
  return LIVRES.some((t) => caminho === t || caminho.startsWith(`${t}/`));
}

export function ExigirConta({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { pathname, search } = useLocation();

  if (ehTelaLivre(pathname)) return <>{children}</>;

  /* Enquanto a sessão está sendo lida, não decide nada: mandar para o
     login aqui jogaria para fora justamente quem JÁ tem conta, a cada
     abertura do app, porque a sessão demora alguns quadros para chegar. */
  if (loading) return null;

  if (!user) {
    /* Guarda onde a pessoa queria chegar. Sem isto, quem abre um link de
       uma vaga específica entra e cai na tela inicial, sem nunca ver a
       vaga que a trouxe até aqui. */
    guardarDestinoLogin(pathname + search);
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
