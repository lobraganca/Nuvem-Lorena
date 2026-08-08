import { useState } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { Logo } from "./components/Logo";
import { AppShell } from "./components/AppShell";
import { BottomSheet } from "./components/BottomSheet";
import { HomePage } from "./pages/HomePage";
import { ProfessionalPage } from "./pages/ProfessionalPage";
import { LoginPage } from "./pages/LoginPage";
import { PainelPage } from "./pages/PainelPage";
import { AdminPage } from "./pages/AdminPage";
import { TermosPage } from "./pages/TermosPage";
import { ComoFuncionaPage } from "./pages/ComoFuncionaPage";
import { FavoritosPage } from "./pages/FavoritosPage";
import { PerfilPage } from "./pages/PerfilPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { useAuth } from "./lib/useAuth";
import { sendSuggestion } from "./lib/suggestions";

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
      setError(err instanceof Error ? err.message : "Não foi possível enviar a sugestão.");
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
          <button className="btn btn-gold btn-block" onClick={handleSend} disabled={sending}>
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}

function Footer() {
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  return (
    <footer className="footer">
      <div className="container">
        <Logo />
        <p style={{ marginTop: 10 }}>
          Busca Itabirito — marketplace de profissionais por cidade. Selo de verificação por R$ 10,90/mês,
          pago via Mercado Pago.
        </p>
        <p style={{ marginTop: 6 }}>
          <Link to="/termos">Termos de Uso</Link> · <Link to="/como-funciona">Como funciona</Link> ·{" "}
          <button
            type="button"
            onClick={() => setSuggestionOpen(true)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              font: "inherit",
              color: "var(--color-accent-teal)",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Enviar sugestão
          </button>
        </p>
      </div>
      {suggestionOpen && <SuggestionSheet onClose={() => setSuggestionOpen(false)} />}
    </footer>
  );
}

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/profissional/:id" element={<ProfessionalPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/painel" element={<PainelPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/termos" element={<TermosPage />} />
        <Route path="/como-funciona" element={<ComoFuncionaPage />} />
        <Route path="/favoritos" element={<FavoritosPage />} />
        <Route path="/perfil" element={<PerfilPage />} />
        <Route path="/analytics/:id" element={<AnalyticsPage />} />
      </Routes>
      <Footer />
    </AppShell>
  );
}
