import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  obterVaga,
  obterOndasDaVaga,
  calcularOndas,
  abrirOnda,
} from "../lib/company";
import { mensagemDeErro } from "../lib/erros";
import { Pagina } from "../components/ei/Pagina";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import {
  ONDAS,
  ONDAS_POR_VAGA,
  type JobListing,
  type JobDispatch,
  type WaveNumber,
} from "../types/domain";

/**
 * As ondas de uma vaga, em tela própria.
 *
 * ── Por que saiu da tela da vaga — 04/09 ─────────────────────────────
 *
 * A dona: "no painel da vaga acho que pode ter botões sobre as ondas e
 * outro para as pessoas que são interessadas. Daí fica mais organizado em
 * outras telas."
 *
 * A tela da vaga acumulava três assuntos numa rolagem só: a ficha da vaga,
 * as três ondas (com contagem, botão de disparo e explicação de cada
 * faixa) e a lista de quem se candidatou. Quem entrava para ver um nome
 * passava por dois blocos de disparo antes; quem entrava para disparar
 * rolava a ficha inteira.
 *
 * Agora a vaga é a ficha, e cada assunto tem porta e endereço.
 *
 * Disparar continua sendo um ATO da empresa, nunca automático: quem já
 * achou gente não incomoda mais ninguém.
 */
