import { Routes, Route, Link } from "react-router-dom";
import { Logo } from "./components/Logo";
import { AppShell } from "./components/AppShell";
import { HomePage } from "./pages/HomePage";
import { ProfessionalPage } from "./pages/ProfessionalPage";
import { LoginPage } from "./pages/LoginPage";
import { PainelPage } from "./pages/PainelPage";
import { AdminPage } from "./pages/AdminPage";
import { TermosPage } from "./pages/TermosPage";
import { ComoFuncionaPage } from "./pages/ComoFuncionaPage";
import { FavoritosPage } from "./pages/FavoritosPage";
import { PerfilPage } from "./pages/PerfilPage";

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <Logo />
        <p style={{ marginTop: 10 }}>
          Busca Itabirito — marketplace de profissionais por cidade. Selo de verificação por R$ 10,90/mês,
          pago via Mercado Pago.
        </p>
        <p style={{ marginTop: 6 }}>
          <Link to="/termos">Termos de Uso</Link> · <Link to="/como-funciona">Como funciona</Link>
        </p>
      </div>
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
      </Routes>
      <Footer />
    </AppShell>
  );
}
