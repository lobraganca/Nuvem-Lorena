/**
 * Quem entrou por SMS e ainda não tem senha cria uma antes de seguir.
 *
 * ── POR QUE ISTO VIROU UMA BARREIRA, E NÃO UM PEDAÇO DA TELA DE ENTRAR ─
 *
 * A dona: "quando entro com o sms não tá dando pra criar a senha."
 *
 * E não estava mesmo. A oferta morava dentro da `LoginPage`, aparecendo
 * depois do código conferido. Só que, no instante em que a sessão nasce,
 * o `RetomarDestinoLogin` leva a pessoa para onde ela queria ir — e a
 * `LoginPage` inteira sai da tela junto, levando a oferta com ela. Os dois
 * estavam certos separadamente e brigavam pelo mesmo momento.
 *
 * Como barreira, ela não depende de nenhuma tela: vale em qualquer rota,
 * e o desvio do destino salvo acontece DEPOIS, quando a senha existir.
 *
 * ── A REGRA ────────────────────────────────────────────────────────────
 *
 * "A partir do momento que tem o sms confirmado, deve abrir uma tela pra
 * cadastrar a senha, após isso a pessoa só consegue abrir com o número e
 * senha. Ou se esquecer a senha, aí manda outro sms."
 *
 * Então: sem senha, não se passa daqui. A marca de que ela existe é o
 * `user_metadata.tem_senha`, escrito por `definirSenha` — o Supabase não
 * responde "esta conta tem senha?", e sem essa marca a barreira apareceria
 * para sempre, inclusive para quem já criou.
 *
 * ── A SAÍDA DE EMERGÊNCIA ──────────────────────────────────────────────
 *
 * Ela só aparece quando guardar a senha FALHA. Sem isso, uma queda de rede
 * prende a pessoa numa tela obrigatória, já logada, sem caminho nenhum —
 * o que é pior do que uma conta sem senha por mais um dia.
 */
import { useState, type ReactNode } from "react";
import { useAuth } from "../../lib/useAuth";
import { definirSenha } from "../../lib/auth";
import { mensagemDeErro } from "../../lib/erros";

/* As telas que a barreira não cobre. `/termos` e `/privacidade` porque
   precisam ser alcançáveis sempre (Play Store e LGPD), e `/login` porque
   é de onde a pessoa vem — cobri-la faria a barreira aparecer por cima do
   próprio formulário de entrar. */
const LIVRES = ["/login", "/termos", "/privacidade"];

export function exigeSenha(caminho: string): boolean {
  return !LIVRES.some((t) => caminho === t || caminho.startsWith(`${t}/`));
}

export function ExigirSenha({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  /** Falhou e a pessoa escolheu seguir assim, só nesta sessão. */
  const [adiado, setAdiado] = useState(false);

  if (loading || !user) return <>{children}</>;
  if (user.user_metadata?.tem_senha || adiado) return <>{children}</>;

  return (
    <div className="ei">
      <div className="ei-tela">
        <div className="ei-margem" style={{ paddingTop: 20 }}>
          <h1 className="ei-entrada-titulo">Agora crie sua senha</h1>
          <p className="ei-apoio" style={{ marginTop: 6 }}>
            É com ela que você entra daqui em diante — sem esperar SMS. Se um dia
            esquecer, a gente manda um código de novo.
          </p>
        </div>

        <section className="ei-cartao" style={{ marginTop: 14 }}>
          <div className="ei-campo">
            <label htmlFor="criar-senha">Sua senha</label>
            <input
              id="criar-senha"
              type="password"
              autoComplete="new-password"
              placeholder="Pelo menos 8 caracteres"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
            <span className="ei-campo-ajuda">
              Guarde num lugar seguro. Ninguém do Ei Itabirito vai te pedir a sua senha.
            </span>
          </div>

          {erro && <p className="ei-campo-erro" role="alert">{erro}</p>}

          <button
            type="button"
            className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
            style={{ marginTop: 12 }}
            disabled={salvando || senha.length < 8}
            onClick={async () => {
              setSalvando(true);
              setErro("");
              try {
                await definirSenha(senha);
                try {
                  localStorage.setItem("ei-tem-senha", "1");
                } catch {
                  /* segue sem lembrar */
                }
                /* Depois da senha, a escolha do ambiente.
                   ─────────────────────────────────────────
                   A dona: "depois de colocar a senha, deve ter uma página
                   onde a pessoa escolhe o ambiente que quer acessar, o
                   ambiente de candidata ou se empresa."

                   É o fim natural da sequência: entrar → provar o número →
                   criar a senha → dizer o que veio fazer. Antes, a
                   pergunta do lado aparecia solta em outro momento, e quem
                   acabava de criar a senha caía direto no app sem nunca
                   ter escolhido nada.

                   Vai por `location.href` e não pelo roteador: o
                   `tem_senha` recém-gravado é lido da sessão, e sem uma
                   volta ao começo esta mesma barreira continuaria de pé
                   sobre um dado velho. */
                window.location.href = "/onboarding-tipo";
              } catch (err) {
                setErro(mensagemDeErro(err, "Não consegui guardar a senha."));
                setSalvando(false);
              }
            }}
          >
            {salvando ? "Guardando…" : "Guardar senha e continuar"}
          </button>

          {erro && (
            <button
              type="button"
              className="ei-btn-inline"
              style={{ marginTop: 10 }}
              onClick={() => setAdiado(true)}
            >
              Não consegui agora — criar depois, na Conta
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
