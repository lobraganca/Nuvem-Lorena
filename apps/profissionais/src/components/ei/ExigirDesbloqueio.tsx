/**
 * A tela de entrar toda vez que o app é ABERTO — e nunca quando ele só
 * ficou parado.
 *
 * ── O PEDIDO ───────────────────────────────────────────────────────────
 *
 * A dona: "está tendo uma confusão quando entra no site. ele tá passando
 * direto da tela de login. toda vez que o app for aberto, ele tem que cair
 * na tela de login, dando opção para a pessoa gravar a senha. quando ele
 * estiver inativo e não fechou, ele pode voltar na tela que parou."
 *
 * O que estava acontecendo: a sessão do Supabase dura semanas e vive no
 * armazenamento do aparelho. Quem entrou uma vez nunca mais via a tela de
 * entrar — o app abria direto por dentro, e a pessoa não tinha como saber
 * com qual conta estava, nem como trocar.
 *
 * ── ABERTO x PARADO, E COMO SE SABE A DIFERENÇA ────────────────────────
 *
 * `sessionStorage` responde exatamente a essa pergunta e é a única coisa
 * no navegador que responde: ele vive enquanto a aba (ou o app instalado)
 * está aberta, e é apagado quando ela fecha. Minimizar, trocar de app,
 * deixar a tela apagar por horas — nada disso o apaga.
 *
 *   tem a marca  → é a mesma abertura: volta para onde parou
 *   não tem      → o app foi aberto agora: pede a senha
 *
 * `localStorage` não serviria (sobrevive ao fechamento, e aí nunca mais
 * pediria), e um carimbo de hora também não: "faz 3 horas" pode ser o
 * celular no bolso, e "faz 10 segundos" pode ser um app que acabou de ser
 * aberto de novo.
 *
 * ── ISTO NÃO É UM LOGOUT ───────────────────────────────────────────────
 *
 * A sessão continua de pé, e nada é apagado. O que se pede aqui é a senha
 * de quem já está dentro — como o banco faz ao reabrir. Sair de verdade
 * continua sendo o botão da Conta.
 *
 * E quem não quiser digitar toda vez marca "não pedir de novo neste
 * aparelho": aí a marca vai para o `localStorage` e a tela some. A senha
 * em si NUNCA é guardada em lugar nenhum — guardar senha em navegador é o
 * tipo de atalho que vira notícia ruim.
 */
import { useState, type ReactNode } from "react";
import { useAuth } from "../../lib/useAuth";
import { entrarComTelefoneESenha, entrarComTelefone, conferirCodigoDeEntrada } from "../../lib/auth";
import { formatPhone, doFormatoDoBanco } from "../../lib/phone";
import { mensagemDeErro } from "../../lib/erros";

const MARCA_ABERTURA = "ei-app-aberto";
const NAO_PEDIR = "ei-nao-pedir-senha";

function estaNaMesmaAbertura(): boolean {
  try {
    return sessionStorage.getItem(MARCA_ABERTURA) === "1";
  } catch {
    /* Sem armazenamento (aba anônima com tudo bloqueado), trata como mesma
       abertura: pedir senha a cada tela seria pior que não pedir. */
    return true;
  }
}

function marcarAbertura() {
  try {
    sessionStorage.setItem(MARCA_ABERTURA, "1");
  } catch {
    /* segue sem marcar */
  }
}

function naoPedirNesteAparelho(): boolean {
  try {
    return localStorage.getItem(NAO_PEDIR) === "1";
  } catch {
    return false;
  }
}

const LIVRES = ["/login", "/termos", "/privacidade"];

export function exigeDesbloqueio(caminho: string): boolean {
  return !LIVRES.some((t) => caminho === t || caminho.startsWith(`${t}/`));
}

export function ExigirDesbloqueio({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [liberado, setLiberado] = useState(
    () => estaNaMesmaAbertura() || naoPedirNesteAparelho(),
  );
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [lembrar, setLembrar] = useState(false);
  /* Esqueceu a senha: o código por SMS resolve, aqui mesmo. */
  const [codigo, setCodigo] = useState("");
  const [pedindoCodigo, setPedindoCodigo] = useState(false);
  const [aviso, setAviso] = useState("");

  if (loading || !user) return <>{children}</>;
  if (liberado) {
    marcarAbertura();
    return <>{children}</>;
  }

  const telefone = formatPhone(doFormatoDoBanco(user.phone));

  function liberar() {
    marcarAbertura();
    if (lembrar) {
      try {
        localStorage.setItem(NAO_PEDIR, "1");
      } catch {
        /* segue sem lembrar */
      }
    }
    setLiberado(true);
  }

  return (
    <div className="ei">
      <div className="ei-tela">
        <div className="ei-margem" style={{ paddingTop: 20 }}>
          <h1 className="ei-entrada-titulo">Olá de novo</h1>
          <p className="ei-apoio" style={{ marginTop: 6 }}>
            {telefone ? `Entre com a senha de ${telefone}.` : "Entre com a sua senha."}
          </p>
        </div>

        <section className="ei-cartao" style={{ marginTop: 14 }}>
          {!pedindoCodigo ? (
            <>
              <div className="ei-campo">
                <label htmlFor="desbloqueio-senha">Sua senha</label>
                <input
                  id="desbloqueio-senha"
                  type="password"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>

              {/* "Gravar a senha", no sentido que a dona pediu: não pedir de
                  novo neste aparelho. A senha não é guardada — o que se
                  guarda é a decisão. */}
              <label className="ei-linha-item" style={{ gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={lembrar}
                  onChange={(e) => setLembrar(e.target.checked)}
                />
                <span>Não pedir de novo neste aparelho</span>
              </label>

              {erro && <p className="ei-campo-erro" role="alert">{erro}</p>}

              <button
                type="button"
                className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
                disabled={ocupado || senha.length < 4}
                onClick={async () => {
                  setOcupado(true);
                  setErro("");
                  try {
                    await entrarComTelefoneESenha(telefone, senha);
                    liberar();
                  } catch (err) {
                    setErro(mensagemDeErro(err, "Senha incorreta."));
                  } finally {
                    setOcupado(false);
                  }
                }}
              >
                {ocupado ? "Entrando…" : "Entrar"}
              </button>

              <button
                type="button"
                className="ei-btn-inline"
                style={{ marginTop: 10 }}
                disabled={ocupado}
                onClick={async () => {
                  setOcupado(true);
                  setErro("");
                  try {
                    await entrarComTelefone(telefone);
                    setPedindoCodigo(true);
                    setAviso("Mandamos um código por SMS.");
                  } catch (err) {
                    setErro(mensagemDeErro(err, "Não consegui mandar o código."));
                  } finally {
                    setOcupado(false);
                  }
                }}
              >
                Esqueci minha senha — receber código por SMS
              </button>
            </>
          ) : (
            <>
              <div className="ei-campo">
                <label htmlFor="desbloqueio-codigo">Código do SMS</label>
                <input
                  id="desbloqueio-codigo"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>
              {aviso && <p className="ei-campo-ajuda">{aviso}</p>}
              {erro && <p className="ei-campo-erro" role="alert">{erro}</p>}
              <button
                type="button"
                className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
                disabled={ocupado || codigo.length < 4}
                onClick={async () => {
                  setOcupado(true);
                  setErro("");
                  try {
                    await conferirCodigoDeEntrada(telefone, codigo);
                    liberar();
                  } catch (err) {
                    setErro(mensagemDeErro(err, "Código incorreto."));
                  } finally {
                    setOcupado(false);
                  }
                }}
              >
                {ocupado ? "Conferindo…" : "Entrar"}
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
