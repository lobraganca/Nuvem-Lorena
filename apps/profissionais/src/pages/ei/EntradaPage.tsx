import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { useOnboardingStatus } from "../../lib/useOnboardingStatus";
import { isAdmin } from "../../lib/admin";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { IconePorta } from "./ComecarPage";
import { casaDoLado } from "../../lib/ladoDaSessao";
import { Vitrine } from "../../components/ei/Vitrine";

/**
 * A porta de entrada do Ei Emprego.
 *
 * Substitui a HomePage do procurô, que era a tela de BUSCA: campo de
 * procurar serviço, grade de categorias, vitrine de anúncios pagos,
 * banners. Aquela tela responde "quem conserta o meu chuveiro?" — a
 * pergunta do outro produto.
 *
 * Aqui a pergunta é "de que lado você está?", e são só duas respostas. Não
 * há campo de busca na entrada de propósito: quem chega a este app ou está
 * procurando trabalho ou está procurando gente, e as duas coisas começam
 * com um cadastro, não com uma busca.
 *
 * Quem já entrou não sai desta pergunta — o app sempre abre aqui — mas
 * esta tela responde só a ela. Os botões de cada lado (Meu cadastro,
 * Minhas empresas, Banco de talentos...) moraram aqui até 02/09 e foram
 * para `ComecarPage.tsx`, a tela que cada escolha abre. A dona: "na tela
 * de por onde começamos só deveria ter a opção de procuro trabalho ou
 * quero contratar, daí dentro dessas telas teriam os demais botões." */
