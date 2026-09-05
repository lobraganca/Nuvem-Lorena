import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useOnboardingStatus } from "../../lib/useOnboardingStatus";
import { casaDoLado } from "../../lib/ladoDaSessao";

/**
 * Tranca uma tela no lado a que ela pertence.
 *
 * ── Por que existe ────────────────────────────────────────────────────
 *
 * A dona: "serão dois logins diferentes e as funcionalidades serão
 * separadas. Uma pessoa que entra só pra procurar um emprego, só terá as
 * opções para isso."
 *
 * Esconder o botão não é separar. A barra de baixo já mostra só os
 * destinos do lado atual, mas o endereço continua existindo: quem tiver o
 * link (um favorito antigo, o histórico do navegador, um "voltar" depois
 * de trocar de lado) abre "Criar vaga" tendo entrado para procurar
 * emprego — e cai num formulário que pergunta o salário que ELA vai
 * pagar. Nenhuma tela dessas quebra, e é justamente por isso que passa
 * despercebido: o app fica com cara de que a pessoa fez algo errado.
 *
 * Aqui a tela do lado errado não abre. Devolve para a casa do lado em que
 * a pessoa está, sem mensagem de erro — não houve erro nenhum, ela só foi
 * parar num endereço que não é dela.
 *
 * ── O que NÃO fica aqui ───────────────────────────────────────────────
 *
 * As telas que servem aos dois lados: o banco de vagas, o banco de
 * talentos, um perfil público, a Conta, os documentos. Elas continuam
 * abertas para os dois porque respondem à mesma pergunta dos dois lados —
 * e trancá-las seria inventar uma separação que a dona não pediu.
 *
 * ── E o que isto NÃO é ────────────────────────────────────────────────
 *
 * Não é segurança. Quem manda no que pode ser lido e gravado é o RLS, no
 * banco, e continua sendo: esta guarda vive no navegador e serve para a
 * pessoa não se perder. Uma trava de tela nunca protegeu dado nenhum.
 */
export function SoDesteLado({
  lado,
  children,
}: {
  lado: "professional" | "company";
  children: ReactNode;
}) {
  const atual = useOnboardingStatus();

  /* `null` é "ainda não sei" — e aqui esperar é obrigatório. Tratar o
     desconhecido como lado errado jogaria a pessoa para fora da tela que
     ela pediu, no meio do carregamento, toda vez que o app abrisse
     direto num endereço interno. */
  if (atual === null) return null;

  /* ── DEIXAR PASSAR ERA O BURACO DA SEPARAÇÃO — 04/09 ────────────────
     A dona: "o app ainda não tem a separação das funções."

     Aqui estava escrito que quem não tem lado nenhum passa direto, porque
     "o desvio para a pergunta é feito pela tela inicial". Só que a tela
     inicial é justamente a tela em que quase ninguém entra: o app é um
     PWA que reabre na ÚLTIMA tela, e ainda se chega por favorito, por
     aviso empurrado e pelo botão voltar. Quem entra por qualquer um
     desses caminhos nunca passa pela pergunta — e então TODAS as telas
     dos dois lados abriam para ele, sem barra embaixo. O app parecia não
     ter separação nenhuma, que foi exatamente o que ela viu.

     Agora a pergunta vem até a pessoa, em vez de esperar que ela caia na
     tela que a faz.

     ── E A PERGUNTA MUDOU DE ENDEREÇO — 05/09 ─────────────────────────
     A dona, com o print de `/onboarding-tipo`: "que tela é essa?"

     Era a tela ANTIGA da mesma pergunta, de quando a escolha vinha depois
     do login. A reformulação de 04/09 mudou isso — as duas portas estão
     na tela de ENTRAR —, e esta continuou existindo e continuou sendo
     alcançável por aqui. Duas telas para a mesma pergunta, uma delas
     dizendo regras que já não valem ("dá para trocar de lado a qualquer
     hora, na sua Conta").

     Agora manda para `/login`, que é onde a pergunta mora. Quem já está
     conectado só toca num lado e entra — a tela não pede senha de quem
     acabou de dar. */
  if (atual === false) return <Navigate to="/login" replace />;

  if (atual !== lado) return <Navigate to={casaDoLado(atual)} replace />;

  return <>{children}</>;
}
