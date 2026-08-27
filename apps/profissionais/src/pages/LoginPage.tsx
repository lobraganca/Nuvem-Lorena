import { useEffect, useState } from "react";
import {
  conferirCodigoDeEntrada,
  criarContaComEmail,
  entrarComEmail,
  entrarComTelefone,
  recuperarSenha,
  signInWithGoogle,
} from "../lib/auth";
import { hasDatabase } from "../lib/supabase";
import { BotaoApple } from "../components/BotaoApple";
import { BotaoGoogle } from "../components/BotaoGoogle";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { mensagemDeErro } from "../lib/erros";
import { formatPhone } from "../lib/phone";
import { useNavigate } from "react-router-dom";
import { LOGIN_EMAIL_ATIVO, LOGIN_TELEFONE_ATIVO } from "../config";
import { useAuth } from "../lib/useAuth";
import { temDestinoLogin } from "../lib/auth";
import { googleServeAqui } from "../lib/plataforma";

/**
 * Entrar: pelo telefone, pelo Google, ou por e-mail e senha.
 *
 * O Google era a única porta, e isso deixava de fora quem não tem conta
 * Google no celular, quem tem e não lembra a senha, e quem simplesmente não
 * quer entrar com ela. Numa cidade pequena, essas três somam gente demais.
 *
 * O telefone vem primeiro por dois motivos. Para quem entra, é o caminho
 * mais curto que existe: sem senha para criar, sem senha para lembrar, sem
 * e-mail para confirmar. Para o app, é o único que entrega o número
 * confirmado sem precisar pedir nada — e o número é o que permite avisar
 * alguém de que apareceu um cliente.
 *
 * E-mail e senha ficam recolhidos atrás de um toque. Não por serem piores,
 * mas porque quem quer esse caminho já sabe que quer, e quem não quer não
 * precisa ler dois campos a mais para achar o que veio fazer.
 *
 * **Hoje só o Google está no ar.** As duas portas novas dependem de ajuste
 * no painel do Supabase (ver `LOGIN_TELEFONE_ATIVO` e `LOGIN_EMAIL_ATIVO`
 * em `config.ts`) e ficam escondidas até lá — inteiras, não desabilitadas.
 * Botão cinza com "em breve" é pior que ausência: quem precisava daquele
 * caminho vai embora sabendo que ele existe e não funciona, e ainda tenta
 * de novo amanhã.
 */
