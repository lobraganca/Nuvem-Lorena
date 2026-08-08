import { Routes, Route, Link } from "react-router-dom";
import { Logo } from "./components/Logo";
import { HomePage } from "./pages/HomePage";
import { ProfessionalPage } from "./pages/ProfessionalPage";
import { LoginPage } from "./pages/LoginPage";
import { PainelPage } from "./pages/PainelPage";
import { TermosPage } from "./pages/TermosPage";
import { useAuth } from "./lib/useAuth";
import { signOut } from "./lib/auth";

function Header() {
  const { user } = useAuth();
  return (
    <header className="container header">
      <Logo />
      <nav className="nav">
        <Link to="/">Buscar</Link>
        {user ? (
          <>
            <Link to="/painel">Painel</Link>
            <button className="btn btn-outline" onClick={() => signOut()}>
              Sair
            </button>
          </>
        ) : (
          <Link className="btn btn-gold" to="/login">
            Entrar
          </Link>
        )}
      </nav>
    </header>
  );
}

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
          <Link to="/termos">Termos de Uso</Link>
        </p>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/profissional/:id" element={<ProfessionalPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/painel" element={<PainelPage />} />
        <Route path="/termos" element={<TermosPage />} />
      </Routes>
      <Footer />
    </>
  );
}
