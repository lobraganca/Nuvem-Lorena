import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { obterTipoDeUsuario } from "./company";
import { lerLadoDaSessao, guardarLadoDaSessao, saiuDeProposito } from "./ladoDaSessao";

/**
 * De que lado o app está agora — é isto que a barra de baixo, a tela
 * inicial e cada tela de lado consultam.
 *
 * Devolve:
 * - `null`   — ainda carregando (não é "não tem lado")
 * - `"professional"` / `"company"` — o lado desta sessão
 * - `false`  — entrou e não há lado nenhum para usar
 *
 * ── O QUE MUDOU EM 04/09 ──────────────────────────────────────────────
 *
 * A dona: "na tela de login a pessoa vai ter que escolher entre quero
 * contratar ou procuro emprego... uma pessoa que entra só pra procurar um
 * emprego, só terá as opções para isso."
 *
 * Antes quem respondia era o BANCO: `user_onboarding.user_type`, o último
 * lado que a pessoa registrou. Isso tinha dois defeitos para o que ela
 * quer agora. O primeiro é que o banco guarda um lado só — quem tem loja
 * e também procura emprego só existia como um dos dois. O segundo é que
 * a resposta demorava: era uma consulta, então toda tela abria sem saber
 * de que lado estava, e a barra de baixo piscava.
 *
 * Agora quem manda é a escolha feita na porta, que está no aparelho e é
 * lida na hora. O banco continua sendo escrito no login (é dele que saem
 * os números do painel de administração), mas não decide mais nada aqui.
 *
 * A consulta ao banco fica como PLANO B, e só por causa de quem já estava
 * logado quando esta mudança subiu: essas pessoas não passaram pela nova
 * tela de login, não têm lado de sessão nenhum, e sem o plano B abririam
 * o app sem barra e sem caminho. Some sozinho conforme cada uma sai e
 * entra de novo.
 */
export function useOnboardingStatus(): "professional" | "company" | false | null {
  const { user, loading: carregandoAuth } = useAuth();

  /* Lido no primeiro render, e não num efeito: o lado da sessão está no
     armazenamento local, responde na hora, e esperar um ciclo para
     mostrá-lo faria a barra de baixo aparecer vazia e depois preencher —
     que é o pisca que a consulta ao banco causava. */
  const [tipo, setTipo] = useState<"professional" | "company" | false | null>(
    () => lerLadoDaSessao()
  );

  useEffect(() => {
    if (carregandoAuth) return;
    if (!user) {
      setTipo(null);
      return;
    }

    const daSessao = lerLadoDaSessao();
    if (daSessao) {
      setTipo(daSessao);
      return;
    }

    /* Quem acabou de tocar em "Sair" não tem lado porque NÃO QUER ter:
       adotar o do banco aqui desfaria o logout no meio dele, e a pessoa
       voltaria para o mesmo lado de onde saiu para trocar. */
    if (saiuDeProposito()) {
      setTipo(false);
      return;
    }

    /* Plano B: quem já estava logado antes da mudança. Ver o comentário
       do topo — isto não é o caminho normal, é a ponte para quem ficou no
       meio dela. */
    obterTipoDeUsuario(user.id).then((resultado) => {
      /* ── O PLANO B PRECISAVA ADOTAR O LADO, NÃO SÓ LÊ-LO — 04/09 ─────
         A dona: "o app ainda não tem a separação das funções."

         Estava certa, e o defeito era este. Quem já estava logado quando a
         separação subiu não tem lado NA SESSÃO — e ninguém tem, porque
         ninguém deslogou. O plano B descobria o lado no banco e o
         devolvia, mas não o GRAVAVA: a cada tela aberta a consulta era
         refeita, e enquanto ela não voltava o app inteiro ficava em
         `null`, sem barra e sem tranca.

         Gravar resolve de uma vez: a partir da primeira resposta a pessoa
         passa a ter lado de sessão como quem entrou pela porta nova, e o
         app se separa sem ela precisar sair e entrar de novo. */
      if (resultado === "professional" || resultado === "company") {
        guardarLadoDaSessao(resultado);
        setTipo(resultado);
        return;
      }
      setTipo(false);
    });
  }, [user, carregandoAuth]);

  return tipo;
}
