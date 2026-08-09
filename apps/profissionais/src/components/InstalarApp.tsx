import { useEffect, useState } from "react";
import { BottomSheet } from "./BottomSheet";

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
 *   exato de cada botão.
 *
 * Quando o app já está instalado, o componente não aparece: `display-mode:
 * standalone` é o sinal de que a pessoa está usando justamente a versão
 * instalada.
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

export function InstalarApp({ variante = "lista" }: { variante?: "lista" | "faixa" }) {
  const [prompt, setPrompt] = useState<PromptDeInstalacao | null>(null);
  const [instalado, setInstalado] = useState(() => estaInstalado());
  const [ensinandoIOS, setEnsinandoIOS] = useState(false);

  useEffect(() => {
    function capturar(e: Event) {
      // Sem o preventDefault, o Chrome mostra a barra dele no rodapé, que a
      // pessoa fecha por reflexo — e o convite some para sempre.
      e.preventDefault();
      setPrompt(e as PromptDeInstalacao);
    }
    function instalou() {
      setInstalado(true);
      setPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", capturar);
    window.addEventListener("appinstalled", instalou);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturar);
      window.removeEventListener("appinstalled", instalou);
    };
  }, []);

  if (instalado) return null;

  // No iPhone não há prompt para oferecer; no Android, se o evento ainda não
  // chegou (ou o navegador não instala apps), não adianta prometer um botão
  // que não vai fazer nada.
  const podeInstalarDireto = !!prompt;
  if (!podeInstalarDireto && !ehIOS()) return null;

  async function instalar() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalado(true);
    // O evento só pode ser usado uma vez.
    setPrompt(null);
  }

  return (
    <>
      {variante === "faixa" ? (
        /* Na busca, o convite é uma faixa fina e dispensável: quem chegou
           aqui veio procurar alguém, e um app que pede para ser instalado
           antes de provar que serve é um app que a pessoa desinstala. */
        <div className="instalar-faixa">
          <span>
            <strong>Deixe o Busca no seu celular.</strong> Vira ícone e abre direto, sem digitar o endereço.
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
              onClick={() => setInstalado(true)}
            >
              ✕
            </button>
          </span>
        </div>
      ) : (
        <button
          type="button"
          className="settings-item"
          onClick={() => (podeInstalarDireto ? instalar() : setEnsinandoIOS(true))}
        >
          <span className="settings-icon" aria-hidden="true">
            📲
          </span>
          <span>Adicionar à tela do celular</span>
          <span className="settings-arrow" aria-hidden="true">
            ›
          </span>
        </button>
      )}

      {ensinandoIOS && (
        <BottomSheet
          title="Adicionar à tela de início"
          subtitle="No iPhone, quem instala é o próprio Safari — são três toques."
          onClose={() => setEnsinandoIOS(false)}
        >
          <ol style={{ display: "grid", gap: 10, paddingLeft: 20, margin: 0, lineHeight: 1.45 }}>
            <li>
              Toque no botão <strong>Compartilhar</strong> — o quadrado com a seta para cima, na barra de baixo.
            </li>
            <li>
              Role a lista e toque em <strong>Adicionar à Tela de Início</strong>.
            </li>
            <li>
              Toque em <strong>Adicionar</strong>, no canto de cima.
            </li>
          </ol>
          <p className="muted" style={{ marginTop: 14, fontSize: "0.88rem" }}>
            O ícone do Busca Itabirito aparece junto com os outros aplicativos, e daí em diante abre sem passar
            pelo navegador.
          </p>
        </BottomSheet>
      )}
    </>
  );
}
