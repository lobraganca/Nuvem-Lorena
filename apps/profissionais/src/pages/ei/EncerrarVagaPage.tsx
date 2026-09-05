import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Pagina } from "../../components/ei/Pagina";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { mensagemDeErro } from "../../lib/erros";
import {
  arquivarVaga,
  excluirVaga,
  obterVaga,
  pausarVaga,
  contarRespostasDasVagas,
} from "../../lib/company";
import type { JobListing } from "../../types/domain";

/**
 * "O que aconteceu com esta vaga?"
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "ao clicar em tirar do ar a vaga, direcionar a uma outra tela
 * para que a pessoa escolha a finalidade."
 *
 * ── Por que uma tela, e não o painel que abria ali mesmo ──────────────
 *
 * As três saídas já existiam, escritas por extenso — só que dentro da
 * própria tela da vaga, empurrando o resto para baixo, e com a pergunta
 * do "contratou por aqui?" abrindo DENTRO de uma delas. Três níveis
 * dobrados um dentro do outro, numa tela que já tinha a ficha inteira da
 * vaga, os números e a lista de interessados acima.
 *
 * O efeito era o previsível: a empresa tocava em "Tirar do ar", a tela
 * crescia por baixo do dedo, e ela escolhia a primeira palavra que
 * reconhecia. Escolher entre "pausar", "encerrar" e "apagar" sem ler a
 * consequência é o caminho mais curto para alguém apagar por engano a
 * lista de gente que pagou para receber.
 *
 * Numa tela só disto, cada saída tem espaço para dizer o que faz, e a
 * escolha é a única coisa que existe ali.
 *
 * ── A ordem é da mais leve para a mais grave ──────────────────────────
 *
 * Pausar (volta quando quiser) → encerrar (libera vaga do plano, guarda a
 * lista) → apagar (não tem volta, leva a lista junto). E só a última pede
 * um segundo toque.
 */
