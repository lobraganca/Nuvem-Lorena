import { Suspense, lazy, useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
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
import { TourDetail } from "./pages/TourDetail";
import { Messages } from "./pages/Messages";
import { Conversation } from "./pages/Conversation";
import { Destination } from "./pages/Destination";
import { Bookings } from "./pages/Bookings";
import { Retrospective } from "./pages/Retrospective";
import { Welcome } from "./pages/Welcome";
import { ProfessionalDashboard } from "./pages/ProfessionalDashboard";
import { ProfessionalTours } from "./pages/ProfessionalTours";
import { ProfessionalBookings } from "./pages/ProfessionalBookings";
import { ProfessionalPayouts } from "./pages/ProfessionalPayouts";
import { ProfessionalReviews } from "./pages/ProfessionalReviews";
import { ProfessionalBusiness } from "./pages/ProfessionalBusiness";
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
import { Ads } from "./pages/Ads";
import { SignIn } from "./pages/SignIn";
import { FirstMemory } from "./pages/FirstMemory";
import { NotFound } from "./pages/NotFound";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { NotificationsBell } from "./components/NotificationsBell";
import { PhoneVerification } from "./components/PhoneVerification";
import { hasSmsServer } from "./lib/phoneVerification";
import { I18nProvider, useT } from "./i18n";

// Loaded on demand *and* only when the build enabled it, so a public build
// ships no administration code at all — there is nothing to find in the bundle
// and nothing to reach by guessing the address.
const Admin = __ADMIN_ENABLED__
  ? lazy(() => import("./pages/Admin").then((m) => ({ default: m.Admin })))
  : null;

function RootScreen() {
  const { user, updateUser } = useAvena();

  // The app opens on what it is for: choosing where to go. It used to open on
  // "where was your last trip?", which asked people to look backwards before
  // they had seen anything, and — worse — held the whole app behind the
  // answer, since the tab bar only appears once this is set. Recording a
  // memory is still there, in Viagens, where someone goes looking for it.
  useEffect(() => {
    if (!user.accountType) updateUser({ accountType: "turista" });
  }, [user.accountType, updateUser]);

  if (user.accountType === "profissional") return <ProfessionalDashboard />;
  return <Home />;
}

/**
 * Ao trocar de tela, o foco vai para o conteúdo.
 *
 * Num app de uma página só o navegador não recarrega nada, então o foco fica
 * onde estava — no link que foi tocado, ou no corpo da página. Para quem usa
 * leitor de tela isso significa que mudar de tela não anuncia nada: a pessoa
 * toca em "Reservar", a tela inteira troca, e a voz continua no mesmo lugar.
 * Para quem navega por teclado, a próxima tabulação recomeça do topo do site.
 *
 * `preventScroll` porque a rolagem já é tratada abaixo, e sem isso a página
 * daria um salto ao focar.
 */
function FocoNaTroca() {
  const { pathname } = useLocation();
  useEffect(() => {
    const alvo = document.getElementById("conteudo");
    alvo?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

function AppShell() {
  const { user } = useAvena();
  const { signedIn, needsPhone, setVerifiedPhone, postponePhone } = useAuth();
  const t = useT();

  // Nobody reaches the app without passing the door. Rendering the sign-in
  // screen in place of the whole shell — rather than redirecting — means there
  // is no address to type past it.
  if (!signedIn) return <SignIn />;

  // Same reasoning as the door: rendering the screen in place of the shell,
  // rather than redirecting, means there is no address that skips it.
  if (needsPhone) {
    return (
      <div className="signin-page">
        <div className="signin-card">
          <h1 className="signin-wordmark">avena</h1>
          <PhoneVerification
            onVerified={setVerifiedPhone}
            // Optional while there is no server to send the SMS. The day the
            // server exists this goes away and the number becomes required.
            onSkip={hasSmsServer() ? undefined : postponePhone}
          />
        </div>
      </div>
    );
  }

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
          {/* The tabs carry the destinations now; the bar keeps what they do
              not: the people you follow, and the download page. */}
          {chosen && !isProfissional && <Link to="/feed">{t("nav.people")}</Link>}
          <Link to="/app" className="topbar-app-link">
            {t("app.navLink")}
          </Link>
        </div>
        <div className="topbar-actions">
          {/* Help lives in the bar that is always on screen. It used to float
              over the bottom-right corner, where it landed on top of the
              cards and beside the tab bar. */}
          <HelpChat />
          <NotificationsBell />
          <LanguageSwitcher />
        </div>
      </nav>
      <FocoNaTroca />
      {/* tabIndex -1: o main recebe foco por código, mas não entra na ordem
          de tabulação de quem navega por teclado. */}
      <main className="app-content" id="conteudo" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<RootScreen />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/comecar" element={<FirstMemory />} />
          <Route path="/professional" element={<ProfessionalDashboard />} />
          <Route path="/professional/passeios" element={<ProfessionalTours />} />
          <Route path="/professional/reservas" element={<ProfessionalBookings />} />
          <Route path="/professional/extrato" element={<ProfessionalPayouts />} />
          <Route path="/professional/avaliacoes" element={<ProfessionalReviews />} />
          <Route path="/professional/empresa" element={<ProfessionalBusiness />} />
          <Route path="/experience/new" element={<AddExperience />} />
          <Route path="/experience/:id/editar" element={<AddExperience />} />
          <Route path="/experience/:id" element={<ExperienceDetail />} />
          <Route path="/person/:id" element={<PersonProfile />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/destination" element={<Destination />} />
          <Route path="/business" element={<BusinessLanding />} />
          <Route path="/business/new" element={<BusinessRegister />} />
          <Route path="/business/:id" element={<BusinessDetail />} />
          <Route path="/tour/:businessId/:tourId" element={<TourDetail />} />
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
          <Route path="/anuncios" element={<Ads />} />
          <Route path="/app" element={<GetApp />} />
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
        <Link to="/profile">{t("nav.profile")}</Link>
        <span className="muted">© {new Date().getFullYear()} Avena</span>
      </footer>
      <CookieBanner />
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
