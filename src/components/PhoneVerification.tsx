import { useEffect, useRef, useState } from "react";
import {
  CODE_LENGTH,
  cancelPending,
  confirmCode,
  e164,
  hasSmsServer,
  isSendablePhone,
  requestCode,
  type ConfirmFailure,
  type SendFailure,
  type VerificationLevel,
} from "../lib/phoneVerification";
import { formatPhone, onlyDigits } from "../lib/documents";

const SEND_MESSAGE: Record<SendFailure, string> = {
  "telefone-invalido": "Confira o número: DDD e nove dígitos, começando com 9.",
  espere: "Aguarde para pedir outro código.",
  "muitos-envios": "Muitos pedidos para este número. Tente de novo daqui a uma hora.",
  "sem-rede": "Não deu para falar com o servidor. Confira a conexão e tente de novo.",
};

const CONFIRM_MESSAGE: Record<ConfirmFailure, string> = {
  "codigo-errado": "Código incorreto.",
  expirado: "Este código expirou. Peça outro.",
  "muitas-tentativas": "Tentativas demais. Peça um código novo.",
  "sem-rede": "Não deu para falar com o servidor. Confira a conexão e tente de novo.",
};

/**
 * Number, then code — the two steps of confirming a phone.
 *
 * The number is asked for first and alone, because a screen with one field is
 * answered and a screen with six is abandoned. The code screen keeps the
 * number in view with a way back to it, since the commonest failure is not a
 * wrong code but a wrong number.
 */
export function PhoneVerification({
  onVerified,
  onSkip,
}: {
  onVerified: (phone: string, level: VerificationLevel) => void;
  /** Offered when the number is not required to continue. */
  onSkip?: () => void;
}) {
  const [step, setStep] = useState<"numero" | "codigo">("numero");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [testCode, setTestCode] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  // The countdown is the only thing that makes "resend" honest: a button that
  // is available but silently ignored reads as a broken app.
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  useEffect(() => {
    if (step === "codigo") codeRef.current?.focus();
  }, [step]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setProblem(null);
    setBusy(true);
    const result = await requestCode(phone);
    setBusy(false);
    if (!result.ok) {
      setProblem(SEND_MESSAGE[result.reason]);
      if (result.resendInSeconds) setWait(result.resendInSeconds);
      return;
    }
    setTestCode(result.testCode ?? null);
    setWait(result.resendInSeconds);
    setCode("");
    setStep("codigo");
  }

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    setBusy(true);
    const result = await confirmCode(phone, code);
    setBusy(false);
    if (result.ok) {
      onVerified(e164(phone), result.level);
      return;
    }
    const extra =
      result.reason === "codigo-errado" && typeof result.attemptsLeft === "number"
        ? ` Restam ${result.attemptsLeft} tentativas.`
        : "";
    setProblem(CONFIRM_MESSAGE[result.reason] + extra);
    if (result.reason === "expirado" || result.reason === "muitas-tentativas") {
      setStep("numero");
      setTestCode(null);
      setWait(0);
    }
  }

  function changeNumber() {
    cancelPending();
    setStep("numero");
    setProblem(null);
    setTestCode(null);
    setCode("");
    setWait(0);
  }

  if (step === "numero") {
    return (
      <form className="phone-verify" onSubmit={send}>
        <h2>Confirme seu telefone</h2>
        <p className="muted">
          Enviamos um código de {CODE_LENGTH} dígitos por SMS. É assim que
          sabemos que a conta é de quem tem o aparelho na mão.
        </p>

        <label>
          Celular com DDD
          <div className="phone-field">
            <span className="phone-country">+55</span>
            <input
              inputMode="tel"
              autoComplete="tel-national"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              required
            />
          </div>
        </label>

        {problem && (
          <p className="signin-error" role="alert">
            {problem}
          </p>
        )}

        <button
          type="submit"
          className="btn-primary signin-submit"
          disabled={busy || !isSendablePhone(phone)}
        >
          {busy ? "Enviando…" : "Enviar código"}
        </button>

        {onSkip && (
          <button type="button" className="signin-quiet" onClick={onSkip}>
            Agora não
          </button>
        )}

        {!hasSmsServer() && (
          // Said before the number is typed, not after: someone who would
          // rather not hand over a phone number to a test deserves to know now.
          <p className="signin-truth">
            O envio de SMS depende de um servidor, que ainda não está no ar.
            Nesta versão de teste o código aparece na própria tela — serve para
            você conhecer o caminho, mas não confirma nada. Quando o servidor
            entrar, o código vem por SMS e todo mundo confirma de novo.
          </p>
        )}
      </form>
    );
  }

  return (
    <form className="phone-verify" onSubmit={check}>
      <h2>Digite o código</h2>
      <p className="muted">
        Enviado para <strong>+55 {phone}</strong>.
      </p>

      {testCode && (
        <p className="phone-testcode" role="status">
          Modo de teste — seu código é <strong>{testCode}</strong>
        </p>
      )}

      <label className="phone-code-label">
        Código de {CODE_LENGTH} dígitos
        <input
          ref={codeRef}
          className="phone-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          value={code}
          onChange={(e) => setCode(onlyDigits(e.target.value).slice(0, CODE_LENGTH))}
          placeholder="000000"
          required
        />
      </label>

      {problem && (
        <p className="signin-error" role="alert">
          {problem}
        </p>
      )}

      <button
        type="submit"
        className="btn-primary signin-submit"
        disabled={busy || code.length < CODE_LENGTH}
      >
        {busy ? "Conferindo…" : "Confirmar"}
      </button>

      <div className="phone-actions">
        <button
          type="button"
          className="signin-quiet"
          onClick={() => void send()}
          disabled={wait > 0 || busy}
        >
          {wait > 0 ? `Reenviar em ${wait}s` : "Reenviar código"}
        </button>
        <button type="button" className="signin-quiet" onClick={changeNumber}>
          Trocar número
        </button>
      </div>
    </form>
  );
}