export function OndasDaVagaPage() {
  const { id: vagaId } = useParams<{ id: string }>();
  const navegar = useNavigate();
  useTituloDaPagina("Ondas da vaga");

  const [vaga, setVaga] = useState<JobListing | null>(null);
  const [ondas, setOndas] = useState<JobDispatch[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  /* `null` = ainda não perguntamos ao banco. Zero é resposta legítima
     ("não há mais ninguém"), então não dá para usá-lo como "não sei". */
  const [alcanceProximaOnda, setAlcanceProximaOnda] = useState<number | null>(null);
  const [contando, setContando] = useState(false);
  const [abrindo, setAbrindo] = useState(false);

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
        setOndas(await obterOndasDaVaga(vagaId));
      } catch (err) {
        setErro(mensagemDeErro(err, "Não foi possível carregar as ondas."));
      } finally {
        setCarregando(false);
      }
    })();
  }, [vagaId, navegar]);

  /** Quantas pessoas novas a próxima onda alcança. Só quando a empresa pede. */
  async function contarProximaOnda() {
    if (!vaga || !proximaOnda) return;
    setContando(true);
    setErro("");
    try {
      const todas = await calcularOndas(vaga);
      setAlcanceProximaOnda(todas.find((o) => o.onda === proximaOnda)?.novos ?? 0);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível contar os profissionais."));
    } finally {
      setContando(false);
    }
  }

  async function dispararProximaOnda() {
    if (!vaga || !proximaOnda) return;
    setAbrindo(true);
    setErro("");
    try {
      await abrirOnda(vaga, proximaOnda);
      setOndas(await obterOndasDaVaga(vaga.id));
      setAlcanceProximaOnda(null);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível disparar a onda."));
    } finally {
      setAbrindo(false);
    }
  }

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
          <Pagina titulo="Ondas" voltar="/painel-empresa" />
          <p className="ei-apoio ei-margem">{erro || "Vaga não encontrada."}</p>
        </div>
      </div>
    );
  }

  const proximaOnda = ([1, 2, 3] as WaveNumber[]).find(
    (n) => !ondas.some((o) => o.wave === n)
  );
  const aindaTemOnda = ondas.length < ONDAS_POR_VAGA;

  return (
    <div className="ei">
      <div className="ei-tela detalhe-vaga">
        <Pagina titulo="Ondas" voltar={`/vaga/${vaga.id}`}>
          <p className="ei-apoio ei-margem" style={{ marginTop: 4 }}>
            {vaga.title}
          </p>
        </Pagina>

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 12 }} role="alert">
            {erro}
          </p>
        )}

      {/* ── AS TRÊS ONDAS, UMA POR BLOCO — 03/09 ─────────────────────────
          A dona: "a parte de disparo de ondas tem que ficar melhor.
          Colocar 3 botões de ondas."

          Era uma caixa que mostrava o que JÁ tinha sido disparado e, no
          fim, um bloco só para "a próxima" — então a empresa nunca via as
          três de uma vez, nem entendia que existe uma escala: exatamente
          isso → mesmo ofício → ramo vizinho. Cada onda alcança mais gente
          e menos precisa, e essa é a decisão que a tela tem que deixar
          tomar.

          Agora são três blocos fixos, sempre os três, cada um dizendo em
          que estado está: disparada (com data e quantas pessoas), pronta
          para disparar (com o botão), ou trancada (com o motivo escrito).
          Ninguém precisa adivinhar o que existe atrás do que está na tela. */}
      <div className="ei-lista">
        {([1, 2, 3] as WaveNumber[]).map((n) => {
          const jaSaiu = ondas.find((o) => o.wave === n);
          const ehAProxima = !jaSaiu && proximaOnda === n && vaga.status === "active";
          const semCota = !jaSaiu && !aindaTemOnda;

          return (
            <div key={n} className="ei-onda">
              <div className="ei-onda-topo">
                <span className="ei-onda-nome">
                  Onda {n} — {ONDAS[n].titulo}
                </span>
                {jaSaiu && <span className="ei-selo ei-selo-verde">Disparada</span>}
              </div>
              <p className="ei-onda-nota">{ONDAS[n].explicacao}</p>

              {jaSaiu ? (
                <p className="ei-onda-conta">
                  <strong>
                    {jaSaiu.professionals_count}{" "}
                    {jaSaiu.professionals_count === 1 ? "pessoa avisada" : "pessoas avisadas"}
                  </strong>{" "}
                  em{" "}
                  {new Date(jaSaiu.sent_at).toLocaleDateString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {/* Quantas TÊM aparelho que recebe aviso. Sem este número
                      a tela venderia um alcance que não existe, e a empresa
                      descobriria pelo silêncio — a forma mais cara. `null`
                      é "não sei" e some: escrever "0 com aviso" seria
                      inventar a pior notícia possível. */}
                  {jaSaiu.podiam_receber !== null && jaSaiu.podiam_receber !== undefined && (
                    <>
                      {" · "}
                      {jaSaiu.podiam_receber} com aviso no celular
                    </>
                  )}
                </p>
              ) : ehAProxima ? (
                alcanceProximaOnda === null ? (
                  <button
                    className="ei-btn ei-btn-contorno ei-btn-curto"
                    disabled={contando}
                    onClick={contarProximaOnda}
                  >
                    {contando ? "Contando…" : "Ver quantas pessoas alcança"}
                  </button>
                ) : (
                  <button
                    className="ei-btn ei-btn-cheio ei-btn-curto"
                    disabled={abrindo || alcanceProximaOnda === 0}
                    onClick={dispararProximaOnda}
                  >
                    {abrindo
                      ? "Avisando…"
                      : alcanceProximaOnda === 0
                        ? "Não há mais ninguém para avisar"
                        : `Avisar ${alcanceProximaOnda} ${
                            alcanceProximaOnda === 1 ? "pessoa" : "pessoas"
                          }`}
                  </button>
                )
              ) : (
                /* Trancada, e o motivo escrito: sem ele o bloco cinza
                   parece defeito. São dois motivos diferentes — a vaga não
                   está no ar, ou a cota de ondas acabou — e trocar um pelo
                   outro manda a empresa procurar a solução errada. */
                <p className="ei-onda-nota">
                  {vaga.status !== "active"
                    ? "A vaga precisa estar no ar para disparar."
                    : semCota
                      ? `Esta vaga já usou as ${ONDAS_POR_VAGA} ondas dela.`
                      : "Sai depois da onda anterior."}
                </p>
              )}
            </div>
          );
        })}
      </div>



      </div>
    </div>
  );
}
