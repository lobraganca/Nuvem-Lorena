import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./theme.css";
/* Depois do theme.css de propósito: o outro é do procurô, este é do Ei.
   Ver o cabeçalho do arquivo. */
import "./estilo-ei.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { irParaEnderecoCanonico } from "./lib/enderecoCanonico";
import { cuidarDasAtualizacoes } from "./lib/atualizacao";
import { aplicarAberturaDoApp } from "./lib/aberturaDoApp";

// Antes de qualquer outra coisa: se a pessoa chegou pelo endereço sem www,
// manda para o com www. Desenhar a tela primeiro faria o app guardar sessão
// e segredo do login num endereço que ele vai abandonar no instante seguinte.
if (!irParaEnderecoCanonico()) {
/* ── TODA ABERTURA COMEÇA NA TELA DE ENTRAR — 05/09 ────────────────────
   A dona: "quando fecho o app e entro ele ainda volta na tela do que eu
   estava. Ele tem que voltar sempre na de login onde tem opção de escolher
   se é empresa ou pessoa."

   Roda AQUI, antes de o React desenhar qualquer coisa, e não dentro de um
   componente. Não é preciosismo: dentro do app a decisão vira uma corrida
   com os guardiões de tela. Foi medido — o desvio para a tela de entrar
   acontecia, e o `SoDesteLado` da tela que estava saindo mandava a pessoa
   para `/onboarding-tipo` no mesmo instante. Reescrevendo o endereço antes
   do primeiro desenho, o app nasce já na tela certa e não há corrida
   nenhuma.

   Depois do endereço canônico pelo mesmo motivo que o `cuidarDasAtualizacoes`
   está aqui embaixo: não vale mexer no endereço de uma página que vai ser
   abandonada no instante seguinte. */
aplicarAberturaDoApp();
cuidarDasAtualizacoes();
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
