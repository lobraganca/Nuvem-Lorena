/* Entrada da DEMONSTRAÇÃO — não vai para o app de verdade.
   ────────────────────────────────────────────────────────
   Monta o app inteiro num arquivo HTML só, com o Supabase de mentira, para
   a dona abrir no celular dela e navegar. Quatro diferenças do `main.tsx`:

   1. HashRouter, e não BrowserRouter: a demonstração é uma página só,
      servida de um endereço fixo. Com o BrowserRouter, tocar em qualquer
      link daria 404 no servidor.
   2. Sem o redirecionamento para o endereço canônico (www): aqui não há
      domínio nenhum, e ele mandaria a pessoa para o site de verdade.
   3. Sem `cuidarDasAtualizacoes`: ele fala com o service worker, que não
      existe nesta montagem.
   4. Uma barra de escolha no topo, que não faz parte do app. Sem ela a
      demonstração mostraria só as três telas públicas — para ver a Conta,
      os Avisos ou o painel da empresa é preciso estar dentro, e não há
      login de verdade num app sem banco. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./theme.css";
import "./estilo-ei.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

type Papel = "visitante" | "nova" | "trabalhador" | "empresa";

function papelAgora(): Papel {
  try {
    if (localStorage.getItem("falso-usuario") === null) return "visitante";
    if (localStorage.getItem("falso-conta") === "nova") return "nova";
    return localStorage.getItem("falso-lado") === "empresa" ? "empresa" : "trabalhador";
  } catch {
    return "visitante";
  }
}

function escolher(papel: Papel) {
  try {
    /* A chave da conta nova é limpa em todos os casos e reposta só no dela:
       esquecer isso deixava a pessoa presa no estado em branco depois de
       trocar de papel — e o sintoma (nenhuma vaga, nenhum cadastro) parece
       app quebrado, não filtro ligado. */
    localStorage.removeItem("falso-conta");
    if (papel === "visitante") {
      localStorage.removeItem("falso-usuario");
      localStorage.removeItem("falso-lado");
    } else if (papel === "nova") {
      /* Conta recém-criada: entrou pelo SMS (que é a porta que traz o
         número) e mais nada. Sem lado escolhido, sem nome, sem e-mail, sem
         foto, sem cadastro, sem empresa. É por aqui que passa todo mundo
         uma vez, e era o único estado que a demonstração não sabia
         mostrar. */
      localStorage.setItem("falso-usuario", "sms");
      localStorage.setItem("falso-lado", "novo");
      localStorage.setItem("falso-conta", "nova");
    } else if (papel === "trabalhador") {
      localStorage.setItem("falso-usuario", "sms");
      localStorage.setItem("falso-lado", "trabalhador");
    } else {
      localStorage.setItem("falso-usuario", "google");
      localStorage.setItem("falso-lado", "empresa");
    }
    /* Volta ao começo do app, e não à tela em que estava: a tela de uma
       empresa não existe para quem virou trabalhador, e cair nela seria
       cair num erro. */
    location.hash = "#/";
  } catch {
    /* armazenamento bloqueado: a barra fica sem efeito, e a demonstração
       segue funcionando como visitante */
  }

  /* O `setTimeout` NÃO é desleixo, e sem ele isto não funciona.
     ──────────────────────────────────────────────────────────
     Mexer no `#` agenda uma navegação. Um `reload()` chamado na mesma
     linha é engolido por ela: a página não recarrega, o cliente falso
     continua com o lado antigo — porque ele lê o armazenamento uma vez
     só, ao carregar — e a barra troca de botão aceso sem trocar de app.
     Foi exatamente o que aconteceu: o botão "Empresa" acendia e a tela
     continuava a do trabalhador.

     Zero milissegundos bastam: só é preciso que a navegação do `#`
     termine antes. */
  setTimeout(() => location.reload(), 0);
}

function BarraDaDemonstracao() {
  const atual = papelAgora();
  const opcoes: Array<[Papel, string]> = [
    ["visitante", "Sem conta"],
    ["nova", "Conta nova (em branco)"],
    ["trabalhador", "Procurando trabalho"],
    ["empresa", "Empresa"],
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
        padding: "7px 10px",
        background: "#2b2925",
        color: "#f0ece4",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 11.5,
        lineHeight: 1.3,
      }}
    >
      <strong style={{ fontWeight: 600, letterSpacing: "0.04em" }}>DEMONSTRAÇÃO</strong>
      <span style={{ opacity: 0.62 }}>ver como:</span>
      {opcoes.map(([p, nome]) => (
        <button
          key={p}
          type="button"
          onClick={() => escolher(p)}
          style={{
            font: "inherit",
            fontWeight: atual === p ? 700 : 500,
            padding: "3px 8px",
            cursor: "pointer",
            border: "1px solid " + (atual === p ? "#f0ece4" : "#57534b"),
            background: atual === p ? "#f0ece4" : "transparent",
            color: atual === p ? "#2b2925" : "#f0ece4",
          }}
        >
          {nome}
        </button>
      ))}
    </div>
  );
}

/* A apresentação já vista: na demonstração ela ficaria na frente do app a
   cada recarga, e recarrega-se a cada troca de papel. */
try {
  localStorage.setItem("busca-itabirito-inicio-visto", "1");
  localStorage.setItem("busca-itabirito-tour-visto", "1");
} catch {
  /* sem armazenamento, a demonstração abre pela apresentação — que também
     é uma tela do app */
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <BarraDaDemonstracao />
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>
);
