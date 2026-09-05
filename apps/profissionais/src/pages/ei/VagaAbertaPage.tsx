import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { obterVaga } from "../../lib/company";
import {
  CANDIDATURAS_POR_DIA,
  podeSeCandidatar,
  responderVaga,
} from "../../lib/minhasVagas";
import { BottomSheet } from "../../components/BottomSheet";
import { lerMeuPerfil } from "../../lib/meuPerfil";
import { supabase } from "../../lib/supabase";
import { mensagemDeErro } from "../../lib/erros";
import { Callout, Pagina } from "../../components/ei/Pagina";
import { FichaDaVaga } from "../../components/ei/FichaDaVaga";
import { BotaoCompartilhar } from "../../components/ei/BotaoCompartilhar";
import {
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
  /* Bateu o teto de candidaturas do dia. Ver `podeSeCandidatar`. */
  const [lotado, setLotado] = useState(false);

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
        /* ── A FRASE DA EMPRESA VEM À PARTE — 04/09 ──────────────────
           Isto era UMA consulta que pedia `description` junto do resto. Só
           que essa coluna não está na view desde que ela nasceu (0100), e
           o PostgREST recusa a consulta INTEIRA quando uma coluna pedida
           não existe. Então não era a frase que sumia: era a empresa —
           nome, foto e endereço saíam da tela junto, e a vaga aparecia com
           "Empresa" escrito no lugar do nome, em produção, para todo
           mundo.

           Não apareceu em teste nenhum porque o Supabase de mentira que
           roda o app nesta máquina devolve o objeto inteiro e ignora a
           lista de colunas pedidas.

           A 0115 põe a coluna na view. Enquanto ela não for aplicada, esta
           segunda consulta simplesmente falha em silêncio e a tela mostra
           a empresa sem a frase — que é muito melhor do que a tela sem a
           empresa. Depois de aplicada, a frase aparece sozinha, sem
           precisar mexer aqui de novo. */
        const { data: emp } = await sb
          .from("companies_public")
          .select("company_name, photo_url, city, uf, neighborhood")
          .eq("id", v.company_id)
          .maybeSingle();
        const { data: sobre } = await sb
          .from("companies_public")
          .select("description")
          .eq("id", v.company_id)
          .maybeSingle();
        if (emp) {
          const e = {
            ...(emp as {
              company_name?: string;
              photo_url?: string | null;
              city?: string | null;
              uf?: string | null;
              neighborhood?: string | null;
            }),
            description: (sobre as { description?: string | null } | null)?.description ?? null,
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

    /* O mesmo teto do baralho — ver `podeSeCandidatar`. As duas telas
       respondem vaga, e uma trava que só existe numa delas é uma trava
       que não existe: bastaria abrir a vaga inteira para passar por cima. */
    if (quero) {
      const t = await podeSeCandidatar(id, user.id);
      if (!t.pode) {
        setLotado(true);
        return;
      }
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

        {/* ── COMPARTILHAR, FORA DO CARTÃO — 05/09 ───────────────────
            A dona: "o compartilhar está muito fora de contexto. Ele pode
            ser um botão discreto fora do card."

            Ele morava DENTRO do cartão da vaga, na mesma linha do título —
            e ali competia com ele: "Repositor de mercadorias" quebrava em
            duas linhas espremidas de um lado enquanto "Compartilhar",
            azul e com ícone, ocupava o outro. O título da vaga é a coisa
            mais importante da tela; nada devia dividir a linha com ele.

            Agora fica no chão cinza entre os dois cartões, encostado à
            direita e pequeno. Continua no primeiro instante da tela — que
            é quando se decide mandar a vaga para alguém, numa cidade onde
            vaga circula de mão em mão — mas fora do conteúdo, como o que
            ele é: uma ação sobre a vaga, e não parte dela.

            Continua ANTES da ficha inteira, e não junto do "Tenho
            interesse" lá embaixo: aquelas são as ações de quem VAI se
            candidatar. */}
        <div className="ei-acao-solta">
          <BotaoCompartilhar
            titulo={vaga.title}
            texto={`Vaga de ${vaga.profession || vaga.title} em ${vaga.city}. Vi no Ei Emprego:`}
            caminho={`/vaga-aberta/${vaga.id}`}
          />
        </div>

        {/* 2 — A VAGA: o que é, e o que a pessoa vai fazer. */}
        {/* ══ CADA SEÇÃO NUM CARTÃO — 05/09 ══════════════════════════
            A dona: "essa tela pode ser melhorada. Cada seção ficar em um
            card. O card da empresa ter mais profundidade. Organizar
            melhor e ficar mais chamativa e intuitiva."

            O que havia: as fichas do meio (salário, horário, requisitos)
            já eram cartões brancos, mas o TÍTULO de cada uma flutuava
            solto no chão cinza acima dele — e o começo da tela, que é o
            que mais importa (título da vaga, selos, o que a pessoa vai
            fazer), não era cartão nenhum. O resultado era uma tela em que
            metade do conteúdo mora numa superfície e a outra metade no
            fundo, sem regra visível.

            Agora cada seção é um cartão fechado, com o próprio título
            dentro. Quem rola vê blocos, e não texto solto alternando com
            caixas. */}
        <section className="ei-ficha ei-ficha-capa">
        <h1 className="ei-titulo-g" style={{ paddingTop: 0 }}>
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
        {(vaga.available_immediately ||
          vaga.quantidade_vagas > 1 ||
          vaga.aceita_primeiro_emprego ||
          vaga.vaga_para_pcd) && (
          <div className="ei-chips" style={{ marginTop: 10 }}>
            {vaga.available_immediately && (
              <span className="ei-selo ei-selo-laranja">Começa logo</span>
            )}
            {vaga.quantidade_vagas > 1 && (
              <span className="ei-selo ei-selo-cinza">{vaga.quantidade_vagas} vagas</span>
            )}
            {/* ── O SELO DO PRIMEIRO EMPREGO (0114) ──────────────────
                A dona: "no perfil da vaga ter opção de escolher que pode
                ser pessoa que busca o primeiro emprego."

                Junto do título, e não no meio da ficha: para quem está
                começando, esta é a informação que decide se vale a pena
                ler o resto — e ela hoje só aparecia quando a empresa
                escrevia "não precisa de experiência" na descrição, se
                escrevesse. */}
            {vaga.aceita_primeiro_emprego && (
              <span className="ei-selo ei-selo-verde">Aceita primeiro emprego</span>
            )}
            {/* PCD (0115). Junto do título pelo mesmo motivo do primeiro
                emprego: para quem procura, esta é a informação que decide
                se vale a pena ler o resto. */}
            {vaga.vaga_para_pcd && (
              <span className="ei-selo ei-selo-verde">Aceita PCD</span>
            )}
          </div>
        )}

        {vaga.description?.trim() && (
          /* `white-space: pre-line` guarda as quebras que a empresa
             escreveu. Sem isso, uma lista de tarefas escrita em linhas vira
             um parágrafo corrido e ilegível. */
          <p className="ei-corpo" style={{ whiteSpace: "pre-line", marginBottom: 0 }}>
            {vaga.description}
          </p>
        )}
        </section>

        {/* A ficha inteira, em cartões por assunto. Vive num
            componente porque a tela da EMPRESA mostra a mesma vaga — e
            duas cópias divergem no primeiro campo novo. */}
        <FichaDaVaga vaga={vaga} />

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
            /* ── "A EMPRESA TE LIGA" SAIU — 04/09 ─────────────────────
                A dona: "está estranho."

                Duas coisas estavam erradas, e a segunda é séria.

                A forma: era a faixa de duas colunas, com o texto de um
                lado e o de outro, que lê como linha de tabela — o mesmo
                defeito já corrigido logo abaixo, no "não é para você".

                E o conteúdo: "a empresa te liga" é uma PROMESSA que o app
                não tem como cumprir. Quem está desempregado lê isso e fica
                esperando um telefone que pode nunca tocar. O que o app
                sabe de verdade é o que ele fez: entregou o nome e o
                telefone. É isso que a frase diz agora.

                E ganhou o caminho de volta que faltava: o "não quis" tinha
                "mudei de ideia" e o "tenho interesse" não tinha nada —
                quem tocou por engano ficava preso na decisão. */
            <>
              <p className="ei-nota-resposta">
                <strong>Interesse enviado.</strong> A empresa recebeu seu nome e
                seu telefone.
              </p>
              <button
                type="button"
                className="ei-btn-inline"
                style={{ marginTop: 8 }}
                disabled={enviando}
                onClick={() => responder(false)}
              >
                {enviando ? "Enviando…" : "Na verdade, não é para mim"}
              </button>
            </>
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

        {/* ── PROTEÇÃO CONTRA VAGA FALSA — 04/09 ─────────────────────────
            Duas coisas que faltavam, e a Google Play exige a segunda.

            A PRIMEIRA é a frase. O golpe de emprego falso funciona sempre
            do mesmo jeito: alguém anuncia uma vaga, chama a pessoa e pede
            dinheiro — por "taxa de cadastro", "exame admissional",
            "uniforme". Quem está desempregado há meses paga. A defesa que
            funciona não é uma cartilha: é a frase estar ali, na tela da
            vaga, no momento em que a pessoa vai responder. Ela custa uma
            linha e é a única coisa deste app que pode evitar um prejuízo
            de verdade na vida de alguém.

            A SEGUNDA é o denunciar. A Play exige, para app com conteúdo
            de usuário, um jeito de denunciar dentro do app — e sem isso o
            envio corre risco de reprovação (ver a auditoria). Mas ele não
            está aqui por causa da loja: sem denúncia, a administração só
            descobre a vaga falsa quando alguém já foi enganado.

            ── A DENÚNCIA PASSA A CHEGAR NO PAINEL — 05/09 ─────────────
            A dona: "a situação de denunciar o perfil deve ser direcionado
            ao painel administrativo, com a solicitação e descrição para
            que eu veja e tenha a possibilidade de tirar a vaga ou o
            usuário do ar."

            Isto aqui ia para o WHATSAPP com um texto pronto. O raciocínio
            de antes está escrito acima e não era errado — formulário exige
            mais de quem está desconfiado e com pressa. Só que uma conversa
            não é uma fila: não tem estado, some no meio das outras
            mensagens, e não tem o botão de tirar do ar do lado do caso.
            A tabela e a seção "Denúncias" do painel existem desde a 0007 e
            a 0008; faltava o app escrever nelas.

            O custo do formulário foi pago onde dava: motivo em botões (um
            toque), descrição curta, e o WhatsApp continua ali como saída
            para quem não confirmou o número. */}
        {/* A mesma folha do baralho, com o mesmo tom: "por hoje, chega" e
            não "você excedeu o limite". Quem procura emprego já ouve "não"
            o dia inteiro. */}
        {lotado && (
          <BottomSheet title="Por hoje, chega" onClose={() => setLotado(false)}>
            <p className="ei-corpo" style={{ marginTop: 0 }}>
              Você já se candidatou a <strong>{CANDIDATURAS_POR_DIA} vagas hoje</strong>.
              Amanhã abre outras {CANDIDATURAS_POR_DIA}.
            </p>
            <p className="ei-apoio">
              O limite existe para você chegar às empresas como alguém que
              escolheu a vaga, e não como mais um nome numa lista de trinta.
              Esta vaga continua aqui amanhã.
            </p>
            <p className="ei-apoio">
              E as vagas que o app manda para você — as que mais combinam com
              seu cadastro — <strong>não entram nessa conta</strong>.
            </p>
            <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
              <Link className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto" to="/avisos">
                Ver o que já chegou para mim
              </Link>
              <button
                type="button"
                className="ei-btn ei-btn-contorno ei-btn-largo"
                onClick={() => setLotado(false)}
              >
                Voltar para a vaga
              </button>
            </div>
          </BottomSheet>
        )}

        <div className="ei-aviso-golpe ei-margem">
          <p className="ei-aviso-golpe-texto">
            <strong>O Ei Emprego nunca cobra nada para você se candidatar.</strong>{" "}
            Nenhuma empresa séria pede dinheiro por taxa de cadastro, exame ou
            uniforme antes de contratar. Se pedirem, não pague — e nos avise.
          </p>
          <Link
            className="ei-btn ei-btn-texto ei-aviso-golpe-botao"
            to={`/denunciar/vaga/${vaga.id}`}
          >
            Denunciar esta vaga
          </Link>
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
