import { useEffect, useState } from "react";
import { aplicarAtualizacao, observarAtualizacoes } from "../lib/atualizacao";

/**
 * Aviso de versão nova.
 *
 * Aparece em dois casos, e o texto muda porque as situações são diferentes:
 *
 * - Existe uma versão nova baixada, esperando para entrar. Aqui a promessa é
 *   firme: tocar resolve.
 * - A aba está aberta há dias sem parar. Aqui não se sabe se há versão nova
 *   (pode não haver), então o texto não promete novidade — só oferece
 *   recomeçar, que é o que uma página velha precisa.
 *
 * Fica no rodapé, acima da barra de navegação, e não no topo: no topo ele
 * empurraria o conteúdo para baixo justamente quando a pessoa está lendo
 * alguma coisa. E dá para dispensar — um aviso que não se fecha vira estorvo,
 * e estorvo ensina a pessoa a ignorar avisos.
 */
export function AvisoDeVersao() {
  const [estado, setEstado] = useState({ versaoNova: false, abertoHaMuitoTempo: false });
  const [dispensado, setDispensado] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => observarAtualizacoes(setEstado), []);

  const mostrar = (estado.versaoNova || estado.abertoHaMuitoTempo) && !dispensado;
  if (!mostrar) return null;

  return (
    <div className="aviso-versao" role="status">
      <span>
        {estado.versaoNova ? (
          <>
            <strong>Tem uma versão nova do Ei Itabirito.</strong> Atualize para pegar as novidades e as correções.
          </>
        ) : (
          <>
            <strong>Este app está aberto há dias.</strong> Atualize para garantir que você está vendo a versão
            mais recente.
          </>
        )}
      </span>
      <span className="aviso-versao-acoes">
        <button
          type="button"
          className="btn btn-primary"
          disabled={aplicando}
          onClick={() => {
            setAplicando(true);
            aplicarAtualizacao();
          }}
        >
          {aplicando ? "Atualizando…" : "Atualizar"}
        </button>
        <button
          type="button"
          className="aviso-versao-fechar"
          aria-label="Agora não"
          onClick={() => setDispensado(true)}
        >
          ✕
        </button>
      </span>
    </div>
  );
}
