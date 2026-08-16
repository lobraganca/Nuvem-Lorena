import { signInWithApple } from "../lib/auth";
import { LOGIN_APPLE_ATIVO } from "../config";
import { mensagemDeErro } from "../lib/erros";

/**
 * "Entrar com a Apple", ao lado do Google.
 *
 * Só aparece quando o login da Apple está configurado (ver
 * `LOGIN_APPLE_ATIVO`): mostrar o botão antes disso seria oferecer uma porta
 * que não abre, e porta que não abre custa mais confiança do que a ausência
 * dela.
 *
 * O visual segue o que a Apple exige de quem usa o botão dela — fundo preto,
 * texto branco, a maçã à esquerda e a mesma altura do botão vizinho. Não é
 * capricho: a revisão da App Store confere isso.
 */
export function BotaoApple({ voltarPara, onErro }: { voltarPara?: string; onErro?: (m: string) => void }) {
  if (!LOGIN_APPLE_ATIVO) return null;

  return (
    <button
      type="button"
      className="btn btn-apple btn-block"
      onClick={async () => {
        try {
          await signInWithApple(voltarPara);
        } catch (err) {
          onErro?.(mensagemDeErro(err, "Não foi possível abrir o login da Apple."));
        }
      }}
    >
      <svg width="16" height="19" viewBox="0 0 16 19" fill="currentColor" aria-hidden="true">
        <path d="M13.2 10.1c0-2 1.6-2.9 1.7-3-.9-1.4-2.4-1.5-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.2 2C1.8 10 2.8 13.6 4.1 15.6c.6 1 1.4 2.1 2.4 2.1 1 0 1.3-.6 2.5-.6s1.5.6 2.5.6c1 0 1.7-1 2.3-2 .7-1.1 1-2.2 1-2.3 0 0-2-.8-2-3.3zM11.2 3.9c.5-.7.9-1.6.8-2.6-.8 0-1.8.5-2.4 1.2-.5.6-1 1.6-.8 2.5.9.1 1.8-.4 2.4-1.1z" />
      </svg>
      Entrar com a Apple
    </button>
  );
}