export function EncerrarVagaPage() {
  useTituloDaPagina("Tirar a vaga do ar");
  const { id } = useParams<{ id: string }>();
  const navegar = useNavigate();

  const [vaga, setVaga] = useState<JobListing | null>(null);
  const [interessados, setInteressados] = useState(0);
  const [fechando, setFechando] = useState(false);
  const [erro, setErro] = useState("");
  const [perguntandoContratacao, setPerguntandoContratacao] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [quantosContratados, setQuantosContratados] = useState("1");

  useEffect(() => {
    if (!id) {
      navegar("/minhas-empresas", { replace: true });
      return;
    }
    let vivo = true;
    (async () => {
      try {
        const v = await obterVaga(id);
        if (!vivo) return;
        if (!v) {
          setErro("Esta vaga não existe mais.");
          return;
        }
        setVaga(v);
        /* Quantas pessoas se interessaram: é o número que faz a empresa
           parar antes de apagar. "Tem certeza?" não informa nada; "apagar
           leva junto as 7 pessoas interessadas" informa. */
        const contas = await contarRespostasDasVagas([v.id]);
        if (vivo) setInteressados(contas.get(v.id) ?? 0);
      } catch (err) {
        if (vivo) setErro(mensagemDeErro(err, "Não consegui ler esta vaga."));
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id, navegar]);

  async function fazer(acao: () => Promise<void>, aviso: string) {
    setFechando(true);
    setErro("");
    try {
      await acao();
      /* Volta para a vaga, e não para a lista: a empresa acabou de mudar
         a situação dela e o que ela quer ver é a vaga com a situação
         nova. `replace` para o botão de voltar do aparelho não trazer de
         volta esta tela, que já não faz sentido. */
      navegar(`/vaga/${id}`, { replace: true });
    } catch (err) {
      setErro(mensagemDeErro(err, aviso));
      setFechando(false);
    }
  }

  const gente =
    interessados === 1 ? "a pessoa interessada" : `as ${interessados} pessoas interessadas`;

  return (
    <div className="ei">
      <div className="ei-tela">
        <Pagina titulo="Tirar a vaga do ar" voltar={`/vaga/${id}`} />

        {vaga && (
          <p className="ei-apoio ei-margem" style={{ marginTop: 12 }}>
            {vaga.title}
          </p>
        )}

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 12 }} role="alert">
            {erro}
          </p>
        )}

        <h2 className="ei-secao">O que aconteceu com esta vaga?</h2>

        <div className="ei-margem ei-saidas">
          <button
            className="ei-saida"
            onClick={() => fazer(() => pausarVaga(id!), "Não foi possível pausar a vaga.")}
            disabled={fechando}
          >
            <span className="ei-saida-nome">Pausar por enquanto</span>
            <span className="ei-saida-nota">
              Some da busca e volta quando você quiser. Continua ocupando uma
              vaga do seu plano.
            </span>
          </button>

          {!perguntandoContratacao ? (
            <button
              className="ei-saida"
              onClick={() => {
                setErro("");
                setPerguntandoContratacao(true);
              }}
              disabled={fechando}
            >
              <span className="ei-saida-nome">Já contratei — encerrar</span>
              <span className="ei-saida-nota">
                Libera uma vaga do seu plano. A lista de quem se interessou
                fica guardada, em “Encerradas”.
              </span>
            </button>
          ) : (
            <div className="ei-saida ei-saida-confirma">
              <span className="ei-saida-nome">
                A pessoa que você contratou veio do Ei Emprego?
              </span>
              <span className="ei-saida-nota">
                Serve para sabermos quantos empregos saem daqui de verdade.
                Ninguém além de nós vê esta resposta, e ela não muda nada no
                seu plano.
              </span>

              <label className="ei-quantos-contratados">
                Quantas pessoas você contratou por esta vaga?
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={999}
                  value={quantosContratados}
                  onChange={(e) => setQuantosContratados(e.target.value)}
                />
              </label>

              <div className="ei-saida-botoes">
                <button
                  className="ei-btn"
                  disabled={fechando}
                  onClick={() =>
                    fazer(
                      () =>
                        arquivarVaga(id!, {
                          contratouPorAqui: true,
                          /* Campo vazio ou rabiscado não vira zero: vira
                             "não disse quantas". Zero significaria
                             "contratou ninguém", que contradiz o sim. */
                          quantos:
                            Number(quantosContratados) > 0
                              ? Number(quantosContratados)
                              : null,
                        }),
                      "Não foi possível encerrar a vaga."
                    )
                  }
                >
                  Sim, veio daqui — encerrar
                </button>

                <button
                  className="ei-btn-inline"
                  disabled={fechando}
                  onClick={() =>
                    fazer(
                      () => arquivarVaga(id!, { contratouPorAqui: false }),
                      "Não foi possível encerrar a vaga."
                    )
                  }
                >
                  Não, veio de outro lugar — encerrar
                </button>

                {/* A saída sem responder. Sem ela, quem não quer dizer fica
                    preso numa tela que só queria encerrar a vaga — e
                    responde qualquer coisa para sair. */}
                <button
                  className="ei-btn-inline"
                  disabled={fechando}
                  onClick={() =>
                    fazer(() => arquivarVaga(id!), "Não foi possível encerrar a vaga.")
                  }
                >
                  Prefiro não dizer — só encerrar
                </button>
              </div>
            </div>
          )}

          {/* A grave, e a única que pede um segundo toque. A pergunta DIZ O
              NÚMERO: "tem certeza?" não informa nada, e saber que sete
              pessoas somem junto é o que faz parar e escolher encerrar. */}
          {!confirmandoExclusao ? (
            <button
              className="ei-saida ei-saida-grave"
              onClick={() => {
                setErro("");
                setConfirmandoExclusao(true);
              }}
              disabled={fechando}
            >
              <span className="ei-saida-nome">Apagar de vez</span>
              <span className="ei-saida-nota">
                {interessados > 0
                  ? `Apaga a vaga e ${gente} nela. Não dá para desfazer.`
                  : "Apaga a vaga de vez. Não dá para desfazer."}
              </span>
            </button>
          ) : (
            <div className="ei-saida ei-saida-grave ei-saida-confirma">
              <span className="ei-saida-nome">
                {interessados > 0
                  ? `Apagar leva junto ${gente}. Tem certeza?`
                  : "Apagar não tem volta. Tem certeza?"}
              </span>
              <button
                className="ei-btn ei-btn-perigo-claro ei-btn-largo"
                onClick={() => fazer(() => excluirVaga(id!), "Não foi possível apagar a vaga.")}
                disabled={fechando}
              >
                {fechando ? "Apagando…" : "Sim, apagar esta vaga"}
              </button>
            </div>
          )}

          <button
            className="ei-btn ei-btn-texto"
            onClick={() => navegar(`/vaga/${id}`)}
            disabled={fechando}
          >
            Deixar como está
          </button>
        </div>
      </div>
    </div>
  );
}
