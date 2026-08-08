import { useState } from "react";

/**
 * Mostra na tela o motivo de um login que falhou.
 *
 * Quando o Google ou o Supabase recusam o pedido, a pessoa é devolvida ao app
 * com a explicação pendurada no endereço (`?error=...&error_description=...`).
 * O app ignorava isso e desenhava a busca normalmente — então um login
 * recusado e um login bem-sucedido que caiu na tela errada eram, para quem
 * está olhando, exatamente a mesma coisa. Foram várias rodadas consertando o
 * problema errado por causa disso.
 *
 * A mensagem vem em inglês e em vocabulário de servidor. Ela aparece assim
 * mesmo, junto de uma frase em português: quem só quer usar o app entende a
 * frase, e quem está consertando precisa do texto original, sem tradução no
 * meio.
 */
function leErroDoEndereco(): { codigo: string; descricao: string } | null {
  if (typeof window === "undefined") return null;

  // Pode chegar como query (`?error=`) ou como fragmento (`#error=`),
  // dependendo do fluxo — os dois precisam ser lidos.
  const daQuery = new URLSearchParams(window.location.search);
  const doHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  const codigo = daQuery.get("error") ?? doHash.get("error");
  if (!codigo) return null;

  const descricao =
    daQuery.get("error_description") ?? doHash.get("error_description") ?? "";
  return { codigo, descricao: descricao.replace(/\+/g, " ") };
}

export function AvisoErroLogin() {
  const [erro, setErro] = useState(() => leErroDoEndereco());

  if (!erro) return null;

  function fechar() {
    setErro(null);
    // Limpa o endereço para o aviso não voltar a cada atualização da página.
    window.history.replaceState({}, "", window.location.pathname);
  }

  return (
    <div className="container" style={{ paddingTop: 16 }}>
      <div className="form-erro" role="alert" style={{ display: "grid", gap: 8 }}>
        <strong>Não foi possível entrar com o Google.</strong>
        <span style={{ fontSize: "0.86rem" }}>
          {erro.descricao || "O servidor recusou o pedido de login."}
        </span>
        <span style={{ fontSize: "0.78rem", opacity: 0.8, userSelect: "text" }}>
          Código: {erro.codigo}
        </span>
        <button type="button" className="btn btn-outline" onClick={fechar} style={{ justifySelf: "start" }}>
          Fechar
        </button>
      </div>
    </div>
  );
}
