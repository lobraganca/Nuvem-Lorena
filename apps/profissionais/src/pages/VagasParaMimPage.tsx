import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { mensagemDeErro } from "../lib/erros";
import {
  vagasParaMim,
  marcarVagaComoVista,
  responderVaga,
  type VagaParaMim,
} from "../lib/minhasVagas";
import { pedirPermissaoDePush, pushServeAqui, situacaoDaPermissao } from "../lib/push";

/**
 * "Vagas para você" — o que chegou para este profissional.
 *
 * Esta tela é o aviso de verdade; o push é só o empurrão para abri-la mais
 * cedo. A ordem importa: push alcança só quem instalou o app e aceitou
 * receber, e no iPhone só quem adicionou à tela de início. Se a vaga
 * existisse apenas como notificação, quem não tem push nunca ficaria
 * sabendo — e, pior, não teria como saber que está perdendo vaga.
 */
export function VagasParaMimPage() {
  useTituloDaPagina("Vagas para você");
  const navegar = useNavigate();
  const { user, loading: carregandoConta } = useAuth();

  const [vagas, setVagas] = useState<VagaParaMim[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [ligandoAviso, setLigandoAviso] = useState(false);
  const [avisoLigado, setAvisoLigado] = useState(false);

  useEffect(() => {
    if (carregandoConta) return;
    if (!user) {
      navegar("/login", { replace: true });
      return;
    }

    vagasParaMim(user.id)
      .then((lista) => {
        setVagas(lista);
        /* Marcar como visto ao ABRIR a lista, e não ao tocar em cada vaga:
           a pessoa viu que existem. Marcar só no toque deixaria o contador
           do menu aceso para sempre para quem olhou e não se interessou. */
        lista.filter((v) => !v.visto_em).forEach((v) => marcarVagaComoVista(v.aviso_id));
      })
      .catch((err) => {
        /* Lista vazia por erro seria "não tem vaga para você" — a mentira
           mais cara desta tela, porque quem lê está procurando emprego. */
        setErro(mensagemDeErro(err, "Não consegui carregar suas vagas."));
      })
      .finally(() => setCarregando(false));
  }, [user, carregandoConta, navegar]);

  async function ligarAviso() {
    setLigandoAviso(true);
    setErro("");
    const deu = await pedirPermissaoDePush();
    setAvisoLigado(deu);
    if (!deu) {
      /* Dizer que não deu é obrigatório. Quem acha que ativou e não ativou
         fica esperando um aviso que nunca chega, e conclui que não aparece
         vaga na cidade. */
      setErro(
        "Não consegui ligar o aviso neste aparelho. Você continua vendo as vagas " +
          "aqui sempre que abrir o app."
      );
    }
    setLigandoAviso(false);
  }

  async function responder(v: VagaParaMim) {
    if (!user) return;
    setRespondendo(v.vaga.id);
    setErro("");
    try {
      await responderVaga(v.vaga.id, user.id);
      setVagas((atual) =>
        atual.map((x) => (x.vaga.id === v.vaga.id ? { ...x, respondida: true } : x))
      );
    } catch (err) {
      setErro(mensagemDeErro(err, "Não consegui enviar seu interesse."));
    } finally {
      setRespondendo(null);
    }
  }

  if (carregandoConta || carregando) {
    return (
      <div className="container" style={{ paddingTop: 48 }}>
        <span className="muted">Carregando…</span>
      </div>
    );
  }

  const permissao = situacaoDaPermissao();
  const podeOferecerAviso =
    pushServeAqui() && permissao === "default" && !avisoLigado && vagas.length > 0;

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <h1 style={{ marginBottom: 8 }}>Vagas para você</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Empresas de Itabirito procurando gente que faz o que você faz.
      </p>

      {erro && (
        <p style={{ color: "var(--color-danger)", margin: "12px 0" }}>{erro}</p>
      )}

      {/* O convite para ligar o aviso vem DEPOIS de existir vaga na lista, e
          nunca ao abrir o app pela primeira vez. No celular a recusa é
          definitiva — não há segunda caixa de diálogo, nem jeito de voltar
          atrás sem ir nas configurações do sistema. Pedir antes de a pessoa
          entender para quê é gastar a única chance que existe. */}
      {podeOferecerAviso && (
        <div className="card" style={{ padding: 14, margin: "16px 0" }}>
          <strong style={{ fontSize: "0.95em" }}>Quer saber na hora?</strong>
          <p className="muted" style={{ margin: "4px 0 10px", fontSize: "0.9em" }}>
            Ligue o aviso e o celular te chama quando aparecer vaga do seu ofício.
            Quem responde primeiro costuma ser chamado primeiro.
          </p>
          <button
            type="button"
            className="btn btn-outline btn-block"
            disabled={ligandoAviso}
            onClick={ligarAviso}
          >
            {ligandoAviso ? "Ligando…" : "Ligar o aviso"}
          </button>
        </div>
      )}

      {avisoLigado && (
        <p style={{ margin: "12px 0", fontSize: "0.9em" }}>
          Pronto — o aviso está ligado neste aparelho.
        </p>
      )}

      {vagas.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: "center", marginTop: 16 }}>
          <p style={{ margin: 0 }}>Nenhuma vaga chegou para você ainda.</p>
          {/* O que a pessoa PODE fazer a respeito. Uma tela vazia sem saída
              faz ela concluir que o app não serve e não voltar mais. */}
          <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.9em" }}>
            As vagas chegam pelo que você marcou em <strong>"quero ser avisado de
            vagas"</strong>, no seu cadastro. Marcar mais tipos de trabalho aumenta o
            que chega.
          </p>
          <button
            className="btn btn-outline"
            style={{ marginTop: 12 }}
            onClick={() => navegar("/painel")}
          >
            Abrir meu cadastro
          </button>
        </div>
      )}

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {vagas.map((v) => (
          <div key={v.aviso_id} className="card" style={{ padding: 16 }}>
            <strong style={{ fontSize: "1.05em" }}>{v.vaga.title}</strong>
            <p className="muted" style={{ margin: "2px 0 8px", fontSize: "0.9em" }}>
              {v.empresa} · {v.vaga.city}/{v.vaga.uf}
            </p>

            {v.vaga.description && (
              <p style={{ margin: "0 0 10px", fontSize: "0.95em" }}>{v.vaga.description}</p>
            )}

            <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.88em" }}>
              {v.vaga.work_modality === "presencial"
                ? "Presencial"
                : v.vaga.work_modality === "remoto"
                  ? "A distância"
                  : "Parte presencial"}
              {v.vaga.required_experience ? ` · ${v.vaga.required_experience}` : ""}
              {v.vaga.available_immediately ? " · Para começar logo" : ""}
            </p>

            {v.respondida ? (
              /* Estado que precisa aparecer: sem ele a pessoa toca de novo
                 achando que não funcionou, e depois fica sem saber se a
                 empresa recebeu. */
              <p style={{ margin: 0, fontSize: "0.9em" }}>
                <strong>Você avisou que tem interesse.</strong> A empresa entra em
                contato pelo seu telefone.
              </p>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={respondendo === v.vaga.id}
                onClick={() => responder(v)}
              >
                {respondendo === v.vaga.id ? "Enviando…" : "Tenho interesse"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
