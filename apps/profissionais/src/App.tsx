import { useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { Logo } from "./components/Logo";
import { BotaoSuporte } from "./components/BotaoSuporte";
import { AppShell } from "./components/AppShell";
import { BoasVindas, jaViuAsBoasVindas } from "./components/ei/BoasVindas";
import { SplashScreen } from "./components/SplashScreen";
import { BottomSheet } from "./components/BottomSheet";
import { Suspense, lazy } from "react";
import { useAuth } from "./lib/useAuth";
import { sendSuggestion } from "./lib/suggestions";
import { AvisoDeDados } from "./components/AvisoDeDados";
import { RetomarDestinoLogin } from "./components/RetomarDestinoLogin";
import { AvisoErroLogin } from "./components/AvisoErroLogin";
import { CONTATO_EMAIL } from "./config";
import { importarPagina } from "./lib/importarPagina";
import { mensagemDeErro } from "./lib/erros";

/**
 * Telas carregadas sob demanda.
 *
 * Tudo vinha num arquivo só: quem abria a busca baixava junto o painel, a
 * administração, os termos e a tela de números — telas que a maioria das
 * pessoas nunca abre. Em 4G fraco isso é a diferença entre abrir e desistir.
 *
 * Ficam de fora a busca, o anúncio e a apresentação: são a porta de entrada,
 * e adiar o que já vai ser pedido só troca um tempo de espera por outro.
 *
 * Cada `import()` passa por `importarPagina`: como o nome de cada arquivo
 * muda a cada publicação, um app instalado com a versão antiga ainda em
 * segundo plano pode pedir um arquivo que já não existe mais no servidor —
 * e cair na tela de "algo quebrou" em vez de simplesmente atualizar sozinho
 * (ver o comentário em lib/importarPagina.ts).
 */
const LoginPage = lazy(importarPagina(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage }))));
const AdminPage = lazy(importarPagina(() => import("./pages/AdminPage").then((m) => ({ default: m.AdminPage }))));
const TermosPage = lazy(importarPagina(() => import("./pages/TermosPage").then((m) => ({ default: m.TermosPage }))));
const PrivacidadePage = lazy(importarPagina(() => import("./pages/PrivacidadePage").then((m) => ({ default: m.PrivacidadePage }))));
const DiagnosticoPage = lazy(importarPagina(() => import("./pages/DiagnosticoPage").then((m) => ({ default: m.DiagnosticoPage }))));
const ExcluirContaPage = lazy(importarPagina(() => import("./pages/ExcluirContaPage").then((m) => ({ default: m.ExcluirContaPage }))));
const ConfiguracaoPage = lazy(importarPagina(() => import("./pages/ConfiguracaoPage").then((m) => ({ default: m.ConfiguracaoPage }))));
const PerfilPage = lazy(importarPagina(() => import("./pages/PerfilPage").then((m) => ({ default: m.PerfilPage }))));

// MVP Local Hiring
const OnboardingTipoPage = lazy(importarPagina(() => import("./pages/OnboardingTipoPage").then((m) => ({ default: m.OnboardingTipoPage }))));
const CadastroEmpresaPage = lazy(importarPagina(() => import("./pages/CadastroEmpresaPage").then((m) => ({ default: m.CadastroEmpresaPage }))));
const PainelEmpresaPage = lazy(importarPagina(() => import("./pages/PainelEmpresaPage").then((m) => ({ default: m.PainelEmpresaPage }))));
const CriarVagaPage = lazy(importarPagina(() => import("./pages/CriarVagaPage").then((m) => ({ default: m.CriarVagaPage }))));
const EntradaPage = lazy(importarPagina(() => import("./pages/ei/EntradaPage").then((m) => ({ default: m.EntradaPage }))));
const MeuPerfilPage = lazy(importarPagina(() => import("./pages/ei/MeuPerfilPage").then((m) => ({ default: m.MeuPerfilPage }))));
const ProfissionaisPage = lazy(importarPagina(() => import("./pages/ProfissionaisPage").then((m) => ({ default: m.ProfissionaisPage }))));
const VagasParaMimPage = lazy(importarPagina(() => import("./pages/VagasParaMimPage").then((m) => ({ default: m.VagasParaMimPage }))));
const BancoDeVagasPage = lazy(importarPagina(() => import("./pages/ei/BancoDeVagasPage").then((m) => ({ default: m.BancoDeVagasPage }))));
const PlanosEmpresaPage = lazy(importarPagina(() => import("./pages/PlanosEmpresaPage").then((m) => ({ default: m.PlanosEmpresaPage }))));
const DetalheVagaPage = lazy(importarPagina(() => import("./pages/DetalheVagaPage").then((m) => ({ default: m.DetalheVagaPage }))));
const PerfilPublicoPage = lazy(importarPagina(() => import("./pages/PerfilPublicoPage").then((m) => ({ default: m.PerfilPublicoPage }))));
/* A vaga vista por QUEM PROCURA. É outra tela que a `/vaga/:id`, que é o
   painel de quem anunciou (ondas, alcance, lista de interessados). Antes só
   existia a do anunciante — a pessoa decidia se queria a vaga sem nunca ter
   lido a vaga inteira. */
