import { useEffect, useState } from "react";
import {
  conferirCodigoDeEntrada,
  criarContaComEmail,
  entrarComEmail,
  entrarComTelefone,
  entrarComTelefoneESenha,
  recuperarSenha,
} from "../lib/auth";
import { hasDatabase, problemaDeConfiguracao } from "../lib/supabase";
import { marcarAppAberto, gravarSenhaNesteAparelho } from "../components/ei/ExigirDesbloqueio";
import { CampoSenha } from "../components/ei/CampoSenha";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { mensagemDeErro } from "../lib/erros";
import { formatPhone } from "../lib/phone";
import { useLocation, useNavigate } from "react-router-dom";
import { LOGIN_EMAIL_ATIVO, LOGIN_TELEFONE_ATIVO } from "../config";
import { useAuth } from "../lib/useAuth";
import { temDestinoLogin } from "../lib/auth";
import { ladoDaUrl, type Lado } from "../lib/ladoEscolhido";
import {
  casaDoLado,
  guardarLadoDaSessao,
  lerLadoDaSessao,
} from "../lib/ladoDaSessao";
import { registrarTipoDeUsuario } from "../lib/company";

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
    /* ── A SENHA É O CAMINHO NORMAL; O SMS É O CONSERTO ────────────────
       A dona: "toda vez que entra está me pedindo pra enviar o sms. a
       partir do momento que tem o sms confirmado, deve abrir uma tela pra
       cadastrar a senha, após isso a pessoa só consegue abrir com o número
       e senha. ou se esquecer a senha, aí manda outro sms."

       Antes o padrão era o SMS, e a senha só aparecia se o aparelho
       lembrasse que ela existia. O efeito é o que ela descreve: quem já
       tem senha era recebido, toda vez, pela tela que gasta uma mensagem.

       Agora abre na senha, sempre. O SMS continua a um toque, com o nome
       do que ele resolve — "esqueci a senha" —, e é ele que cria a conta
       de quem chega pelo botão "Criar conta". */
    const pedido = new URLSearchParams(window.location.search || "").get("acao")
      ?? new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("acao");
    return pedido === "criar" ? "sms" : "senha";
  });
  const [senhaEntrada, setSenhaEntrada] = useState("");
  /* "Gravar a senha", na tela de início.
     ─────────────────────────────────────
     A dona: "ter opção de gravar a senha na tela de inicio."

     A caixinha existia, mas só na tela "Olá de novo" — a que aparece
     quando o app é ABERTO de novo. Ou seja: para chegar até ela a pessoa
     precisava já ter entrado uma vez, fechado o app, e aberto outra. Na
     primeira vez, que é quando alguém decide se vai digitar senha todo dia,
     a opção não estava em lugar nenhum.

     O que se grava é a DECISÃO de não pedir de novo neste aparelho, e nunca
     a senha. Senha guardada em navegador é o tipo de atalho que vira
     notícia ruim, e aqui não resolveria nada que a decisão não resolva. */
  const [gravarSenha, setGravarSenha] = useState(false);

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
  const navegar = useNavigate();
  const { search } = useLocation();

  /* ── A ESCOLHA DO LADO É O PRIMEIRO PASSO DO LOGIN — 04/09 ──────────
     A dona: "na tela de login a pessoa vai ter que escolher entre quero
     contratar ou procuro emprego. Serão dois logins diferentes e as
     funcionalidades serão separadas."

     Enquanto isto for `null`, a tela mostra SÓ as duas portas — sem campo
     de telefone, sem senha. Não é enfeite de fluxo: é o que faz a escolha
     ser uma decisão, e não uma caixinha que se pula sem ler.

     Vem da URL quando alguém chega por um caminho que já sabe o lado
     (`?lado=trabalhar`, de quem tentou responder a uma vaga sem conta), e
     do armazenamento quando a pessoa já tinha escolhido e a página
     recarregou no meio — as duas portas de novo, nesse caso, seriam o app
     esquecendo o que ela acabou de responder. */
  const [ladoEscolhido, setLadoEscolhido] = useState<Lado | null>(
    () => ladoDaUrl(search) ?? lerLadoDaSessao()
  );

  function escolherLado(l: Lado) {
    guardarLadoDaSessao(l);
    setLadoEscolhido(l);
    limpar();
  }

  useEffect(() => {
    if (carregandoConta || !user) return;
    if (temDestinoLogin()) return;

    /* ── DEPOIS DE ENTRAR, O LADO JÁ FOI ESCOLHIDO — 04/09 ────────────
       A dona: "na tela de login a pessoa vai ter que escolher entre quero
       contratar ou procuro emprego."

       Aqui havia um desvio para `/onboarding-tipo`: a pergunta do lado
       vinha DEPOIS do login, sempre, inclusive para quem já usava o app
       todo dia. Era o que ela tinha pedido antes ("logo após fazer login,
       sempre deve ter opção de escolher o ambiente") e é exatamente o que
       ela está desfazendo agora — a pergunta subiu para a porta, e
       perguntar de novo do lado de dentro seria perguntar duas vezes.

       Sem lado nenhum (só acontece com quem entrou por um caminho antigo,
       de fora desta tela) a pergunta continua existindo, na tela dela.

       O banco é escrito aqui, e não na hora do toque: um lado registrado
       para quem nem chegou a entrar seria um cadastro de mentira nos
       números do painel. `catch` vazio porque a escrita é para a
       administração contar — falhar nela não pode impedir alguém de usar
       o app. */
    const lado = ladoEscolhido ?? lerLadoDaSessao();
    if (!lado) {
      navegar("/onboarding-tipo", { replace: true });
      return;
    }

    guardarLadoDaSessao(lado);
    registrarTipoDeUsuario(user.id, lado).catch(() => {
      /* silêncio proposital: ver o comentário acima */
    });
    navegar(casaDoLado(lado), { replace: true });
  }, [user, carregandoConta, navegar, ladoEscolhido]);

  useEffect(() => {
    if (esperaSegundos <= 0) return;
    const t = setTimeout(() => setEsperaSegundos((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [esperaSegundos]);

  async function tentar<T>(acao: () => Promise<T>, aoDarCerto?: (r: T) => void) {
    limpar();
    setEnviando(true);
    try {
      const resultado = await acao();
      aoDarCerto?.(resultado);
    } catch (err) {
      setError(mensagemDeErro(err, "Não foi possível continuar."));
    } finally {
      setEnviando(false);
    }
  }

  /* A criação da senha saiu daqui.
     ────────────────────────────────
     Ela morava nesta tela, logo depois do código conferido, e não
     aparecia: no instante em que a sessão nasce, o `RetomarDestinoLogin`
     leva a pessoa para o destino guardado e a LoginPage sai da tela junto.
     Virou barreira global (`ExigirSenha`), que não depende de nenhuma rota
     continuar montada. */

  return (
    <div className="container entrar-pagina">
      <h1>{modo === "sms" && !comEmail ? "Criar conta ou entrar" : "Entrar"}</h1>
      {/* ── A CHAVE DO LADO, NA MESMA TELA DO LOGIN — 04/09 ─────────────
          A dona: "na tela de login a pessoa vai ter que escolher entre quero
          contratar ou procuro emprego. Serão dois logins diferentes e as
          funcionalidades serão separadas." E, logo depois: "sobre a chave
          para escolher o perfil, deve estar na mesma tela do login."

          A primeira versão disto foi uma tela ANTES do login, com as duas
          portas grandes, e o formulário só aparecia depois de escolher. Ela
          recusou: são dois passos onde cabe um, e quem já sabe o que veio
          fazer tem de tocar duas vezes para chegar no mesmo campo de
          telefone.

          Aqui a chave é a primeira coisa da tela e o formulário está logo
          abaixo, os dois visíveis de uma vez. Nada é preenchido antes da
          escolha — o botão de entrar fica travado — porque o lado decide o
          app inteiro que vem depois, e entrar sem ele seria escolher por
          quem não escolheu. */}
      <div className="entrar-lados" role="group" aria-label="O que você veio fazer">
        <button
          type="button"
          className="entrar-lado"
          aria-pressed={ladoEscolhido === "professional"}
          onClick={() => escolherLado("professional")}
        >
          <span className="entrar-lado-nome">Procuro emprego</span>
          <span className="entrar-lado-nota">
            Recebo as vagas que combinam comigo
          </span>
        </button>
        <button
          type="button"
          className="entrar-lado"
          aria-pressed={ladoEscolhido === "company"}
          onClick={() => escolherLado("company")}
        >
          <span className="entrar-lado-nome">Quero contratar</span>
          <span className="entrar-lado-nota">
            Publico vagas e falo com quem responder
          </span>
        </button>
      </div>

      <p className="muted" style={{ marginTop: 10 }}>
        {ladoEscolhido === null
          ? "Escolha uma das duas para continuar."
          : ladoEscolhido === "company"
            ? "Dentro do app você vê só o lado de quem contrata. Para trocar, é só sair e entrar de novo."
            : "Dentro do app você vê só o lado de quem procura emprego. Para trocar, é só sair e entrar de novo."}
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
              value={telefone}
              onChange={(e) => setTelefone(formatPhone(e.target.value))}
              disabled={!hasDatabase() || enviando}
            />
            {/* A senha só aparece no modo senha. Um campo de senha vazio
                ao lado do caminho do SMS faria a pessoa achar que precisa
                inventar uma para receber o código. */}
            {modo === "senha" && (
              <>
                {/* O olho de mostrar a senha (a dona: "ícone pra mostrar
                    a senha no login"). Num celular o teclado erra letra e
                    o campo escondido não deixa conferir — e quem erra duas
                    vezes desiste de entrar. Ver CampoSenha. */}
                <CampoSenha
                  id="entrar-senha-fone"
                  classeRotulo="entrar-rotulo"
                  rotulo="Sua senha"
                  valor={senhaEntrada}
                  onChange={setSenhaEntrada}
                  desabilitado={!hasDatabase() || enviando}
                />
                {/* Caixa e texto colados, lado a lado. Com a classe de item
                    de lista a caixinha ia para uma ponta e o texto para a
                    outra, separados por meia tela — foi o que a foto da
                    dona mostrou na tela "Olá de novo". */}
                <label className="entrar-gravar">
                  <input
                    type="checkbox"
                    checked={gravarSenha}
                    onChange={(e) => setGravarSenha(e.target.checked)}
                    disabled={!hasDatabase() || enviando}
                  />
                  <span>Gravar minha senha neste aparelho</span>
                </label>
              </>
            )}

            <button
              type="button"
              className="btn btn-primary btn-block"
              /* `!ladoEscolhido` trava o botão até a chave de cima ser
                 tocada — ver o comentário dela. Entrar sem lado deixaria
                 o app decidir por quem não decidiu. */
              disabled={
                !hasDatabase() ||
                !ladoEscolhido ||
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
                      /* Quem acabou de entrar não pode ser parado pela tela
                         que pede a senha a cada abertura: ela é para quem
                         ABRE o app já logado, não para quem acabou de
                         digitar a senha aqui. */
                      marcarAppAberto();
                      /* Marcou a caixinha: este aparelho para de pedir a
                         senha a cada abertura. Desmarcada, ela LIMPA uma
                         decisão anterior — senão quem gravou uma vez nunca
                         mais conseguiria voltar atrás sem saber onde mexer. */
                      gravarSenhaNesteAparelho(gravarSenha);
                    })
                  : tentar(
                      () => entrarComTelefone(telefone),
                      ({ jaTinhaConta }) => {
                        setPassoTelefone("codigo");
                        setEsperaSegundos(60);
                        /* Quem já tem conta precisa saber disso ANTES de
                           refazer um cadastro que já existe — e precisa
                           saber que há um caminho mais curto, a senha. O
                           código vai do mesmo jeito: recusar aqui deixaria
                           de fora justamente quem esqueceu a senha. */
                        setAviso(
                          jaTinhaConta
                            ? "Esse número já tem conta aqui. Mandamos o código para você entrar — " +
                                "e, se você já criou uma senha, dá para usar ela em “Prefiro entrar " +
                                "com a minha senha”, logo abaixo."
                            : "Enviamos um código para o seu celular. Ele chega em alguns segundos."
                        );
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
                    /* Só "Receber código" — a dona: "tirar da tela de
                       login 'receber código por SMS'". O caminho continua
                       o mesmo; o que saiu foi o nome do encanamento, que
                       não ajuda quem está esperando o código chegar. */
                    : "Receber código"}
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
                ? "Esqueci minha senha"
                : "Já tenho senha — entrar com ela"}
            </button>

            {/* ── "CRIAR CONTA", NO PÉ DA TELA DE ENTRAR — 02/09 ─────────
                A dona: "a tela de login já está caindo pra quem já tem
                senha cadastrada. Preciso que tenha um botão embaixo
                escrito criar conta."

                A tela passou a abrir na senha (e é o certo: quem já tem
                conta é a maioria de quem volta). Só que quem AINDA NÃO TEM
                caía numa tela que pede uma senha que ele nunca criou, e a
                única saída dizia "esqueci minha senha" — que é a frase de
                quem tem conta. Não havia porta para quem é novo.

                Fica separado por um fio e com o texto da pergunta em cima:
                um segundo botão colado no "entrar" seria mais uma coisa
                para errar com o dedo, e a pergunta é o que diz a quem ele
                serve. */}
            {modo === "senha" && (
              <div className="entrar-rodape">
                <span className="entrar-rodape-nota">Ainda não tem conta?</span>
                <button
                  type="button"
                  className="btn btn-block"
                  onClick={() => {
                    setModo("sms");
                    setSenhaEntrada("");
                    limpar();
                  }}
                >
                  Criar conta
                </button>
              </div>
            )}
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
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={enviando}
            />
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={enviando || codigo.length < 4}
              onClick={() =>
                tentar(() => conferirCodigoDeEntrada(telefone, codigo), marcarAppAberto)
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
            {/* O caminho de volta para a senha.
                ────────────────────────────────
                O aviso "esse número já tem conta — ou volte e use a sua
                senha" mandava a pessoa "voltar" para uma tela que não
                existia: daqui só havia "Trocar o número", que apaga o
                número e volta ao SMS. A dona perguntou, com o aviso na
                tela: "como volta nessa tela?". Não voltava.

                Agora volta, com o número preservado — quem tem senha
                digita e entra sem esperar SMS nenhum. */}
            <button
              type="button"
              className="entrar-link"
              disabled={enviando}
              onClick={() => {
                setModo("senha");
                setPassoTelefone("numero");
                setCodigo("");
                limpar();
              }}
            >
              Prefiro entrar com a minha senha
            </button>
          </>
        )}
      </section>
      )}

      {/* ── O GOOGLE SAIU — 01/09 ─────────────────────────────────────
          A dona: "acho que pode tirar o login do Google."

          Aqui existiam o botão do Google e o da Apple, com um "ou" em
          cima, mostrados só onde eles conseguem voltar para o app (ver
          `googleServeAqui`). Saíram os dois, e o "ou" com eles.

          Faz sentido agora, e não fazia antes: quando o Google era a ÚNICA
          porta, tirá-lo trancava o app. Hoje o caminho é o telefone — que
          é melhor para este produto por um motivo que o Google não
          resolve: ele entrega o número confirmado, e é o número que
          permite avisar alguém de que apareceu uma vaga. Uma conta Google
          não dá isso; ela só evita digitar uma senha.

          O que se ganha ao tirar: uma porta a menos para manter (chave,
          endereço de volta, tela de consentimento), um botão a menos na
          primeira tela, e o fim de um caso confuso — quem entrava pelo
          Google numa vez e pelo SMS na outra criava DUAS contas, com dois
          cadastros, e não entendia por que o perfil "sumiu".

          O código de `signInWithGoogle` e `BotaoGoogle` continua no
          repositório de propósito: religar é devolver este bloco, e
          apagar tudo agora só tornaria a volta cara.

          A Apple saiu junto porque ela existia como companheira do Google
          (a loja da Apple exige a alternativa quando há login social); sem
          o Google, ela não tem par nem uso — este app é PWA e Play Store. */}

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
            disabled={
              !ladoEscolhido || enviando || !email.includes("@") || senha.length < (criando ? 8 : 4)
            }
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
