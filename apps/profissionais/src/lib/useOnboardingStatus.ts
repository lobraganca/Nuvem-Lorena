import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { lerLadoDaSessao } from "./ladoDaSessao";

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

    /* ── SEM LADO NA SESSÃO, A RESPOSTA É PERGUNTAR — 04/09 ────────────
       A dona: "continua cortando caminho."

       Aqui havia um plano B: quando não há lado na sessão, consultar o
       banco e ADOTAR o último lado que a pessoa registrou. A intenção era
       boa — poupar a pergunta de quem já usava o app. O efeito era o
       oposto do que ela pediu: o app decidia sozinho por onde a pessoa
       entrava, e quem abria o app pela segunda vez ia direto para o lado
       de empresa sem nunca ter sido perguntado.

       E não bastava consertar caso a caso (o logout foi um; abrir o app
       de novo era outro; favorito e aviso empurrado, mais dois). O
       problema é o palpite em si: o que está no banco é HISTÓRICO — o
       lado da última vez —, não uma escolha para esta vez. A dona pediu a
       escolha na porta, e um palpite silencioso é justamente o que tira
       a escolha.

       Sem lado, `false`. Quem trata o `false` já existe e leva à
       pergunta: `SoDesteLado` e a tela inicial mandam para
       `/onboarding-tipo`, que é um toque e segue direto.

       O banco continua sendo escrito no login — é dele que saem os
       números do painel de administração. Só não decide mais nada aqui. */
    setTipo(false);
  }, [user, carregandoAuth]);

  return tipo;
}
