import { useState } from "react";
import { remoteResendConfirmation } from "../lib/authRemote";
import { useT } from "../i18n";

/**
 * "Abra o seu e-mail" — a tela inteira, não um recado no rodapé.
 *
 * Criar conta foi o gesto mais deliberado que a pessoa fez até aqui: escreveu
 * nome, e-mail, inventou uma senha. Responder isso com uma linha cinza embaixo
 * do formulário faz parecer que nada aconteceu — e quem acha que nada aconteceu
 * clica de novo, e de novo, até desistir achando que o site está quebrado.
 *
 * A tela ocupa o lugar do formulário porque o formulário não tem mais nada a
 * fazer: a conta já existe, e o próximo passo não é aqui, é na caixa de
 * entrada. Ela diz o endereço para onde o e-mail foi (é onde o erro de
 * digitação aparece), lembra do spam (é onde a maioria está), e oferece as
 * duas saídas reais: reenviar e voltar.
 */
export function ConfirmEmail({
  email,
  onBack,
}: {
  email: string;
  onBack: () => void;
}) {
  const t = useT();
  const [estado, setEstado] = useState<"parado" | "enviando" | "enviado" | "falhou">(
    "parado"
  );

  async function reenviar() {
    setEstado("enviando");
    setEstado((await remoteResendConfirmation(email)) ? "enviado" : "falhou");
  }

  return (
    <div className="confirm-email">
      <div className="confirm-email-mark" aria-hidden="true">
        ✉
      </div>

      <h1 className="confirm-email-title">{t("confirm.title")}</h1>

      <p className="confirm-email-address">{email}</p>

      <p className="confirm-email-text">{t("confirm.body")}</p>

      <ol className="confirm-email-steps">
        <li>{t("confirm.stepOpen")}</li>
        <li>{t("confirm.stepClick")}</li>
        <li>{t("confirm.stepBack")}</li>
      </ol>

      <p className="confirm-email-spam">{t("confirm.spam")}</p>

      <button
        type="button"
        className="btn-outline signin-submit"
        onClick={reenviar}
        disabled={estado === "enviando"}
      >
        {t(estado === "enviando" ? "auth.working" : "confirm.resend")}
      </button>

      {/* role="status" para o leitor de tela anunciar sozinho: sem isso, quem
          não enxerga aperta o botão e não recebe resposta nenhuma. */}
      {estado === "enviado" && (
        <p className="confirm-email-ok" role="status">
          {t("confirm.resent")}
        </p>
      )}
      {estado === "falhou" && (
        <p className="signin-error" role="alert">
          {t("auth.errorNetwork")}
        </p>
      )}

      <button type="button" className="signin-quiet" onClick={onBack}>
        {t("confirm.wrongAddress")}
      </button>
    </div>
  );
}
