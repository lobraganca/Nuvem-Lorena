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
import {
  entrarComTelefoneESenha,
  entrarComTelefone,
  conferirCodigoDeEntrada,
  signOut,
} from "../../lib/auth";
import { formatPhone, doFormatoDoBanco } from "../../lib/phone";
import { mensagemDeErro } from "../../lib/erros";
import { CampoSenha } from "./CampoSenha";

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

/**
 * "Esta abertura do app já está liberada."
 *
 * Exportada porque quem ENTRA não passa por esta barreira: a tela de
 * entrar é livre (senão a barreira apareceria por cima do próprio
 * formulário), e quem acabou de digitar celular e senha ali era parado, na
 * tela seguinte, por uma tela pedindo... a mesma senha. Foi o que
 * aconteceu com a dona no primeiro uso: entrou, e caiu no "Olá de novo".
 *
 * Então a tela de entrar avisa aqui assim que a sessão nasce.
 */
export function marcarAppAberto() {
  marcarAbertura();
}

/**
 * "Gravar a senha neste aparelho" — a decisão, nunca a senha.
 *
 * Exportada porque a tela de ENTRAR também oferece a caixinha (a dona:
 * "ter opção de gravar a senha na tela de inicio"), e ela é livre desta
 * barreira. Antes a opção só existia aqui dentro, e para chegar até aqui a
 * pessoa precisava já ter entrado, fechado o app e aberto de novo.
 *
 * Recebe `false` de propósito em vez de só ligar: sem isso, quem gravou uma
 * vez ficaria preso à decisão, porque desmarcar a caixinha não teria efeito
 * nenhum e o único jeito de voltar atrás seria limpar os dados do site.
 */
export function gravarSenhaNesteAparelho(gravar: boolean) {
  try {
    if (gravar) localStorage.setItem(NAO_PEDIR, "1");
    else localStorage.removeItem(NAO_PEDIR);
  } catch {
    /* segue sem gravar */
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

/**
 * A senha da abertura ainda está pendente?
 *
 * ── Por que a tela de ENTRAR precisa saber disso — 05/09 ──────────────
 *
 * A dona: "quando clico em procuro emprego na tela de login está me
 * direcionando para uma OUTRA ÁREA pra clicar a senha."
 *
 * E estava mesmo, desde que toda abertura passou a cair na tela de
 * entrar (ver `lib/aberturaDoApp.ts`). A sequência era esta:
 *
 *   1. a tela de entrar aparece, JÁ com o campo de senha;
 *   2. a pessoa toca em "procuro emprego" — e a conta já está
 *      conectada, então o app entra na hora, sem olhar o campo;
 *   3. a tela de destino roda ESTA barreira e pede... a mesma senha,
 *      noutra tela.
 *
 * Duas telas pedindo a mesma coisa, uma atrás da outra. Pior: a primeira
 * dava a impressão de que a senha era opcional (dava para pular tocando
 * no lado) e a segunda dizia que não era.
 *
 * Com esta função a tela de entrar pergunta antes de sair do lugar: se a
 * senha ainda é devida, ela pede ALI, onde o campo já está, e só então
 * entra. Uma tela, uma senha.
 */
export function precisaDesbloquearAgora(): boolean {
  return !estaNaMesmaAbertura() && !naoPedirNesteAparelho();
}

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
    /* Só grava quando marcada. Aqui, ao contrário da tela de entrar, a
       caixinha desmarcada não apaga nada: quem já gravou não passa por
       esta tela, então uma desmarcação aqui nunca é "mudei de ideia". */
    if (lembrar) gravarSenhaNesteAparelho(true);
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
                <CampoSenha
                  id="desbloqueio-senha"
                  rotulo="Sua senha"
                  valor={senha}
                  onChange={setSenha}
                />
              </div>

              {erro && <p className="ei-campo-erro" role="alert">{erro}</p>}

              {/* Respiro entre a senha e o Entrar — 03/09
                  A dona: "a tela olá de novo, colocar respiro entre a senha
                  e o botão de entrar." Eles estavam colados por um vão de
                  campo, e não de bloco: o botão parecia parte da caixa de
                  texto, e num toque apressado o dedo que ia à senha caía
                  nele. */}
              <button
                type="button"
                className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
                style={{ marginTop: 18 }}
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

              {/* "Gravar a senha", no sentido que a dona pediu: não pedir de
                  novo neste aparelho. A senha não é guardada — o que se
                  guarda é a decisão.

                  Desceu para debaixo do botão de Entrar, e ficou menor — a
                  dona: "'não pedir de novo neste aparelho' pode ficar
                  debaixo do botão de entrar e bem menor". Antes disputava
                  altura com o campo de senha, do mesmo tamanho de um botão;
                  é uma opção, não uma decisão do peso de "Entrar". */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  marginTop: 12,
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  color: "var(--ei-tinta-fraca)",
                }}
              >
                <input
                  type="checkbox"
                  checked={lembrar}
                  onChange={(e) => setLembrar(e.target.checked)}
                  style={{ width: 15, height: 15 }}
                />
                <span>Não pedir de novo neste aparelho</span>
              </label>

              {/* ── ENTRAR EM OUTRA CONTA — 02/09 ─────────────────────────
                  A dona: "nessa tela ter opção com botão de entrar em outra
                  conta."

                  Faltava, e prendia de verdade: esta tela mostra um número
                  e pede a senha DELE. Quem pegou o celular de outra pessoa,
                  ou tem duas contas (a da loja e a sua), não tinha saída —
                  as duas opções eram "entrar" e "receber o código", as duas
                  do mesmo número. Sair pelo botão da Conta exigia estar
                  dentro, e estar dentro é exatamente o que esta tela
                  impede.

                  `signOut` de verdade, e não só liberar a barreira: entrar
                  em outra conta é justamente derrubar a sessão desta. Vai
                  por `location.href` para o app recarregar limpo — sem
                  isso, telas já montadas continuariam mostrando dados da
                  conta anterior. */}
              <button
                type="button"
                className="ei-btn-inline"
                style={{ marginTop: 14 }}
                disabled={ocupado}
                onClick={async () => {
                  setOcupado(true);
                  try {
                    await signOut();
                  } catch {
                    /* Se a saída falhar, seguir para a tela de entrar é
                       melhor que travar aqui: lá dá para entrar de novo. */
                  }
                  window.location.href = "/login";
                }}
              >
                Entrar em outra conta
              </button>

              {/* Abaixo de "Entrar em outra conta", e mais curto — a dona:
                  "esqueci minha senha - tirar o 'receber código por SMS' e
                  colocar debaixo do botão de entrar em outra conta". O que
                  o botão FAZ não mudou (ainda manda o código por SMS); só
                  parou de anunciar o mecanismo no próprio rótulo. */}
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
                Esqueci minha senha
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
