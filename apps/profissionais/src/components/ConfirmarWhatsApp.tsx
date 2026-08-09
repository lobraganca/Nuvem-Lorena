import { useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { conferirCodigoWhatsApp, enviarCodigoWhatsApp, marcarAnuncioConfirmado } from "../lib/whatsappVerify";
import { formatPhone } from "../lib/phone";

/**
 * Confirmação do WhatsApp do anúncio, em dois passos: manda o código, confere
 * o código.
 *
 * O número não é digitado aqui — ele vem do anúncio. Um campo livre nesta
 * tela deixaria a pessoa confirmar um número e anunciar outro, que é
 * exatamente o buraco que esta funcionalidade existe para fechar. Se o número
 * estiver errado, o caminho é corrigir o anúncio.
 */
export function ConfirmarWhatsApp({
  professionalId,
  numero,
  onConfirmado,
  onClose,
}: {
  professionalId: string;
  numero: string;
  onConfirmado: () => void;
  onClose: () => void;
}) {
  const [passo, setPasso] = useState<"enviar" | "conferir">("enviar");
  const [codigo, setCodigo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar() {
    setCarregando(true);
    setErro("");
    try {
      await enviarCodigoWhatsApp(numero);
      setPasso("conferir");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar o código.");
    } finally {
      setCarregando(false);
    }
  }

  async function conferir() {
    setCarregando(true);
    setErro("");
    try {
      await conferirCodigoWhatsApp(numero, codigo);
      await marcarAnuncioConfirmado(professionalId);
      onConfirmado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível confirmar o código.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <BottomSheet
      title="Confirmar seu número"
      subtitle="Serve para ninguém anunciar usando o seu número — e para quem procura saber que o número é mesmo seu."
      onClose={onClose}
    >
      {passo === "enviar" ? (
        <div style={{ display: "grid", gap: 14 }}>
          <p style={{ margin: 0 }}>
            Vamos mandar um código para o <strong>{formatPhone(numero)}</strong>, por SMS ou WhatsApp.
          </p>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            É o número que está no seu anúncio. Se não for esse, feche aqui e corrija o anúncio primeiro.
          </p>
          {erro && <p className="form-erro">{erro}</p>}
          <button className="btn btn-primary btn-block" onClick={enviar} disabled={carregando}>
            {carregando ? "Enviando…" : "Enviar código"}
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <p style={{ margin: 0 }}>Digite o código que chegou no seu celular:</p>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="000000"
            aria-label="Código recebido"
            style={{ fontSize: "1.4rem", letterSpacing: "0.3em", textAlign: "center" }}
          />
          {erro && <p className="form-erro">{erro}</p>}
          <button className="btn btn-primary btn-block" onClick={conferir} disabled={carregando || codigo.length < 4}>
            {carregando ? "Conferindo…" : "Confirmar"}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-block"
            onClick={enviar}
            disabled={carregando}
          >
            Não chegou — enviar de novo
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
