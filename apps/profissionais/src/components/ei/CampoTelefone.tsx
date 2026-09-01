import { useState } from "react";
import {
  conferirCodigoWhatsApp,
  enviarCodigoWhatsApp,
  numeroJaConfirmadoNaConta,
} from "../../lib/whatsappVerify";
import { formatPhone, onlyPhoneDigits } from "../../lib/phone";
import { mensagemDeErro } from "../../lib/erros";

/**
 * O telefone do cadastro — que se confirma sozinho, no próprio campo.
 *
 * ── Por que este componente existe ────────────────────────────────────
 *
 * A confirmação já era exigida (a lista pública e o aviso de vaga filtram
 * por ela desde a 0076), mas na tela ela era um AVISO no topo do
 * formulário, com um botão "confirmar agora" — uma coisa ao lado do
 * cadastro. A dona olhou e disse:
 *
 *   "A confirmação do telefone tem que ser algo inerente ao cadastro, não
 *    uma coisa apartada."
 *
 * Está certa, e a diferença não é de lugar na tela: é de natureza. Um
 * aviso no topo é um lembrete que a pessoa pode ignorar e voltar depois —
 * e por isso ela preenche tudo, salva, e descobre no fim que o cadastro
 * não vale. Um campo que se confirma é parte do formulário: o telefone só
 * está preenchido quando está confirmado, do mesmo jeito que um campo
 * obrigatório só está preenchido quando tem texto.
 *
 * ── Os três estados ───────────────────────────────────────────────────
 *
 *   digitando  →  a pessoa escreve o número
 *   codigo     →  ela pediu o código e ele está a caminho
 *   confirmado →  o número virou dado do cadastro
 *
 * O atalho: quem entrou no app por SMS já tem esse número confirmado na
 * conta. Nesse caso não se manda código nenhum — é um toque só, e mandar
 * SMS para quem acabou de receber um seria cobrar duas vezes pela mesma
 * prova.
 *
 * ── Trocar o número derruba a confirmação ─────────────────────────────
 *
 * E é o certo: o banco faz o mesmo (migration 0052). Confirmar um número
 * e divulgar outro é exatamente o buraco que a confirmação existe para
 * fechar.
 */
