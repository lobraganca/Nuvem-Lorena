import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { useOnboardingStatus } from "../../lib/useOnboardingStatus";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { saudacaoDoDia } from "../../lib/saudacao";
import { useQuemEstaOnline } from "../../lib/presence";
import { lerMeuPerfil } from "../../lib/meuPerfil";
import { empresaAtual } from "../../lib/company";
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
  const { user, loading } = useAuth();
  const tipo = useOnboardingStatus();
  const entrou = !loading;

  /* ── A SAUDAÇÃO — 05/09 ───────────────────────────────────────────
     A dona: "colocar uma frase motivacional na tela da empresa e do
     profissional. 'Ei Lorena, que bom te ver de novo.'"

     O nome vem do cadastro. Falha em silêncio de propósito: sem nome a
     frase existe na versão sem nome (ver `saudacao.ts`), e derrubar a
     tela inicial do app por causa de um cumprimento seria trocar uma
     gentileza por um defeito. */
  /* ── E O NOME DA EMPRESA, QUANDO NÃO HÁ O DA PESSOA — 05/09 ───────
     A dona: "quando não tem perfil profissional, ao entrar a saudação
     deve ser o nome da empresa."

     O nome saía só de `lerMeuPerfil`, que lê a tabela `professionals`.
     Quem entrou para CONTRATAR e cadastrou apenas a empresa não tem linha
     nenhuma ali — então a saudação caía na versão sem nome, e o app abria
     dizendo "Vamos com tudo hoje?" para alguém que ele conhece pelo nome
     desde o cadastro. É o caso mais comum do lado da empresa, não a
     exceção.

     A ordem é a que ela descreveu: a pessoa primeiro, a empresa quando não
     existe pessoa. Quem tem os dois cadastros continua sendo chamado pelo
     próprio nome — "Ei Lorena" é melhor que "Ei Padaria Pão de Minas"
     para quem tem nome.

     `de` acompanha o nome porque nome de empresa não se encurta como nome
     de gente (ver `saudacao.ts`). Os dois andam juntos num estado só para
     não existir o instante em que o nome já trocou e o tipo ainda não —
     seria "Ei Padaria" na tela, por um quadro. */
  const [quem, setQuem] = useState<{ nome: string; de: "pessoa" | "empresa" }>({
    nome: "",
    de: "pessoa",
  });
  useEffect(() => {
    if (!user) return;
    let vivo = true;
    (async () => {
      /* Falha em silêncio de propósito, nas duas buscas: sem nome a frase
         existe na versão sem nome, e derrubar a tela inicial do app por
         causa de um cumprimento seria trocar uma gentileza por um
         defeito. */
      let daPessoa = "";
      try {
        daPessoa = (await lerMeuPerfil(user.id))?.name ?? "";
      } catch {
        /* segue para a empresa */
      }
      if (!vivo) return;
      if (daPessoa.trim()) {
        setQuem({ nome: daPessoa, de: "pessoa" });
        return;
      }
      try {
        const empresa = await empresaAtual(user.id);
        if (vivo && empresa?.company_name) {
          setQuem({ nome: empresa.company_name, de: "empresa" });
        }
      } catch {
        /* fica sem nome, e a frase sem nome dá conta */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [user]);

  return (
    <div className="ei">
      <div className="ei-tela ei-entrada">
        <div className="ei-entrada-topo">
          {/* ── O ON-LINE SUBIU PARA CIMA DA SAUDAÇÃO — 05/09 ────────
              A dona: "o on-line pode ser em cima da saudação."

              Ela já tinha subido hoje de manhã, do fim da tela para
              debaixo do cumprimento (antes, quem não rolasse até o fim
              nunca via o movimento do app). Agora vai um degrau acima.

              E fica melhor assim: a linha é sobre a CIDADE — quantas
              pessoas e empresas estão aqui agora — e o cumprimento é sobre
              QUEM ESTÁ LENDO. Do mais largo para o mais próximo é a ordem
              em que se chega num lugar. */}
          {entrou && <QuemEstaAqui />}
          {/* Vem ANTES do título, e miúda: é um cumprimento, não o nome
              da tela. Acima do título ela é a primeira coisa que se lê e
              some do caminho; no lugar do título, viraria o assunto. */}
          {entrou && <p className="ei-saudacao">{saudacaoDoDia(quem.nome, quem.de)}</p>}
          {/* ── O LADO DE QUEM PROCURA VIROU PERGUNTA — 05/09 ────────
              A dona: "a pergunta da tela inicial deve ser 'Procura
              emprego?'".

              Era "Procuro emprego", na primeira pessoa — a mesma frase do
              botão da porta, onde ela é a RESPOSTA de quem escolheu o
              lado. Repetida aqui dentro ela não diz mais nada: a pessoa já
              escolheu, e o app está afirmando por ela uma coisa que ela
              acabou de afirmar.

              Como pergunta, o título volta a ter trabalho: ele abre a
              tela e a linha de apoio logo abaixo responde. */}
          <h1 className="ei-entrada-titulo">
            {lado === "company" ? "Quero contratar" : "Procura emprego?"}
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
              {/* ── PUBLICAR VAGA VIRA A PRIMEIRA PORTA — 04/09 ─────────
                  Achado usando o app como quem precisa contratar hoje: a
                  tela de "Quero contratar" oferecia ver as empresas, ver o
                  plano, o banco de talentos e o banco de vagas — e NÃO
                  oferecia publicar uma vaga. Para publicar era preciso
                  entrar em "Minhas empresas", escolher a empresa, abrir o
                  painel dela e só então achar o botão: três toques até a
                  ação que é o motivo de o app existir para esse lado.

                  Ela vira a porta cheia, que é a de mais peso, e "Minhas
                  empresas" desce para porta comum — ver o que já existe é
                  consulta; publicar é o trabalho.

                  A tela de criar já resolve sozinha qual empresa é e o que
                  fazer quando o plano está cheio, então não há decisão
                  nenhuma a tomar antes de tocar aqui. */}
              <Link to="/criar-vaga" className="ei-porta ei-porta-cheia">
                <IconePorta desenho="mala" />
                <span className="ei-porta-nome">Publicar uma vaga</span>
                <span className="ei-porta-nota ei-uma-linha">
                  O app avisa quem faz esse serviço na cidade
                </span>
              </Link>
              <Link to="/minhas-empresas" className="ei-porta">
                <IconePorta desenho="predio" />
                {/* "e vagas" a pedido da dona: a porta leva à escolha da
                    empresa, mas o que se vai fazer lá dentro é mexer nas
                    vagas dela — e quem lia só "Minhas empresas" procurava
                    as vagas noutro lugar. */}
                <span className="ei-porta-nome">Minhas empresas e vagas</span>
                <span className="ei-porta-nota ei-uma-linha">Escolha a empresa e veja as vagas</span>
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
                <span className="ei-porta-nota ei-uma-linha">Funções, horários e contato</span>
              </Link>
              {/* "Vagas compatíveis" no lugar de "Vagas para mim": o nome
                  antigo não dizia POR QUE aquelas vagas estão ali, e a
                  diferença para o banco de vagas — que mostra tudo —
                  ficava invisível. */}
              <Link to="/vagas-para-mim" className="ei-porta">
                <IconePorta desenho="mala" />
                <span className="ei-porta-nome">Vagas compatíveis</span>
                <span className="ei-porta-nota ei-uma-linha">O que combina com você</span>
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

              {/* A porta "Bicos e freelas" ficou pronta em 04/09 e saiu no
                  mesmo dia, a pedido da dona: "tire o botão de freelas e
                  bicos, não vou colocar isso por enquanto". O recorte
                  continua existindo em `/vagas?t=freela` (ver
                  BancoDeVagasPage) — é uma linha de filtro, não uma tela —,
                  então voltar a oferecê-lo é pôr esta porta de volta. */}

              {/* ── MEU DESEMPENHO — 04/09 ──────────────────────────────
                  A dona: "ter uma opção de métricas... seu perfil apareceu
                  para 8 empresas esta semana."

                  A porta fica no fim das do lado de quem procura porque
                  ela não é um caminho para fazer alguma coisa: é a
                  resposta para "e aí, está adiantando?", que é a pergunta
                  que faz a pessoa abrir o app quando não recebeu nada. */}
              <Link to="/meu-desempenho" className="ei-porta">
                <IconePorta desenho="selo" />
                <span className="ei-porta-nome">Meu desempenho</span>
                <span className="ei-porta-nota ei-uma-linha">
                  Quem te viu, e onde você apareceu
                </span>
              </Link>
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
/**
 * "3 empresas e 8 pessoas com o app aberto agora."
 *
 * Conta pelo Presence do Supabase (ver `lib/presence.ts`): cada aba
 * anuncia uma chave aleatória e de que lado está, e some sozinha ao
 * fechar. Nenhum dado pessoal trafega — não dá para saber QUEM está
 * online, só quantos.
 *
 * O pontinho verde pulsa. É o único movimento da tela, e é ele que faz o
 * número ser lido como "agora" em vez de "no total".
 */
function QuemEstaAqui() {
  const quem = useQuemEstaOnline();

  /* ── SUMIR FOI ERRO MEU — 05/09 ─────────────────────────────────────
     A dona: "não consegui ver os on-line."

     Estava assim aqui:

       if (outros <= 0 && meus <= 0) return null;

     ou seja: sozinha no app, a linha sumia inteira. Foi decisão minha, e o
     raciocínio era "0 empresas agora é a verdade, e é também a frase que
     faz a pessoa fechar o app". O raciocínio não estava errado — estava
     incompleto, e o que faltava é o que aconteceu com ela: um contador que
     desaparece é um contador em que não dá para confiar. Ela não tinha
     como saber se o app estava vazio ou se a peça estava quebrada. Eu
     também não, só pela mensagem dela.

     Agora a linha só some enquanto o app AINDA NÃO SABE (`quem` nulo, que
     é o instante entre abrir a tela e o canal responder). Sabendo, ela
     diz — inclusive quando a resposta é "só você".

     E a conta passou a INCLUIR a própria pessoa: "2 pessoas" com você
     dentro é mais fácil de conferir do que "1 outra pessoa", que obriga
     quem lê a somar. */
  if (!quem) return null;

  const pedacos: string[] = [];
  if (quem.profissionais > 0) {
    pedacos.push(
      `${quem.profissionais} ${quem.profissionais === 1 ? "pessoa" : "pessoas"}`
    );
  }
  if (quem.empresas > 0) {
    pedacos.push(`${quem.empresas} ${quem.empresas === 1 ? "empresa" : "empresas"}`);
  }

  return (
    <p className="ei-ao-vivo">
      <span className="ei-ao-vivo-ponto" aria-hidden="true" />
      {/* Sozinha, a frase é essa e não "1 pessoa no app agora": o número um
          referindo-se a você mesma é a informação mais estranha que uma
          tela pode dar. */}
      {/* ── "1 PESSOA ON-LINE", E NÃO "SÓ VOCÊ" — 05/09 ──────────────
          A dona: "ao invés de só você on-line, escreva uma pessoa
          on-line."

          Ela tem razão e o motivo é mais fundo do que a palavra: "só
          você" fala SOBRE a pessoa que está lendo, e vira um comentário
          sobre a solidão dela. "1 pessoa on-line" é a mesma informação
          contada do jeito que se conta um número — e no dia em que
          houver quinze, a frase é a mesma, só com outro número. */}
      {pedacos.length === 0
        ? `${quem.total} ${quem.total === 1 ? "pessoa" : "pessoas"} on-line`
        : `${pedacos.join(" e ")} on-line`}
    </p>
  );
}

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
