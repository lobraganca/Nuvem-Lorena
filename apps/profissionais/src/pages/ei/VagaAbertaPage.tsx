import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { obterVaga } from "../../lib/company";
import { responderVaga } from "../../lib/minhasVagas";
import { lerMeuPerfil } from "../../lib/meuPerfil";
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
  const [empresa, setEmpresa] = useState<{
    nome: string;
    foto: string | null;
    onde: string;
    descricao: string | null;
  } | null>(null);
  /* `undefined` = ainda não respondeu; `true`/`false` = a resposta dela.
     Três estados, como na lista — sem isso, "não quis" e "não abriu"
     mostrariam a mesma tela. */
  const [interessado, setInteressado] = useState<boolean | undefined>(undefined);
  /* O estado do cadastro de quem está olhando:
       null      → ainda lendo
       "sem"     → nunca preencheu
       "falta"   → preencheu, mas o número não está confirmado
       "ok"      → pode se candidatar
     Erro de leitura NÃO vira "sem": bloquear a candidatura por causa de uma
     consulta que caiu seria impedir a pessoa de responder por um defeito
     nosso. Nesse caso passa, e quem recusa é o banco. */
  const [cadastro, setCadastro] = useState<"sem" | "falta" | "ok" | null>(null);

  useEffect(() => {
    if (!user) return;
    let vivo = true;
    lerMeuPerfil(user.id)
      .then((p) => {
        if (!vivo) return;
        if (!p) setCadastro("sem");
        else if (!p.confirmado) setCadastro("falta");
        else setCadastro("ok");
      })
      .catch(() => vivo && setCadastro("ok"));
    return () => {
      vivo = false;
    };
  }, [user]);
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
        /* `companies_public`, e não `companies`.
           ───────────────────────────────────────
           A tabela só tem policy de leitura do PRÓPRIO DONO (0066): quem
           procura trabalho lê zero linhas aqui — sem erro, só sem
           resultado. Efeito na tela: a vaga abria com o nome e a foto da
           empresa em branco, exatamente para o público a quem ela
           interessa. É o mesmo defeito que a 0100 consertou nas duas
           listas, e que ficou de fora desta tela. */
        /* A prévia da empresa quer mais do que nome e foto — a dona: "em
           cima pode ter um prévia do perfil da empresa". O que ela faz, em
           uma linha, é o que responde "dá para confiar nesta vaga?" antes
           de qualquer especificação. */
        const { data: emp } = await sb
          .from("companies_public")
          .select("company_name, photo_url, city, uf, neighborhood, description")
          .eq("id", v.company_id)
          .maybeSingle();
        if (emp) {
          const e = emp as {
            company_name?: string;
            photo_url?: string | null;
            city?: string | null;
            uf?: string | null;
            neighborhood?: string | null;
            description?: string | null;
          };
          setEmpresa({
            nome: e.company_name ?? "",
            foto: e.photo_url ?? null,
            onde: [e.neighborhood, [e.city, e.uf].filter(Boolean).join("/")]
              .filter(Boolean)
              .join(" · "),
            descricao: e.description ?? null,
          });
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

  /* ── QUEM SE CANDIDATA PRECISA DE CADASTRO — 02/09 ───────────────────
     A dona, vendo "Cadastro fora do ar" na lista de interessados da vaga
     dela: "se for porque não tem cadastro, deve ter tudo cadastrado
     primeiro."

     Era isso mesmo. Responder à vaga só exigia CONTA — e conta é telefone
     confirmado, mais nada. Quem nunca preencheu o cadastro (ou preencheu e
     não confirmou o número) aparecia para a empresa como uma linha sem
     nome, sem telefone e sem foto: "Cadastro fora do ar". Do outro lado é
     pior do que parece — a empresa vê que alguém se interessou e não tem
     como chamar.

     Agora o cadastro é conferido ANTES: sem ele, os botões dão lugar a um
     aviso com o caminho. É o mesmo princípio do lado da empresa, que não
     publica vaga sem telefone confirmado. */
  async function responder(quero: boolean) {
    if (!user || !id) {
      /* Sem conta não dá para responder, e mandar embora sem explicação
         faria parecer defeito. A tela de entrar sabe voltar para cá. */
      navegar("/login?lado=trabalhar");
      return;
    }
    /* A trava vale para o SIM. O "não é para mim" continua livre: ele
       serve para o app parar de mostrar a vaga, e exigir cadastro para
       alguém dizer "não quero" seria cobrar trabalho para recusar. */
    if (quero && cadastro !== "ok") {
      navegar("/painel?motivo=candidatura");
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
          <Pagina titulo="Vaga" voltar="/vagas-para-mim" />
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
        {/* A volta agora mora DENTRO da barra de topo (ver `Pagina`), como
            nos prints do Conta Azul. Aqui ela era uma linha só dela, acima
            do título — uma fileira inteira da tela para uma seta. */}

        {/* 1 — A EMPRESA, com a logo. Abre a tela — e agora LEVA a algum
            lugar (a dona: "o candidato pode acessar o perfil da empresa e
            ver as vagas que estão em aberto").

            Antes este bloco era o mais visível da tela e não era clicável:
            "que empresa é essa" é a primeira pergunta de quem lê uma vaga
            numa cidade pequena, e a resposta ficava com o nome escrito e
            nenhum caminho. */}
        {/* 04/09: virou uma PRÉVIA do perfil, e não só o nome — a dona:
            "em cima pode ter um prévia do perfil da empresa e depois todos
            os dados que a vaga teve de preenchimento pelo dono."

            O que a prévia acrescentou foi a frase que a empresa escreveu
            sobre si, em duas linhas: numa cidade pequena, "quem é essa
            empresa" decide se a pessoa continua lendo — e o nome sozinho
            não responde isso quando a empresa é nova. */}
        <Link to={`/empresa/${vaga.company_id}`} className="ei-empresa-topo ei-empresa-topo-link">
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
              {empresa?.onde ||
                `${vaga.neighborhood ? `${vaga.neighborhood} · ` : ""}${vaga.city}/${vaga.uf}`}
            </span>
            {empresa?.descricao?.trim() && (
              <span className="ei-empresa-topo-sobre">{empresa.descricao}</span>
            )}
            <span className="ei-empresa-topo-ver">Ver o perfil e as outras vagas</span>
          </span>
          {/* A seta diz que dá para tocar. Sem ela o bloco vira um link
              que ninguém descobre — e um link que ninguém descobre é o
              mesmo que não existir. */}
          <span className="ei-linha-seta" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </Link>

        {/* 2 — A VAGA: o que é, e o que a pessoa vai fazer. */}
        <h1 className="ei-titulo-g" style={{ paddingTop: 18 }}>
          {vaga.title}
        </h1>

        {/* ── A FRASE DE ABERTURA SAIU — 04/09 ────────────────────────
            A dona: "essa frase de início está horrível."

            Era um quadro cinza de largura cheia, logo abaixo do título,
            com "A empresa precisa de alguém para começar logo." — o
            primeiro bloco da tela, do tamanho de um aviso importante, para
            dizer uma coisa que é um detalhe da vaga.

            Vira um selo junto do título, do lado das outras marcas: a
            informação continua, com o peso que ela tem. */}
        {(vaga.available_immediately || vaga.quantidade_vagas > 1) && (
          <div className="ei-margem ei-chips" style={{ marginTop: 8 }}>
            {vaga.available_immediately && (
              <span className="ei-selo ei-selo-laranja">Começa logo</span>
            )}
            {vaga.quantidade_vagas > 1 && (
              <span className="ei-selo ei-selo-cinza">{vaga.quantidade_vagas} vagas</span>
            )}
          </div>
        )}

        {vaga.description?.trim() && (
          /* `white-space: pre-line` guarda as quebras que a empresa
             escreveu. Sem isso, uma lista de tarefas escrita em linhas vira
             um parágrafo corrido e ilegível. */
          <p className="ei-corpo ei-margem" style={{ whiteSpace: "pre-line" }}>
            {vaga.description}
          </p>
        )}

        {/* ── 3. A FICHA, EM SEÇÕES — 04/09 ─────────────────────────
            A dona: "depois todos os dados que a vaga teve de preenchimento
            pelo dono, separado por seções."

            Era uma lista só, com o título "Especificações", empilhando
            catorze linhas de assuntos diferentes: salário, horário, CNH,
            idiomas, benefícios. Quem procurava uma coisa lia todas.

            As seções são as MESMAS do formulário que a empresa preencheu —
            dinheiro, horário e local, requisitos, datas. Duas telas com a
            mesma ordem se leem sem reaprender, e é a ordem em que a
            própria empresa pensou a vaga.

            Cada seção só existe quando tem alguma linha: uma ficha cheia
            de "não informado" não informa mais que uma ficha curta — só faz
            a empresa parecer descuidada. A exceção é o SALÁRIO, que
            aparece ausente dizendo que está ausente, porque escondê-lo não
            o torna menos ausente: torna a vaga mais suspeita. */}
        <div className="ei-secao">
          <h2>Salário e benefícios</h2>
        </div>
        <div className="ei-props">
          <Prop rotulo="Salário">
            {salario ?? <span className="ei-apoio">A empresa não informou</span>}
          </Prop>
          {vaga.comissao && <Prop rotulo="Comissão">{vaga.comissao}</Prop>}
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
          {vaga.outros_beneficios && (
            <Prop rotulo="Também oferece">{vaga.outros_beneficios}</Prop>
          )}
        </div>

        <div className="ei-secao">
          <h2>Horário e local</h2>
        </div>
        <div className="ei-props">
          <Prop rotulo="Contratação">
            {contrato ?? <span className="ei-apoio">A empresa não informou</span>}
          </Prop>
          <Prop rotulo="Horário">
            {jornada ?? <span className="ei-apoio">A empresa não informou</span>}
          </Prop>
          {vaga.horario && <Prop rotulo="Que horas">{vaga.horario}</Prop>}
          {vaga.escala && <Prop rotulo="Escala">{vaga.escala}</Prop>}
          {/* O JEITO de trabalhar, e não o endereço: o endereço já está
              embaixo do nome da empresa, lá em cima. O que falta saber
              aqui é se a pessoa vai até lá todo dia. */}
          <Prop rotulo="Trabalho">
            {vaga.work_modality === "remoto"
              ? "De casa"
              : vaga.work_modality === "hibrido"
                ? "Parte no local, parte de casa"
                : "No local da empresa"}
          </Prop>
          {vaga.exige_viagem && <Prop rotulo="Viagem">A vaga exige viajar</Prop>}
          {vaga.aceita_outras_cidades === false && (
            <Prop rotulo="De onde">Só quem mora em {vaga.city}</Prop>
          )}
        </div>

        <div className="ei-secao">
          <h2>O que a vaga pede</h2>
        </div>
        <div className="ei-props">
          <Prop rotulo="Experiência">
            {vaga.required_experience || "Não precisa de experiência"}
          </Prop>
          {vaga.escolaridade_minima && (
            <Prop rotulo="Escolaridade">{nomeDaEscolaridade(vaga.escolaridade_minima)}</Prop>
          )}
          {vaga.curso_especifico && <Prop rotulo="Curso">{vaga.curso_especifico}</Prop>}
          {vaga.cnh_exigida && (
            <Prop rotulo="CNH">
              {vaga.cnh_categorias.length > 0
                ? `Categoria ${vaga.cnh_categorias.join(", ")}`
                : "Precisa ter"}
            </Prop>
          )}
          {vaga.idiomas?.length > 0 && (
            <Prop rotulo="Idiomas">{vaga.idiomas.join(", ")}</Prop>
          )}
        </div>

        {/* As datas ficam por último e juntas: são as duas linhas que a
            pessoa confere DEPOIS de decidir que quer — e "responder até" é
            o que faz responder hoje em vez de deixar para depois, que é
            como se perde uma vaga. */}
        {(vaga.data_inicio || vaga.prazo_candidatura) && (
          <>
            <div className="ei-secao">
              <h2>Datas</h2>
            </div>
            <div className="ei-props">
              {vaga.data_inicio && (
                <Prop rotulo="Começa em">
                  {new Date(`${vaga.data_inicio}T12:00:00`).toLocaleDateString("pt-BR")}
                </Prop>
              )}
              {vaga.prazo_candidatura && (
                <Prop rotulo="Responder até">
                  {new Date(`${vaga.prazo_candidatura}T12:00:00`).toLocaleDateString("pt-BR")}
                </Prop>
              )}
            </div>
          </>
        )}

        {/* As informações complementares vêm DEPOIS da ficha, e como
            parágrafo: é texto corrido escrito pela empresa, e espremê-lo
            numa linha de "rótulo à esquerda, valor à direita" cortaria a
            frase no meio. */}
        {vaga.observacoes?.trim() && (
          <>
            <div className="ei-secao">
              <h2>Mais sobre a vaga</h2>
            </div>
            <p className="ei-corpo ei-margem" style={{ whiteSpace: "pre-line" }}>
              {vaga.observacoes}
            </p>
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
              {/* O aviso aparece no lugar do "tenho interesse", e não como
                  um erro DEPOIS do toque: a pessoa precisa saber o que
                  falta antes de tentar, e o caminho tem que estar do lado
                  da frase. */}
              {user && (cadastro === "sem" || cadastro === "falta") && (
                <Callout atencao>
                  <strong>
                    {cadastro === "sem"
                      ? "Preencha seu cadastro para se candidatar."
                      : "Confirme seu telefone para se candidatar."}
                  </strong>{" "}
                  {cadastro === "sem"
                    ? "A empresa precisa do seu nome e do seu telefone para te chamar — sem isso, você aparece para ela como um cadastro fora do ar."
                    : "É por ele que a empresa vai te chamar."}{" "}
                  <Link to="/painel" className="ei-btn-inline">
                    {cadastro === "sem" ? "Preencher agora" : "Confirmar agora"}
                  </Link>
                </Callout>
              )}
              {/* Laranja, a pedido da dona — e é o certo: o laranja é a
                  cor de AÇÃO deste app (o "+ Nova vaga" do outro lado usa
                  ela), e aqui está a única coisa que a pessoa veio fazer
                  nesta tela. Em azul ele competia com todos os links. */}
              <button
                type="button"
                className="ei-btn-laranja"
                /* Sem a margem lateral da classe: ela existe para o botão
                   que mora DENTRO de um cartão (o "+ Nova vaga"), e aqui o
                   bloco já tem a margem da tela — somadas, o botão ficava
                   40px mais estreito que os outros. */
                style={{ margin: 0, width: "100%" }}
                disabled={enviando || (!!user && (cadastro === "sem" || cadastro === "falta"))}
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

/**
 * "medio" vira "Ensino médio".
 *
 * O banco guarda o valor curto porque é ele que se compara com a formação
 * do candidato (0104 e 0105); a tela mostra a palavra que a pessoa usa.
 * Um valor desconhecido volta como veio — melhor mostrar "tecnico" torto
 * do que sumir com a exigência da vaga.
 */
function nomeDaEscolaridade(v: string): string {
  const nomes: Record<string, string> = {
    fundamental: "Ensino fundamental",
    medio: "Ensino médio",
    tecnico: "Técnico",
    superior: "Superior",
    pos: "Pós-graduação",
    mestrado: "Mestrado",
    doutorado: "Doutorado",
  };
  return nomes[v] ?? v;
}
