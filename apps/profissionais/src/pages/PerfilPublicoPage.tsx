import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { mensagemDeErro } from "../lib/erros";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { Pagina, Prop } from "../components/ei/Pagina";
import type { ProfessionalExperience } from "../types/domain";
import { useAuth } from "../lib/useAuth";
import { empresaAtual, lerStatusDaResposta, marcarResposta } from "../lib/company";
import type { JobResponse } from "../types/domain";
import { registrarVisita } from "../lib/quemMeViu";
import { obterVaga } from "../lib/company";
import type { JobListing } from "../types/domain";
import { normalizar, ESCADA_ESCOLARIDADE } from "../lib/compatibilidade";
import { BotaoFavorito } from "../components/ei/BotaoFavorito";
import { lerFavoritos } from "../lib/favoritos";

/* ── O PERFIL INTEIRO, E NÃO UM RESUMO — 04/09 ─────────────────────────
   A dona: "ao clicar no pedido de um candidato tem que ter todas as
   informações que ele preencheu."

   A tela mostrava seis campos: situação, cidade, telefone, funções,
   experiências e cursos. O cadastro tem trinta — pretensão, horários,
   CNH, viagem, fim de semana, começar imediato, escolaridade,
   competências, resumo. A pessoa preenche tudo isso para ser escolhida, e
   quem decide não via quase nada.

   A view `professionals_public` já entregava esses campos desde a 0103;
   era esta tela que pedia só um punhado deles. */
type Publico = {
  id: string;
  name: string;
  photo_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  neighborhood: string | null;
  city: string;
  uf: string;
  bio: string | null;
  categories: string[] | null;
  areas_de_interesse: string[];
  especialidade: string | null;
  disponivel: boolean | null;
  whatsapp_verified: boolean;
  idade: number | null;
  pretensao_centavos: number | null;
  pretensao_combinar: boolean | null;
  pretensao_periodo: string | null;
  disponibilidade: string[] | null;
  aceita_viajar: boolean | null;
  fim_de_semana: boolean | null;
  inicio_imediato: boolean | null;
  modo_trabalho: string | null;
  cnh: boolean | null;
  cnh_categorias: string[] | null;
  /** Declarações da própria pessoa (0114 e 0115). */
  primeiro_emprego: boolean | null;
  pcd: boolean | null;
};

type Curso = {
  nome: string;
  instituicao: string | null;
  ano: string | null;
  tipo: string | null;
  nivel: string | null;
  situacao: string | null;
};

