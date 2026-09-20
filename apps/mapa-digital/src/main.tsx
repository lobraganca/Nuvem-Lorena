import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { App } from "./App";
import { EH_PREVIA } from "./lib/previa";
import "./estilo.css";

const raiz = document.getElementById("raiz");
if (!raiz) throw new Error("Faltou a div #raiz no index.html");

// Endereço normal (/pilar/1/pesquisa-passiva) é o certo, e é o que vai no ar.
// Mas ele exige que o servidor devolva a página para QUALQUER caminho; na
// prévia publicada isso não acontece e recarregar numa etapa daria "página não
// encontrada". Ver src/lib/previa.ts.
const Rotas = EH_PREVIA ? HashRouter : BrowserRouter;

createRoot(raiz).render(
  <StrictMode>
    <Rotas>
      <App />
    </Rotas>
  </StrictMode>,
);
