import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { obterVaga, obterRespostasDaVaga, type RespostaComPessoa } from "../lib/company";
import { mensagemDeErro } from "../lib/erros";
import { Pagina } from "../components/ei/Pagina";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import type { JobListing } from "../types/domain";

/**
 * Quem se candidatou a uma vaga, em tela própria.
 *
 * A dona: "no painel da vaga acho que pode ter botões sobre as ondas e
 * outro para as pessoas que são interessadas."
 *
 * É a tela pela qual a empresa paga o plano — e ela vivia no fim de uma
 * rolagem que começava na ficha da vaga e passava pelas três ondas. Aqui
 * ela abre direto, com o telefone a um toque de distância.
 */
export function InteressadosDaVagaPage() {
  const { id: vagaId } = useParams<{ id: string }>();
  const navegar = useNavigate();
  useTituloDaPagina("Interessados");

  const [vaga, setVaga] = useState<JobListing | null>(null);
  const [respostas, setRespostas] = useState<RespostaComPessoa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!vagaId) {
      navegar("/painel-empresa", { replace: true });
      return;
    }
    (async () => {
      try {
        const v = await obterVaga(vagaId);
        if (!v) {
          setErro("Vaga não encontrada.");
          return;
        }
        setVaga(v);
        setRespostas(await obterRespostasDaVaga(vagaId));
      } catch (err) {
        setErro(mensagemDeErro(err, "Não foi possível carregar os interessados."));
      } finally {
        setCarregando(false);
      }
    })();
  }, [vagaId, navegar]);

  if (carregando) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <p className="ei-apoio ei-margem" style={{ paddingTop: 24 }}>Carregando…</p>
        </div>
      </div>
    );
  }

  if (!vaga) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <Pagina titulo="Interessados" voltar="/painel-empresa" />
          <p className="ei-apoio ei-margem">{erro || "Vaga não encontrada."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ei">
      <div className="ei-tela detalhe-vaga">
        <Pagina titulo="Interessados" voltar={`/vaga/${vaga.id}`}>
          <p className="ei-apoio ei-margem" style={{ marginTop: 4 }}>
            {vaga.title}
          </p>
        </Pagina>

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 12 }} role="alert">
            {erro}
          </p>
        )}

      {/* Respostas */}
      <section className="ei-cartao">
        {/* Sem repetir "interessados": o título da tela já diz. Aqui só a
            contagem, que é o que muda de uma visita para a outra. */}
        {respostas.length > 0 && (
          <p className="muted" style={{ marginBottom: 10 }}>
            {respostas.length === 1 ? "1 pessoa" : `${respostas.length} pessoas`}
          </p>
        )}

        {respostas.length === 0 ? (
          /* "Ainda não se interessou" e não "não respondeu": desde a 0078 a
             pessoa também pode responder que a vaga não é para ela, e essa
             resposta não aparece aqui. Dizer "ninguém respondeu" sobre uma
             vaga que já teve respostas seria falso. */
          <p className="muted">
            Ninguém se interessou ainda. Quem tocar em “tenho interesse” aparece aqui,
            com o telefone.
          </p>
        ) : (
          /* Cada pessoa vira uma LINHA com nome, rosto e caminho para o
             perfil — onde está o telefone. Antes era "Profissional ID:
             8f3a2b1c…" com um botão "Ver perfil" que não fazia nada: a
             lista pela qual a empresa paga o plano inteiro chegava como
             uma coluna de códigos. */
          <div style={{ margin: "0 -20px" }}>
            {respostas.map((resp) => (
              /* O link usa `cadastroId`, e não `professional_id`: aquele é
                 o id da CONTA, e abriria "perfil não encontrado". Quem
                 está sem cadastro visível vira linha sem toque. */
              <Link
                key={resp.id}
                to={resp.cadastroId ? `/profissional/${resp.cadastroId}` : "#"}
                className="ei-pessoa"
                style={resp.cadastroId ? undefined : { pointerEvents: "none", opacity: 0.6 }}
              >
                <span className="ei-pessoa-retrato" aria-hidden="true">
                  {resp.foto ? (
                    <img src={resp.foto} alt="" loading="lazy" />
                  ) : (
                    (resp.nome || "?").trim().charAt(0).toLocaleUpperCase("pt-BR")
                  )}
                </span>
                <span className="ei-pessoa-texto">
                  <span className="ei-pessoa-nome ei-uma-linha">
                    {resp.nome || "Sem nome"}
                  </span>
                  <span className="ei-pessoa-oficio ei-uma-linha">
                    {resp.bairro ? `${resp.bairro} · ` : ""}
                    respondeu em {new Date(resp.responded_at).toLocaleDateString("pt-BR")}
                  </span>
                </span>
                {resp.cadastroId && (
                  <span className="ei-linha-seta" aria-hidden="true">
                    <IconeSeta />
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}

function IconeSeta() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
         strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}
