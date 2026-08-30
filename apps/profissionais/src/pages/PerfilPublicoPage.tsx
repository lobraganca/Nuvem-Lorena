import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { mensagemDeErro } from "../lib/erros";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { Pagina, Prop } from "../components/ei/Pagina";
import type { ProfessionalExperience } from "../types/domain";

type Publico = {
  id: string;
  name: string;
  photo_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  neighborhood: string | null;
  city: string;
  uf: string;
  areas_de_interesse: string[];
  especialidade: string | null;
  disponivel: boolean | null;
  whatsapp_verified: boolean;
};

type Curso = { nome: string; instituicao: string | null; ano: string | null };

/**
 * O perfil de um profissional, visto por quem contrata.
 *
 * ── Isto faltava, e faltava o principal ───────────────────────────────
 *
 * A dona alinhou assim: "a empresa, se não aderir a algum plano, só
 * consegue ver os perfis. E terá que entrar em contato 1 a 1."
 *
 * Só que não havia perfil para ver nem contato para fazer. A lista de
 * profissionais era um `<article>` sem link nenhum, e o telefone não
 * aparecia em lugar nenhum do app. A metade gratuita da oferta — a que faz
 * a empresa entender que vale a pena assinar — simplesmente não existia.
 *
 * ── O telefone aparece, e é de propósito ──────────────────────────────
 *
 * É o que a política de privacidade já diz: quem fica visível torna
 * público nome, foto, cidade, funções e telefone. Quem não quer isso tem o
 * modo oculto, que tira da lista e mantém as ondas — e é aí que a decisão
 * pertence: à pessoa, no cadastro dela, e não a uma tela que esconde o
 * contato de todo mundo e obriga a empresa a pagar para conversar.
 */