type Competencia = { nome: string; nivel: string | null };

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
  const { user } = useAuth();
  const [favorito, setFavorito] = useState(false);
  const { id = "" } = useParams();
  const [p, setP] = useState<Publico | null>(null);
  const [experiencias, setExperiencias] = useState<ProfessionalExperience[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [competencias, setCompetencias] = useState<Competencia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  /* ── A TRIAGEM DA EMPRESA — 04/09 ───────────────────────────────────
     A dona: "ao clicar em uma pessoa que se interessou deve aparecer o
     perfil dela e ter botões para a empresa marcar se ele interessou, não
     interessou ou analisar."

     Os botões só existem quando o perfil foi aberto A PARTIR de uma
     candidatura — a lista de interessados ou o aviso mandam `?resposta=`.
     Aberto pelo banco de talentos não há o que marcar: a pessoa não se
     candidatou a nada, e três botões de triagem ali seriam sobre uma vaga
     que ninguém escolheu. */
  const [busca] = useSearchParams();
  const respostaId = busca.get("resposta");
  const [marca, setMarca] = useState<JobResponse["status"] | null>(null);
  const [marcando, setMarcando] = useState(false);

  /* ── A FICHA COMPARADA COM A VAGA — 04/09 ─────────────────────────
     A dona: "ao abrir um perfil de candidato, colocar um check na frente
     das especificações que batem com a vaga."

     Quem chega pela lista de candidatos de uma vaga traz `?vaga=` na
     URL. Sem esse parâmetro (banco de talentos, favoritos, link
     compartilhado) não há com o que comparar, e a ficha aparece limpa,
     como sempre foi.

     A vaga é lida à parte e em silêncio: ela é um enfeite útil, e
     derrubar a ficha da pessoa porque a vaga não carregou seria trocar o
     essencial pelo acessório. */
  const vagaId = busca.get("vaga");
  const [vagaDeOrigem, setVagaDeOrigem] = useState<JobListing | null>(null);

  useEffect(() => {
    if (!vagaId) return;
    let vivo = true;
    obterVaga(vagaId)
      .then((v) => vivo && setVagaDeOrigem(v))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [vagaId]);

  useTituloDaPagina(p?.name ?? "Profissional");

  useEffect(() => {
    if (!respostaId) return;
    lerStatusDaResposta(respostaId)
      .then(setMarca)
      /* Sem marca conhecida os três botões ficam apagados, que é o mesmo
         que "ainda não decidi" — e marcar continua funcionando. */
      .catch(() => setMarca(null));
  }, [respostaId]);

  async function marcar(status: JobResponse["status"]) {
    if (!respostaId || marcando) return;
    setMarcando(true);
    setErro("");
    try {
      await marcarResposta(respostaId, status);
      setMarca(status);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não consegui marcar agora."));
    } finally {
      setMarcando(false);
    }
  }

  /**
   * Registra a visita, se quem está olhando for uma empresa.
   *
   * Só o lado de quem CONTRATA gera visita: um profissional espiando o
   * cadastro de outro não é notícia para ninguém, e apareceria na tela do
   * outro como "uma empresa te viu" — o que seria falso.
   *
   * A conferência de que a empresa é mesmo desta conta acontece no banco
   * (a função da 0106 roda como `security definer` e checa o dono). Aqui
   * é só descobrir QUAL empresa está aberta.
   */
  async function registrarVisitaSePossivel() {
    if (!user || !id) return;
    try {
      const empresa = await empresaAtual(user.id);
      if (empresa) await registrarVisita(id, empresa.id);
    } catch {
      /* silêncio proposital */
    }
  }

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
          /* A lista é escrita à mão, uma coluna a uma: coluna nova que
             ninguém acrescente aqui chega indefinida, sem erro nenhum — e
             o campo some da tela como se a pessoa não o tivesse
             preenchido. */
          .select(
            "id, name, photo_url, phone, whatsapp, neighborhood, city, uf, bio, " +
              "categories, areas_de_interesse, especialidade, disponivel, whatsapp_verified, " +
              "idade, pretensao_centavos, pretensao_combinar, pretensao_periodo, " +
              "disponibilidade, aceita_viajar, fim_de_semana, inicio_imediato, " +
              "modo_trabalho, cnh, cnh_categorias, primeiro_emprego, pcd"
          )
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;

        /* ── REGISTRA QUE ESTA EMPRESA VIU ESTE CADASTRO ─────────────
           A dona: "criar opção do candidato ver que a empresa visualizou
           seu perfil."

           Fica aqui, e não num efeito à parte, porque é exatamente este
           o momento: o cadastro foi encontrado e a tela dele abriu. E vem
           DEPOIS do `throw`: uma tela que não abriu não é uma visita.

           Não é esperado (`void`) e nunca levanta erro — quem está aqui
           veio ver o cadastro, e derrubar isso por causa de uma
           contabilidade que não é dela seria a troca errada. */
        void registrarVisitaSePossivel();

        /* Se esta pessoa já está guardada. Sem `await`: o coração aceso é
           detalhe, e a tela não espera por ele para abrir. */
        if (user) {
          lerFavoritos(user.id).then((f) => setFavorito(f.pessoas.has(id!)));
        }
        if (!data) {
          /* Não achou é diferente de deu erro: quem ficou oculto some da
             view pública, e o certo é dizer isso — não fingir defeito. */
          setP(null);
          return;
        }
        setP(data as unknown as Publico);

        const [{ data: exps }, { data: curs }, { data: comps }] = await Promise.all([
          sb
            .from("professional_experiences")
            .select("*")
            .eq("professional_id", id)
            .order("ordem", { ascending: true }),
          sb
            .from("professional_courses")
            .select("nome, instituicao, ano, tipo, nivel, situacao")
            .eq("professional_id", id)
            .order("ordem", { ascending: true }),
          sb
            .from("professional_skills")
            .select("nome, nivel")
            .eq("professional_id", id)
            .order("ordem", { ascending: true }),
        ]);
        setExperiencias((exps ?? []) as ProfessionalExperience[]);
        setCursos((curs ?? []) as Curso[]);
        setCompetencias((comps ?? []) as Competencia[]);
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
          <Pagina titulo="Perfil" voltar="/profissionais" />
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
  /* O que ela FAZ e onde ela ACEITARIA trabalhar são duas listas no banco
     (`categories` e `areas_de_interesse`). Para quem contrata, as duas
     respondem a mesma pergunta — "dá para me ajudar nisto?" —, então elas
     aparecem juntas, sem repetição. */
  const funcoes = [
    ...new Set([...(p.categories ?? []), ...(p.areas_de_interesse ?? [])]),
  ].filter(Boolean);
  const pretensao = textoDaPretensao(
    p.pretensao_centavos,
    p.pretensao_combinar,
    p.pretensao_periodo
  );
  const formacao = cursos.filter((c) => c.tipo === "formacao");
  const outrosCursos = cursos.filter((c) => c.tipo !== "formacao");

  /* ── O QUE BATE COM A VAGA ────────────────────────────────────────
     Um visto por linha da ficha (ver `Prop` e o comentário lá). Cada
     resposta é `undefined` quando não há vaga de origem — e aí nenhum
     visto aparece.

     A regra de cada uma é a MESMA da conta de compatibilidade
     (`compatibilidade.ts`): se a ficha marcasse um visto onde a conta não
     dá ponto, a empresa veria seis vistos numa pessoa de 40% e deixaria
     de confiar nos dois números. */
  const v = vagaDeOrigem;
  const bate = {
    oficio:
      v == null
        ? undefined
        : funcoes.some((f) => {
            const n = normalizar(f);
            const alvo = normalizar(`${v.profession ?? ""} ${v.specialty ?? ""} ${v.title ?? ""}`);
            return n.length > 2 && (alvo.includes(n) || n.includes(normalizar(v.profession ?? "")));
          }),
    cidade: v == null ? undefined : normalizar(p.city ?? "") === normalizar(v.city ?? ""),
    modo:
      v == null || !v.work_modality || !p.modo_trabalho
        ? undefined
        : p.modo_trabalho === "tanto_faz" || p.modo_trabalho === v.work_modality,
    cnh:
      v == null || !v.cnh_exigida
        ? undefined
        : !!p.cnh &&
          (v.cnh_categorias.length === 0 ||
            v.cnh_categorias.some((c) => (p.cnh_categorias ?? []).includes(c))),
    viagem: v == null || !v.exige_viagem ? undefined : !!p.aceita_viajar,
    inicio: v == null || !v.available_immediately ? undefined : !!p.inicio_imediato,
    fimDeSemana: v == null || v.jornada !== "fins_de_semana" ? undefined : !!p.fim_de_semana,
    pretensao:
      v == null || (!v.salario_a_combinar && (v.salary_range_max ?? v.salary_range_min) == null)
        ? undefined
        : !!p.pretensao_combinar ||
          !!v.salario_a_combinar ||
          (p.pretensao_centavos != null &&
            p.pretensao_centavos <= (v.salary_range_max ?? v.salary_range_min ?? 0)),
    escolaridade:
      v == null || !v.escolaridade_minima
        ? undefined
        : formacao.some(
            (c) =>
              c.nivel != null &&
              ESCADA_ESCOLARIDADE.indexOf(c.nivel) >=
                ESCADA_ESCOLARIDADE.indexOf(v.escolaridade_minima!)
          ),
  };

  return (
    <div className="ei">
      <div className="ei-tela">
        {/* O coração na barra: guardar esta pessoa é a ação secundária da
            tela (a principal é o telefone), e a barra é onde o app já põe
            a ação secundária de cada página. */}
        <Pagina
          foto={p.photo_url}
          titulo={p.name}
          voltar="/profissionais"
          acao={
            <BotaoFavorito
              pessoa={p.id}
              marcado={favorito}
              rotulo={p.name}
              aoMudar={setFavorito}
            />
          }
        >
          <div className="ei-props">
            <Prop rotulo="Situação">
              {p.disponivel === false ? (
                <span className="ei-selo ei-selo-cinza">Ocupado agora</span>
              ) : (
                <span className="ei-selo ei-selo-verde">Disponível</span>
              )}
            </Prop>
            {/* As duas declarações da pessoa (0114 e 0115). Estavam só na
                lista de compatíveis, e é AQUI que a empresa decide se
                liga: quem abre o cadastro inteiro e não vê "está no
                primeiro emprego" liga esperando experiência e desliga em
                trinta segundos — para os dois lados é pior. */}
            {(p.primeiro_emprego || p.pcd) && (
              <Prop rotulo="Também">
                <span className="ei-chips">
                  {p.primeiro_emprego && (
                    <span className="ei-selo ei-selo-laranja">Primeiro emprego</span>
                  )}
                  {p.pcd && <span className="ei-selo ei-selo-verde">PCD</span>}
                </span>
              </Prop>
            )}
            <Prop rotulo="Onde" bate={bate.cidade}>
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
        {/* ── OS DOIS CONTATOS, EMPILHADOS — 04/09 ─────────────────────
            A dona: "essa tela está muito quebrada, faça os botões
            melhores."

            Eram duas colunas de mesma largura, e "Chamar no WhatsApp" não
            cabia em metade de um celular de 390px: o texto era cortado no
            meio da palavra ("Chamar no WhatsAp"). Botão com o nome cortado
            é o defeito que mais parece app mal feito, porque não há como
            confundir com outra coisa.

            Agora são dois botões de largura cheia, um em cima do outro. O
            WhatsApp em laranja porque é o que quase todo mundo usa aqui —
            e é a ação que esta tela existe para permitir. */}
        {telefone && (
          <div className="ei-contatos ei-margem">
            <a
              className="ei-btn-laranja"
              style={{ margin: 0, width: "100%" }}
              href={`https://wa.me/55${soDigitos(telefone)}?text=${encodeURIComponent(
                /* O texto é o que a dona escreveu, palavra por palavra
                   (04/09): "Olá, achei seu perfil no Ei Emprego, você tem
                   interesse em conversar sobre uma oportunidade?".

                   Sem o primeiro nome no começo, que era o que estava
                   aqui: a pergunta no fim é o que faz a pessoa responder,
                   e um "Olá, Maria!" antes dela só empurra a pergunta
                   para a segunda linha da prévia da conversa. */
                "Olá, achei seu perfil no Ei Emprego, você tem interesse em conversar sobre uma oportunidade?"
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span style={{ display: "grid", placeItems: "center", width: 20, height: 20, flex: "none" }}>
                <IconeConversa />
              </span>
              Chamar no WhatsApp
            </a>
            <a
              className="ei-btn ei-btn-contorno ei-btn-largo ei-btn-alto"
              href={`tel:+55${soDigitos(telefone)}`}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <span style={{ display: "grid", placeItems: "center", width: 20, height: 20, flex: "none" }}>
                <IconeFone />
              </span>
              Ligar para {primeiroNome(p.name)}
            </a>
          </div>
        )}

        {/* Os três botões da triagem. Ficam DEPOIS do contato de propósito:
            a marca é o que a empresa faz depois de olhar (e às vezes depois
            de ligar), e antes dos contatos ela roubaria o lugar da ação que
            esta tela existe para permitir.

            Marcado, o botão fica aceso — é o que responde "eu já decidi
            sobre esta pessoa?" quando a empresa volta ao mesmo perfil dias
            depois. Dá para trocar a marca a qualquer momento: triagem não é
            porta que tranca. */}
        {respostaId && (
          <div className="ei-margem" style={{ marginTop: 18 }}>
            <p className="ei-apoio" style={{ margin: "0 0 8px" }}>
              O que você achou desta pessoa para a vaga?
            </p>
            <div className="ei-triagem">
              {(
                [
                  { chave: "accepted", rotulo: "Gostei" },
                  { chave: "read", rotulo: "Analisando" },
                  { chave: "rejected", rotulo: "Não é para a vaga" },
                ] as { chave: JobResponse["status"]; rotulo: string }[]
              ).map((b) => (
                <button
                  key={b.chave}
                  type="button"
                  className="ei-chip"
                  aria-pressed={marca === b.chave}
                  disabled={marcando}
                  onClick={() => marcar(b.chave)}
                >
                  {b.rotulo}
                </button>
              ))}
            </div>
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
          {/* A especialidade é o recorte dentro do ofício — "telhados",
              "pintura de portão". Estava sendo mostrada só quando NÃO
              havia função nenhuma, que é justamente quando ela não
              acrescenta nada. */}
          {p.especialidade && funcoes.length > 0 && (
            <p className="ei-apoio" style={{ marginTop: 10 }}>
              Especialidade: {p.especialidade}
            </p>
          )}
        </div>

        {/* O resumo que a pessoa escreveu sobre si. Vem logo depois das
            funções porque é o único texto do cadastro em que ela fala com
            as próprias palavras — e é o que a empresa lê antes de decidir
            se liga. */}
        {p.bio?.trim() && (
          <>
            <h2 className="ei-secao">Sobre ela</h2>
            <div className="ei-cartao">
              <p className="ei-corpo" style={{ margin: 0, whiteSpace: "pre-line" }}>
                {p.bio}
              </p>
            </div>
          </>
        )}

        {/* ── O QUE ELA QUER, E O QUE PODE ────────────────────────────
            Tudo isto já estava no cadastro (0101 e 0103) e não aparecia em
            lugar nenhum para quem contrata: pretensão, horários, viagem,
            fim de semana, começar imediato, CNH, idade.

            Cada linha só existe quando tem resposta. Uma ficha cheia de
            "não informado" não informa mais que uma ficha curta — e aqui
            ela ainda faria a pessoa parecer descuidada, o que é injusto
            com quem simplesmente não quis responder. */}
        {(pretensao ||
          p.modo_trabalho ||
          (p.disponibilidade?.length ?? 0) > 0 ||
          p.aceita_viajar ||
          p.fim_de_semana ||
          p.inicio_imediato ||
          p.cnh ||
          p.idade != null) && (
          <>
            <h2 className="ei-secao">O que ela procura</h2>
            <div className="ei-props">
              {pretensao && (
                <Prop rotulo="Pretensão" bate={bate.pretensao}>
                  {pretensao}
                </Prop>
              )}
              {p.modo_trabalho && (
                <Prop rotulo="Trabalho" bate={bate.modo}>{nomeDoModo(p.modo_trabalho)}</Prop>
              )}
              {(p.disponibilidade?.length ?? 0) > 0 && (
                <Prop rotulo="Horários">
                  <span className="ei-chips">
                    {p.disponibilidade!.map((d) => (
                      <span key={d} className="ei-selo ei-selo-cinza">
                        {d}
                      </span>
                    ))}
                  </span>
                </Prop>
              )}
              {p.inicio_imediato && (
                <Prop rotulo="Começa" bate={bate.inicio}>Pode começar imediato</Prop>
              )}
              {p.fim_de_semana && (
                <Prop rotulo="Fim de semana" bate={bate.fimDeSemana}>Aceita trabalhar</Prop>
              )}
              {p.aceita_viajar && (
                <Prop rotulo="Viagem" bate={bate.viagem}>Aceita viajar</Prop>
              )}
              {p.cnh && (
                <Prop rotulo="CNH" bate={bate.cnh}>
                  {(p.cnh_categorias?.length ?? 0) > 0
                    ? `Categoria ${p.cnh_categorias!.join(", ")}`
                    : "Tem habilitação"}
                </Prop>
              )}
              {/* A IDADE, e nunca a data de nascimento: é o que o cadastro
                  promete a quem preenche ("a empresa vê só a sua idade"). */}
              {p.idade != null && <Prop rotulo="Idade">{p.idade} anos</Prop>}
            </div>
          </>
        )}

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

        {/* Formação e cursos vinham juntos numa lista só chamada "Cursos".
            São coisas diferentes para quem contrata: escolaridade é
            requisito de vaga (a compatibilidade compara), curso é
            diferencial. A 0104 já separa os dois por `tipo`. */}
        {formacao.length > 0 && (
          <>
            <h2 className="ei-secao">Formação</h2>
            <div>
              {formacao.map((c, i) => (
                <div key={i} className="ei-linha-item" style={{ cursor: "default" }}>
                  <span className="ei-linha-nome">
                    {c.nome}
                    {(c.instituicao || c.ano || c.situacao) && (
                      <span className="ei-linha-sub">
                        {[c.instituicao, c.ano, nomeDaSituacao(c.situacao)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {outrosCursos.length > 0 && (
          <>
            <h2 className="ei-secao">Cursos</h2>
            <div>
              {outrosCursos.map((c, i) => (
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

        {competencias.length > 0 && (
          <>
            <h2 className="ei-secao">Competências</h2>
            <div className="ei-cartao">
              <div className="ei-chips">
                {competencias.map((c, i) => (
                  <span key={i} className="ei-selo ei-selo-cinza">
                    {c.nome}
                    {c.nivel ? ` · ${nomeDoNivel(c.nivel)}` : ""}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {/* A propaganda do plano saiu daqui — 04/09
            ─────────────────────────────────────────
            A dona: "tirar 'falar um por um funciona para uma
            contratação...' tirar isso dentro do perfil das pessoas."

            Era um convite a publicar vaga no fim do perfil de CADA pessoa.
            Quem abre um perfil está decidindo se chama AQUELA pessoa — e
            recebia, no lugar do telefone dela, um anúncio dizendo que
            existe um jeito melhor. O caminho para o plano continua em
            "Meu plano" e na tela de criar vaga, que são as telas de quem
            já quer isso. */}

        {/* Denunciar — mesmo motivo da tela da vaga (ver o comentário
            longo em VagaAbertaPage): a Play exige um jeito de denunciar
            dentro do app para conteúdo feito por usuário, e sem isso a
            administração só descobre um cadastro falso depois que alguém
            já foi enganado.

            Fica no fim, discreto e sem cor: quem abre um perfil quase
            sempre veio contratar, e um botão vermelho de denúncia no alto
            trataria toda pessoa cadastrada como suspeita. */}
        <div className="ei-margem" style={{ marginTop: 30, marginBottom: 8 }}>
          {/* ── VAI PARA O PAINEL, E NÃO PARA O WHATSAPP — 05/09 ─────
              A dona: "a situação de denunciar o perfil deve ser
              direcionado ao painel administrativo, com a solicitação e
              descrição para que eu veja e tenha a possibilidade de tirar a
              vaga ou o usuário do ar." Ver o comentário longo em
              `DenunciarPage`. */}
          <Link className="ei-btn ei-btn-texto ei-denunciar" to={`/denunciar/perfil/${p.id}`}>
            Denunciar este cadastro
          </Link>
        </div>
      </div>
    </div>
  );
}

/** "R$ 1.800 por mês", "a combinar", ou vazio quando não respondeu. */
function textoDaPretensao(
  centavos: number | null,
  combinar: boolean | null,
  periodo: string | null
): string {
  if (combinar) return "A combinar";
  if (centavos == null) return "";
  const valor = (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  });
  const quando =
    periodo === "dia" ? " por dia" : periodo === "hora" ? " por hora" : " por mês";
  return valor + quando;
}

function nomeDoModo(v: string): string {
  return v === "remoto"
    ? "De casa"
    : v === "hibrido"
      ? "Parte no local, parte de casa"
      : v === "tanto_faz"
        ? "Tanto faz"
        : "No local da empresa";
}

function nomeDaSituacao(v: string | null): string {
  return v === "cursando"
    ? "cursando"
    : v === "trancado"
      ? "trancado"
      : v === "concluido"
        ? "concluído"
        : "";
}

function nomeDoNivel(v: string): string {
  return v === "avancado" ? "avançado" : v === "intermediario" ? "intermediário" : "básico";
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
