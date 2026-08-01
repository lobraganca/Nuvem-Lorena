import { useNavigate } from "react-router-dom";
import { useT } from "../i18n";

/**
 * Voltar.
 *
 * Volta na história em vez de apontar para um endereço fixo, porque a mesma
 * tela é alcançada de vários lugares — a busca vem da inicial, do perfil e de
 * um link compartilhado, e um "voltar" que sempre leva ao mesmo canto manda a
 * pessoa para onde ela não estava.
 *
 * Quando não há história — alguém que abriu o link direto, que é o caso de
 * quem recebe um passeio pelo WhatsApp — o botão leva ao início, que é o
 * único destino que com certeza existe.
 */
export function BackLink({ label }: { label?: string }) {
  const navigate = useNavigate();
  const t = useT();

  function go() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  }

  return (
    <button type="button" className="back-link" onClick={go}>
      ← {label ?? t("common.back")}
    </button>
  );
}
