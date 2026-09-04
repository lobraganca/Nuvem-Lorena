import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { registrarTipoDeUsuario, marcarOnboardingCompleto, minhasEmpresas } from "../lib/company";
/* ── ESTA TELA VIROU PONTE — 04/09 ──────────────────────────────────
   A dona: "na tela de login a pessoa vai ter que escolher entre quero
   contratar ou procuro emprego."

   A escolha do lado mudou de lugar: agora é a chave da tela de login.
   Esta tela continua existindo por um motivo só — quem já estava logado
   quando a mudança subiu não passou pela porta nova, e sem ela abriria o
   app sem lado nenhum.

   Por isso ela grava também o LADO DA SESSÃO, e não só o tipo no banco:
   sem isso a mesma pessoa responderia a pergunta a cada abertura, porque
   é o lado da sessão que o app inteiro lê agora. */
import { guardarLadoDaSessao } from "../lib/ladoDaSessao";
import { mensagemDeErro } from "../lib/erros";
import { Pagina } from "../components/ei/Pagina";

/**
 * Primeira página após login/criar conta: escolhe se é profissional ou empresa.
 *
 * Depois disso:
 * - Profissional → CadastroPage (nome, foto, serviço, bairro, etc)
 * - Empresa → CadastroEmpresaPage (razão social, CNPJ, endereço, etc)
 */