export function CampoTelefone({
  valor,
  confirmado,
  onChange,
  onConfirmado,
  /** Chamado antes de confirmar: a função do banco precisa do cadastro
   *  gravado para comparar o número dele com o da conta. */
  aoPrecisarSalvar,
}: {
  valor: string;
  confirmado: boolean;
  onChange: (v: string) => void;
  onConfirmado: (idDoCadastro: string) => void;
  aoPrecisarSalvar: () => Promise<string>;
}) {
  const [passo, setPasso] = useState<"digitando" | "codigo">("digitando");
  /* ── O NÚMERO CONFIRMADO NÃO SE APAGA SEM QUERER ────────────────────
     A dona, com o cadastro aberto: "ao confirmar o telefone ele não pode
     sair do cadastro."

     Estava certo o incômodo. O campo continuava aberto depois de
     confirmado, e qualquer toque nele — um dedo na tela ao rolar, um
     backspace — apagava dígitos, o que derruba a confirmação na hora
     (aqui e no banco, pela 0052). A pessoa saía do cadastro com o selo
     laranja de novo, sem entender o que fez, e o cadastro dela deixava de
     aparecer para as empresas.

     Agora o número confirmado fica travado, e trocar exige um toque
     deliberado num botão que diz o que vai acontecer. */
  const [destravado, setDestravado] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const digitos = onlyPhoneDigits(valor);
  const pareceCompleto = digitos.length === 10 || digitos.length === 11;

  async function pedirCodigo() {
    setOcupado(true);
    setErro("");
    setAviso("");
    try {
      /* Se a conta já confirmou este mesmo número — o caso de quem entrou
         por SMS —, não há código a pedir: é só amarrar ao cadastro. */
      if (await numeroJaConfirmadoNaConta(valor)) {
        await amarrarAoCadastro();
        return;
      }
      await enviarCodigoWhatsApp(valor);
      setPasso("codigo");
      setAviso("Mandamos um código por SMS para " + formatPhone(valor) + ".");
    } catch (err) {
      setErro(mensagemDeErro(err, "Não consegui mandar o código."));
    } finally {
      setOcupado(false);
    }
  }

  async function conferir() {
    setOcupado(true);
    setErro("");
    try {
      await conferirCodigoWhatsApp(valor, codigo);
      await amarrarAoCadastro();
    } catch (err) {
      setErro(mensagemDeErro(err, "Código incorreto. Confira e tente de novo."));
      setOcupado(false);
    }
  }

  /** Grava o cadastro (se preciso) e diz ao banco que o número é dele. */
  async function amarrarAoCadastro() {
    const { marcarAnuncioConfirmado } = await import("../../lib/whatsappVerify");
    const id = await aoPrecisarSalvar();
    await marcarAnuncioConfirmado(id);
    setPasso("digitando");
    setCodigo("");
    setAviso("");
    setOcupado(false);
    onConfirmado(id);
  }

  return (
    <div className="ei-campo">
      <label htmlFor="meu-fone">
        Telefone{" "}
        {confirmado ? (
          <span className="ei-selo ei-selo-verde">Confirmado</span>
        ) : (
          <span className="ei-selo ei-selo-laranja">Falta confirmar</span>
        )}
      </label>

      <input
        id="meu-fone"
        type="tel"
        inputMode="tel"
        value={valor}
        placeholder="(31) 99999-8888"
        readOnly={confirmado && !destravado}
        onChange={(e) => {
          onChange(e.target.value);
          /* Mexeu no número, some o pedido de código que estava no ar: ele
             era para o número anterior. */
          setPasso("digitando");
          setErro("");
          setAviso("");
        }}
      />

      {confirmado ? (
        <>
          <span className="ei-campo-ajuda">
            É por aqui que a empresa vai te chamar.{" "}
            {destravado
              ? "Ao salvar um número diferente, ele volta a pedir confirmação."
              : "Ele está travado para não sumir sem querer."}
          </span>
          {!destravado && (
            <button
              type="button"
              className="ei-btn-inline"
              onClick={() => setDestravado(true)}
            >
              Trocar o número
            </button>
          )}
        </>
      ) : passo === "digitando" ? (
        <>
          <span className="ei-campo-ajuda">
            {/* A consequência, e não o nome da regra. "Campo obrigatório"
                não explica nada; isto explica. */}
            Seu cadastro só entra na lista e só recebe vaga depois que este número for
            confirmado.
          </span>
          <div>
            <button
              type="button"
              className="ei-btn ei-btn-contorno"
              disabled={!pareceCompleto || ocupado}
              onClick={pedirCodigo}
            >
              {ocupado ? "Confirmando…" : "Confirmar este número"}
            </button>
          </div>
        </>
      ) : (
        <>
          {aviso && <span className="ei-campo-ajuda">{aviso}</span>}
          <label htmlFor="meu-codigo" style={{ marginTop: 6 }}>
            Código recebido
          </label>
          <input
            id="meu-codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={codigo}
            placeholder="000000"
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="ei-btn ei-btn-cheio"
              disabled={codigo.length < 4 || ocupado}
              onClick={conferir}
            >
              {ocupado ? "Conferindo…" : "Conferir"}
            </button>
            {/* Sair do código sem perder o número digitado: quem errou o
                telefone precisa voltar e arrumar, não recomeçar. */}
            <button
              type="button"
              className="ei-btn ei-btn-texto"
              disabled={ocupado}
              onClick={() => {
                setPasso("digitando");
                setCodigo("");
                setErro("");
              }}
            >
              Mudar o número
            </button>
          </div>
        </>
      )}

      {erro && <span className="ei-campo-erro">{erro}</span>}
    </div>
  );
}
