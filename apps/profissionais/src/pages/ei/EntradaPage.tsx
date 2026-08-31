import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  const navegar = useNavigate();

  /* Quem já tem conta vai direto ao que veio fazer. Mostrar a porta de
     entrada para quem já entrou é fazer a pessoa escolher de novo uma coisa
     que ela já escolheu.

     ── Pelo roteador, e não mexendo no endereço à mão ─────────────────
     Isto era um `window.history.replaceState` seguido de um `popstate`
     disparado na mão. O motivo estava escrito e era legítimo: um
     `<Navigate>` dentro de um `if` ANTES dos hooks quebraria a ordem
     deles. Mas a saída escolhida trocou um problema por outro — o desvio
     passou a escrever o endereço por fora do react-router, e portanto a
     supor que o roteador é o de endereço de verdade.

     Quebrou na primeira vez que o app rodou com outro tipo de roteador (a
     demonstração de um arquivo só, que precisa do de `#`): o desvio
     escrevia `/vagas-para-mim` como caminho real, o servidor não tinha
     esse arquivo, e a tela virava um 404 — sem nenhum erro de JavaScript
     para apontar a causa.

     O `useEffect` resolve os dois: fica no topo, com os outros hooks, e
     desvia pelo roteador que estiver montado. */
  const paraOnde = !loading && user && tipo
    ? tipo === "company" ? "/painel-empresa" : "/vagas-para-mim"
    : null;

  useEffect(() => {
    if (paraOnde) navegar(paraOnde, { replace: true });
  }, [paraOnde, navegar]);

  if (paraOnde) return null;

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
        {/* O `?lado=` não é enfeite: sem ele os dois botões apontavam para o
            MESMO `/login`, e a escolha que a pessoa acabou de fazer era
            jogada fora. Ela chegava a uma tela chamada "Entrar", sem
            nenhuma menção ao lado que escolheu, e depois de entrar era
            perguntada de novo — "Qual é seu tipo de conta?". Duas
            perguntas para a mesma decisão é o jeito mais rápido de alguém
            achar que errou o caminho e voltar. */}
        <div className="ei-margem" style={{ display: "grid", gap: 10 }}>
          <Link
            to="/login?lado=trabalhar"
            className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
          >
            Procuro trabalho
          </Link>
          <Link
            to="/login?lado=contratar"
            className="ei-btn ei-btn-contorno ei-btn-largo ei-btn-alto"
          >
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