export function OnboardingTipoPage() {
  useTituloDaPagina("De que lado você está?");
  const navegar = useNavigate();
  const { user, loading } = useAuth();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navegar("/login", { replace: true });
    }
  }, [user, loading, navegar]);

  async function escolherProfissional() {
    if (!user) return;
    setEnviando(true);
    setErro("");

    try {
      guardarLadoDaSessao("professional");
      await registrarTipoDeUsuario(user.id, "professional");
      await marcarOnboardingCompleto(user.id);
      /* `/painel` e não `/painel/novo`.
         ──────────────────────────────
         Quem decide entre os dois é o próprio painel, que já sabe
         distinguir "não tem cadastro" (abre o formulário) de "a rede caiu"
         (mostra o erro). Apontar direto para o formulário jogava fora essa
         distinção — e agora que esta tela aparece a cada login (item 4),
         mandaria quem JÁ tem cadastro para um formulário em branco toda
         vez que abrisse o app. */
      navegar("/painel", { replace: true });
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível continuar."));
      setEnviando(false);
    }
  }

  async function escolherEmpresa() {
    if (!user) return;
    setEnviando(true);
    setErro("");

    try {
      guardarLadoDaSessao("company");
      await registrarTipoDeUsuario(user.id, "company");

      /* ── QUEM JÁ TEM EMPRESA NÃO VÊ A TELA DE PREÇO DE NOVO ─────────
         A dona: "ao escolher a empresa, se o cadastro tiver feito, deve
         aparecer cards com a foto e nome das empresas cadastradas."

         Antes esta tela mandava TODO MUNDO para os planos, o que fazia
         sentido quando ela só aparecia uma vez, para quem estava criando
         a conta. Agora ela aparece a cada login (item 4), e quem já paga
         um plano cairia na vitrine de preços toda vez que abrisse o app.

         Se a leitura falhar, segue pelo caminho dos planos: é o
         comportamento antigo, e ele não perde nada — no pior caso a
         empresa vê um preço que já conhece. Derrubar a escolha do lado por
         causa desta consulta seria trocar um incômodo por um bloqueio. */
      let temEmpresa = false;
      try {
        temEmpresa = (await minhasEmpresas(user.id)).length > 0;
      } catch {
        /* ver acima */
      }

      if (temEmpresa) {
        /* A tela de escolha decide sozinha o que fazer com uma empresa só
           (abre direto o painel dela) e com várias (mostra os cartões). */
        navegar("/minhas-empresas", { replace: true });
        return;
      }

      /* Os planos ANTES do formulário. A empresa decide o que está
         comprando enquanto ainda tem paciência para ler — depois de
         preencher treze campos, qualquer preço parece cobrança. A tela
         some sozinha dentro do app da loja (ver `podeVender`) e leva
         direto ao cadastro. */
      navegar("/planos-empresa?antes=cadastro", { replace: true });
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível continuar."));
      setEnviando(false);
    }
  }

  if (loading) {
    return <div className="container" style={{ paddingTop: 48, textAlign: "center" }}>
      <span className="muted">Carregando…</span>
    </div>;
  }

  return (
    /* A MESMA pergunta da tela inicial, com as MESMAS palavras.
       ────────────────────────────────────────────────────────
       Esta tela só aparece para quem acabou de criar a conta e ainda não
       disse de que lado está — por isso passou tanto tempo sem ser aberta,
       e por isso era a mais atrasada do app.

       Ela perguntava "Qual é seu tipo de conta?" e oferecia "Sou
       profissional" e "Sou empresa/contratante". A tela inicial faz a
       MESMA pergunta, três toques antes, assim: "De que lado você está?",
       "Procuro trabalho", "Estou contratando". Duas linguagens para a
       mesma decisão fazem a pessoa achar que são decisões diferentes — e
       "tipo de conta" é palavra de sistema, não de gente.

       O texto de apoio era do procurô, palavra por palavra: "apareça aqui
       e receba CLIENTES" (aqui não se recebe cliente, se recebe vaga) e
       "preciso de profissionais — BUSQUE aqui" (a empresa não busca, ela
       publica a vaga e o app avisa quem encaixa). O ícone do lado da
       empresa era uma LUPA, pelo mesmo motivo.

       E sumiu o "você pode mudar de ideia depois, mas preencha seu tipo
       principal primeiro": ninguém sabe o que é um "tipo principal", e a
       frase pedia calma para uma dúvida que a tela não criou. */
    <div className="ei">
      <div className="ei-tela">
        <Pagina titulo="De que lado você está?" />
        <p className="ei-apoio ei-margem">
          {/* "Ambiente" é a palavra da dona ("a pessoa escolhe o ambiente
              que quer acessar"), e ela diz melhor o que a escolha faz: não
              define quem a pessoa É, define qual app ela abre agora. */}
          Escolha o ambiente que você quer abrir agora.
        </p>

        {/* ── ESTA TELA ERA SÓ DUAS CAIXAS ────────────────────────────
            A dona: "melhorar essa tela. está muito sem graça."

            E estava: dois retângulos com duas linhas de texto cada, num
            fundo cinza, sem nada que ajudasse a decidir além das palavras.
            É a pergunta mais importante do app — ela decide o que a pessoa
            vai ver de agora em diante — e parecia um formulário.

            O que entrou, e por que cada coisa:

            · um DESENHO em cada lado. Numa decisão entre dois caminhos, a
              figura é lida antes do texto e diz de que se trata sem que
              ninguém precise ler;
            · o que cada lado GANHA, em três linhas com visto — a pergunta
              real de quem está aí não é "quem sou eu", é "o que acontece
              se eu tocar aqui";
            · a promessa de que dá para ter os dois, embaixo. Ela existe
              porque a escolha assusta: numa cidade pequena, quem tem loja
              também é eletricista à noite, e a pessoa trava com medo de
              escolher errado. Escolher errado aqui não custa nada, e a
              tela precisa dizer isso. */}
        <div className="ei-lados">
          <button
            type="button"
            className="ei-lado ei-lado-cheio"
            disabled={enviando}
            onClick={escolherProfissional}
          >
            <svg viewBox="0 0 120 120" className="ei-lado-arte" aria-hidden="true">
              <circle cx="60" cy="60" r="52" fill="rgba(255,255,255,.16)" />
              <circle cx="60" cy="46" r="16" fill="#fff" />
              <path d="M30 92a30 30 0 0 1 60 0z" fill="#fff" />
              <circle cx="92" cy="30" r="9" fill="#f7a64a" />
            </svg>
            <span className="ei-lado-nome">Procuro emprego</span>
            <span className="ei-lado-lista">
              <span>As vagas do seu ofício chegam no seu celular</span>
              <span>A empresa te chama pelo telefone confirmado</span>
              <span>Sem currículo e sem custo</span>
            </span>
          </button>

          <button
            type="button"
            className="ei-lado"
            disabled={enviando}
            onClick={escolherEmpresa}
          >
            <svg viewBox="0 0 120 120" className="ei-lado-arte" aria-hidden="true">
              <circle cx="60" cy="60" r="52" fill="rgba(10,114,196,.10)" />
              <path d="M34 88V44a4 4 0 0 1 4-4h26a4 4 0 0 1 4 4v44" fill="#0a72c4" />
              <path d="M68 88V60h16a4 4 0 0 1 4 4v24" fill="#7fb9e6" />
              <rect x="44" y="52" width="8" height="8" rx="2" fill="#fff" />
              <rect x="44" y="68" width="8" height="8" rx="2" fill="#fff" />
              <circle cx="92" cy="32" r="8" fill="#f7a64a" />
            </svg>
            <span className="ei-lado-nome">Estou contratando</span>
            <span className="ei-lado-lista">
              <span>Publique a vaga e a cidade fica sabendo</span>
              <span>O app avisa quem faz aquele serviço</span>
              <span>Pessoa física ou empresa</span>
            </span>
          </button>
        </div>

        <p className="ei-apoio ei-margem" style={{ marginTop: 14 }}>
          Escolheu e era o outro? Dá para trocar de lado a qualquer hora, na
          sua Conta — e dá para ter os dois no mesmo número.
        </p>

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 14 }} role="alert">
            {erro}
          </p>
        )}
      </div>
    </div>
  );
}
