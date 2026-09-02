import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

const CHAVE = "busca-itabirito-aviso-dados";

/**
 * Aviso de dados no primeiro acesso, exigido pela LGPD.
 *
 * É deliberadamente diferente dos banners de cookies que todo site tem: não
 * há "aceitar todos" nem "gerenciar preferências", porque não há nada a
 * gerenciar — o app não usa rastreamento de terceiros nem cookie de
 * publicidade. Oferecer botões falsos de escolha seria pior do que não
 * oferecer nenhum.
 *
 * Também não bloqueia a tela. A lei pede informação ostensiva, não refém: uma
 * barra no rodapé, com o link do documento e um "Entendi", cumpre o que ela
 * pede sem impedir a pessoa de usar o app.
 */
export function AvisoDeDados() {
  const { pathname } = useLocation();
  const [visivel, setVisivel] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return !window.localStorage.getItem(CHAVE);
    } catch {
      // Navegador com armazenamento bloqueado: mostrar de novo é melhor do
      // que quebrar a tela.
      return true;
    }
  });

  // Só na busca — e lendo a rota pelo router, não por `window.location`:
  // dentro de um app de página única o endereço muda sem recarregar, e o
  // aviso continuava colado na tela seguinte.
  //
  // Antes ele acompanhava a pessoa por todas as telas, e no perfil do
  // profissional chegava a cobrir o botão de contato: o aviso de privacidade
  // atrapalhando justamente o ato que o app existe para permitir.
  const aparece = visivel && pathname === "/";

  if (!aparece) return null;

  function aceitar() {
    try {
      window.localStorage.setItem(CHAVE, "1");
    } catch {
      /* sem armazenamento, o aviso volta na próxima visita — aceitável */
    }
    setVisivel(false);
  }

  return (
    <div className="ei aviso-dados" role="region" aria-label="Aviso sobre dados pessoais">
      <p>
        Guardamos apenas o necessário para o app funcionar — e nada vai para publicidade. Veja a{" "}
        <Link to="/privacidade">Política de Privacidade</Link>.
      </p>
      <button type="button" className="ei-btn ei-btn-cheio" onClick={aceitar}>
        Entendi
      </button>
    </div>
  );
}
