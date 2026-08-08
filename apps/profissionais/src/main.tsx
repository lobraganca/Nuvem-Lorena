import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./theme.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { irParaEnderecoCanonico } from "./lib/enderecoCanonico";

// Antes de qualquer outra coisa: se a pessoa chegou pelo endereço sem www,
// manda para o com www. Desenhar a tela primeiro faria o app guardar sessão
// e segredo do login num endereço que ele vai abandonar no instante seguinte.
if (!irParaEnderecoCanonico()) {
createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
}
