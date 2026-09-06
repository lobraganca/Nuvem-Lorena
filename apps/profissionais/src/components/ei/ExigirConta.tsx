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
 *                   pelo revisor da loja.
 */
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { guardarDestinoLogin } from "../../lib/auth";

const LIVRES = ["/login", "/termos", "/privacidade"];

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