const VagaAbertaPage = lazy(importarPagina(() => import("./pages/ei/VagaAbertaPage").then((m) => ({ default: m.VagaAbertaPage }))));
/* O histórico dos disparos que chegaram para esta pessoa. Diferente de
   "Vagas": lá só o que está aberto, para responder; aqui tudo o que chegou,
   inclusive as vagas já encerradas — senão o aviso some e parece engano. */
const AvisosPage = lazy(importarPagina(() => import("./pages/ei/AvisosPage").then((m) => ({ default: m.AvisosPage }))));


/**
 * BottomSheet acessível de qualquer lugar do app (link no rodapé) para
 * enviar sugestões gerais sobre a plataforma — não exige login; quando o
 * usuário está logado, o user_id é capturado automaticamente.
 */
function SuggestionSheet({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    if (!message.trim()) {
      setError("Escreva sua sugestão antes de enviar.");
      return;
    }
    setSending(true);
    setError("");
    try {
      await sendSuggestion(message.trim(), user?.id ?? null);
      setSent(true);
    } catch (err) {
      setError(mensagemDeErro(err, "Não foi possível enviar a sugestão."));
    } finally {
      setSending(false);
    }
  }

  return (
    <BottomSheet
      title="Enviar sugestão"
      subtitle="Ideias, melhorias, categorias que faltam — qualquer feedback sobre o app é bem-vindo."
      onClose={onClose}
    >
      {sent ? (
        <p className="card">Sugestão enviada. Obrigado pela contribuição!</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <textarea
            placeholder="Escreva sua sugestão…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
          />
          {error && <p style={{ color: "var(--color-danger)", margin: 0 }}>{error}</p>}
          <button className="btn btn-primary btn-block" onClick={handleSend} disabled={sending}>
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}

/* As telas que são APP, e não site.
   ──────────────────────────────────
   Elas têm a barra de baixo e terminam nela, como nos apps que a dona
   mandou de referência — que não têm rodapé nenhum. O rodapé de links
   embaixo de um cartão de vaga era o que sobrava mais visível do procurô:
   três colunas de letra miúda em versalete, links azuis e um botão verde,
   tudo com o desenho do outro app.

   Ele não sumiu do app: continua nas telas longas (documentos, conta),
   onde é rodapé de página de verdade. E nada se perdeu — Termos,
   Privacidade, sugestão e suporte estão em Conta, que é um dos três itens
   da barra. */
const TELAS_DE_APP = [
  "/",
  "/inicio",
  /* `/login` faltava, e o efeito era o mais visível do app inteiro: a tela
     de entrar — a primeira que qualquer pessoa nova lê — terminava com o
     rodapé de SITE embaixo. Três colunas de links, o e-mail de contato e
     um botão verde de WhatsApp que era, de longe, a coisa mais colorida da
     tela: mais chamativo que o próprio botão de entrar, logo acima dele. */
  "/login",
  /* As duas telas do caminho de criar conta, pelo mesmo motivo do
     `/login`: são passo de app, e traziam o rodapé de site — com "Publicar
     vaga" e "Enviar sugestão" — logo abaixo da pergunta de que lado a
     pessoa está. */
  "/onboarding-tipo",
  "/cadastro-empresa",
  "/vagas-para-mim",
  /* O banco de vagas. Sem esta linha ele terminava com o rodapé de SITE
     embaixo da barra do app — três colunas de links e um botão verde de
     WhatsApp, o pedaço mais visível que sobrou do procurô. É o mesmo
     esquecimento que já aconteceu com `/login` e com `/vaga-aberta`. */
  "/vagas",
  "/meu-perfil",
  "/painel",
  "/painel-empresa",
  "/criar-vaga",
  "/vaga",
  /* `/vaga-aberta` precisa estar escrito à parte: a comparação é por
     caminho exato ou com barra depois, então "/vaga" casa com "/vaga/123" e
     NÃO casa com "/vaga-aberta/123". Sem esta linha, a tela da vaga de quem
     procura trabalho terminava com o rodapé de links do site embaixo da
     barra do app — o pedaço mais visível que sobrou do procurô. */
  "/vaga-aberta",
  "/avisos",
  "/planos-empresa",
  "/profissionais",
  "/profissional",
  "/perfil",
];

function Footer() {
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const { pathname } = useLocation();

  if (TELAS_DE_APP.some((r) => pathname === r || pathname.startsWith(r + "/"))) return null;

  return (
    <footer className="footer">
      <div className="container">
        <Logo />

        {/* Dois grupos com título, no lugar de cinco links soltos.

            Estavam todos na mesma fileira, do mesmo tamanho e sem ordem:
            "Termos de Uso", "Privacidade", "Como funciona", "Anuncie aqui"
            e "Enviar sugestão", como se fossem cinco coisas do mesmo tipo.
            Não são. Duas são documento que quase ninguém abre por vontade
            própria; três são caminhos que a pessoa pode querer agora. Sem
            essa separação, o rodapé virava uma lista para procurar dentro,
            e foi assim que a dona o descreveu: confuso.

            Depois dos links vinham três parágrafos soltos — aviso
            jurídico, versão, e-mail —, cada um com um tamanho de letra
            diferente, dois deles escritos direto no atributo `style`. Agora
            são duas linhas quietas, do mesmo tamanho, na ordem de quem
            precisa: quem quer falar com alguém primeiro, o resto depois. */}
        <div className="rodape-grupos">
          <nav className="rodape-grupo" aria-label="O Ei Itabirito">
            <h2 className="rodape-grupo-titulo">O Ei Itabirito</h2>
            {/* "Anuncie aqui" saiu: levava à venda de espaço de banner, que é
                produto do procurô. Quem contrata neste app publica VAGA, e o
                caminho para isso é o plano — que fica no painel da empresa,
                onde ela já está, e não escondido num link de rodapé. */}
            <Link to="/planos-empresa">Publicar vaga</Link>
            <button type="button" onClick={() => setSuggestionOpen(true)}>
              Enviar sugestão
            </button>
          </nav>

          <nav className="rodape-grupo" aria-label="Documentos">
            <h2 className="rodape-grupo-titulo">Documentos</h2>
            <Link to="/termos">Termos de Uso</Link>
            <Link to="/privacidade">Privacidade</Link>
          </nav>

          {/* Contato: o e-mail escrito, e o WhatsApp só no botão.

              O número também aparecia aqui, por extenso. Era repetição: o
              botão logo abaixo abre a mesma conversa, e ninguém digita um
              telefone à mão tendo o toque ao lado. O e-mail fica porque
              não tem botão — e porque pedido sobre dados pessoais costuma
              vir por escrito, com registro. */}
          <nav className="rodape-grupo" aria-label="Contato">
            <h2 className="rodape-grupo-titulo">Contato</h2>
            <a href={`mailto:${CONTATO_EMAIL}`}>{CONTATO_EMAIL}</a>
          </nav>
        </div>

        <BotaoSuporte />

      </div>
      {suggestionOpen && <SuggestionSheet onClose={() => setSuggestionOpen(false)} />}
    </footer>
  );
}

export default function App() {
  /* ── As boas-vindas do primeiro acesso ────────────────────────────────
     Ficam ANTES de tudo, cobrindo a tela, e não como uma rota: rota teria
     endereço, e endereço vai parar em link compartilhado, em favorito e no
     botão de voltar. Isto não é uma página do app — é a porta, e ela abre
     uma vez só.

     O estado é lido no primeiro render (função dentro do `useState`, não
     efeito depois): com efeito, a tela do app apareceria por um instante
     antes de a porta cobrir, e o primeiro acesso começaria com um susto. */
  const [mostrarBoasVindas, setMostrarBoasVindas] = useState(() => !jaViuAsBoasVindas());

  return (
    <>
      <SplashScreen />
      {mostrarBoasVindas && <BoasVindas aoTerminar={() => setMostrarBoasVindas(false)} />}
      <AppShell>
      <RetomarDestinoLogin />
      <AvisoErroLogin />
      {/* Enquanto a tela pedida chega, o app não pode piscar em branco: a
          barra de baixo e o cabeçalho continuam, e só o miolo espera. */}
      <Suspense fallback={<div className="container" style={{ paddingTop: 48, textAlign: "center" }}>
        <span className="muted">Carregando…</span>
      </div>}>
      <Routes>
        {/* ── O Ei Itabirito ───────────────────────────────────────────
            As telas do procurô saíram daqui inteiras: a busca de serviço,
            o perfil público com avaliações, os anúncios, a venda de
            banner, as categorias, os favoritos, as assinaturas de selo e
            destaque, e os relatórios. Eram o produto daquele app.

            Ficou o que é infraestrutura (entrar, conta, documentos,
            administração) e o que é o Ei. */}
        <Route path="/" element={<EntradaPage />} />
        {/* `/inicio` era a tela das duas portas do procurô. Continua
            existindo porque a marca do cabeçalho aponta para ela e há
            links antigos por aí — leva à entrada nova. */}
        <Route path="/inicio" element={<EntradaPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Quem procura trabalho */}
        <Route path="/vagas-para-mim" element={<VagasParaMimPage />} />
        {/* O banco de vagas: tudo que está no ar, para quem quiser procurar
            sozinha — e não só o que a onda escolheu mandar. Ver a
            BancoDeVagasPage. */}
        <Route path="/vagas" element={<BancoDeVagasPage />} />
        <Route path="/meu-perfil" element={<MeuPerfilPage />} />
        {/* `/painel` era o painel do profissional no procurô, com
            assinaturas, destaque e pedidos de contato. O que resta dele
            neste app é o perfil — e é para lá que ele aponta, para não
            quebrar a barra de baixo nem o que já estava aberto no celular
            de alguém. */}
        <Route path="/painel" element={<MeuPerfilPage />} />

        {/* Quem contrata */}
        <Route path="/onboarding-tipo" element={<OnboardingTipoPage />} />
        <Route path="/cadastro-empresa" element={<CadastroEmpresaPage />} />
        <Route path="/painel/editar-empresa" element={<CadastroEmpresaPage />} />
        <Route path="/painel-empresa" element={<PainelEmpresaPage />} />
        <Route path="/criar-vaga" element={<CriarVagaPage />} />
        <Route path="/vaga/:id" element={<DetalheVagaPage />} />
        <Route path="/planos-empresa" element={<PlanosEmpresaPage />} />
        <Route path="/profissionais" element={<ProfissionaisPage />} />
        {/* O perfil de uma pessoa, visto por quem contrata. É a metade
            gratuita da oferta da empresa — ver e falar um a um — e não
            existia: a lista não levava a lugar nenhum. */}
        <Route path="/profissional/:id" element={<PerfilPublicoPage />} />
        <Route path="/vaga-aberta/:id" element={<VagaAbertaPage />} />
        <Route path="/avisos" element={<AvisosPage />} />

        {/* Conta e documentos */}
        <Route path="/perfil" element={<PerfilPage />} />
        <Route path="/configuracao" element={<ConfiguracaoPage />} />
        <Route path="/termos" element={<TermosPage />} />
        <Route path="/privacidade" element={<PrivacidadePage />} />
        <Route path="/excluir-conta" element={<ExcluirContaPage />} />
        {/* Sem link em lugar nenhum: existe para depurar login a distância. */}
        <Route path="/diagnostico" element={<DiagnosticoPage />} />

        {/* Administração */}
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/:secao" element={<AdminPage />} />
      </Routes>
      </Suspense>
      <Footer />
      </AppShell>
      <AvisoDeDados />
    </>
  );
}
