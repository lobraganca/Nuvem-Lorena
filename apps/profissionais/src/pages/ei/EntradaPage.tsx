import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { useOnboardingStatus } from "../../lib/useOnboardingStatus";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { InstalarApp } from "../../components/InstalarApp";

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
  useTituloDaPagina("Emprego em Itabirito");
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
  const paraOnde = !loading && user && tipo
    ? tipo === "company" ? "/painel-empresa" : "/vagas-para-mim"
    : null;

  useEffect(() => {
    if (paraOnde) navegar(paraOnde, { replace: true });
  }, [paraOnde, navegar]);

  if (paraOnde) return null;

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
          <h1 className="ei-entrada-titulo">Emprego em Itabirito</h1>
          {/* Uma linha. A anterior tinha duas orações e dizia, com vinte
              palavras, o que os dois botões logo abaixo dizem com seis. */}
          {/* Era "De que lado você está?", que fazia par com as duas
              portas. Com a pergunta adiada para depois da conta, a frase
              ficou anunciando uma escolha que não está mais nesta tela. */}
          <p className="ei-entrada-apoio">Vagas e serviços da cidade, no seu celular.</p>
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
        {/* Dois botões, e não um "entrar ou criar conta".
            ───────────────────────────────────────────────
            A dona: "no início pode ter entrar e criar conta em botões
            diferentes."

            O que isso resolve: as duas pessoas que chegam nesta tela
            querem coisas opostas. Quem já tem conta quer digitar a senha e
            passar; quem é nova precisa do código por SMS. Com um botão só,
            as duas caíam na mesma tela e uma delas tinha que trocar o modo
            à mão — e quem não entendeu que precisava trocar ficava batendo
            numa senha que nunca criou.

            Cada botão abre o login já no caminho certo (`?acao=`), e criar
            conta vem primeiro porque é o que a maioria fará nos primeiros
            meses: o app é novo, quase todo mundo é gente nova. */}
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
          <div className="ei-lista">
            <InstalarApp />
          </div>
        </div>
      </div>
    </div>
  );
}
