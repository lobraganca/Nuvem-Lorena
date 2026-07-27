import { Link, Route, Routes } from "react-router-dom";
import { AvenaProvider } from "./store/AvenaContext";
import { Home } from "./pages/Home";
import { AddExperience } from "./pages/AddExperience";
import { ExperienceDetail } from "./pages/ExperienceDetail";
import { PersonProfile } from "./pages/PersonProfile";
import { Profile } from "./pages/Profile";

export default function App() {
  return (
    <AvenaProvider>
      <div className="app-shell">
        <nav className="topbar">
          <Link to="/" className="brand">
            Avena
          </Link>
          <Link to="/profile">Perfil</Link>
        </nav>
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/experience/new" element={<AddExperience />} />
            <Route path="/experience/:id" element={<ExperienceDetail />} />
            <Route path="/person/:id" element={<PersonProfile />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </main>
      </div>
    </AvenaProvider>
  );
}
