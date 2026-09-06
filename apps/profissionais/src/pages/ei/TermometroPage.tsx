import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pagina } from "../../components/ei/Pagina";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { lerTermometro, MINIMO_PARA_SETA, type LinhaDoTermometro } from "../../lib/termometro";
import { DEFAULT_CITY } from "../../types/domain";

/**
 * "O que está contratando em Itabirito?"
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "criar TERMÔMETRO DO EMPREGO. O app poderia mostrar: o que está
 * contratando em Itabirito? Vendas ↑, Construção ↑, Administrativo →,
 * Serviços ↑, Tecnologia ↑."
 *
 * ── Por que esta é a tela que sai do app ──────────────────────────────
 *
 * Todas as outras servem quem já está dentro: o cadastro, as vagas, a
 * triagem. Esta responde uma pergunta que a cidade inteira faz e que
 * ninguém em Itabirito tem onde responder — e é por isso que ela é a
 * única que alguém compartilha num grupo de WhatsApp.
 *
 * Ela não pede conta, de propósito. Quem chegar por um link vê a resposta
 * inteira; o convite para se cadastrar vem depois dela, e não antes.
 *
 * ── O que ela promete, e o que não promete ────────────────────────────
 *
 * Ela mede as vagas ANUNCIADAS AQUI, e diz isso com todas as letras no
 * rodapé. Não é o mercado de trabalho de Itabirito — é a parte dele que
 * passou pelo app. Escrever "o mercado está aquecido" a partir de trinta
 * vagas seria a mentira mais fácil desta tela, e a mais difícil de
 * desmentir depois.
 */
export function TermometroPage() {
  useTituloDaPagina("O que está contratando");
  const [linhas, setLinhas] = useState<LinhaDoTermometro[] | null>(null);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      /* Itabirito e não "a cidade toda": o termômetro é sobre ESTA
         cidade, e somar Ouro Preto e Belo Horizonte transformaria a
         resposta em outra pergunta. */
      const t = await lerTermometro(DEFAULT_CITY);
      if (!vivo) return;
      setLinhas(t?.linhas ?? null);
      setTotal(t?.totalAgora ?? 0);
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div className="ei">
      <div className="ei-tela">
        <Pagina titulo="O que está contratando" voltar="/" />

        <p className="ei-apoio ei-margem">
          As vagas anunciadas em {DEFAULT_CITY} nos últimos 30 dias, comparadas
          com os 30 dias anteriores.
        </p>

        {carregando && (
          <p className="muted ei-margem">Somando as vagas…</p>
        )}

        {/* Sem dado NÃO é "a cidade parou de contratar" — é o app ainda não
            ter vaga suficiente para dizer alguma coisa, ou a SQL não ter
            sido aplicada. Afirmar a primeira coisa a partir da segunda é
            exatamente o tipo de mentira calma que este app persegue. */}
        {!carregando && !linhas && (
          <section className="ei-cartao">
            <p className="muted" style={{ margin: 0 }}>
              Ainda não há vagas suficientes para montar o termômetro. Ele aparece
              assim que a cidade tiver movimento por aqui.
            </p>
          </section>
        )}

        {!carregando && linhas && (
          <>
            <section className="ei-cartao ei-termometro">
              {linhas.map((l) => (
                <div key={l.setor} className="ei-termometro-linha">
                  <span className="ei-termometro-seta" aria-hidden="true">
                    <Seta tendencia={l.tendencia} />
                  </span>
                  <span className="ei-termometro-setor">{l.setor}</span>
                  <span className="ei-termometro-conta">
                    {l.agora} {l.agora === 1 ? "vaga" : "vagas"}
                  </span>
                  {/* A leitura escrita, para quem usa leitor de tela e para
                      quem não entende seta como número. A seta sozinha é
                      desenho; isto é a informação. */}
                  <span className="ei-termometro-nota">{legenda(l)}</span>
                </div>
              ))}
            </section>

            {/* Onde o número acaba e a honestidade começa. Sem esta linha,
                "Construção ↑" lê como dado do mercado de trabalho da
                cidade — e é dado das vagas deste app. */}
            <p className="ei-apoio ei-margem">
              São {total} {total === 1 ? "vaga anunciada" : "vagas anunciadas"} no Ei
              Emprego nos últimos 30 dias. A seta só aparece a partir de{" "}
              {MINIMO_PARA_SETA} vagas — abaixo disso, uma vaga a mais ou a menos
              não quer dizer nada.
            </p>

            {/* O convite vem DEPOIS da resposta, e não antes: quem chegou
                aqui por um link veio saber o que está contratando, não
                criar conta. Responder primeiro é o que torna o convite
                bem-vindo. */}
            <div className="ei-margem" style={{ marginTop: 4 }}>
              <Link to="/vagas" className="ei-btn ei-btn-cheio ei-btn-largo">
                Ver as vagas abertas
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Só o texto da seta muda; a cor vem do CSS pela classe do pai. */
function Seta({ tendencia }: { tendencia: LinhaDoTermometro["tendencia"] }) {
  if (tendencia === "subiu") return <span className="ei-seta-sobe">↑</span>;
  if (tendencia === "desceu") return <span className="ei-seta-desce">↓</span>;
  if (tendencia === "igual") return <span className="ei-seta-igual">→</span>;
  /* "Poucas" fica com um traço, e não com uma seta apagada: seta cinza
     ainda aponta para algum lado, e apontar é justamente o que não dá
     para fazer com três vagas. */
  return <span className="ei-seta-poucas">–</span>;
}

function legenda(l: LinhaDoTermometro): string {
  if (l.tendencia === "poucas") return "poucas vagas para comparar";
  if (l.tendencia === "subiu") return `mais que as ${l.antes} do mês anterior`;
  if (l.tendencia === "desceu") return `menos que as ${l.antes} do mês anterior`;
  return `parecido com as ${l.antes} do mês anterior`;
}
