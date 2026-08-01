import { useEffect, useState } from "react";
import { aoFalharGravacao } from "../lib/remote/catalog";

/**
 * "Não conseguimos salvar isto no servidor."
 *
 * A tela do Avena mostra o que está na memória, e a gravação segue por baixo —
 * é o que faz o app responder na hora em vez de ficar rodando uma ampulheta a
 * cada toque. O preço dessa escolha é este aviso: quando a gravação falha, a
 * tela continua bonita e mentindo.
 *
 * Aconteceu de verdade. O banco recusava "Temporada" como tipo de empresa, a
 * recusa ia só para o console, e a casa aparecia cadastrada sem existir em
 * lugar nenhum. Sumiria na troca de aparelho, e nenhuma viajante a acharia na
 * busca — sem que a dona tivesse motivo para desconfiar.
 *
 * Por isso o texto não diz "erro" nem "algo deu errado": diz o que está em
 * jogo, que é o trabalho da pessoa não ter sido guardado.
 */
export function SaveFailureBanner() {
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    aoFalharGravacao(setMensagem);
    return () => aoFalharGravacao(null);
  }, []);

  if (!mensagem) return null;

  return (
    <div className="save-failure" role="alert">
      <span>{mensagem}</span>
      <button type="button" onClick={() => setMensagem(null)}>
        Entendi
      </button>
    </div>
  );
}
