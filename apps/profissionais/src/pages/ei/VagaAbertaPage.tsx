import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { obterVaga } from "../../lib/company";
import { responderVaga } from "../../lib/minhasVagas";
import { supabase } from "../../lib/supabase";
import { mensagemDeErro } from "../../lib/erros";
import { Callout, Pagina, Prop } from "../../components/ei/Pagina";
import {
  nomeDaJornada,
  nomeDoContrato,
  salarioEmTexto,
  type JobListing,
} from "../../types/domain";

/**
 * A vaga inteira, para quem procura trabalho.
 *
 * ── Por que esta tela precisou existir ────────────────────────────────
 *
 * A dona: "tem que ter todos os campos descritos."
 *
 * Ao acrescentar tipo de contrato, jornada e benefícios ao cadastro,
 * apareceu um problema maior que os campos que faltavam: **quem procura
 * nunca via a vaga inteira**. Havia só o cartão de "Vagas para você", com a
 * descrição cortada em duas linhas, a modalidade e a urgência — e nenhum
 * salário. A rota `/vaga/:id` existia, mas é o painel de quem ANUNCIOU:
 * mostra ondas, alcance e a lista de interessados.
 *
 * Ou seja: a pessoa decidia se queria a vaga sem nunca ter lido a vaga.
 * Pedir mais campos à empresa sem esta tela seria pedir que ela escrevesse
 * para ninguém.
 *
 * ── A ordem das informações é a ordem da dúvida ───────────────────────
 *
 * Salário, contratação e horário primeiro — nesta ordem, e antes da
 * descrição. São as três perguntas que decidem se vale continuar lendo, e
 * enterrá-las embaixo de um parágrafo faz a pessoa desistir antes de
 * chegar nelas.
 */
