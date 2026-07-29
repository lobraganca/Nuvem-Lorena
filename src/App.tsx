import { Link, Route, Routes } from "react-router-dom";
import { AvenaProvider, useAvena } from "./store/AvenaContext";
import avenaLogo from "./assets/avena-logo-wordmark.png";
import { Home } from "./pages/Home";
import { AddExperience } from "./pages/AddExperience";
import { ExperienceDetail } from "./pages/ExperienceDetail";
import { PersonProfile } from "./pages/PersonProfile";
import { Profile } from "./pages/Profile";
import { BusinessLanding } from "./pages/BusinessLanding";
import { BusinessRegister } from "./pages/BusinessRegister";
import { BusinessDetail } from "./pages/BusinessDetail";
import { Messages } from "./pages/Messages";
import { Conversation } from "./pages/Conversation";
import { Destination } from "./pages/Destination";
import { Bookings } from "./pages/Bookings";
import { Admin } from "./pages/Admin";
import { Welcome } from "./pages/Welcome";
import { ProfessionalDashboard } from "./pages/ProfessionalDashboard";
import { Notifications } from "./pages/Notifications";
import { Terms, Privacy } from "./pages/Legal";
import { CookieBanner, openCookiePreferences } from "./components/CookieBanner";
import { HelpChat } from "./components/HelpChat";
import { useNotifications } from "./hooks/useNotifications";

function RootScreen() {
  const { user } = useAvena();
  if (!user.accountType) return <Welcome />;
  if (user.accountType === "profissional") return <ProfessionalDashboard />;
  return <Home />;
}

function NotificationsLink() {
  const notifications = useNotifications();

  return (
    <Link to="/notifications" className="nav-notifications">
      Notificações
      {notifications.length > 0 && (
        <span className="nav-badge">{notifications.length}</span>
      )}
    </Link>
  );
}

function AppShell() {
  const { user } = useAvena();
  const isProfissional = user.accountType === "profissional";
  const chosen = Boolean(user.accountType);

  return (
    <div className="app-shell">
      <nav className="topbar">
        <Link to="/" className="brand">
          <img src={avenaLogo} alt="Avena" className="brand-logo" />
        </Link>
        <div className="topbar-links">
          {chosen && (
            <>
              {isProfissional && <Link to="/professional">Painel</Link>}
              <Link to="/destination">Destinos</Link>
              {!isProfissional && <Link to="/business">Para empresas</Link>}
              <Link to="/messages">Mensagens</Link>
              {!isProfissional && <Link to="/bookings">Reservas</Link>}
              {!isProfissional && <NotificationsLink />}
              <Link to="/profile">Perfil</Link>
            </>
          )}
        </div>
      </nav>
      <main className="app-content">
        <Routes>
          <Route path="/" element={<RootScreen />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/professional" element={<ProfessionalDashboard />} />
          <Route path="/experience/new" element={<AddExperience />} />
          <Route path="/experience/:id/editar" element={<AddExperience />} />
          <Route path="/experience/:id" element={<ExperienceDetail />} />
          <Route path="/person/:id" element={<PersonProfile />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/destination" element={<Destination />} />
          <Route path="/business" element={<BusinessLanding />} />
          <Route path="/business/new" element={<BusinessRegister />} />
          <Route path="/business/:id" element={<BusinessDetail />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:id" element={<Conversation />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/termos" element={<Terms />} />
          <Route path="/privacidade" element={<Privacy />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
      <footer className="app-footer">
        <Link to="/termos">Termos de Uso</Link>
        <Link to="/privacidade">Política de Privacidade</Link>
        <button type="button" className="footer-link" onClick={openCookiePreferences}>
          Preferências de cookies
        </button>
        <span className="muted">© {new Date().getFullYear()} Avena</span>
      </footer>
      <CookieBanner />
      <HelpChat />
    </div>
  );
}

export default function App() {
  return (
    <AvenaProvider>
      <AppShell />
    </AvenaProvider>
  );
}
