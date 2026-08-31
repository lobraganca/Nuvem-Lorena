import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
 * ── Três blocos, nesta ordem ──────────────────────────────────────────
 *
 * A dona: "na tela da vaga é necessário ter a empresa com a logo. Bem
 * organizado. Empresa / Vaga / E especificações."
 *
 *   1. EMPRESA   logo, nome e onde fica — abrindo a tela
 *   2. VAGA      o título e o que a pessoa vai fazer
 *   3. ESPECIFICAÇÕES  salário, contratação, horário, onde, experiência
 *                      e benefícios, todos juntos
 *
 * A primeira versão desta tela era uma tabela só, e a empresa aparecia
 * como mais uma linha dela — do mesmo tamanho de "Experiência", espremida
 * entre o salário e o bairro. Numa cidade em que as pessoas se conhecem,
 * "que empresa é essa" é a PRIMEIRA pergunta, e a resposta estava do
 * tamanho da última.
 *
 * Dentro das especificações o salário vem primeiro: é o que decide se a
 * pessoa continua lendo. E quando um dado falta, a linha aparece dizendo
 * que falta, em vez de sumir — omitir o salário não o torna menos ausente,
 * só torna a vaga mais suspeita.
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
          <Pagina titulo="Vaga" />
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
        {/* ── Três blocos, nesta ordem ───────────────────────────────────
            A dona: "empresa / vaga / e especificações."

            Era tudo uma tabela só: a empresa aparecia como mais uma linha,
            do mesmo tamanho de "Experiência", entre o salário e o bairro.
            Numa cidade em que as pessoas se conhecem, "que empresa é essa"
            é a PRIMEIRA pergunta — e a resposta estava do tamanho da
            última. */}
        {/* Um caminho de volta, e não uma migalha de três níveis.
            ──────────────────────────────────────────────────────
            A migalha terminava com o título da vaga — que aparece de novo,
            inteiro e em corpo grande, doze linhas abaixo. O nome da vaga
            duas vezes na mesma tela não orienta ninguém; só empurra o
            conteúdo para baixo.

            E "Ei Itabirito / Vagas / …" prometia uma hierarquia que não
            existe: Vagas é uma aba, não uma pasta. Quem chega aqui veio da
            lista e quer voltar para ela — é isso, e só isso, que o link
            precisa oferecer. */}
        <Link to="/vagas-para-mim" className="ei-voltar">
          <span aria-hidden="true">‹</span> Vagas
        </Link>

        {/* 1 — A EMPRESA, com a logo. Abre a tela. */}
        <div className="ei-empresa-topo">
          <span className="ei-empresa-marca" aria-hidden="true">
            {empresa?.foto ? (
              <img src={empresa.foto} alt="" />
            ) : (
              (empresa?.nome || "?").trim().charAt(0).toLocaleUpperCase("pt-BR")
            )}
          </span>
          <span className="ei-empresa-topo-texto">
            <span className="ei-empresa-topo-nome ei-uma-linha">
              {empresa?.nome || "Empresa"}
            </span>
            <span className="ei-empresa-topo-onde ei-uma-linha">
              {vaga.neighborhood ? `${vaga.neighborhood} · ` : ""}
              {vaga.city}/{vaga.uf}
            </span>
          </span>
        </div>

        {/* 2 — A VAGA: o que é, e o que a pessoa vai fazer. */}
        <h1 className="ei-titulo-g" style={{ paddingTop: 18 }}>
          {vaga.title}
        </h1>

        {vaga.available_immediately && (
          <Callout>A empresa precisa de alguém para começar logo.</Callout>
        )}

        {vaga.description?.trim() && (
          /* `white-space: pre-line` guarda as quebras que a empresa
             escreveu. Sem isso, uma lista de tarefas escrita em linhas vira
             um parágrafo corrido e ilegível. */
          <p className="ei-corpo ei-margem" style={{ whiteSpace: "pre-line" }}>
            {vaga.description}
          </p>
        )}

        {/* 3 — AS ESPECIFICAÇÕES, todas juntas e com título próprio.
            Salário em primeiro: é a pergunta que decide se a pessoa
            continua lendo. Quando não há resposta nenhuma, a linha aparece
            dizendo isso — omitir não torna o salário menos ausente, só
            torna a vaga mais suspeita. */}
        <div className="ei-secao">
          <h2>Especificações</h2>
        </div>
        <div className="ei-props">
          <Prop rotulo="Salário">
            {salario ?? <span className="ei-apoio">A empresa não informou</span>}
          </Prop>

          <Prop rotulo="Contratação">
            {contrato ?? <span className="ei-apoio">A empresa não informou</span>}
          </Prop>

          <Prop rotulo="Horário">
            {jornada ?? <span className="ei-apoio">A empresa não informou</span>}
          </Prop>

          {/* O JEITO de trabalhar, e não o endereço.
              ────────────────────────────────────────
              O endereço já está embaixo do nome da empresa, ali em cima —
              e repetir "Centro · Itabirito/MG" a dez linhas de distância
              não acrescenta nada, só faz a lista parecer mais cheia do que
              é. O que falta saber aqui é se a pessoa vai até lá todo dia. */}
          <Prop rotulo="Trabalho">
            {vaga.work_modality === "remoto"
              ? "De casa"
              : vaga.work_modality === "hibrido"
                ? "Parte no local, parte de casa"
                : "No local da empresa"}
          </Prop>

          <Prop rotulo="Experiência">
            {vaga.required_experience || "Não precisa de experiência"}
          </Prop>

          {/* Os benefícios entram como especificação, e não numa seção
              solta lá embaixo: quem lê esta lista está comparando vagas, e
              vale-transporte pertence à mesma comparação que o salário. */}
          {vaga.beneficios?.length > 0 && (
            <Prop rotulo="Benefícios">
              <span className="ei-chips">
                {vaga.beneficios.map((b) => (
                  <span key={b} className="ei-selo ei-selo-verde">
                    {b}
                  </span>
                ))}
              </span>
            </Prop>
          )}
        </div>

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
              {/* Uma linha, não a faixa de duas colunas — ver o comentário
                  igual a este em VagasParaMimPage: os dois textos somam 53
                  letras e o `space-between` quebrava cada um em duas
                  linhas, com cara de tabela torta. */}
              <p className="ei-nota-resposta">
                Você marcou que não é para você — a empresa não é avisada.
              </p>
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
