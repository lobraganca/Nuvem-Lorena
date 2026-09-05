import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { useOnboardingStatus } from "../../lib/useOnboardingStatus";
import { isAdmin } from "../../lib/admin";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { InstalarApp } from "../../components/InstalarApp";
import { IconePorta } from "./ComecarPage";
import { casaDoLado } from "../../lib/ladoDaSessao";

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
        <div className="ei-entrada-topo">
          {/* O "Ei" gigante saiu daqui.
              ─────────────────────────
              Ele entrou quando esta tela era a única sem a barra azul do
              topo — e fazia sentido: a marca precisava aparecer em algum
              lugar. Agora a barra está em todas as telas (ver AppShell), e
              duas marcas na mesma dobra é uma marca a mais.

              O que fica é a pergunta que a tela faz. "Emprego em
              Itabirito" continua fora, como a dona pediu no item 12: quem
              diz o nome agora é a barra. */}
          <h1 className="ei-entrada-titulo">
            {entrou ? "Por onde começamos?" : "Vagas e serviços de Itabirito"}
          </h1>
          {/* Uma linha. A anterior tinha duas orações e dizia, com vinte
              palavras, o que os dois botões logo abaixo dizem com seis. */}
          {/* Era "De que lado você está?", que fazia par com as duas
              portas. Com a pergunta adiada para depois da conta, a frase
              ficou anunciando uma escolha que não está mais nesta tela. */}
          <p className="ei-entrada-apoio">
            {entrou
              /* 02/09: "Dá para trocar quando quiser" saiu a pedido da
                 dona. Ela explicava o controle de lado que está logo
                 abaixo, e que já diz o mesmo com todas as letras: "Você
                 está em — toque para trocar de lado". */
              ? "Escolha por onde entrar."
              : "Quem contrata e quem procura trabalho, no mesmo lugar."}
          </p>
        </div>

        {/* ── A ORDEM MUDOU: PRIMEIRO A CONTA, DEPOIS O LADO ─────────
            A dona: "acho que antes de perguntar se é empresa ou se é
            profissional, tinha que ter a tela pra entrar no app e criar
            senha. depois de criar a pessoa escolhe o perfil de empresa ou
            de profissional."

            Ela está certa, e o desenho anterior tinha um problema real:
            as duas portas ("Procuro trabalho" / "Estou contratando")
            faziam a pessoa escolher um LADO antes de existir como conta.
            Quem tocasse errado — e "estou contratando" é ambíguo para
            quem está montando um serviço próprio — só descobria depois de
            entrar, com o lado já gravado.

            Agora a ordem é a natural: entra (ou cria a conta, com senha),
            e só então escolhe de que lado está, numa tela que existe só
            para isso e pode explicar cada opção com calma. */}
        {/* ── A ESCOLHA DE LADO SAIU DAQUI — 04/09 ────────────────────
            A dona: "na tela de login a pessoa vai ter que escolher entre
            quero contratar ou procuro emprego."

            Ficavam aqui os dois botões que trocavam de lado a qualquer
            momento — o lugar do app onde as duas metades apareciam juntas
            para todo mundo. Agora a escolha é feita na porta, uma vez, e
            quem já entrou nem chega a ver esta tela: o desvio lá em cima
            manda cada um para a casa do seu lado.

            O que sobrou aqui é a entrada de quem NÃO tem conta. */}

        {!entrou && (
          /* Dois botões, e não um "entrar ou criar conta": quem já tem
             conta quer digitar a senha e passar; quem é novo precisa do
             código por SMS. Cada botão abre o login no caminho certo. */
          <div className="ei-portas">
            <Link to="/login?acao=criar" className="ei-porta ei-porta-cheia">
              <span className="ei-porta-nome">Criar conta</span>
              <span className="ei-porta-nota">Pelo celular, com um código por SMS</span>
            </Link>
            <Link to="/login?acao=entrar" className="ei-porta">
              <span className="ei-porta-nome">Já tenho conta</span>
              <span className="ei-porta-nota">Entrar com celular e senha</span>
            </Link>
          </div>
        )}

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

          {/* Instalar, para quem ainda não entrou. O caminho mora na Conta,
              e quem chega aqui pela primeira vez não tem conta — ficava sem
              nenhum. E é justamente esta pessoa que precisa dele: quem
              gostou do app e não o deixou no celular volta uma vez e
              esquece o endereço.

              Some sozinho dentro do app já instalado e dentro do app da
              loja. Ver InstalarApp. */}
          {/* Botão pequeno e redondo, no fim da tela — a forma que a
              dona pediu. Antes era uma linha de lista larga, do tamanho
              das portas principais, competindo com a decisão desta tela.

              O que ele FAZ continua sendo decidido pelo aparelho: no
              Android o toque instala de verdade; no iPhone abre o passo a
              passo, porque lá quem instala é o próprio Safari. */}
          {/* "Banco de talentos" e "Banco de vagas" moraram aqui até
              02/09. Foram para o rodapé das telas de `ComecarPage` — esta
              tela deixou de ter porta nenhuma, e as duas são portas. */}
          <InstalarApp variante="botao" />
        </div>
      </div>
    </div>
  );
}
