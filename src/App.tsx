import { Suspense, lazy } from "react";
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
import { Retrospective } from "./pages/Retrospective";
import { Welcome } from "./pages/Welcome";
import { ProfessionalDashboard } from "./pages/ProfessionalDashboard";
import { Notifications } from "./pages/Notifications";
import { Terms, Privacy } from "./pages/Legal";
import { CookieBanner, openCookiePreferences } from "./components/CookieBanner";
import { HelpChat } from "./components/HelpChat";
import { OfflineBanner } from "./components/OfflineBanner";
import { BottomNav } from "./components/BottomNav";
import { StorageBanner } from "./components/StorageBanner";
import { Payment } from "./pages/Payment";
import { Support } from "./pages/Support";
import { MyData } from "./pages/MyData";
import { Feed } from "./pages/Feed";
import { Wishlist } from "./pages/Wishlist";
import { TravelerProfile } from "./pages/TravelerProfile";
import { NotFound } from "./pages/NotFound";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { NotificationsBell } from "./components/NotificationsBell";
import { I18nProvider, useT } from "./i18n";

// Loaded on demand *and* only when the build enabled it, so a public build
// ships no administration code at all — there is nothing to find in the bundle
// and nothing to reach by guessing the address.
const Admin = __ADMIN_ENABLED__
  ? lazy(() => import("./pages/Admin").then((m) => ({ default: m.Admin })))
  : null;

function RootScreen() {
  const { user } = useAvena();
  if (!user.accountType) return <Welcome />;
  if (user.accountType === "profissional") return <ProfessionalDashboard />;
  return <Home />;
}

function AppShell() {
  const { user } = useAvena();
  const t = useT();
  const isProfissional = user.accountType === "profissional";
  const chosen = Boolean(user.accountType);

  return (
    <div className="app-shell">
      <a href="#conteudo" className="skip-link">
        {t("nav.skipToContent")}
      </a>
      <OfflineBanner />
      <StorageBanner />
      <nav className="topbar" aria-label={t("nav.main")}>
        <Link to="/" className="brand">
          <img src={avenaLogo} alt={t("nav.home")} className="brand-logo" />
        </Link>
        <div className="topbar-links">
          {chosen && (
            <>
              {isProfissional && <Link to="/professional">{t("nav.dashboard")}</Link>}
              <Link to="/destination">{t("nav.destinations")}</Link>
              {!isProfissional && <Link to="/feed">{t("nav.feed")}</Link>}
              {!isProfissional && <Link to="/desejos">{t("nav.wishlist")}</Link>}
              {!isProfissional && <Link to="/business">{t("nav.forBusiness")}</Link>}
              <Link to="/messages">{t("nav.messages")}</Link>
              {!isProfissional && <Link to="/bookings">{t("nav.bookings")}</Link>}
              <Link to="/ajuda">{t("nav.help")}</Link>
              <Link to="/profile">{t("nav.profile")}</Link>
            </>
          )}
        </div>
        <div className="topbar-actions">
          <NotificationsBell />
          <LanguageSwitcher />
        </div>
      </nav>
      <main className="app-content" id="conteudo">
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
          <Route path="/retrospectiva" element={<Retrospective />} />
          <Route path="/pagamento/:id" element={<Payment />} />
          <Route path="/ajuda" element={<Support />} />
          <Route path="/ajuda/novo" element={<Support />} />
          <Route path="/meus-dados" element={<MyData />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/desejos" element={<Wishlist />} />
          <Route path="/traveler/:id" element={<TravelerProfile />} />
          {Admin && (
            <Route
              path="/admin"
              element={
                <Suspense fallback={<div className="page">…</div>}>
                  <Admin />
                </Suspense>
              }
            />
          )}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="app-footer">
        <Link to="/termos">{t("footer.terms")}</Link>
        <Link to="/privacidade">{t("footer.privacy")}</Link>
        <Link to="/ajuda">{t("footer.help")}</Link>
        <Link to="/meus-dados">{t("footer.myData")}</Link>
        <button type="button" className="footer-link" onClick={openCookiePreferences}>
          {t("footer.cookies")}
        </button>
        <span className="muted">© {new Date().getFullYear()} Avena</span>
      </footer>
      <CookieBanner />
      <HelpChat />
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AvenaProvider>
        <AppShell />
      </AvenaProvider>
    </I18nProvider>
  );
}
