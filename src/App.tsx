import { Link, Route, Routes } from "react-router-dom";
import { AvenaProvider } from "./store/AvenaContext";
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
import { Revenue } from "./pages/Revenue";

export default function App() {
  return (
    <AvenaProvider>
      <div className="app-shell">
        <nav className="topbar">
          <Link to="/" className="brand">
            Avena
          </Link>
          <Link to="/destination">Destinos</Link>
          <Link to="/business">Para empresas</Link>
          <Link to="/messages">Mensagens</Link>
          <Link to="/bookings">Reservas</Link>
          <Link to="/profile">Perfil</Link>
          <Link to="/revenue" className="nav-admin-link" title="Painel do dono da plataforma">
            📊 Receita
          </Link>
        </nav>
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/experience/new" element={<AddExperience />} />
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
            <Route path="/revenue" element={<Revenue />} />
          </Routes>
        </main>
      </div>
    </AvenaProvider>
  );
}
