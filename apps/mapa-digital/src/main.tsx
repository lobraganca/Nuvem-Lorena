import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { App } from "./App";
import "./estilo.css";

const raiz = document.getElementById("raiz");
if (!raiz) throw new Error("Faltou a div #raiz no index.html");

// Endereço normal (/pilar/1/pesquisa-passiva) é o certo, e é o que vai no ar.
// Mas ele exige que o servidor devolva a página para QUALQUER caminho; em
// hospedagem que não faz isso (a prévia publicada, por exemplo), recarregar
// numa etapa dá "página não encontrada". Montando com VITE_ROTA_HASH=1, os
// endereços passam a ter # e funcionam em qualquer lugar.
const Rotas = import.meta.env.VITE_ROTA_HASH === "1" ? HashRouter : BrowserRouter;

createRoot(raiz).render(
  <StrictMode>
    <Rotas>
      <App />
    </Rotas>
  </StrictMode>,
);
