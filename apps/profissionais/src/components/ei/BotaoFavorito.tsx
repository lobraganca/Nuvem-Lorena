import { useState } from "react";
import { useAuth } from "../../lib/useAuth";
import { alternarFavorito } from "../../lib/favoritos";

/**
 * O coração de guardar uma empresa ou um candidato.
 *
 * ── DUAS DECISÕES QUE NÃO SÃO ÓBVIAS ───────────────────────────────────
 *
 * 1. **Ele acende antes de o banco responder.** É o que se chama de
 *    otimista, e aqui vale a pena: a gravação é uma linha e quase nunca
 *    falha, enquanto meio segundo de coração sem reagir num 4G fraco faz a
 *    pessoa tocar de novo — e o segundo toque DESFAZ o primeiro. Se falhar,
 *    ele volta sozinho ao estado anterior e mostra o motivo.
 *
 * 2. **Ele não é um link.** Vive dentro de cartões que são links (a linha
 *    do banco de talentos leva ao perfil), e sem o `stopPropagation` o
 *    toque no coração abriria o perfil junto — favoritar viraria navegar,
 *    que é o oposto do que a pessoa quis.
 */
export function BotaoFavorito({
  empresa,
  pessoa,
  marcado,
  aoMudar,
  rotulo,
}: {
  empresa?: string;
  pessoa?: string;
  marcado: boolean;
  /** Avisa a tela de fora, que é quem guarda a lista. */
  aoMudar: (novo: boolean) => void;
  /** O que o leitor de tela anuncia: "Guardar a Padaria Pão de Minas". */
  rotulo: string;
}) {
  const { user } = useAuth();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(false);

  if (!user) return null;

  return (
    <button
      type="button"
      className={marcado ? "ei-coracao marcado" : "ei-coracao"}
      aria-pressed={marcado}
      aria-label={marcado ? `Tirar ${rotulo} dos favoritos` : `Guardar ${rotulo} nos favoritos`}
      title={marcado ? "Tirar dos favoritos" : "Guardar nos favoritos"}
      disabled={ocupado}
      onClick={async (e) => {
        /* O coração vive dentro de cartões que são links. Sem estas duas
           linhas, favoritar abriria o perfil junto. */
        e.preventDefault();
        e.stopPropagation();

        const antes = marcado;
        setErro(false);
        aoMudar(!antes); // acende já — ver o comentário do topo
        setOcupado(true);
        try {
          await alternarFavorito(user.id, { empresa, pessoa }, antes);
        } catch {
          /* Volta ao que era. Um coração aceso que não gravou é pior que
             um que não acendeu: a pessoa só descobre amanhã, com a lista
             vazia. */
          aoMudar(antes);
          setErro(true);
        } finally {
          setOcupado(false);
        }
      }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"
           fill={marcado ? "currentColor" : "none"} stroke="currentColor"
           strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20.3s-7.5-4.6-7.5-9.6a4.3 4.3 0 0 1 7.5-2.9 4.3 4.3 0 0 1 7.5 2.9c0 5-7.5 9.6-7.5 9.6z" />
      </svg>
      {erro && <span className="ei-so-leitor">Não consegui salvar</span>}
    </button>
  );
}
