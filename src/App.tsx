import { Suspense, lazy } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { AvenaProvider, useAvena } from "./store/AvenaContext";
import { AuthProvider, useAuth } from "./store/AuthContext";
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
import { CookieBanner } from "./components/CookieBanner";
import { HelpChat } from "./components/HelpChat";
import { OfflineBanner } from "./components/OfflineBanner";
import { BottomNav } from "./components/BottomNav";
import { StorageBanner } from "./components/StorageBanner";
import { GuestBanner } from "./components/GuestBanner";
import { Payment } from "./pages/Payment";
import { Support } from "./pages/Support";
import { MyData } from "./pages/MyData";
import { Feed } from "./pages/Feed";
import { Wishlist } from "./pages/Wishlist";
import { TravelerProfile } from "./pages/TravelerProfile";
import { GetApp } from "./pages/GetApp";
import { SignIn } from "./pages/SignIn";
import { FirstMemory } from "./pages/FirstMemory";
import { Settings } from "./pages/Settings";
import { NotFound } from "./pages/NotFound";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { NotificationsBell } from "./components/NotificationsBell";
import { MessagesBell } from "./components/MessagesBell";
import { I18nProvider, useT } from "./i18n";

// Loaded on demand *and* only when the build enabled it, so a public build
// ships no administration code at all — there is nothing to find in the bundle
// and nothing to reach by guessing the address.
const Admin = __ADMIN_ENABLED__
  ? lazy(() => import("./pages/Admin").then((m) => ({ default: m.Admin })))
  : null;

function RootScreen() {
  const { user } = useAvena();
  // Nobody is asked to declare what they are before seeing what the app does:
  // the first screen asks one question and puts a memory on the map.
  if (!user.accountType) return <FirstMemory />;
  if (user.accountType === "profissional") return <ProfessionalDashboard />;
  return <Home />;
}

function AppShell() {
  const { user } = useAvena();
  const { signedIn } = useAuth();
  const t = useT();

  // Nobody reaches the app without passing the door. Rendering the sign-in
  // screen in place of the whole shell — rather than redirecting — means there
  // is no address to type past it.
  if (!signedIn) return <SignIn />;
  const isProfissional = user.accountType === "profissional";
  const chosen = Boolean(user.accountType);

  return (
    <div className="app-shell">
      <a href="#conteudo" className="skip-link">
        {t("nav.skipToContent")}
      </a>
      <OfflineBanner />
      <StorageBanner />
      <GuestBanner />
      <nav className="topbar" aria-label={t("nav.main")}>
        <Link to="/" className="brand">
          <img src={avenaLogo} alt={t("nav.home")} className="brand-logo" />
        </Link>
        <div className="topbar-links">
          {/* Three, and none of them a tab: the two lists a traveller returns
              to, and the download page. Everything else lives in Ajustes. */}
          {chosen && !isProfissional && (
            <>
              <Link to="/bookings">{t("nav.bookings")}</Link>
              <Link to="/desejos">{t("nav.wishlist")}</Link>
            </>
          )}
          <Link to="/app" className="topbar-app-link">
            {t("app.navLink")}
          </Link>
        </div>
        <div className="topbar-actions">
          {chosen && <MessagesBell />}
          <NotificationsBell />
          <LanguageSwitcher />
        </div>
      </nav>
      <main className="app-content" id="conteudo">
        <Routes>
          <Route path="/" element={<RootScreen />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/comecar" element={<FirstMemory />} />
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
          <Route path="/app" element={<GetApp />} />
          <Route path="/ajustes" element={<Settings />} />
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
        <Link to="/ajustes">{t("settings.title")}</Link>
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
      <AuthProvider>
        <AvenaProvider>
          <AppShell />
        </AvenaProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
