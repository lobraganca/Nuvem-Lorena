import { Link } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { useOnboardingStatus } from "../../lib/useOnboardingStatus";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { InstalarApp } from "../../components/InstalarApp";

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
      <div className="ei-tela">
        {/* A marca aparecia DUAS vezes: no cabeçalho e de novo aqui, grande,
            num quadrado azul que era a única mancha de cor forte do app
            inteiro. Saiu a segunda — a do cabeçalho já identifica o app, e
            uma marca repetida a 60px de distância da outra não informa
            nada, só ocupa o lugar do que decide a tela.

            E "quem procura serviço" era linguagem do procurô. Aqui não se
            contrata serviço, se contrata gente. */}
        <h1 className="ei-titulo-g" style={{ paddingTop: 34 }}>
          Emprego em Itabirito
        </h1>
        <p className="ei-apoio ei-margem" style={{ paddingBottom: 26 }}>
          De um lado quem procura trabalho. Do outro, quem está contratando.
        </p>

        {/* As duas portas. Ordem deliberada: quem procura trabalho primeiro.
            São muito mais pessoas, e é o lado que precisa estar cheio antes
            de o outro valer alguma coisa.

            A primeira é a CHEIA agora, e não "ver os profissionais": a
            decisão desta tela é de que lado a pessoa está, e a terceira
            opção estava em preto disputando com ela. */}
        <div className="ei-margem" style={{ display: "grid", gap: 10 }}>
          <Link to="/login" className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto">
            Procuro trabalho
          </Link>
          <Link to="/login" className="ei-btn ei-btn-contorno ei-btn-largo ei-btn-alto">
            Estou contratando
          </Link>
        </div>

        <div className="ei-margem" style={{ marginTop: 18 }}>
          <Link to="/profissionais" className="ei-btn-inline">
            Ver quem está disponível na cidade
          </Link>
          <p className="ei-apoio" style={{ marginTop: 4 }}>
            É grátis e não precisa de conta.
          </p>
        </div>

        {/* Instalar, para quem ainda não entrou.
            ──────────────────────────────────────
            O caminho de instalar mora na Conta, e quem chega aqui pela
            primeira vez não tem conta — ficava sem nenhum. E é justamente
            esta pessoa que precisa dele: quem gostou do app e não o deixou
            no celular volta uma vez e esquece o endereço.

            Some sozinho dentro do app já instalado e dentro do app da
            loja. Ver InstalarApp. */}
        <div className="ei-lista" style={{ marginTop: 26 }}>
          <InstalarApp />
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
