import { useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { Menu } from "./componentes/Menu";
import { Inicio } from "./telas/Inicio";
import { TelaDaEtapa } from "./telas/Etapa";
import { Relatorio } from "./telas/Relatorio";
import { NaoAchei } from "./telas/NaoAchei";

export function App() {
  const [menuAberto, setMenuAberto] = useState(false);
  const local = useLocation();

  // Trocou de tela, fecha o menu. No celular ele cobre a tela inteira: sem
  // isto, a pessoa toca numa etapa e continua olhando para o menu, achando
  // que o toque não pegou.
  useEffect(() => {
    setMenuAberto(false);
    window.scrollTo(0, 0);
  }, [local.pathname]);

  return (
    <div className="moldura">
      <header className="topo">
        <button
          type="button"
          className="botao-menu"
          aria-expanded={menuAberto}
          aria-controls="menu-lateral"
          onClick={() => setMenuAberto((aberto) => !aberto)}
        >
          <span aria-hidden="true">{menuAberto ? "✕" : "☰"}</span>
          <span className="so-leitor-de-tela">
            {menuAberto ? "Fechar o menu" : "Abrir o menu"}
          </span>
        </button>

        <Link to="/" className="marca">
          Mapa <strong>Digital</strong>
        </Link>

        <Link to="/relatorio" className="atalho-relatorio">
          Relatório
        </Link>
      </header>

      <div className="corpo">
        <Menu aberto={menuAberto} aoFechar={() => setMenuAberto(false)} />

        <main className="conteudo">
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/pilar/:numero/:slug" element={<TelaDaEtapa />} />
            <Route path="/relatorio" element={<Relatorio />} />
            <Route path="*" element={<NaoAchei />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
