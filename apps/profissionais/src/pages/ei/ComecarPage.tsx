import { Link } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { useOnboardingStatus } from "../../lib/useOnboardingStatus";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { InstalarApp } from "../../components/InstalarApp";
import { AvisoPerfilIncompleto } from "../../components/ei/AvisoPerfilIncompleto";
import { PortaDosAvisos } from "../../components/ei/PortaDosAvisos";
import { PortaDoPlano } from "../../components/ei/PortaDoPlano";

/**
 * A tela de um lado: os botões que antes viviam na porta de entrada.
 *
 * ── POR QUE SAIU DA ENTRADA ────────────────────────────────────────────
 *
 * A dona: "na tela de por onde começamos só deveria ter a opção de
 * procuro trabalho ou quero contratar, daí dentro dessas telas teriam os
 * demais botões."
 *
 * A `EntradaPage` respondia duas perguntas ao mesmo tempo: "de que lado
 * você está?" e, embaixo da resposta, "o que você quer fazer nele?". A
 * segunda pergunta só faz sentido depois da primeira, e misturar as duas
 * numa tela só fazia quem só queria TROCAR de lado passar pela lista
 * inteira de botões do lado antigo antes de ver os dois de escolha.
 *
 * Duas rotas usam este mesmo componente — `/comecar-profissional` e
 * `/comecar-empresa` — porque o layout é idêntico e só o conteúdo muda
 * com `lado`. Ver `App.tsx`.
 *
 * ── QUEM PODE VER ────────────────────────────────────────────────────
 *
 * Esta tela não confere se `lado` bate com o tipo de conta registrado: a
 * `EntradaPage` só manda para cá depois de gravar o lado escolhido, então
 * quando esta tela monta os dois já concordam. Conferir de novo aqui
 * seria duplicar uma verdade que já foi estabelecida um passo atrás.
 */
export function ComecarPage({ lado }: { lado: "professional" | "company" }) {
  useTituloDaPagina(lado === "company" ? "Quero contratar" : "Procuro emprego");
  const { loading } = useAuth();
  const tipo = useOnboardingStatus();
  const entrou = !loading;

  return (
    <div className="ei">
      <div className="ei-tela ei-entrada">
        <div className="ei-entrada-topo">
          <h1 className="ei-entrada-titulo">
            {lado === "company" ? "Quero contratar" : "Procuro emprego"}
          </h1>
          <p className="ei-entrada-apoio">
            {lado === "company"
              ? "Publique vagas e veja quem se interessou."
              : "Seu cadastro, as vagas que combinam com você, e quem mais procura na cidade."}
          </p>
        </div>

        {/* O aviso do cadastro pela metade (a dona: "ao escolher o
            ambiente, se o perfil não estiver preenchido, deve ter um aviso
            na tela"). Veio junto das portas quando elas se mudaram para
            cá: é sobre o que a pessoa vai fazer ao tocar numa delas —
            longe das portas, ela já teria saído da tela antes de ler. */}
        {entrou && tipo === lado && <AvisoPerfilIncompleto lado={lado} />}

        <div className="ei-portas">
          {lado === "company" ? (
            /* Vai para a escolha da empresa, e não para o painel de uma
               delas: quem tem duas lojas escolhe qual abrir, e quem tem
               uma vê ali o "+" para cadastrar a segunda. */
            <>
              <Link to="/minhas-empresas" className="ei-porta ei-porta-cheia">
                <IconePorta desenho="predio" />
                <span className="ei-porta-nome">Minhas empresas</span>
                <span className="ei-porta-nota">Escolha a empresa e veja as vagas dela</span>
              </Link>
              {/* O plano subiu para cá — 03/09
                  ─────────────────────────────
                  A dona: "nessa tela pode colocar 'meu plano' e tirar a
                  informação da tela de minhas empresas."

                  Lá ele era uma faixa no fim da lista de lojas, vista só
                  por quem rolava até o fim de uma tela que é sobre
                  escolher a empresa. Aqui é uma porta como as outras, e a
                  própria nota já responde o que a pessoa ia conferir: qual
                  plano está valendo e quantas vagas cabem nele. */}
              <PortaDoPlano />
            </>
          ) : (
            <>
              {/* A ordem tem lógica de uso, e não só de gosto: sem o
                  cadastro preenchido nenhuma vaga chega (a onda procura
                  por ofício), então ele vem primeiro — e é a única coisa
                  desta tela que depende da pessoa. */}
              {/* Vai para a ESCOLHA do cadastro, e não direto ao
                  formulário — a dona: "ao clicar em cadastro dentro do
                  profissional deve abrir uma tela igual a de empresa para
                  a pessoa selecionar o perfil, por mais que só tenha 1."

                  Mesma decisão do lado da empresa, que abre em "Suas
                  empresas": quem tem dois escolhe qual, e quem tem um vê
                  ali que dá para ter outro. Quem ainda não tem nenhum é
                  levado direto ao formulário pela própria tela de escolha. */}
              <Link to="/meus-cadastros" className="ei-porta ei-porta-cheia">
                <IconePorta desenho="pessoa" />
                <span className="ei-porta-nome">Meu cadastro</span>
                <span className="ei-porta-nota">Suas funções, horários e contato</span>
              </Link>
              {/* "Vagas compatíveis" no lugar de "Vagas para mim": o nome
                  antigo não dizia POR QUE aquelas vagas estão ali, e a
                  diferença para o banco de vagas — que mostra tudo —
                  ficava invisível. */}
              <Link to="/vagas-para-mim" className="ei-porta">
                <IconePorta desenho="mala" />
                <span className="ei-porta-nome">Vagas compatíveis</span>
                <span className="ei-porta-nota">O que combina com o seu ofício</span>
              </Link>
              {/* ── A PORTA DOS AVISOS — 03/09 ─────────────────────────
                  A dona: "na tela de procuro emprego pode ter um botão de
                  notificações que mostre se a pessoa foi chamada por
                  alguma onda."

                  Os avisos já estavam na barra de baixo, mas ali eles são
                  um sino pequeno no meio de cinco ícones — e é justamente
                  esta a notícia que a pessoa abre o app para ver. Aqui a
                  porta DIZ o que tem dentro: quantas vagas chegaram e se
                  alguma ainda não foi aberta. */}
              <PortaDosAvisos />
            </>
          )}
        </div>

        {/* Banco de talentos e Banco de vagas — quadrados, sempre DEPOIS
            das portas principais, nos dois lados. A ordem já mudou várias
            vezes (ver histórico no git); a última palavra da dona foi
            "na tela de procuro emprego: os botões de banco de talentos e
            de vagas devem ficar de baixo de vagas compatíveis" — ou seja,
            depois de TODAS as portas, não entre elas nem antes. */}
        <Atalhos />

        <div className="ei-entrada-pe">
          <InstalarApp variante="botao" />
        </div>
      </div>
    </div>
  );
}

