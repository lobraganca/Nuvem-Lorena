import { useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { Logo } from "./components/Logo";
import { BotaoSuporte } from "./components/BotaoSuporte";
import { AppShell } from "./components/AppShell";
import { SplashScreen } from "./components/SplashScreen";
import { BottomSheet } from "./components/BottomSheet";
import { HomePage } from "./pages/HomePage";
import { BoasVindasPage } from "./pages/BoasVindasPage";
import { ProfessionalPage } from "./pages/ProfessionalPage";
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
const PainelPage = lazy(importarPagina(() => import("./pages/PainelPage").then((m) => ({ default: m.PainelPage }))));
const CadastroPage = lazy(importarPagina(() => import("./pages/CadastroPage").then((m) => ({ default: m.CadastroPage }))));
const AdminPage = lazy(importarPagina(() => import("./pages/AdminPage").then((m) => ({ default: m.AdminPage }))));
const TermosPage = lazy(importarPagina(() => import("./pages/TermosPage").then((m) => ({ default: m.TermosPage }))));
const PrivacidadePage = lazy(importarPagina(() => import("./pages/PrivacidadePage").then((m) => ({ default: m.PrivacidadePage }))));
const DiagnosticoPage = lazy(importarPagina(() => import("./pages/DiagnosticoPage").then((m) => ({ default: m.DiagnosticoPage }))));
const ExcluirContaPage = lazy(importarPagina(() => import("./pages/ExcluirContaPage").then((m) => ({ default: m.ExcluirContaPage }))));
const ConfiguracaoPage = lazy(importarPagina(() => import("./pages/ConfiguracaoPage").then((m) => ({ default: m.ConfiguracaoPage }))));
const ComoFuncionaPage = lazy(importarPagina(() => import("./pages/ComoFuncionaPage").then((m) => ({ default: m.ComoFuncionaPage }))));
const FavoritosPage = lazy(importarPagina(() => import("./pages/FavoritosPage").then((m) => ({ default: m.FavoritosPage }))));
const PerfilPage = lazy(importarPagina(() => import("./pages/PerfilPage").then((m) => ({ default: m.PerfilPage }))));
const AssinaturaPage = lazy(importarPagina(() => import("./pages/AssinaturaPage").then((m) => ({ default: m.AssinaturaPage }))));
const AnalyticsPage = lazy(importarPagina(() => import("./pages/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage }))));
const CategoriasPage = lazy(importarPagina(() => import("./pages/CategoriasPage").then((m) => ({ default: m.CategoriasPage }))));
const AnunciosPage = lazy(importarPagina(() => import("./pages/AnunciosPage").then((m) => ({ default: m.AnunciosPage }))));
const PublicidadePage = lazy(importarPagina(() => import("./pages/PublicidadePage").then((m) => ({ default: m.PublicidadePage }))));


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

function Footer() {
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const { pathname } = useLocation();

  // A tela de início já se fecha com o próprio rodapé de texto legal — o
  // rodapé do app ali só repetiria os mesmos links.
  if (pathname === "/inicio") return null;

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
          <nav className="rodape-grupo" aria-label="O procurô">
            <h2 className="rodape-grupo-titulo">O procurô</h2>
            <Link to="/como-funciona">Como funciona</Link>
            <Link to="/publicidade">Anuncie aqui</Link>
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
  return (
    <>
      <SplashScreen />
      <AppShell>
      <RetomarDestinoLogin />
      <AvisoErroLogin />
      {/* Enquanto a tela pedida chega, o app não pode piscar em branco: a
          barra de baixo e o cabeçalho continuam, e só o miolo espera. */}
      <Suspense fallback={<div className="container" style={{ paddingTop: 48, textAlign: "center" }}>
        <span className="muted">Carregando…</span>
      </div>}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/inicio" element={<BoasVindasPage />} />
        <Route path="/profissional/:id" element={<ProfessionalPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/painel" element={<PainelPage />} />
        {/* Preencher e editar o cadastro ganharam endereço próprio. Dentro
            do painel, o formulário era uma segunda tela empilhada na
            primeira: a pessoa apertava "Editar" e uma rolagem a levava para
            baixo dos cartões, sem título que mudasse nem botão de voltar —
            no celular, dava para não perceber que a tela tinha trocado de
            assunto. Com endereço, editar é ir e voltar, e o botão do
            aparelho volta a servir para sair. */}
        <Route path="/painel/novo" element={<CadastroPage />} />
        <Route path="/painel/editar/:id" element={<CadastroPage />} />
        <Route path="/admin" element={<AdminPage />} />
        {/* Cada seção do painel administrativo tem endereço próprio: dá
            para ir direto a ela, voltar, e guardar o link. Endereço
            desconhecido cai no menu, não numa tela em branco. */}
        <Route path="/admin/:secao" element={<AdminPage />} />
        <Route path="/termos" element={<TermosPage />} />
        <Route path="/privacidade" element={<PrivacidadePage />} />
        {/* Sem link em lugar nenhum: existe para depurar login a distancia. */}
        <Route path="/diagnostico" element={<DiagnosticoPage />} />
        {/* Endereco publico exigido pela Google Play: exclusao de conta
            explicada sem precisar estar logado. */}
        {/* Todas as categorias com gente cadastrada. A grade da busca mostra
            oito; esta tela é a saída de quem procura um ofício que não está
            entre os mais numerosos da cidade. */}
        <Route path="/categorias" element={<CategoriasPage />} />
        <Route path="/anuncios" element={<AnunciosPage />} />
        {/* Página de venda de publicidade: medidas da arte, regras e o
            pedido de contato. É para onde vão os espaços "Apareça aqui". */}
        <Route path="/publicidade" element={<PublicidadePage />} />
        <Route path="/excluir-conta" element={<ExcluirContaPage />} />
        <Route path="/configuracao" element={<ConfiguracaoPage />} />
        <Route path="/como-funciona" element={<ComoFuncionaPage />} />
        <Route path="/favoritos" element={<FavoritosPage />} />
        <Route path="/perfil" element={<PerfilPage />} />
        <Route path="/assinatura" element={<AssinaturaPage />} />
        <Route path="/analytics/:id" element={<AnalyticsPage />} />
      </Routes>
      </Suspense>
      <Footer />
      </AppShell>
      <AvisoDeDados />
    </>
  );
}
