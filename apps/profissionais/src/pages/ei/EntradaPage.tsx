import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { useOnboardingStatus } from "../../lib/useOnboardingStatus";
import { registrarTipoDeUsuario } from "../../lib/company";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { InstalarApp } from "../../components/InstalarApp";
import { IconePorta } from "./ComecarPage";

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
  /* Segura os dois botões: dois toques rápidos levariam a pessoa para
     dois lugares em sequência, e o segundo toque só faz sentido depois
     que o primeiro terminou de gravar. */
  const [trocando, setTrocando] = useState(false);

  /* ── OS BOTÕES TRAVAVAM AO VOLTAR — 03/09 ────────────────────────────
     A dona: "quando clica em voltar pra tela de início os botões de
     procuro emprego e quero contratar estão travando. Só volta quando
     atualiza a página."

     A causa é a saída daqui ser um `location.href`, e não uma navegação
     do roteador: a tela some do React e o navegador guarda a página
     inteira, VIVA, no cache de voltar (bfcache) — com o estado que ela
     tinha no momento da saída, ou seja, `trocando = true`. Ao voltar, a
     página não é montada de novo (nenhum `useState` roda), então o
     primeiro `if` de `irParaOLado` continua saindo sem fazer nada e os
     dois botões continuam `disabled`. Atualizar a página resolvia porque
     aí sim tudo era montado do zero.

     `pageshow` é o único evento que avisa essa volta (o `useEffect` não
     roda: o componente nunca desmontou). Destravar sempre que a tela
     reaparece é seguro — se a pessoa está vendo esta tela, não há
     gravação em curso para proteger. */
  useEffect(() => {
    function aoReaparecer() {
      setTrocando(false);
    }
    window.addEventListener("pageshow", aoReaparecer);
    /* E também quando a aba volta a ficar visível: no iPhone o gesto de
       voltar nem sempre dispara `pageshow`, e aí o app fica com a tela
       viva e os botões mortos — que é exatamente o sintoma relatado. */
    document.addEventListener("visibilitychange", aoReaparecer);
    return () => {
      window.removeEventListener("pageshow", aoReaparecer);
      document.removeEventListener("visibilitychange", aoReaparecer);
    };
  }, []);

  /**
   * Escolhe o ambiente e vai para a tela DELE.
   *
   * A dona: "na tela de por onde começamos só deveria ter a opção de
   * procuro trabalho ou quero contratar, daí dentro dessas telas teriam
   * os demais botões."
   *
   * Antes esta função só fazia sentido para TROCAR de lado — quem já
   * estava no lado tocado nem chamava o clique (`novo === tipo` saía sem
   * fazer nada), porque as portas daquele lado já estavam logo abaixo, na
   * mesma tela. Agora esta tela não tem mais porta nenhuma: os dois
   * botões são a única forma de chegar a qualquer um dos dois lados,
   * então tocar no que já é o seu tem que navegar do mesmo jeito.
   *
   * Só grava um lado novo no banco quando ele muda — gravar de novo o
   * mesmo lado seria uma escrita à toa a cada visita.
   *
   * Recarrega por `location.href` em vez de navegar pelo roteador: o lado
   * é lido uma vez, na abertura, pela barra de baixo e por várias telas.
   * Trocar pelo roteador deixaria a barra mostrando os itens do lado
   * antigo — e a pessoa acharia que a troca não funcionou.
   */
  async function irParaOLado(lado: "professional" | "company") {
    if (!user || trocando) return;
    const destino = lado === "company" ? "/comecar-empresa" : "/comecar-profissional";
    if (lado === tipo) {
      window.location.href = destino;
      return;
    }
    setTrocando(true);
    try {
      await registrarTipoDeUsuario(user.id, lado);
      window.location.href = destino;
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
        {/* ── SÓ A ESCOLHA, NADA MAIS — 02/09 ─────────────────────────
            A dona: "na tela de por onde começamos só deveria ter a opção
            de procuro trabalho ou quero contratar, daí dentro dessas
            telas teriam os demais botões."

            Antes esta tela acumulava duas coisas: a escolha do lado E os
            caminhos daquele lado (Meu cadastro, Vagas compatíveis, Banco
            de talentos — ou os da empresa), tudo junto embaixo da escolha.
            Quem só queria trocar de lado via uma lista inteira de botões
            que não pediu.

            Agora esta tela pergunta uma coisa e uma coisa só. As portas de
            cada lado — e o aviso de perfil incompleto, que é sobre elas —
            se mudaram para dentro da tela que cada botão abre. Ver
            `ComecarPage.tsx`. */}
        {entrou && (tipo === "company" || tipo === "professional") && (
          <div className="ei-ambiente">
            {/* O rótulo "Você está em — toque para trocar de lado" saiu.
                ─────────────────────────────────────────────────────────
                A dona pediu para tirar. Quem já sabe qual lado está ativo
                vê pelo próprio botão marcado (`ativo`, `aria-pressed`) —
                a frase só repetia por extenso o que a cor já dizia. */}
            {/* Um debaixo do outro, com ícone — a dona: "os botões de
                procuro trabalho e quero contratar podem ter ícones e
                ficar um debaixo do outro". Empilhados em vez de lado a
                lado: cada botão ganha a largura toda para o ícone, o nome
                e ficar do tamanho de um alvo de toque confortável. */}
            <div className="ei-ambiente-botoes ei-ambiente-empilhado" role="group" aria-label="Escolher o ambiente">
              <button
                type="button"
                className={tipo === "professional" ? "ei-ambiente-botao ativo" : "ei-ambiente-botao"}
                aria-pressed={tipo === "professional"}
                disabled={trocando}
                onClick={() => irParaOLado("professional")}
              >
                <IconePorta desenho="pessoa" />
                Procuro emprego
              </button>
              <button
                type="button"
                className={tipo === "company" ? "ei-ambiente-botao ativo" : "ei-ambiente-botao"}
                aria-pressed={tipo === "company"}
                disabled={trocando}
                onClick={() => irParaOLado("company")}
              >
                <IconePorta desenho="predio" />
                Quero contratar
              </button>
            </div>
          </div>
        )}

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