export function EntradaPage() {
  useTituloDaPagina("Início");
  const { user, loading } = useAuth();
  const tipo = useOnboardingStatus();
  const navegar = useNavigate();

  /* Quem já tem conta vai direto ao que veio fazer. Mostrar a porta de
     entrada para quem já entrou é fazer a pessoa escolher de novo uma coisa
     que ela já escolheu.

     ── Pelo roteador, e não mexendo no endereço à mão ─────────────────
     Isto era um `window.history.replaceState` seguido de um `popstate`
     disparado na mão. O motivo estava escrito e era legítimo: um
     `<Navigate>` dentro de um `if` ANTES dos hooks quebraria a ordem
     deles. Mas a saída escolhida trocou um problema por outro — o desvio
     passou a escrever o endereço por fora do react-router, e portanto a
     supor que o roteador é o de endereço de verdade.

     Quebrou na primeira vez que o app rodou com outro tipo de roteador (a
     demonstração de um arquivo só, que precisa do de `#`): o desvio
     escrevia `/vagas-para-mim` como caminho real, o servidor não tinha
     esse arquivo, e a tela virava um 404 — sem nenhum erro de JavaScript
     para apontar a causa.

     O `useEffect` resolve os dois: fica no topo, com os outros hooks, e
     desvia pelo roteador que estiver montado. */
  /* ── QUEM ENTROU NUNCA MAIS VÊ ESTA TELA ─────────────────────────────
     Faltava um caso, e ele apareceu na primeira pessoa que usou o app de
     verdade: quem ENTROU mas ainda não disse de que lado está.

     `tipo` é `false` nesse caso (não é nulo — nulo é "ainda carregando"),
     e a conta antiga só desviava quando `tipo` tinha valor. Resultado: a
     dona digitou o código, entrou, e caiu de volta nesta tela oferecendo
     "Criar conta" — com a barra de baixo já mostrando Avisos e Painel,
     ou seja, logada. "Coloquei o SMS e caí nessa tela. Não entendi."

     Ninguém entenderia. Agora quem está nesse meio do caminho vai para a
     pergunta que falta responder. */
  /* ── ABRIR O APP CAI SEMPRE AQUI ─────────────────────────────────────
     A dona, duas vezes: "sempre que o app for aberto, ele tem que cair na
     tela inicial" e "quando abro o site continua a cair na tela de vagas e
     do cadastro".

     Esta tela desviava quem já tinha entrado — ia direto para as vagas ou
     para o painel. A intenção era boa (poupar um toque de quem já sabe o
     que veio fazer), mas o efeito era o oposto: o app abria no meio de uma
     lista, ou pior, dentro de um formulário, e não havia um lugar
     reconhecível de "começo". Quem abre um app quer primeiro se situar.

     Agora ela é a casa dos dois casos. Sem conta, mostra as portas de
     entrar e criar conta. Com conta, mostra o nome de quem entrou e os
     caminhos daquele lado — e o desvio automático fica só para quem ainda
     não escolheu o lado, porque aí falta uma resposta, não um caminho. */
  /* Quem administra vê a porta do painel logo aqui. `false` enquanto não
     se sabe: mostrar o atalho e escondê-lo meio segundo depois pisca na
     tela de quem não é administração. */
  const [ehAdmin, setEhAdmin] = useState(false);
  useEffect(() => {
    if (!user) return;
    let vivo = true;
    isAdmin(user.id)
      .then((sim) => vivo && setEhAdmin(sim))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [user]);

  /* ── QUEM ENTROU JÁ ESCOLHEU O LADO, NA PORTA — 04/09 ────────────────
     A dona: "na tela de login a pessoa vai ter que escolher entre quero
     contratar ou procuro emprego... uma pessoa que entra só pra procurar
     um emprego, só terá as opções para isso."

     Esta tela existia para fazer essa pergunta DEPOIS do login, com os
     dois lados lado a lado — e era o principal lugar onde as duas metades
     do app apareciam juntas para todo mundo. Com a escolha na porta, ela
     não tem mais o que perguntar: manda cada um para a casa do seu lado.

     Sem lado nenhum só sobra quem entrou por um caminho antigo, de antes
     desta mudança; para essas pessoas a pergunta continua existindo, na
     tela dela. */
  const paraOnde =
    !loading && user
      ? tipo === "professional" || tipo === "company"
        ? casaDoLado(tipo)
        : tipo === false
          ? "/login"
          : null
      : null;

  useEffect(() => {
    if (paraOnde) navegar(paraOnde, { replace: true });
  }, [paraOnde, navegar]);

  if (paraOnde) return null;

  const entrou = !loading && !!user;

  return (
    <div className="ei">
      {/* A tela inicial é uma COLUNA que ocupa a altura toda, e não um
          bloco de conteúdo no alto de uma página em branco.

          Antes: título, apoio, dois botões e um link terminavam a 45% da
          tela; o resto era vazio até o aviso de privacidade aparecer
          sozinho, boiando no meio do nada, e a barra de baixo. Num
          celular de 390×844 sobravam quase 300px de papel liso — a
          primeira coisa que se lia como "não terminaram isto".

          Agora a escolha fica no meio da tela (é a decisão desta tela,
          merece o centro óptico) e o que é rodapé — ver sem conta,
          instalar, privacidade — se junta embaixo, num bloco só. */}
      <div className="ei-tela ei-entrada">
        {/* ── A CAPA SAIU DAQUI E FOI PARA A VITRINE — 07/09 ──────────
            A dona: "preciso que a primeira tela seja mais bonita.
            Chamativa."

            O título e a linha de apoio moravam aqui, em preto sobre
            papel, e a tela abria cinza. Agora eles vivem dentro da
            `Vitrine`, numa faixa do azul do Ei com os três números da
            cidade logo abaixo — e é ali que eles têm de estar, porque os
            números vêm da MESMA consulta que já carrega as prateleiras.
            Mantê-los aqui obrigaria a tela a buscar duas vezes a mesma
            coisa só para escrever um título.

            Quem entrou continua vendo o cabeçalho simples: para essa
            pessoa a tela é um menu, não uma vitrine. */}
        {entrou && (
          <div className="ei-entrada-topo">
            <h1 className="ei-entrada-titulo">Por onde começamos?</h1>
            <p className="ei-entrada-apoio">Escolha por onde entrar.</p>
          </div>
        )}

        {/* ── A VITRINE VEM ANTES DAS PORTAS — 07/09 ──────────────────
            A dona: "ao entrar no site a pessoa tem que ter uma tela bonita
            pra ver as vagas e os candidatos. Sem ter que fazer login. Se
            quiser abrir uma vaga ou se candidatar tem que fazer login."

            E isto DESFAZ o pedido de 01/09 ("todos devem criar conta ao
            entrar, até mesmo pra ver"), que é o motivo de o link "ver sem
            conta" ter saído daqui. Está escrito para a próxima sessão não
            "consertar" de volta: a regra de hoje é a de 07/09.

            A ordem é o assunto. Antes vinha o pedido de cadastro e depois
            nada; agora vem a resposta ("tem isto aqui na sua cidade") e a
            conta fica para quando a pessoa quiser FAZER alguma coisa. */}
        {!entrou && <Vitrine />}

        {/* ── OS BOTÕES DE CONTA SAÍRAM DAQUI — 07/09 ────────────────
            A dona: "não sei onde clicar."

            Eram "Criar conta" e "Já tenho conta", no fim da tela, DEPOIS
            das duas prateleiras — fora da primeira dobra num celular. A
            única ação da página estava onde ninguém olha.

            As portas agora vivem dentro da capa azul, no alto, e são as
            duas do app ("Procuro emprego" / "Quero contratar") em vez de
            duas formas de fazer a mesma coisa. Quem já tem conta toca na
            porta do seu lado e entra sem digitar nada — a tela de entrar
            reconhece a sessão. Ver `Vitrine.tsx`. */}

        {/* ── O PAINEL DA ADMINISTRAÇÃO, PARA QUEM ADMINISTRA — 04/09 ──
            A dona: "o botão do painel adm deve ficar na tela por onde
            começamos."

            Ele morava no fim da tela de Conta, depois de senha, instalação
            e ajuda. Para quem administra o app isso está trocado: ver como
            está a cidade é a primeira coisa do dia, não algo que se
            procura no fim de outra tela.

            Aparece SÓ para quem está em `admins` — e quem decide é o
            banco, não esta tela: a rota `/admin` confere de novo, e sem a
            permissão ela não abre nada. Isto aqui é atalho, não porteiro. */}
        {ehAdmin && (
          /* Dentro de `.ei-portas` para pegar a margem e o espaçamento das
             outras portas: solto, ele encostava nas bordas da tela. */
          <div className="ei-portas">
            <Link to="/admin" className="ei-porta">
              <IconePorta desenho="escudo" />
              <span className="ei-porta-nome">Painel administrativo</span>
              <span className="ei-porta-nota">Empresas, vagas, planos e o resto</span>
            </Link>
          </div>
        )}

        {/* O rodapé da tela. Três coisas quietas, do mesmo tamanho, no
            mesmo bloco — e não espalhadas pela altura da página. */}
        <div className="ei-entrada-pe">
          {/* O link "ver sem conta" saiu: a partir de 01/09 ver a lista
              também exige conta ("todos devem criar conta ao entrar, até
              mesmo pra ver"). Ele continuaria clicável e devolveria a
              pessoa ao login — prometendo uma porta que não existe mais. */}

          {/* ── O CONVITE DE INSTALAR SAIU — 07/09 ─────────────────────
              A dona: "deixe somente o baixar app do topo."

              Ele existia aqui porque quem chega pela primeira vez não tem
              conta, e o caminho morava na Conta — essa pessoa ficava sem
              nenhum. Hoje o botão do cabeçalho aparece em TODA tela,
              inclusive nesta e inclusive para quem já instalou (pedido
              dela em 04/09), então o argumento não vale mais: o convite
              continua aqui, um dedo acima.

              "Banco de talentos" e "Banco de vagas" moraram neste mesmo
              lugar até 02/09. Foram para o rodapé das telas de
              `ComecarPage` — esta tela deixou de ter porta nenhuma, e as
              duas são portas. */}
        </div>
      </div>
    </div>
  );
}
