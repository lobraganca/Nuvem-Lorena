import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { useOnboardingStatus } from "../../lib/useOnboardingStatus";
import { registrarTipoDeUsuario } from "../../lib/company";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { InstalarApp } from "../../components/InstalarApp";
import { AvisoPerfilIncompleto } from "../../components/ei/AvisoPerfilIncompleto";

/**
 * A porta de entrada do Ei Itabirito.
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
 * Quem já entrou nunca vê esta tela: é levado direto para o lado dele.
 */
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
  /* Trocando de lado agora. Segura os dois botões: dois toques rápidos
     gravariam os dois lados em ordem imprevisível. */
  const [trocando, setTrocando] = useState(false);

  /**
   * Troca o ambiente e leva para o lado escolhido.
   *
   * Recarrega por `location.href` em vez de navegar pelo roteador: o lado
   * é lido uma vez, na abertura, pela barra de baixo e por várias telas.
   * Trocar pelo roteador deixaria a barra mostrando os itens do lado
   * antigo — e a pessoa acharia que a troca não funcionou.
   */
  async function trocarAmbiente(novo: "professional" | "company") {
    if (!user || novo === tipo || trocando) return;
    setTrocando(true);
    try {
      await registrarTipoDeUsuario(user.id, novo);
      /* Empresa vai para a escolha da empresa; quem procura trabalho vai
         para a tela inicial, que já mostra as portas do lado dela. */
      window.location.href = novo === "company" ? "/minhas-empresas" : "/";
    } catch {
      setTrocando(false);
    }
  }

  const paraOnde = !loading && user && tipo === false ? "/onboarding-tipo" : null;

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
              ? "Escolha por onde entrar. Dá para trocar quando quiser."
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
            para isso e pode explicar cada opção com calma.

            As duas portas viraram uma. O texto embaixo continua dizendo
            que o app serve aos dois lados — a informação não se perdeu,
            só deixou de exigir uma decisão cedo demais. */}
        {/* Com conta: os caminhos do lado da pessoa. Sem conta: as duas
            portas. Os mesmos blocos, o mesmo lugar na tela — o que muda é
            para onde levam. */}
        {/* O aviso do cadastro pela metade (a dona: "ao escolher o
            ambiente, se o perfil não estiver preenchido, deve ter um aviso
            na tela"). Fica acima das portas porque é sobre o que a pessoa
            vai fazer ao tocar numa delas — embaixo, ela já teria saído da
            tela antes de ler. */}
        {entrou && (tipo === "company" || tipo === "professional") && (
          <AvisoPerfilIncompleto lado={tipo} />
        )}

        {/* ── A ESCOLHA DO AMBIENTE, NA TELA QUE O APP SEMPRE ABRE ────
            A dona, depois de eu já ter feito o item 4: "ainda não consegui
            ver no app o botão onde a pessoa pode escolher se quer acessar
            a empresa ou profissional."

            Ela não estava vendo porque eu pus a escolha no lugar errado.
            O item 4 diz "logo após fazer login, sempre deve ter opção de
            escolher o ambiente", e eu li "logo após fazer login" como o
            momento — mandei a tela de entrar desviar para a pergunta.

            Só que ninguém faz login toda vez. Ela abre o app já logado, cai
            aqui, e daqui só havia as portas de UM lado. A tela da escolha
            existia e era inalcançável — o mesmo erro da tela de escolher a
            empresa, que eu pulava quando havia uma só.

            Agora a escolha mora nesta tela, que é a que o app sempre abre.
            Dois botões lado a lado, com o lado atual marcado: dá para ver
            em que ambiente se está sem tocar em nada, que é metade do que
            ela pediu, e trocar num toque, que é a outra metade. */}
        {entrou && (tipo === "company" || tipo === "professional") && (
          <div className="ei-ambiente">
            <span className="ei-ambiente-rotulo">Você está em</span>
            <div className="ei-ambiente-botoes" role="group" aria-label="Escolher o ambiente">
              <button
                type="button"
                className={tipo === "professional" ? "ei-ambiente-botao ativo" : "ei-ambiente-botao"}
                aria-pressed={tipo === "professional"}
                disabled={trocando}
                onClick={() => trocarAmbiente("professional")}
              >
                Procuro trabalho
              </button>
              <button
                type="button"
                className={tipo === "company" ? "ei-ambiente-botao ativo" : "ei-ambiente-botao"}
                aria-pressed={tipo === "company"}
                disabled={trocando}
                onClick={() => trocarAmbiente("company")}
              >
                Quero contratar
              </button>
            </div>
          </div>
        )}

        {entrou ? (
          <div className="ei-portas">
            {tipo === "company" ? (
              <>
                {/* Vai para a escolha da empresa, e não para o painel de
                    uma delas: quem tem duas lojas escolhe qual abrir, e
                    quem tem uma vê ali o "+" para cadastrar a segunda. */}
                <Link to="/minhas-empresas" className="ei-porta ei-porta-cheia">
                  <span className="ei-porta-nome">Minhas empresas</span>
                  <span className="ei-porta-nota">Escolha a empresa e veja as vagas dela</span>
                </Link>
                {/* O laranja da logo, e só aqui.
                    ───────────────────────────────
                    A dona: "o botão de banco de dados pode ter a mesma cor
                    laranja da logo."

                    O laranja é a bolinha do "Ei": no desenho da marca ele
                    aparece uma vez, pequeno, e é isso que o faz saltar.
                    Usado em dois botões da mesma tela ele deixaria de ser
                    destaque e viraria só mais uma cor — então este é o
                    único lugar da tela que o usa, e "Minhas vagas" fica no
                    azul cheio. */}
              </>
            ) : (
              <>
                <Link to="/vagas-para-mim" className="ei-porta ei-porta-cheia">
                  <span className="ei-porta-nome">Vagas para mim</span>
                  <span className="ei-porta-nota">O que chegou para o seu ofício</span>
                </Link>
                {/* O banco de vagas.
                    ─────────────────
                    A dona: "tem que criar um banco de vagas, assim como o
                    de talentos, nela as pessoas poderão acessar as vagas
                    que estão em aberto das empresas."

                    A porta de cima mostra o que a ONDA escolheu mandar;
                    esta mostra TUDO que está no ar. A diferença importa
                    porque a onda compara texto e erra: quem se cadastrou
                    como "auxiliar de limpeza" não recebe a vaga de
                    "camareira" sendo exatamente a pessoa.

                    Fica fora da barra de baixo de propósito — a barra tem
                    quatro lugares, e os quatro foram escolhidos pela dona
                    ("retornar, as notificações, banco de talentos, painel").
                    Um quinto item espremeria os outros quatro. */}
                <Link to="/vagas" className="ei-porta">
                  <span className="ei-porta-nome">Banco de vagas</span>
                  <span className="ei-porta-nota">Todas as vagas abertas da cidade</span>
                </Link>
                <Link to="/painel" className="ei-porta">
                  <span className="ei-porta-nome">Meu cadastro</span>
                  <span className="ei-porta-nota">Suas funções, horários e contato</span>
                </Link>
              </>
            )}
          </div>
        ) : (
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
          {/* O banco de talentos desceu para cá — 02/09
              ────────────────────────────────────────────
              A dona: "o botão de banco de talentos também pode ficar no
              final da página."

              Ele era a segunda porta, do mesmo tamanho de "Minhas
              empresas". Só que as duas não têm o mesmo peso: quem abre o
              app do lado da empresa vem cuidar das vagas dela, e olhar
              quem está disponível é o que se faz DEPOIS. Duas portas
              grandes lado a lado fazem a pessoa escolher entre coisas que
              não competem. */}
          {tipo === "company" && entrou && (
            <Link to="/profissionais" className="ei-porta ei-porta-laranja">
              <span className="ei-porta-nome">Banco de talentos</span>
              <span className="ei-porta-nota">Quem está disponível na cidade</span>
            </Link>
          )}

          <InstalarApp variante="botao" />
        </div>
      </div>
    </div>
  );
}