export function PerfilPublicoPage() {
  const { id = "" } = useParams();
  const [p, setP] = useState<Publico | null>(null);
  const [experiencias, setExperiencias] = useState<ProfessionalExperience[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useTituloDaPagina(p?.name ?? "Profissional");

  useEffect(() => {
    const sb = supabase();
    if (!sb || !id) {
      setCarregando(false);
      return;
    }

    (async () => {
      try {
        const { data, error } = await sb
          .from("professionals_public")
          .select(
            "id, name, photo_url, phone, whatsapp, neighborhood, city, uf, " +
              "areas_de_interesse, especialidade, disponivel, whatsapp_verified"
          )
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          /* Não achou é diferente de deu erro: quem ficou oculto some da
             view pública, e o certo é dizer isso — não fingir defeito. */
          setP(null);
          return;
        }
        setP(data as unknown as Publico);

        const [{ data: exps }, { data: curs }] = await Promise.all([
          sb
            .from("professional_experiences")
            .select("*")
            .eq("professional_id", id)
            .order("ordem", { ascending: true }),
          sb
            .from("professional_courses")
            .select("nome, instituicao, ano")
            .eq("professional_id", id)
            .order("ordem", { ascending: true }),
        ]);
        setExperiencias((exps ?? []) as ProfessionalExperience[]);
        setCursos((curs ?? []) as Curso[]);
      } catch (err) {
        setErro(mensagemDeErro(err, "Não consegui carregar este perfil."));
      } finally {
        setCarregando(false);
      }
    })();
  }, [id]);

  if (carregando) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <p className="ei-apoio ei-margem" style={{ paddingTop: 24 }}>Carregando…</p>
        </div>
      </div>
    );
  }

  if (erro || !p) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <Pagina icone="🔎" titulo="Perfil" ondeEstou="Profissional" />
          <p className="ei-apoio ei-margem" style={{ paddingTop: 8 }}>
            {erro || "Este perfil não está disponível. A pessoa pode ter saído da lista."}
          </p>
          <div className="ei-margem" style={{ marginTop: 16 }}>
            <Link to="/profissionais" className="ei-btn ei-btn-contorno">
              Ver quem está disponível
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const telefone = p.whatsapp || p.phone || "";
  const funcoes = p.areas_de_interesse ?? [];

  return (
    <div className="ei">
      <div className="ei-tela">
        <Pagina icone="👤" foto={p.photo_url} titulo={p.name} ondeEstou="Profissional">
          <div className="ei-props">
            <Prop rotulo="Situação">
              {p.disponivel === false ? (
                <span className="ei-selo ei-selo-cinza">Ocupado agora</span>
              ) : (
                <span className="ei-selo ei-selo-verde">Disponível</span>
              )}
            </Prop>
            <Prop rotulo="Onde">
              {p.neighborhood ? `${p.neighborhood} · ` : ""}
              {p.city}/{p.uf}
            </Prop>
            <Prop rotulo="Telefone">
              {p.whatsapp_verified ? (
                <>
                  {telefoneLegivel(telefone)}{" "}
                  <span className="ei-selo ei-selo-verde">Confirmado</span>
                </>
              ) : (
                /* Dizer que NÃO foi confirmado importa mais do que dizer
                   que foi: é o que separa um cadastro de um número
                   digitado, e quem vai ligar precisa saber disso antes. */
                <>
                  {telefoneLegivel(telefone)}{" "}
                  <span className="ei-selo ei-selo-cinza">Sem confirmação</span>
                </>
              )}
            </Prop>
          </div>
        </Pagina>

        {/* O contato, logo abaixo dos dados: é o que a empresa veio fazer
            aqui. Dois caminhos porque nem todo mundo usa WhatsApp, e um
            número que só abre num app é um número que metade não usa. */}
        {telefone && (
          <div className="ei-acoes">
            <a
              className="ei-acao"
              href={`https://wa.me/55${soDigitos(telefone)}?text=${encodeURIComponent(
                `Olá, ${primeiroNome(p.name)}! Vi o seu perfil no Ei Itabirito e queria falar sobre uma vaga.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="ei-acao-circulo" aria-hidden="true">
                <IconeConversa />
              </span>
              Chamar no WhatsApp
            </a>
            <a className="ei-acao" href={`tel:+55${soDigitos(telefone)}`}>
              <span className="ei-acao-circulo" aria-hidden="true">
                <IconeFone />
              </span>
              Ligar
            </a>
          </div>
        )}

        {p.disponivel === false && (
          <div className="ei-callout" style={{ marginTop: 4 }}>
            <span className="ei-callout-emoji" aria-hidden="true">⏳</span>
            <span className="ei-callout-texto">
              Esta pessoa marcou que <strong>não está aceitando trabalho agora</strong>. Você
              pode falar com ela mesmo assim.
            </span>
          </div>
        )}

        <h2 className="ei-secao">O que ela aceita fazer</h2>
        <div className="ei-cartao">
          {funcoes.length ? (
            <div className="ei-chips">
              {funcoes.map((f) => (
                <span key={f} className="ei-selo ei-selo-cinza">
                  {f}
                </span>
              ))}
            </div>
          ) : (
            <p className="ei-apoio">
              {p.especialidade || "Ainda não marcou nenhuma função."}
            </p>
          )}
        </div>

        {experiencias.length > 0 && (
          <>
            <h2 className="ei-secao">Onde já trabalhou</h2>
            <div>
              {experiencias.map((e) => (
                <div key={e.id} className="ei-linha-item" style={{ cursor: "default" }}>
                  <span className="ei-linha-nome">
                    {e.cargo}
                    {(e.onde || e.periodo) && (
                      <span className="ei-linha-sub">
                        {[e.onde, e.periodo].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {cursos.length > 0 && (
          <>
            <h2 className="ei-secao">Cursos</h2>
            <div>
              {cursos.map((c, i) => (
                <div key={i} className="ei-linha-item" style={{ cursor: "default" }}>
                  <span className="ei-linha-nome">
                    {c.nome}
                    {(c.instituicao || c.ano) && (
                      <span className="ei-linha-sub">
                        {[c.instituicao, c.ano].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* A ponte para o produto pago, dita sem empurrar: quem chegou até
            aqui já entendeu o valor de ter a lista. */}
        <div className="ei-callout" style={{ marginTop: 20 }}>
          <span className="ei-callout-emoji" aria-hidden="true">📣</span>
          <span className="ei-callout-texto">
            Falar um por um funciona para uma contratação. Para várias,{" "}
            <Link to="/planos-empresa" className="ei-btn-inline">
              publique uma vaga
            </Link>{" "}
            e o aviso vai para todo mundo que encaixa.
          </span>
        </div>
      </div>
    </div>
  );
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

/** Deixa só os dígitos e tira o 55 da frente, se vier. */
function soDigitos(bruto: string): string {
  const n = bruto.replace(/\D/g, "");
  return n.startsWith("55") && n.length > 11 ? n.slice(2) : n;
}

function telefoneLegivel(bruto: string): string {
  const n = soDigitos(bruto);
  if (n.length < 10) return bruto || "—";
  return `(${n.slice(0, 2)}) ${n.slice(2, n.length - 4)}-${n.slice(-4)}`;
}

const traco = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function IconeConversa() {
  return (
    <svg {...traco}>
      <path d="M20.5 11.6a8 8 0 0 1-11.8 7l-5.2 1.4 1.4-5A8 8 0 1 1 20.5 11.6z" />
    </svg>
  );
}

function IconeFone() {
  return (
    <svg {...traco}>
      <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5z" />
    </svg>
  );
}