export function LoginPage() {
  useTituloDaPagina("Entrar");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [passoTelefone, setPassoTelefone] = useState<"numero" | "codigo">("numero");
  const [enviando, setEnviando] = useState(false);

  const [comEmail, setComEmail] = useState(false);
  const [criando, setCriando] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  function limpar() {
    setError("");
    setAviso("");
  }

  /* Quando a pessoa entra, ela sai desta tela.
     ──────────────────────────────────────────
     Parece óbvio e não estava aqui, porque até agora só existia o Google:
     lá o navegador SAI do app, vai ao Google e VOLTA para um endereço — a
     mudança de tela é efeito da viagem, não do código.

     Entrar por telefone (e por e-mail) termina aqui mesmo, sem viagem
     nenhuma. A sessão era criada e a tela ficava exatamente igual: o
     código digitado, o botão "Entrar" no lugar, nada acontecendo. Quem
     estava do outro lado tocava de novo — e a segunda conferência
     encontrava um código já gasto.

     `temDestinoLogin` evita disputa: se alguém pediu para entrar a partir
     de outra tela ("Quero ser encontrado" leva ao Painel), quem manda é o
     RetomarDestinoLogin, que sabe o destino certo. Sem destino guardado,
     o Perfil é o lugar: é de onde se vê a conta que acabou de entrar. */
  const { user, loading: carregandoConta } = useAuth();
  const navegar = useNavigate();

  useEffect(() => {
    if (carregandoConta || !user) return;
    if (temDestinoLogin()) return;
    navegar("/perfil", { replace: true });
  }, [user, carregandoConta, navegar]);

  async function tentar(acao: () => Promise<void>, aoDarCerto?: () => void) {
    limpar();
    setEnviando(true);
    try {
      await acao();
      aoDarCerto?.();
    } catch (err) {
      setError(mensagemDeErro(err, "Não foi possível continuar."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="container entrar-pagina">
      <h1>Entrar</h1>
      <p className="muted">
        Para avaliar, salvar favoritos e cadastrar os seus serviços. Buscar continua livre, sem conta.
      </p>

      {!hasDatabase() && (
        <p className="muted" style={{ marginTop: 10 }}>
          Configure VITE_SUPABASE_URL/ANON_KEY no Supabase para habilitar a entrada.
        </p>
      )}

      {/* --- Telefone: o caminho principal ---------------------------- */}
      {LOGIN_TELEFONE_ATIVO && (
      <section className="entrar-bloco">
        {passoTelefone === "numero" ? (
          <>
            <label className="entrar-rotulo" htmlFor="entrar-telefone">
              Seu celular
            </label>
            <input
              id="entrar-telefone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="(31) 99999-9999"
              value={telefone}
              onChange={(e) => setTelefone(formatPhone(e.target.value))}
              disabled={!hasDatabase() || enviando}
            />
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={!hasDatabase() || enviando || telefone.length < 14}
              onClick={() =>
                tentar(
                  () => entrarComTelefone(telefone),
                  () => {
                    setPassoTelefone("codigo");
                    setAviso("Enviamos um código por SMS. Ele chega em alguns segundos.");
                  }
                )
              }
            >
              {enviando ? "Enviando…" : "Receber código por SMS"}
            </button>
            <p className="muted entrar-dica">
              Sem senha para criar nem lembrar. O número fica sendo seu jeito de entrar.
            </p>
          </>
        ) : (
          <>
            <label className="entrar-rotulo" htmlFor="entrar-codigo">
              Código enviado para {telefone}
            </label>
            <input
              id="entrar-codigo"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={enviando}
            />
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={enviando || codigo.length < 4}
              onClick={() => tentar(() => conferirCodigoDeEntrada(telefone, codigo))}
            >
              {enviando ? "Conferindo…" : "Entrar"}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-block entrar-secundario"
              disabled={enviando}
              onClick={() => {
                setPassoTelefone("numero");
                setCodigo("");
                limpar();
              }}
            >
              Trocar o número
            </button>
          </>
        )}
      </section>
      )}

      {/* Google e Apple só onde eles voltam. Dentro do app instalado o
          login abre no navegador e não tem caminho de volta — ver
          `googleServeAqui`. O "ou" acompanha: sem nada depois dele, ele
          anuncia uma alternativa que não vem. */}
      {googleServeAqui() && (
        <>
          {LOGIN_TELEFONE_ATIVO && <p className="entrar-ou">ou</p>}
          <BotaoGoogle onClick={() => tentar(() => signInWithGoogle("/perfil"))} disabled={!hasDatabase()} />
          <BotaoApple voltarPara="/perfil" onErro={setError} />
        </>
      )}

      {/* --- E-mail e senha: recolhido ------------------------------- */}
      {!LOGIN_EMAIL_ATIVO ? null : !comEmail ? (
        <button type="button" className="entrar-link" onClick={() => setComEmail(true)}>
          Entrar com e-mail e senha
        </button>
      ) : (
        <section className="entrar-bloco">
          <label className="entrar-rotulo" htmlFor="entrar-email">
            E-mail
          </label>
          <input
            id="entrar-email"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={enviando}
          />
          <label className="entrar-rotulo" htmlFor="entrar-senha">
            Senha
          </label>
          <input
            id="entrar-senha"
            type="password"
            autoComplete={criando ? "new-password" : "current-password"}
            placeholder={criando ? "Pelo menos 8 caracteres" : "Sua senha"}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            disabled={enviando}
          />
          <button
            type="button"
            className="btn btn-primary btn-block"
            /* Criando, o mínimo é 8 — o mesmo que `criarContaComEmail`
               cobra. Deixar o botão aceso com 5 caracteres só adiava a
               recusa para depois do toque. Entrando, qualquer tamanho
               serve: quem já tem senha curta de antes precisa poder usá-la. */
            disabled={enviando || !email.includes("@") || senha.length < (criando ? 8 : 4)}
            onClick={() =>
              criando
                ? tentar(
                    () => criarContaComEmail(email, senha),
                    () =>
                      setAviso(
                        "Conta criada. Confirme pelo link que enviamos para o seu e-mail — olhe também o lixo eletrônico."
                      )
                  )
                : tentar(() => entrarComEmail(email, senha))
            }
          >
            {enviando ? "Aguarde…" : criando ? "Criar conta" : "Entrar"}
          </button>

          <div className="entrar-alternativas">
            <button type="button" className="entrar-link" onClick={() => { setCriando(!criando); limpar(); }}>
              {criando ? "Já tenho conta" : "Criar uma conta"}
            </button>
            {!criando && (
              <button
                type="button"
                className="entrar-link"
                disabled={!email.includes("@")}
                onClick={() =>
                  tentar(
                    () => recuperarSenha(email),
                    () => setAviso("Se existir conta com este e-mail, o link de nova senha chega nele.")
                  )
                }
              >
                Esqueci a senha
              </button>
            )}
          </div>
        </section>
      )}

      {aviso && <p className="entrar-aviso">{aviso}</p>}
      {error && <p className="entrar-erro">{error}</p>}

      <p className="muted entrar-dica">
        Você continua conectado neste aparelho — só sai quando tocar em <strong>Sair</strong>.
      </p>
    </div>
  );
}
