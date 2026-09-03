import { useEffect, useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { ehAppDaLoja } from "../lib/plataforma";

/**
 * "Adicionar à tela do celular".
 *
 * O app é um site que funciona como aplicativo (PWA): instalado, ele ganha
 * ícone próprio, abre sem a barra do navegador e o endereço deixa de ser algo
 * que a pessoa precisa lembrar de digitar. Sem esse atalho, quem gostou do
 * app volta uma vez e esquece — é a diferença entre estar no bolso e estar
 * numa aba perdida.
 *
 * Os dois caminhos são diferentes por imposição de cada sistema:
 *
 * - Android/Chrome dispara `beforeinstallprompt`, que precisa ser guardado
 *   para ser usado depois, no toque da pessoa. Fora de um gesto dela o
 *   navegador ignora o pedido.
 * - iPhone não expõe evento nenhum. Lá o único caminho é Compartilhar →
 *   "Adicionar à Tela de Início", então o que resta é ensinar, com o nome
 *   exato de cada botão. O primeiro passo muda de aparelho para aparelho: em
 *   boa parte dos iPhones de hoje o Compartilhar está escondido dentro dos
 *   três pontinhos da barra de baixo, e não solto nela — por isso os dois
 *   caminhos aparecem descritos.
 *
 * O convite some num caso só: quando a página já está rodando DENTRO do app
 * instalado (`display-mode: standalone`), onde ele não teria o que fazer.
 * Em aba de navegador aparece sempre — inclusive para quem já instalou aqui
 * antes, porque instalar num aparelho não instala nos outros, e quem apagou
 * o ícone sem querer ficava sem caminho de volta.
 */
interface PromptDeInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function estaInstalado(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari no iPhone não implementa display-mode e usa esta propriedade.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function ehIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Este aparelho tem o que instalar?
 *
 * Existe para a tela de Conta não abrir uma seção "O app" vazia — a dona:
 * "a seção app na parte de contas está vazia, retire".
 *
 * E ela estava mesmo: dentro do app já instalado o convite devolve `null`,
 * mas o TÍTULO da seção continuava lá, com uma lista sem nenhuma linha
 * embaixo. Quem esconde o conteúdo tem de deixar a tela perguntar antes, e
 * era essa pergunta que faltava.
 */
export function instalarServeAqui(): boolean {
  return !ehAppDaLoja() && !estaInstalado();
}

export function InstalarApp({ variante = "lista" }: { variante?: "lista" | "faixa" | "cabecalho" | "botao" }) {
  /* Dentro do app instalado pela loja, convidar a instalar o app é o
     absurdo que parece. Ele já sumia quando o navegador dizia que não há
     o que instalar — mas o app da loja não é navegador, e a pergunta nunca
     chega a ser feita: o convite ficava na tela, sem ter o que fazer ao
     ser tocado. Um botão que não responde é o que ensina a pessoa que o
     app está travado. */
  if (ehAppDaLoja()) return null;

  const [prompt, setPrompt] = useState<PromptDeInstalacao | null>(null);
  /* Só isto esconde o botão: estar rodando dentro do app instalado. O
     "já instalou alguma vez" deixou de esconder — ver o comentário no
     `return null` abaixo. */
  const [emModoApp] = useState(() => estaInstalado());
  /* "Agora não" da faixa: esconde só a faixa, e só nesta visita. Antes isto
     marcava o app como instalado — o mesmo estado de quem tinha instalado de
     verdade —, então fechar a faixa fazia sumir também o botão do cabeçalho. */
  const [dispensado, setDispensado] = useState(false);
  const [ensinandoIOS, setEnsinandoIOS] = useState(false);

  useEffect(() => {
    function capturar(e: Event) {
      // Sem o preventDefault, o Chrome mostra a barra dele no rodapé, que a
      // pessoa fecha por reflexo — e o convite some para sempre.
      e.preventDefault();
      setPrompt(e as PromptDeInstalacao);
    }
    /* Instalou agora, nesta aba: o prompt foi gasto (o evento só vale uma
       vez) e o navegador não manda outro. A aba continua sendo uma aba, e o
       botão continua ali — daí em diante ensinando pelo passo a passo. */
    function instalou() {
      setPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", capturar);
    window.addEventListener("appinstalled", instalou);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturar);
      window.removeEventListener("appinstalled", instalou);
    };
  }, []);

  /* Em aba de navegador o convite aparece sempre, mesmo que o app já esteja
     instalado neste computador: quem instalou no trabalho quer instalar em
     casa, e quem apagou o ícone sem querer não tinha por onde voltar.

     Dentro do app instalado (janela própria, sem barra de navegador) some
     só o que ali seria fora de lugar: a faixa "deixe no seu celular" e o
     item das configurações, que convidam a fazer o que já está feito. O
     botão do topo fica — não é um convite, é o caminho para instalar em
     OUTRO aparelho, e quem está no computador quer justamente pôr no
     celular. Sem ele, esse caminho não existia em lugar nenhum. */
  if (emModoApp && variante !== "cabecalho") return null;

  const podeInstalarDireto = !!prompt;

  async function instalar() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    /* O evento só pode ser usado uma vez, tenha a pessoa aceitado ou não.
       O botão continua na tela: instalado aqui não quer dizer instalado no
       celular dela, e o passo a passo passa a ser o caminho. */
    setPrompt(null);
  }

  /* Quando não há prompt para oferecer, o botão ensina em vez de não fazer
     nada. Fora do iPhone isso passou a acontecer também no computador: uma
     vez instalado, o Chrome não manda mais o `beforeinstallprompt` naquele
     perfil — nem depois de apagar o ícone. Sem este texto, o botão que ela
     pediu para deixar sempre visível seria um botão que não responde. */
  const folhaNavegador = (
    <BottomSheet
      title={emModoApp ? "Instalar em outro aparelho" : "Instalar o Ei Emprego"}
      subtitle={
        emModoApp
          ? "Aqui já está instalado. Para pôr no celular ou em outro computador:"
          : "Pelo menu do próprio navegador — são dois cliques."
      }
      onClose={() => setEnsinandoIOS(false)}
    >
      {/* Aberta de dentro do app instalado, a folha muda de assunto: os
          passos abaixo são para o navegador do OUTRO aparelho, e sem esta
          linha eles pareceriam instruções para esta janela — onde não há
          menu de navegador nenhum para abrir. */}
      {emModoApp && (
        <p style={{ margin: "0 0 12px" }}>
          No outro aparelho, abra <strong>www.empregoitabirito.com.br</strong> no navegador e siga:
        </p>
      )}
      <ol className="passos-ios">
        <li>
          Abra o menu do navegador: <strong>⋮</strong> (três pontinhos) no canto de cima à direita.
          <span className="passo-obs">
            No computador, muitas vezes há um atalho ainda mais rápido: um ícone de monitor com uma seta, do
            lado direito da barra de endereço.
          </span>
        </li>
        <li>
          Toque em <strong>Instalar</strong> — pode aparecer como <strong>Instalar aplicativo</strong>,{" "}
          <strong>Adicionar à tela inicial</strong> ou <strong>Abrir como app</strong>, dependendo do
          navegador.
          <span className="passo-obs">
            Se não encontrar nenhuma dessas opções, procure em <strong>Salvar e compartilhar</strong> ou{" "}
            <strong>Mais ferramentas</strong>.
          </span>
        </li>
      </ol>
      <p className="muted" style={{ marginTop: 14, fontSize: "0.88rem" }}>
        {emModoApp
          ? "O ícone aparece junto dos outros aplicativos daquele aparelho, e daí em diante abre sem passar pelo navegador."
          : "Se o app já estiver instalado neste aparelho, o navegador pode não oferecer de novo — nesse caso ele já está aí, é só procurar o ícone do Ei Emprego junto dos outros aplicativos."}
      </p>
    </BottomSheet>
  );

  /* A folha do iPhone é a mesma nas três variantes — declarada uma vez para
     não haver duas versões do texto se um dia ele mudar. */
  const folhaIOS = (
    <BottomSheet
      title="Adicionar à tela de início"
      subtitle="No iPhone, quem instala é o próprio Safari — são três toques."
      onClose={() => setEnsinandoIOS(false)}
    >
      <ol className="passos-ios">
        <li>
          Na barra de baixo do Safari, toque em <strong>•••</strong> (os três pontinhos) e depois em{" "}
          <strong>Compartilhar</strong>.
          <span className="passo-obs">
            Em alguns iPhones o Compartilhar já fica direto na barra, como um quadrado com uma seta para cima.
            Nesse caso, é só tocar nele.
          </span>
        </li>
        <li>
          Role a lista para baixo até <strong>Adicionar à Tela de Início</strong>.
          <span className="passo-obs">
            Se não achar, toque em <strong>Ver Mais</strong> ou em <strong>Editar Ações</strong> no fim da
            lista.
          </span>
        </li>
        <li>
          Toque em <strong>Adicionar</strong>, no canto de cima à direita.
        </li>
      </ol>
      <p className="muted" style={{ marginTop: 14, fontSize: "0.88rem" }}>
        O ícone do Ei Emprego aparece junto com os outros aplicativos, e daí em diante abre sem passar
        pelo navegador.
      </p>
    </BottomSheet>
  );

  if (variante === "botao") {
    /* O botão pequeno e redondo do fim da tela.
       ─────────────────────────────────────────
       A dona: "a opção de instalar o app deve ter duas vertentes: android
       já adiciona na tela e iphone abre a instrução de como faz pra colocar
       o ícone na área de trabalho. O botão pode ser um botão pequeno
       arredondado mais no fim da tela."

       As duas vertentes já eram assim (é o que `podeInstalarDireto` decide
       logo abaixo: no Android existe o `beforeinstallprompt` e o toque
       instala de verdade; no iPhone não existe evento nenhum e o único
       caminho é ensinar). O que faltava era a FORMA — na tela de início ele
       aparecia como uma linha larga de lista, do tamanho das duas portas
       principais, competindo com a decisão que a tela existe para tomar. */
    return (
      <>
        <button
          type="button"
          className="ei-btn-instalar-pilula"
          onClick={() => (podeInstalarDireto ? instalar() : setEnsinandoIOS(true))}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
            <path d="M12 7.5v7" />
            <path d="M9 11.5l3 3 3-3" />
          </svg>
          {/* "Baixar App" nos dois casos, a pedido da dona (02/09). Eram
              dois textos conforme o aparelho — "Instalar o app" no Android
              e "Deixar na tela do celular" no iPhone — e o segundo é longo
              e ninguém procura por ele: quem quer o app na tela procura
              "baixar".

              O que o botão FAZ continua diferente, e isso não é o rótulo:
              no Android ele instala; no iPhone abre o passo a passo, porque
              lá quem instala é o próprio Safari. */}
          Baixar App
        </button>
        {ensinandoIOS && (ehIOS() ? folhaIOS : folhaNavegador)}
      </>
    );
  }

  if (variante === "cabecalho") {
    /* No cabeçalho, ao lado da marca: fica alcançável de qualquer tela, sem
       ocupar espaço de conteúdo. Ícone e palavra curta porque divide a linha
       com a logo e com o "Sair" — nome comprido empurraria a marca para
       fora em tela estreita. */
    return (
      <>
        <button
          type="button"
          className="btn-instalar-topo"
          onClick={() => (podeInstalarDireto ? instalar() : setEnsinandoIOS(true))}
          title="Adicionar o Ei Emprego à tela do celular"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
            <line x1="12" y1="8" x2="12" y2="15" />
            <line x1="8.5" y1="11.5" x2="15.5" y2="11.5" />
          </svg>
          Instalar App
        </button>
        {ensinandoIOS && (ehIOS() ? folhaIOS : folhaNavegador)}
      </>
    );
  }

  return (
    <>
      {variante === "faixa" && !dispensado ? (
        /* Na busca, o convite é uma faixa fina e dispensável: quem chegou
           aqui veio procurar alguém, e um app que pede para ser instalado
           antes de provar que serve é um app que a pessoa desinstala. */
        <div className="instalar-faixa">
          <span>
            <strong>Deixe o Ei Emprego no seu celular.</strong> Vira ícone e abre direto, sem digitar o endereço.
          </span>
          <span className="instalar-faixa-acoes">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => (podeInstalarDireto ? instalar() : setEnsinandoIOS(true))}
            >
              Adicionar
            </button>
            <button
              type="button"
              className="instalar-fechar"
              aria-label="Agora não"
              onClick={() => setDispensado(true)}
            >
              ✕
            </button>
          </span>
        </div>
      ) : (
        /* Linha do desenho do Ei. Era `settings-item` com um emoji, a classe
           do procurô — dentro da lista da Conta ela era a única com
           quadradinho cinza e desenho colorido, e quebrava o bloco no meio. */
        <button
          type="button"
          className="ei-linha-item"
          onClick={() => (podeInstalarDireto ? instalar() : setEnsinandoIOS(true))}
        >
          <span className="ei-linha-icone" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                 strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
              <path d="M12 7.5v7" />
              <path d="M9 11.5l3 3 3-3" />
            </svg>
          </span>
          <span className="ei-linha-nome">Instalar no celular</span>
          <span className="ei-linha-seta" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </button>
      )}

      {ensinandoIOS && (ehIOS() ? folhaIOS : folhaNavegador)}
    </>
  );
}
