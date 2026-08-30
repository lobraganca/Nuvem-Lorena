import { Link } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { useOnboardingStatus } from "../../lib/useOnboardingStatus";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import marcaEi from "/marca-ei.png";

/**
 * A porta de entrada do Ei Itabirito.
 *
 * Substitui a HomePage do procurô, que era a tela de BUSCA: campo de
 * procurar serviço, grade de categorias, vitrine de anúncios pagos,
 * banners. Aquela tela responde "quem conserta o meu chuveiro?" — a
 * pergunta do outro produto.
 *
 * Aqui a pergunta é "de que lado você está?", e são só duas respostas. Não
 * há campo de busca na entrada de propósito: quem chega a este app ou está
 * procurando trabalho ou está procurando gente, e as duas coisas começam
 * com um cadastro, não com uma busca.
 *
 * Quem já entrou nunca vê esta tela: é levado direto para o lado dele.
 */
export function EntradaPage() {
  useTituloDaPagina("Emprego em Itabirito");
  const { user, loading } = useAuth();
  const tipo = useOnboardingStatus();

  /* Quem já tem conta vai direto ao que veio fazer. Mostrar a porta de
     entrada para quem já entrou é fazer a pessoa escolher de novo uma coisa
     que ela já escolheu. */
  if (!loading && user && tipo) {
    return <Navegar para={tipo === "company" ? "/painel-empresa" : "/vagas-para-mim"} />;
  }

  return (
    <div className="ei">
      <div className="ei-tela" style={{ display: "grid", alignContent: "start", gap: 24 }}>
        {/* Saudação em duas linhas, como na referência: a primeira na cor
            de acento, a segunda em preto. Faz a tela parecer um
            cumprimento, e não o cabeçalho de um formulário. */}
        <div style={{ paddingTop: 28 }}>
          <img
            src={marcaEi}
            alt=""
            aria-hidden="true"
            style={{
              height: 52,
              background: "var(--ei-marca)",
              borderRadius: "24%",
              padding: "10px 12px",
              boxSizing: "content-box",
              marginBottom: 28,
            }}
          />
          <h1 className="ei-saudacao">
            <span>Olá,</span>
            Emprego em Itabirito
          </h1>
          <p className="ei-apoio" style={{ marginBottom: 28 }}>
            De um lado quem procura serviço. Do outro, quem procura gente.
          </p>
        </div>

        {/* As duas portas, empilhadas em cápsula — o formato dos botões de
            entrar da referência. Ordem deliberada: quem procura trabalho
            primeiro. São muito mais pessoas, e é o lado que precisa estar
            cheio antes de o outro valer alguma coisa. */}
        <div style={{ display: "grid", gap: 12 }}>
          <Link to="/login" className="ei-btn ei-btn-contorno ei-btn-largo ei-btn-alto">
            Procuro trabalho
          </Link>
          <Link to="/login" className="ei-btn ei-btn-contorno ei-btn-largo ei-btn-alto">
            Procuro gente
          </Link>
          <Link
            to="/profissionais"
            className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
            style={{ marginTop: 8 }}
          >
            Ver os profissionais da cidade
          </Link>
        </div>

        {/* Dito depois dos botões, e não num cartão: o cartão dava a ele o
            mesmo peso das duas portas, e isto é uma nota de rodapé — o que
            importa é que exista, não que compita. */}
        <p className="ei-apoio" style={{ textAlign: "center", marginTop: 4 }}>
          Ver quem está disponível é grátis e não precisa de conta.
        </p>
      </div>
    </div>
  );
}

/* Redirecionamento sem depender do react-router: um `<Navigate>` dentro de
   um `if` antes dos hooks quebraria a ordem deles. Assim o desvio acontece
   depois da montagem, que é sempre seguro. */
function Navegar({ para }: { para: string }) {
  if (typeof window !== "undefined" && window.location.pathname !== para) {
    window.history.replaceState({}, "", para);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  return null;
}