/**
 * Banco de talentos + Banco de vagas, lado a lado, quadrados.
 *
 * Extraído porque a ORDEM em que este par aparece muda com o lado (ver o
 * comentário em `ComecarPage`), e repetir o par duas vezes no JSX é como
 * uma das duas cópias fica para trás na próxima mudança de texto.
 */
function Atalhos() {
  return (
    <div className="ei-atalhos">
      <Link to="/profissionais" className="ei-atalho">
        <IconePorta desenho="pessoas" />
        <span>Banco de talentos</span>
      </Link>
      <Link to="/vagas" className="ei-atalho">
        <IconePorta desenho="mala" />
        <span>Banco de vagas</span>
      </Link>
    </div>
  );
}

/**
 * O ícone de uma porta.
 *
 * A dona: "colocar ícones nas opções de meu cadastro, vagas compatíveis,
 * banco de talentos."
 *
 * Desenhados aqui, e não trazidos de uma biblioteca de ícones: são quatro,
 * e uma dependência inteira para quatro desenhos é peso que o 4G da cidade
 * paga toda vez que alguém abre o app. É a mesma decisão da barra de baixo
 * (ver NavegacaoEi), e os traços são os mesmos de lá de propósito — o
 * ícone de "pessoas" da porta tem que ser reconhecível como o mesmo do
 * botão "Talentos".
 *
 * `aria-hidden` porque o nome da porta está escrito ao lado: um leitor de
 * tela que anunciasse "imagem, mala" antes de "Vagas compatíveis" só
 * atrapalharia.
 */
export function IconePorta({
  desenho,
}: {
  desenho: "pessoa" | "pessoas" | "mala" | "predio" | "selo" | "sino" | "escudo";
}) {
  return (
    <span className="ei-porta-icone" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
           strokeLinecap="round" strokeLinejoin="round">
        {desenho === "pessoa" && (
          <>
            <circle cx="12" cy="8" r="3.6" />
            <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
          </>
        )}
        {desenho === "pessoas" && (
          <>
            <circle cx="9" cy="8.5" r="3.2" />
            <path d="M3 19.5a6 6 0 0 1 12 0" />
            <path d="M16.5 6.2a3.2 3.2 0 0 1 0 6.1" />
            <path d="M18 15.2a6 6 0 0 1 3 4.3" />
          </>
        )}
        {desenho === "mala" && (
          <>
            <rect x="3" y="7" width="18" height="13" rx="2.5" />
            <path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7" />
            <path d="M3 12h18" />
          </>
        )}
        {/* O selo do plano: um distintivo, não um cifrão. O plano aqui é
            o que a empresa TEM contratado — a tela de preços é que vende,
            e um símbolo de dinheiro na porta faria a pessoa achar que
            tocar já é comprar. */}
        {/* O escudo da administração. Mesmo desenho da linha que ele
            substituiu na tela de Conta, para quem já o conhecia não
            precisar reconhecer outro. */}
        {desenho === "escudo" && (
          <path d="M12 2.8l7.5 2.8v6c0 4.4-3 8.1-7.5 9.6-4.5-1.5-7.5-5.2-7.5-9.6v-6z" />
        )}
        {/* O sino dos avisos. Mesmo traço dos outros — um sino cheio
            pareceria um alerta de erro, e isto aqui é boa notícia. */}
        {desenho === "sino" && (
          <>
            <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5" />
            <path d="M13.7 19a2 2 0 0 1-3.4 0" />
          </>
        )}
        {desenho === "selo" && (
          <>
            <path d="M12 3.2l2.4 1.6 2.9.2.9 2.8 2 2.1-1.3 2.6.3 2.9-2.7 1.1-1.8 2.3-2.7-.8-2.7.8-1.8-2.3-2.7-1.1.3-2.9L4 9.9l2-2.1.9-2.8 2.9-.2z" />
            <path d="M9.5 12.2l1.8 1.8 3.4-3.6" />
          </>
        )}
        {desenho === "predio" && (
          <>
            <path d="M4 20V6.5A1.5 1.5 0 0 1 5.5 5h7A1.5 1.5 0 0 1 14 6.5V20" />
            <path d="M14 11h4.5A1.5 1.5 0 0 1 20 12.5V20" />
            <path d="M2.5 20h19" />
            <path d="M7 9h4M7 13h4M17 15h1" />
          </>
        )}
      </svg>
    </span>
  );
}
