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
  useTituloDaPagina("Trabalho em Itabirito");
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
        <header style={{ textAlign: "center", paddingTop: 24 }}>
          <img
            src={marcaEi}
            alt=""
            aria-hidden="true"
            style={{
              height: 64,
              background: "var(--ei-cor)",
              borderRadius: "22%",
              padding: "10px 12px",
              boxSizing: "content-box",
            }}
          />
          <h1 className="ei-titulo-g" style={{ marginTop: 16 }}>
            Trabalho em Itabirito
          </h1>
          <p className="ei-apoio">
            De um lado quem procura serviço. Do outro, quem procura gente.
          </p>
        </header>

        {/* As duas portas.
            ───────────────
            Ordem deliberada: quem procura trabalho primeiro. São muito mais
            pessoas, e é o lado que precisa estar cheio antes de o outro
            valer alguma coisa — uma cidade com trinta empresas e nenhum
            profissional não tem produto nenhum. */}
        <div style={{ display: "grid", gap: 12 }}>
          <Link
            to="/login"
            className="ei-cartao ei-cartao-toque"
            style={{ background: "var(--ei-cor)", color: "var(--ei-sobre-cor)", padding: 20 }}
          >
            <strong style={{ fontSize: "1.1rem", display: "block" }}>Procuro trabalho</strong>
            <span style={{ opacity: 0.86, fontSize: "0.94rem" }}>
              Diga o que você faz e receba as vagas da cidade no celular.
            </span>
          </Link>

          <Link to="/login" className="ei-cartao ei-cartao-toque" style={{ padding: 20 }}>
            <strong style={{ fontSize: "1.1rem", display: "block" }}>Procuro gente</strong>
            <span className="ei-apoio">
              Publique a vaga e avise quem faz aquele serviço aqui perto.
            </span>
          </Link>
        </div>

        {/* O que é grátis, dito na entrada. Sem isto, os dois cartões acima
            parecem levar a um pedágio, e quem só queria olhar vai embora. */}
        <div className="ei-cartao ei-cartao-fundo">
          <p className="ei-apoio" style={{ margin: 0 }}>
            <strong>Ver os profissionais da cidade é grátis</strong> e não precisa de
            conta —{" "}
            <Link to="/profissionais" style={{ color: "var(--ei-cor)", fontWeight: 500 }}>
              é só olhar
            </Link>
            .
          </p>
        </div>
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
