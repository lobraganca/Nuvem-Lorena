import { useEffect, useState } from "react";
import {
  conferirCodigoDeEntrada,
  criarContaComEmail,
  entrarComEmail,
  entrarComTelefone,
  entrarComTelefoneESenha,
  definirSenha,
  recuperarSenha,
  signInWithGoogle,
} from "../lib/auth";
import { hasDatabase, problemaDeConfiguracao } from "../lib/supabase";
import { BotaoApple } from "../components/BotaoApple";
import { BotaoGoogle } from "../components/BotaoGoogle";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { mensagemDeErro } from "../lib/erros";
import { formatPhone } from "../lib/phone";
import { useLocation, useNavigate } from "react-router-dom";
import { LOGIN_EMAIL_ATIVO, LOGIN_TELEFONE_ATIVO } from "../config";
import { useAuth } from "../lib/useAuth";
import { temDestinoLogin } from "../lib/auth";
import { googleServeAqui } from "../lib/plataforma";
import { useOnboardingStatus } from "../lib/useOnboardingStatus";
import { registrarTipoDeUsuario } from "../lib/company";
import {
  destinoDoLado,
  esquecerLado,
  guardarLado,
  ladoDaUrl,
  lerLado,
  type Lado,
} from "../lib/ladoEscolhido";

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
  /* Segundos que faltam para poder pedir OUTRO código.
     ─────────────────────────────────────────────────
     Cada pedido manda um SMS, e cada SMS é pago pela dona do app. Sem
     freio, o botão "Receber código" é um botão de gastar dinheiro dela —
     e não é preciso má intenção: basta a pessoa achar que não chegou e
     tocar de novo três vezes.
     
     Há um efeito melhor que o custo: pedir um código novo INVALIDA o
     anterior. Boa parte das falhas desta noite foi isso — código pedido
     duas vezes, a pessoa digitando o primeiro, que já não valia.
     
     Não substitui o freio do servidor (Supabase > Authentication > Rate
     Limits), que é quem segura quem tem má intenção de verdade. Este aqui
     resolve o caso comum, que é a maioria. */
  const [esperaSegundos, setEsperaSegundos] = useState(0);
  const [enviando, setEnviando] = useState(false);

  /* ── SENHA: A CONTA QUE NÃO GASTA SMS ───────────────────────────────
     A dona: "acho que podemos inserir a pessoa cadastrar uma conta depois
     que confirma o número de telefone, assim ele não precisa ficar
     gastando sms toda vez que entrar."

     O telefone continua sendo a conta. A senha é um segundo caminho para
     provar que ela é dela — e quem esquecer volta pelo SMS, que nunca
     deixa de funcionar.

     O modo que abre PRIMEIRO depende do aparelho: quem já entrou com
     senha aqui vê o campo de senha; quem nunca entrou vê o caminho do
     SMS, porque senha que ainda não existe não serve de porta. A marca no
     armazenamento é só uma lembrança de conveniência — errar nela não
     tranca ninguém, os dois caminhos estão sempre a um toque. */
  const [modo, setModo] = useState<"senha" | "sms">(() => {
    try {
      return localStorage.getItem("ei-tem-senha") === "1" ? "senha" : "sms";
    } catch {
      return "sms";
    }
  });
  const [senhaEntrada, setSenhaEntrada] = useState("");
  /* Acabou de entrar por SMS e ainda não tem senha: a tela oferece criar
     uma antes de seguir. Segura a ida para o painel, senão a oferta
     apareceria e sumiria no mesmo instante. */
  const [ofereceSenha, setOfereceSenha] = useState(false);
  const [senhaNova, setSenhaNova] = useState("");

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
     o usuário passa pelo onboarding (se primeira vez) ou vai ao destino padrão. */
  const { user, loading: carregandoConta } = useAuth();
  const tipoOnboarding = useOnboardingStatus();
  const navegar = useNavigate();
  const { search } = useLocation();

  /* O lado vem da URL na primeira vez e do armazenamento nas seguintes.
     Os dois porque o Google leva o navegador para fora do app e o traz de
     volta num endereço que este código não escolheu — ali a consulta da
     URL já não existe. */
  const [lado] = useState<Lado | null>(() => {
    const daUrl = ladoDaUrl(search);
    if (daUrl) guardarLado(daUrl);
    return daUrl ?? lerLado();
  });

  useEffect(() => {
    if (carregandoConta || !user) return;
    /* A oferta de criar senha acontece DEPOIS de a sessão existir. Sem
       esta linha, o redirecionamento levaria a pessoa embora no mesmo
       instante e a oferta piscaria sem ser lida. */
    if (ofereceSenha) return;
    if (temDestinoLogin()) return;

    // Se está carregando o status de onboarding, aguarda
    if (tipoOnboarding === null) return;

    /* Ainda sem lado registrado na conta. Se a pessoa já disse de que lado
       está, lá na tela de abertura, essa resposta VALE — perguntar de novo
       é o defeito, não a segurança. Quem chegou aqui sem dizer (tocou em
       "Entrar" na barra de baixo) continua indo à tela da pergunta. */
    if (tipoOnboarding === false) {
      if (lado) {
        registrarTipoDeUsuario(user.id, lado)
          .then(() => {
            esquecerLado();
            navegar(destinoDoLado(lado), { replace: true });
          })
          /* Falhou o registro: cai na pergunta em vez de deixar a pessoa
             parada numa tela de login onde ela já está logada. */
          .catch(() => navegar("/onboarding-tipo", { replace: true }));
        return;
      }
      navegar("/onboarding-tipo", { replace: true });
      return;
    }

    /* Já tem lado. A escolha guardada não manda mais nada — quem tem
       cadastro de empresa é empresa por ter a empresa, e não por um botão
       tocado semanas atrás. */
    esquecerLado();
    navegar(tipoOnboarding === "company" ? "/painel-empresa" : "/vagas-para-mim", {
      replace: true,
    });
  }, [user, carregandoConta, tipoOnboarding, navegar, lado, ofereceSenha]);

  useEffect(() => {
    if (esperaSegundos <= 0) return;
    const t = setTimeout(() => setEsperaSegundos((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [esperaSegundos]);

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

  /* ── A OFERTA DE CRIAR SENHA ────────────────────────────────────────
     Aparece uma vez, logo depois de entrar por SMS, e some para sempre
     assim que a senha existe. "Agora não" é um botão de verdade e leva
     adiante sem cobrar nada: quem não quiser senha continua entrando por
     SMS a vida toda, que é como funcionava até hoje. */
  if (ofereceSenha && user && !user.user_metadata?.tem_senha) {
    return (
      <div className="container entrar-pagina">
        <h1>Pronto, você entrou</h1>
        <p className="muted">
          Quer criar uma senha? Assim, da próxima vez, você entra sem esperar SMS.
        </p>

        <section className="entrar-bloco">
          <label className="entrar-rotulo" htmlFor="entrar-senha-nova">
            Nova senha
          </label>
          <input
            id="entrar-senha-nova"
            type="password"
            autoComplete="new-password"
            placeholder="Pelo menos 8 caracteres"
            value={senhaNova}
            onChange={(e) => setSenhaNova(e.target.value)}
            disabled={enviando}
          />
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={enviando || senhaNova.length < 8}
            onClick={() =>
              tentar(
                () => definirSenha(senhaNova),
                () => {
                  try {
                    localStorage.setItem("ei-tem-senha", "1");
                  } catch {
                    /* segue sem lembrar */
                  }
                  setSenhaNova("");
                  setOfereceSenha(false);
                }
              )
            }
          >
            {enviando ? "Salvando…" : "Criar senha e continuar"}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-block entrar-secundario"
            disabled={enviando}
            onClick={() => setOfereceSenha(false)}
          >
            Agora não
          </button>
        </section>

        {aviso && <p className="entrar-aviso">{aviso}</p>}
        {error && <p className="entrar-erro">{error}</p>}
      </div>
    );
  }

  return (
    <div className="container entrar-pagina">
      {/* O título muda com o lado que a pessoa escolheu na tela de abertura.
          Antes era sempre "Entrar", e quem tinha acabado de tocar em "Estou
          contratando" chegava a uma tela que não falava de contratar em
          lugar nenhum — sem nada dizendo que o caminho ainda era aquele. */}
      <h1>
        {lado === "company"
          ? "Entrar para contratar"
          : lado === "professional"
            ? "Entrar para procurar trabalho"
            : "Entrar"}
      </h1>
      <p className="muted">
        {/* Era texto do procurô — "avaliar, salvar favoritos e cadastrar
            os seus serviços" —, e nenhuma dessas três coisas existe aqui.
            Ficava na PRIMEIRA tela que qualquer pessoa nova lê. */}
        {/* Uma linha, e curta. As três anteriores tinham duas frases cada,
            e a segunda sempre explicava o que NÃO precisa de conta — numa
            tela onde a pessoa já decidiu entrar. Explicação que chega
            depois da decisão não ajuda: ocupa a tela e atrasa o campo. */}
        {lado === "company"
          ? "Para publicar suas vagas."
          : lado === "professional"
            ? "Para receber as vagas do seu ofício."
            : "Para receber vagas, ou publicar as suas."}
      </p>

      {/* Quando o app nao consegue falar com o banco.
          ─────────────────────────────────────────────
          Isto apareceu NO AR, em 31/08, para qualquer pessoa que abrisse o
          site: os dois botoes desligados e, no lugar da explicacao, a
          frase "Configure VITE_SUPABASE_URL/ANON_KEY no Supabase para
          habilitar a entrada".

          Dois defeitos numa linha so.

          O primeiro: e nome de variavel de programador, na PRIMEIRA tela
          que um pedreiro de Itabirito ve. Ele nao tem o que fazer com
          isso; so aprende que o app esta quebrado.

          O segundo, e o pior, porque enganava quem PODIA consertar: as
          variaveis nao ficam "no Supabase". Elas ficam nas variaveis de
          ambiente do projeto na VERCEL, que e quem constroi o site — o
          Supabase so entrega os valores. Quem seguisse a instrucao ia
          procurar no lugar errado.

          Agora: uma frase de gente para quem chegou, e a instrucao certa,
          separada e endereçada a quem administra. */}
      {!hasDatabase() && (
        <div className="ei-callout ei-callout-atencao" style={{ marginTop: 12 }}>
          <span className="ei-callout-texto">
            <strong>O app não está conseguindo falar com o banco agora.</strong>{" "}
            Por isso não dá para entrar. Tente de novo daqui a pouco.
            <br />
            <span className="ei-apoio" style={{ display: "block", marginTop: 8 }}>
              Se você administra o app: {problemaDeConfiguracao()} Elas ficam nas
              variáveis de ambiente do projeto na <strong>Vercel</strong> (não no
              Supabase), e é preciso publicar de novo depois de salvar.
            </span>
          </span>
        </div>
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
            {/* A senha só aparece no modo senha. Um campo de senha vazio
                ao lado do caminho do SMS faria a pessoa achar que precisa
                inventar uma para receber o código. */}
            {modo === "senha" && (
              <>
                <label className="entrar-rotulo" htmlFor="entrar-senha-fone">
                  Sua senha
                </label>
                <input
                  id="entrar-senha-fone"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  value={senhaEntrada}
                  onChange={(e) => setSenhaEntrada(e.target.value)}
                  disabled={!hasDatabase() || enviando}
                />
              </>
            )}

            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={
                !hasDatabase() ||
                enviando ||
                telefone.length < 14 ||
                (modo === "senha" ? senhaEntrada.length < 4 : esperaSegundos > 0)
              }
              onClick={() =>
                modo === "senha"
                  ? tentar(() => entrarComTelefoneESenha(telefone, senhaEntrada), () => {
                      try {
                        localStorage.setItem("ei-tem-senha", "1");
                      } catch {
                        /* segue sem lembrar */
                      }
                    })
                  : tentar(
                      () => entrarComTelefone(telefone),
                      () => {
                        setPassoTelefone("codigo");
                        setEsperaSegundos(60);
                        setAviso("Enviamos um código por SMS. Ele chega em alguns segundos.");
                      }
                    )
              }
            >
              {enviando
                ? modo === "senha"
                  ? "Entrando…"
                  : "Enviando…"
                : modo === "senha"
                  ? "Entrar"
                  : esperaSegundos > 0
                    ? `Aguarde ${esperaSegundos}s para pedir outro`
                    : "Receber código por SMS"}
            </button>

            {/* A troca entre os dois caminhos, sempre visível. É também o
                "esqueci a senha": entrar por SMS funciona mesmo sem ela, e
                dentro do app dá para definir outra. */}
            <button
              type="button"
              className="entrar-link"
              onClick={() => {
                setModo(modo === "senha" ? "sms" : "senha");
                setSenhaEntrada("");
                limpar();
              }}
            >
              {modo === "senha"
                ? "Não tenho senha — entrar com código por SMS"
                : "Já tenho senha — entrar com ela"}
            </button>
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
              onClick={() =>
                tentar(
                  () => conferirCodigoDeEntrada(telefone, codigo),
                  /* Quem já tem senha não precisa ver a oferta de novo.
                     O Supabase não responde "esta conta tem senha?", então
                     a marca fica no próprio usuário quando ela é criada
                     (ver `definirSenha`). */
                  () => setOfereceSenha(true)
                )
              }
            >
              {enviando ? "Conferindo…" : "Entrar"}
            </button>
            {/* Reenviar sem voltar atrás. Antes, quem achava que o SMS não
                tinha chegado só tinha "Trocar o número" — e usava esse
                caminho para pedir de novo, apagando o número certo. A
                espera é a mesma do outro botão: pedir um código novo
                invalida o anterior, e o anterior pode estar chegando
                agora. */}
            <button
              type="button"
              className="btn btn-outline btn-block entrar-secundario"
              disabled={enviando || esperaSegundos > 0}
              onClick={() =>
                tentar(
                  () => entrarComTelefone(telefone),
                  () => {
                    setCodigo("");
                    setEsperaSegundos(60);
                    setAviso("Mandamos outro código. Use o mais novo — o anterior deixou de valer.");
                  }
                )
              }
            >
              {esperaSegundos > 0 ? `Reenviar em ${esperaSegundos}s` : "Não recebi — reenviar"}
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

    </div>
  );
}
