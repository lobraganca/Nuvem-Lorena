import { useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { conferirCodigoWhatsApp, enviarCodigoWhatsApp } from "../lib/whatsappVerify";
import { formatPhone, onlyPhoneDigits } from "../lib/phone";
import { mensagemDeErro } from "../lib/erros";

/**
 * Confirmação do número da própria conta, sem cadastro no meio.
 *
 * É prima do `ConfirmarWhatsApp`, mas resolve outro problema e por isso o
 * número é digitado aqui. Lá o número vem do cadastro de propósito — um
 * campo livre deixaria a pessoa confirmar um número e divulgar outro.
 * Aqui não existe cadastro nenhum: quem denuncia é um vizinho qualquer, e
 * o que se quer garantir é só que exista um chip por trás da denúncia.
 *
 * Quem confirma, confirma para a conta (Supabase Auth). Não passa pela RPC
 * `confirmar_whatsapp`, que é a que amarra número e cadastro.
 */
export function ConfirmarMeuNumero({
  onConfirmado,
  onClose,
}: {
  onConfirmado: () => void;
  onClose: () => void;
}) {
  const [passo, setPasso] = useState<"numero" | "codigo">("numero");
  const [numero, setNumero] = useState("");
  const [codigo, setCodigo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const digitos = onlyPhoneDigits(numero);
  const numeroParecePronto = digitos.length === 10 || digitos.length === 11;

  async function enviar() {
    setCarregando(true);
    setErro("");
    try {
      await enviarCodigoWhatsApp(numero);
      setPasso("codigo");
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível enviar o código."));
    } finally {
      setCarregando(false);
    }
  }

  async function conferir() {
    setCarregando(true);
    setErro("");
    try {
      await conferirCodigoWhatsApp(numero, codigo);
      onConfirmado();
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível confirmar o código."));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <BottomSheet
      title="Confirmar seu número"
      subtitle="Só uma vez, e vale para a sua conta."
      onClose={onClose}
    >
      {passo === "numero" ? (
        <div style={{ display: "grid", gap: 14 }}>
          <p style={{ margin: 0 }}>
            Para denunciar um cadastro a gente precisa confirmar que existe um telefone de verdade por trás da
            denúncia. Vamos mandar um código para o número que você digitar.
          </p>
          {/* Dito sem rodeio: a pessoa está prestes a entregar o telefone
              dela para poder acusar alguém, e tem o direito de saber o que
              acontece com esse número antes de digitá-lo. */}
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            O número fica guardado na sua conta e <strong>não aparece para quem você denunciou</strong> nem em
            lugar nenhum do app. Serve só para impedir que uma pessoa abra várias contas para derrubar o
            cadastro de um concorrente.
          </p>
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            inputMode="tel"
            aria-label="Seu número de celular com DDD"
          />
          {erro && <p className="form-erro">{erro}</p>}
          <button className="btn btn-primary btn-block" onClick={enviar} disabled={carregando || !numeroParecePronto}>
            {carregando ? "Enviando…" : "Enviar código"}
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <p style={{ margin: 0 }}>
            Digite o código que chegou no <strong>{formatPhone(numero)}</strong>:
          </p>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            aria-label="Código recebido"
            style={{ fontSize: "1.4rem", letterSpacing: "0.3em", textAlign: "center" }}
          />
          {erro && <p className="form-erro">{erro}</p>}
          <button className="btn btn-primary btn-block" onClick={conferir} disabled={carregando || codigo.length < 4}>
            {carregando ? "Conferindo…" : "Confirmar"}
          </button>
          <button type="button" className="btn btn-outline btn-block" onClick={enviar} disabled={carregando}>
            Não chegou — enviar de novo
          </button>
          <button
            type="button"
            className="acao-discreta"
            onClick={() => {
              setPasso("numero");
              setCodigo("");
              setErro("");
            }}
          >
            Digitei o número errado
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