export function VagaAbertaPage() {
  const { id } = useParams<{ id: string }>();
  const navegar = useNavigate();
  const { user } = useAuth();
  useTituloDaPagina("Vaga");

  const [vaga, setVaga] = useState<JobListing | null>(null);
  const [empresa, setEmpresa] = useState<{ nome: string; foto: string | null } | null>(null);
  /* `undefined` = ainda não respondeu; `true`/`false` = a resposta dela.
     Três estados, como na lista — sem isso, "não quis" e "não abriu"
     mostrariam a mesma tela. */
  const [interessado, setInteressado] = useState<boolean | undefined>(undefined);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!id) {
      navegar("/vagas-para-mim", { replace: true });
      return;
    }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  async function carregar() {
    try {
      const v = await obterVaga(id!);
      if (!v) {
        setErro("Esta vaga não está mais disponível.");
        return;
      }
      setVaga(v);

      const sb = supabase();
      if (sb) {
        const { data: emp } = await sb
          .from("companies")
          .select("company_name, photo_url")
          .eq("id", v.company_id)
          .maybeSingle();
        if (emp) {
          const e = emp as { company_name?: string; photo_url?: string | null };
          setEmpresa({ nome: e.company_name ?? "", foto: e.photo_url ?? null });
        }

        if (user) {
          const { data: r } = await sb
            .from("job_responses")
            .select("interessado")
            .eq("job_listing_id", id!)
            .eq("professional_id", user.id)
            .maybeSingle();
          if (r) setInteressado((r as { interessado: boolean }).interessado !== false);
        }
      }
    } catch (err) {
      setErro(mensagemDeErro(err, "Não consegui abrir esta vaga."));
    } finally {
      setCarregando(false);
    }
  }

  async function responder(quero: boolean) {
    if (!user || !id) {
      /* Sem conta não dá para responder, e mandar embora sem explicação
         faria parecer defeito. A tela de entrar sabe voltar para cá. */
      navegar("/login?lado=trabalhar");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      await responderVaga(id, user.id, quero);
      setInteressado(quero);
    } catch (err) {
      setErro(
        mensagemDeErro(
          err,
          quero ? "Não consegui enviar seu interesse." : "Não consegui guardar sua resposta."
        )
      );
    } finally {
      setEnviando(false);
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
          <Pagina icone="💼" titulo="Vaga" ondeEstou="Vagas" />
          <p className="ei-apoio ei-margem">{erro || "Esta vaga não está mais disponível."}</p>
          <div className="ei-margem" style={{ marginTop: 16 }}>
            <button className="ei-btn ei-btn-contorno" onClick={() => navegar("/vagas-para-mim")}>
              Ver as vagas para mim
            </button>
          </div>
        </div>
      </div>
    );
  }

  const salario = salarioEmTexto(vaga);
  const contrato = nomeDoContrato(vaga.tipo_contrato);
  const jornada = nomeDaJornada(vaga.jornada);

  return (
    <div className="ei">
      <div className="ei-tela">
        <Pagina icone="💼" titulo={vaga.title} ondeEstou="Vagas">
          <div className="ei-props">
            <Prop rotulo="Empresa">
              <span className="ei-uma-linha">{empresa?.nome || "Empresa"}</span>
            </Prop>

            {/* Salário PRIMEIRO. É a pergunta que decide se a pessoa
                continua lendo, e enterrá-la embaixo do parágrafo faz ela
                desistir antes de chegar. Quando não há resposta nenhuma, a
                linha aparece dizendo isso — omitir não torna o salário menos
                ausente, só torna a vaga mais suspeita. */}
            <Prop rotulo="Salário">
              {salario ?? <span className="ei-apoio">A empresa não informou</span>}
            </Prop>

            {contrato && <Prop rotulo="Contratação">{contrato}</Prop>}
            {jornada && <Prop rotulo="Horário">{jornada}</Prop>}

            <Prop rotulo="Onde">
              {vaga.work_modality === "remoto"
                ? "De casa"
                : vaga.work_modality === "hibrido"
                  ? "Parte no local, parte de casa"
                  : `${vaga.neighborhood ? vaga.neighborhood + " · " : ""}${vaga.city}/${vaga.uf}`}
            </Prop>

            <Prop rotulo="Experiência">
              {vaga.required_experience || "Não precisa de experiência"}
            </Prop>
          </div>
        </Pagina>

        {vaga.available_immediately && (
          <Callout emoji="⚡">A empresa precisa de alguém para começar logo.</Callout>
        )}

        {vaga.description?.trim() && (
          <>
            <div className="ei-secao">
              <h2>O que você vai fazer</h2>
            </div>
            {/* `white-space: pre-line` guarda as quebras que a empresa
                escreveu. Sem isso, uma lista de tarefas escrita em linhas
                vira um parágrafo corrido e ilegível. */}
            <p className="ei-corpo ei-margem" style={{ whiteSpace: "pre-line" }}>
              {vaga.description}
            </p>
          </>
        )}

        {vaga.beneficios?.length > 0 && (
          <>
            <div className="ei-secao">
              <h2>Além do salário</h2>
            </div>
            <div className="ei-chips ei-margem">
              {vaga.beneficios.map((b) => (
                <span key={b} className="ei-selo ei-selo-verde">
                  {b}
                </span>
              ))}
            </div>
          </>
        )}

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 16 }} role="alert">
            {erro}
          </p>
        )}

        {/* A resposta, no fim — depois de a pessoa ter lido tudo. Os mesmos
            três estados da lista de vagas, para as duas telas não contarem
            histórias diferentes sobre a mesma vaga. */}
        <div className="ei-margem" style={{ marginTop: 26 }}>
          {vaga.status !== "active" ? (
            <div className="ei-faixa">
              <span>Esta vaga saiu do ar</span>
              <span className="ei-faixa-valor">não dá mais para responder</span>
            </div>
          ) : interessado === true ? (
            <div className="ei-faixa">
              <span>Interesse enviado</span>
              <span className="ei-faixa-valor">a empresa te liga</span>
            </div>
          ) : interessado === false ? (
            <>
              <div className="ei-faixa">
                <span>Você disse que não é para você</span>
                <span className="ei-faixa-valor">a empresa não é avisada</span>
              </div>
              <button
                type="button"
                className="ei-btn-inline"
                style={{ marginTop: 8 }}
                disabled={enviando}
                onClick={() => responder(true)}
              >
                {enviando ? "Enviando…" : "Mudei de ideia, tenho interesse"}
              </button>
            </>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <button
                type="button"
                className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
                disabled={enviando}
                onClick={() => responder(true)}
              >
                {enviando ? "Enviando…" : "Tenho interesse"}
              </button>
              <button
                type="button"
                className="ei-btn ei-btn-contorno ei-btn-largo"
                disabled={enviando}
                onClick={() => responder(false)}
              >
                Não é para mim
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
