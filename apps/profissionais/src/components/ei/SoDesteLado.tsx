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

  /* `false` é quem entrou e não tem lado nenhum (conta de antes desta
     mudança). Deixa passar: o desvio para a pergunta do lado é feito pela
     tela inicial, e trancar aqui deixaria essa pessoa sem nenhuma tela. */
  if (atual === false) return <>{children}</>;

  if (atual !== lado) return <Navigate to={casaDoLado(atual)} replace />;

  return <>{children}</>;
}
