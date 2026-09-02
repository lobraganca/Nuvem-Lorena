import { Link } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { useOnboardingStatus } from "../../lib/useOnboardingStatus";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { InstalarApp } from "../../components/InstalarApp";
import { AvisoPerfilIncompleto } from "../../components/ei/AvisoPerfilIncompleto";

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
  useTituloDaPagina(lado === "company" ? "Quero contratar" : "Procuro trabalho");
  const { loading } = useAuth();
  const tipo = useOnboardingStatus();
  const entrou = !loading;

  return (
    <div className="ei">
      <div className="ei-tela ei-entrada">
        <div className="ei-entrada-topo">
          <h1 className="ei-entrada-titulo">
            {lado === "company" ? "Quero contratar" : "Procuro trabalho"}
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
            <>
              {/* Vai para a escolha da empresa, e não para o painel de
                  uma delas: quem tem duas lojas escolhe qual abrir, e
                  quem tem uma vê ali o "+" para cadastrar a segunda. */}
              <Link to="/minhas-empresas" className="ei-porta ei-porta-cheia">
                <IconePorta desenho="predio" />
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
                  único lugar da tela que o usa. */}
              <Link to="/profissionais" className="ei-porta ei-porta-laranja">
                <IconePorta desenho="pessoas" />
                <span className="ei-porta-nome">Banco de talentos</span>
                <span className="ei-porta-nota">Quem está disponível na cidade</span>
              </Link>
              <Link to="/vagas" className="ei-porta">
                <IconePorta desenho="mala" />
                <span className="ei-porta-nome">Banco de vagas</span>
                <span className="ei-porta-nota">Todas as vagas abertas da cidade</span>
              </Link>
            </>
          ) : (
            <>
              {/* ── A ORDEM DAS PORTAS, PEDIDA PELA DONA — 02/09 ───────
                  "Na tela de procuro trabalho, ter os botões nessa
                  ordem: meu cadastro — vagas compatíveis — banco de
                  talentos."

                  A ordem tem lógica de uso, e não só de gosto: sem o
                  cadastro preenchido nenhuma vaga chega (a onda procura
                  por ofício), então ele vem primeiro — e é a única coisa
                  desta tela que depende da pessoa. Depois o que ela veio
                  ver, e por último a lista de quem mais está procurando.

                  "Vagas compatíveis" no lugar de "Vagas para mim": o
                  nome antigo não dizia POR QUE aquelas vagas estão ali,
                  e a diferença para o banco de vagas — que mostra tudo —
                  ficava invisível. */}
              <Link to="/painel" className="ei-porta ei-porta-cheia">
                <IconePorta desenho="pessoa" />
                <span className="ei-porta-nome">Meu cadastro</span>
                <span className="ei-porta-nota">Suas funções, horários e contato</span>
              </Link>
              <Link to="/vagas-para-mim" className="ei-porta">
                <IconePorta desenho="mala" />
                <span className="ei-porta-nome">Vagas compatíveis</span>
                <span className="ei-porta-nota">O que combina com o seu ofício</span>
              </Link>
              <Link to="/profissionais" className="ei-porta ei-porta-laranja">
                <IconePorta desenho="pessoas" />
                <span className="ei-porta-nome">Banco de talentos</span>
                <span className="ei-porta-nota">Quem está procurando trabalho na cidade</span>
              </Link>
              {/* A dona: "criar opção de ver as vagas em ambos os casos
                  profissional e empresas." Para quem procura trabalho, o
                  banco de vagas é a rede embaixo do aviso automático, que
                  compara texto e erra (quem se cadastrou como "auxiliar de
                  limpeza" não recebe a vaga de "camareira" sendo
                  exatamente a pessoa). */}
              <Link to="/vagas" className="ei-porta">
                <IconePorta desenho="mala" />
                <span className="ei-porta-nome">Banco de vagas</span>
                <span className="ei-porta-nota">Todas as vagas abertas da cidade</span>
              </Link>
            </>
          )}
        </div>

        <div className="ei-entrada-pe">
          <InstalarApp variante="botao" />
        </div>
      </div>
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
function IconePorta({ desenho }: { desenho: "pessoa" | "pessoas" | "mala" | "predio" }) {
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
