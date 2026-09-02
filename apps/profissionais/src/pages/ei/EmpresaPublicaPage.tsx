import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { mensagemDeErro } from "../../lib/erros";
import { nomeDoContrato, salarioEmTexto, type JobListing } from "../../types/domain";
import { Pagina } from "../../components/ei/Pagina";

/**
 * A empresa, vista por quem procura trabalho.
 *
 * ── O PEDIDO ───────────────────────────────────────────────────────────
 *
 * A dona: "o candidato pode acessar o perfil da empresa e ver as vagas que
 * estão em aberto."
 *
 * ── POR QUE ISSO IMPORTA MAIS AQUI DO QUE PARECERIA ────────────────────
 *
 * Numa cidade pequena, "que empresa é essa?" é a primeira pergunta de quem
 * lê uma vaga — e até agora não havia resposta: o nome aparecia no topo da
 * vaga e não levava a lugar nenhum. Quem quisesse saber mais perguntava
 * para um conhecido, ou não respondia.
 *
 * E tem o efeito prático: quem abre uma vaga de balconista da padaria
 * costuma servir também para a de ajudante de cozinha da MESMA padaria.
 * Sem esta tela, a segunda vaga só chega se a onda a escolher.
 *
 * ── O QUE ELA MOSTRA, E O QUE NÃO ──────────────────────────────────────
 *
 * Lê a `companies_public` (0100), que tem nome, foto e onde fica — e NÃO
 * tem CNPJ, telefone, responsável nem plano. Isso não é limitação da tela:
 * é a razão de a view existir. A tabela `companies` só é legível pelo
 * próprio dono, e liberar a linha inteira liberaria tudo junto.
 *
 * O telefone da empresa continua fora de propósito. Quem contrata liga
 * para quem se interessou — o caminho é a vaga, e não a lista telefônica.
 */
type EmpresaPublica = {
  id: string;
  company_name: string;
  photo_url: string | null;
  city: string | null;
  uf: string | null;
  neighborhood: string | null;
};

export function EmpresaPublicaPage() {
  const { id } = useParams<{ id: string }>();
  const [empresa, setEmpresa] = useState<EmpresaPublica | null>(null);
  const [vagas, setVagas] = useState<JobListing[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useTituloDaPagina(empresa?.company_name ?? "Empresa");

  useEffect(() => {
    if (!id) return;
    const sb = supabase();
    if (!sb) {
      setCarregando(false);
      return;
    }
    let vivo = true;

    (async () => {
      try {
        /* As duas juntas: a empresa sem as vagas é uma tela vazia com um
           nome, e as vagas sem a empresa não dizem de quem são. */
        const [{ data: e, error: erroE }, { data: v, error: erroV }] = await Promise.all([
          sb
            .from("companies_public")
            .select("id, company_name, photo_url, city, uf, neighborhood")
            .eq("id", id)
            .maybeSingle(),
          sb
            .from("job_listings")
            .select(
              "id, company_id, title, description, profession, specialty, required_experience, skills, salary_range_min, salary_range_max, available_immediately, work_modality, city, uf, neighborhood, anunciada_ate, status, created_at, closed_at, tipo_contrato, jornada, beneficios, salario_a_combinar"
            )
            .eq("company_id", id)
            .eq("status", "active")
            .order("created_at", { ascending: false }),
        ]);
        if (erroE) throw erroE;
        if (erroV) throw erroV;
        if (!vivo) return;
        /* Sem empresa não é erro: a `companies_public` só mostra quem tem
           vaga NO AR (0100). Uma empresa que fechou tudo desaparece daqui,
           e a tela diz isso em vez de mostrar um defeito. */
        setEmpresa((e as EmpresaPublica | null) ?? null);
        setVagas((v ?? []) as JobListing[]);
      } catch (err) {
        /* Erro nunca vira "empresa sem vagas". As duas telas seriam
           iguais e as duas coisas são opostas — e esta é a tela em que a
           pessoa decide se responde. */
        if (vivo) setErro(mensagemDeErro(err, "Não consegui abrir esta empresa."));
      } finally {
        if (vivo) setCarregando(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [id]);

  if (carregando) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <Pagina titulo="Empresa" />
          <p className="ei-apoio ei-margem" style={{ paddingTop: 20 }}>Carregando…</p>
        </div>
      </div>
    );
  }

  if (erro || !empresa) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <Pagina titulo="Empresa" />
          <p className={erro ? "ei-campo-erro ei-margem" : "ei-apoio ei-margem"} role={erro ? "alert" : undefined}>
            {erro || "Esta empresa não tem nenhuma vaga no ar agora."}
          </p>
          <div className="ei-margem" style={{ marginTop: 16 }}>
            <Link className="ei-btn ei-btn-contorno" to="/vagas">
              Ver todas as vagas abertas
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ei">
      <div className="ei-tela">
        {/* "Empresa" na barra, e não o nome: ele já está no bloco logo
            abaixo, em corpo grande e com a logo do lado. Nos dois lugares,
            o mesmo nome aparecia duas vezes em três centímetros de tela. */}
        <Pagina titulo="Empresa" />

        {/* O mesmo bloco de topo da tela da vaga, de propósito: quem chega
            aqui vindo de lá tem que reconhecer que é a mesma empresa. */}
        <div className="ei-empresa-topo">
          <span className="ei-empresa-marca" aria-hidden="true">
            {empresa.photo_url ? (
              <img src={empresa.photo_url} alt="" />
            ) : (
              empresa.company_name.trim().charAt(0).toLocaleUpperCase("pt-BR")
            )}
          </span>
          <span className="ei-empresa-topo-texto">
            <span className="ei-empresa-topo-nome ei-uma-linha">{empresa.company_name}</span>
            <span className="ei-empresa-topo-onde ei-uma-linha">
              {[empresa.neighborhood, [empresa.city, empresa.uf].filter(Boolean).join("/")]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
        </div>

        <div className="ei-secao">
          <h2>
            {vagas.length} {vagas.length === 1 ? "vaga aberta" : "vagas abertas"}
          </h2>
        </div>

        {vagas.length === 0 ? (
          <div className="ei-cartao">
            <p className="ei-apoio" style={{ margin: 0 }}>
              Nenhuma vaga desta empresa está no ar agora.
            </p>
          </div>
        ) : (
          <div className="ei-lista">
            {vagas.map((v) => (
              <Link key={v.id} to={`/vaga-aberta/${v.id}`} className="ei-pessoa ei-vaga-linha">
                <span className="ei-pessoa-retrato" aria-hidden="true">
                  {empresa.photo_url ? (
                    <img src={empresa.photo_url} alt="" loading="lazy" />
                  ) : (
                    empresa.company_name.trim().charAt(0).toLocaleUpperCase("pt-BR")
                  )}
                </span>
                <div className="ei-pessoa-texto">
                  <div className="ei-pessoa-nome ei-uma-linha">{v.title}</div>
                  <div className="ei-pessoa-oficio ei-uma-linha">
                    {[v.profession, v.neighborhood ?? v.city].filter(Boolean).join(" · ")}
                  </div>
                  <div className="ei-vaga-linha-detalhe ei-uma-linha">
                    {[salarioEmTexto(v) ?? "Salário não informado", nomeDoContrato(v.tipo_contrato)]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <span className="ei-linha-seta" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                       strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
