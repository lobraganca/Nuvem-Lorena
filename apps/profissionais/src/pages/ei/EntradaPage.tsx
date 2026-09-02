import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { useOnboardingStatus } from "../../lib/useOnboardingStatus";
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
          {/* "Ei", e não "Emprego em Itabirito".
              ─────────────────────────────────────
              A dona: "nas telas onde tem escrito 'Emprego em Itabirito',
              acho melhor mudar para Ei".

              O nome comprido era descrição, não marca: dizia o que o app
              faz, o que a linha logo abaixo já diz melhor, e ocupava duas
              linhas no celular. "Ei" é o que está no ícone, no aparelho e
              na boca das pessoas — e é o que a pessoa procura quando quer
              achar o app de novo. */}
          <h1 className="ei-entrada-titulo ei-marca-titulo">Ei</h1>
          {/* Uma linha. A anterior tinha duas orações e dizia, com vinte
              palavras, o que os dois botões logo abaixo dizem com seis. */}
          {/* Era "De que lado você está?", que fazia par com as duas
              portas. Com a pergunta adiada para depois da conta, a frase
              ficou anunciando uma escolha que não está mais nesta tela. */}
          <p className="ei-entrada-apoio">
            {entrou
              ? "Por onde você quer começar?"
              : "Vagas e serviços da cidade, no seu celular."}
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

        {entrou ? (
          <div className="ei-portas">
            {tipo === "company" ? (
              <>
                <Link to="/painel-empresa" className="ei-porta ei-porta-cheia">
                  <span className="ei-porta-nome">Minhas vagas</span>
                  <span className="ei-porta-nota">Publicar, acompanhar e ver quem respondeu</span>
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
                <Link to="/profissionais" className="ei-porta ei-porta-laranja">
                  <span className="ei-porta-nome">Banco de talentos</span>
                  <span className="ei-porta-nota">Quem está disponível na cidade</span>
                </Link>
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
          <InstalarApp variante="botao" />
        </div>
      </div>
    </div>
  );
}
