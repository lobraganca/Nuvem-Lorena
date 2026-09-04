import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { lerMeuPerfil } from "../lib/meuPerfil";
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
import { getProfile } from "../lib/profiles";
import { Abas, Callout, Pagina } from "../components/ei/Pagina";
import { nomeDoContrato, salarioEmTexto } from "../types/domain";
import { IconeInicio } from "../components/IconesInicio";
import Esqueleto from "../components/ei/Esqueleto";

/**
 * "Vagas para você" — o que chegou para este profissional.
 *
 * Esta tela é o aviso de verdade; o push é só o empurrão para abri-la mais
 * cedo. A ordem importa: push alcança só quem instalou o app e aceitou
 * receber, e no iPhone só quem adicionou à tela de início. Se a vaga
 * existisse apenas como notificação, quem não tem push nunca ficaria
 * sabendo — e, pior, não teria como saber que está perdendo vaga.
 *
 * O desenho é o do `estilo-ei.css`, e o cartão de vaga é COMPOSTO: tarja,
 * título, faixa interna, etiquetas, botão largo. A dona olhou a versão
 * anterior — caixa branca com texto empilhado dentro — e disse que os
 * cartões ainda pareciam os do procurô. Estava certa: um cartão sem
 * anatomia é o mesmo cartão em qualquer app, mude-se a cor que mudar.
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
  /* Quais chegaram sem terem sido vistas ANTES desta visita. Guardado numa
     lista própria porque a primeira coisa que a tela faz é marcar todas
     como vistas — se o selo "Nova" lesse `visto_em`, ele sumiria no mesmo
     instante em que a pessoa abriu, sem nunca ter sido visto por ela. */
  const [novas, setNovas] = useState<Set<string>>(new Set());
  /* O filtro da fileira de cima. "novas" é o que a pessoa abre o app para
     ver; "respondidas" é a pergunta que ela faz depois ("eu já mandei?"),
     e sem ele a única resposta era rolar a lista inteira relendo cartão. */
  const [aba, setAba] = useState<"todas" | "novas" | "respondidas">("todas");
  /* A dona: "o filtro para as vagas tem de ter a opção de escrever nome
     da empresa ou da vaga." O Banco de vagas já tinha esse campo; esta
     lista, que é mais curta, nunca precisou dele até crescer. */
  const [busca, setBusca] = useState("");
  /* O nome vem do PERFIL, e não do `user_metadata`: quem entra pelo
     telefone chega sem nome nenhum no Auth — só o Google traz — e a
     saudação sairia "Olá," seco para a maioria das pessoas. */
  const [nome, setNome] = useState("");

  useEffect(() => {
    if (carregandoConta) return;
    if (!user) {
      navegar("/login", { replace: true });
      return;
    }

    vagasParaMim(user.id)
      .then((lista) => {
        setVagas(lista);
        setNovas(new Set(lista.filter((v) => !v.visto_em).map((v) => v.aviso_id)));
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

  useEffect(() => {
    /* Erro aqui não aparece na tela e nem deve: a saudação é enfeite, e
       derrubar a lista de vagas por causa de um nome seria trocar o que
       importa pelo que não importa. */
    if (user) getProfile(user.id).then((p) => setNome(p?.full_name ?? "")).catch(() => {});
  }, [user]);

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

  /* Ver o comentário em `responder`. Erro de leitura vira "ok": barrar a
     candidatura por causa de uma consulta que caiu seria punir a pessoa por
     um defeito nosso, e quem recusa de verdade é o banco. */
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

  async function responder(v: VagaParaMim, interessado: boolean) {
    if (!user) return;
    /* Mesma trava da tela da vaga (02/09): sem cadastro preenchido e
       telefone confirmado, a empresa recebe uma linha sem nome nem
       telefone — "Cadastro fora do ar" — e não tem como chamar ninguém.
       Vale só para o SIM: dizer "não é para mim" continua livre. */
    if (interessado && cadastro !== "ok") {
      navegar("/painel?motivo=candidatura");
      return;
    }
    setRespondendo(v.vaga.id);
    setErro("");
    try {
      await responderVaga(v.vaga.id, user.id, interessado);
      setVagas((atual) =>
        atual.map((x) =>
          x.vaga.id === v.vaga.id ? { ...x, respondida: true, interessado } : x
        )
      );
    } catch (err) {
      setErro(
        mensagemDeErro(
          err,
          interessado
            ? "Não consegui enviar seu interesse."
            : "Não consegui guardar sua resposta."
        )
      );
    } finally {
      setRespondendo(null);
    }
  }

  if (carregandoConta || carregando) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <Esqueleto />
        </div>
      </div>
    );
  }

  const permissao = situacaoDaPermissao();
  const podeOferecerAviso =
    pushServeAqui() && permissao === "default" && !avisoLigado && vagas.length > 0;

  /* Só o primeiro nome, e sem o sobrenome: "Olá, Joana Ferreira de Souza,"
     não é como ninguém cumprimenta ninguém. Vazio quando não há nome — a
     saudação continua funcionando com um "Olá," seco. */
  const primeiroNome = (nome || user?.user_metadata?.full_name || "").trim().split(/\s+/)[0];

  const quantasNovas = vagas.filter((v) => novas.has(v.aviso_id) && !v.respondida).length;
  const quantasRespondidas = vagas.filter((v) => v.respondida).length;

  const daAba =
    aba === "novas"
      ? vagas.filter((v) => novas.has(v.aviso_id) && !v.respondida)
      : aba === "respondidas"
        ? vagas.filter((v) => v.respondida)
        : vagas;

  const t = busca.trim().toLocaleLowerCase("pt-BR");
  const mostradas = t
    ? daAba.filter(
        (v) =>
          v.vaga.title.toLocaleLowerCase("pt-BR").includes(t) ||
          v.empresa.toLocaleLowerCase("pt-BR").includes(t)
      )
    : daAba;

  return (
    <div className="ei">
      <div className="ei-tela">
        {/* Cabeçalho de página do Notion: migalha, ícone e título. */}
        <Pagina titulo="Vagas" />

        {/* A dona: "o filtro para as vagas tem de ter a opção de
            escrever nome da empresa ou da vaga." Mesmo campo do Banco de
            vagas (`ei-busca`), e só aparece com mais de uma vaga — com
            uma só não há o que filtrar. */}
        {vagas.length > 1 && (
          <div className="ei-busca" style={{ marginTop: 14 }}>
            <IconeLupa />
            <input
              type="search"
              placeholder="Procurar"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Procurar por empresa ou vaga"
            />
            {busca && (
              <button
                type="button"
                className="ei-busca-limpar"
                aria-label="Limpar a busca"
                onClick={() => setBusca("")}
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Abas de visão, como numa base de dados do Notion: texto com um
            traço embaixo da aberta. Eram pílulas pretas, que pesavam mais
            que a lista que filtravam. */}
        {vagas.length > 1 && (
          <Abas
            valor={aba}
            aoTrocar={setAba}
            opcoes={[
              { chave: "todas", rotulo: "Todas", contagem: vagas.length },
              { chave: "novas", rotulo: "Novas", contagem: quantasNovas },
              { chave: "respondidas", rotulo: "Já respondi", contagem: quantasRespondidas },
            ]}
          />
        )}

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 16 }} role="alert">
            {erro}
          </p>
        )}

        {/* O convite para ligar o aviso vem DEPOIS de existir vaga na lista, e
            nunca ao abrir o app pela primeira vez. No celular a recusa é
            definitiva — não há segunda caixa de diálogo, nem jeito de voltar
            atrás sem ir nas configurações do sistema. Pedir antes de a pessoa
            entender para quê é gastar a única chance que existe. */}
        {podeOferecerAviso && (
          /* Um callout — o bloco do Notion para o que precisa ser lido
             antes do resto. Era um cartão com título, quatro linhas de
             parágrafo e um botão largo, mais texto que qualquer vaga da
             lista para uma coisa secundária. */
          <Callout icone={<IconeInicio nome="sino" tamanho={17} />}>
            <button type="button" className="ei-btn-inline" disabled={ligandoAviso} onClick={ligarAviso}>
              {ligandoAviso ? "Ligando…" : "Avisar no celular"}
            </button>{" "}
            quando chegar vaga do seu ofício.
          </Callout>
        )}

        {avisoLigado && (
          <Callout>Aviso ligado neste aparelho.</Callout>
        )}

        {vagas.length === 0 ? (
          <div className="ei-cartao" style={{ marginTop: 20, padding: 0 }}>
            <div className="ei-vazio">
              <span className="ei-vazio-icone" aria-hidden="true">
                <IconeMala />
              </span>
              <h2 className="ei-titulo">Nenhuma vaga ainda</h2>
              {/* O que a pessoa PODE fazer a respeito. Uma tela vazia sem saída
                  faz ela concluir que o app não serve e não voltar mais. */}
              <p className="ei-apoio">
                As vagas chegam pelas funções que você marcou no seu perfil.
                Marcar mais funções aumenta o que chega até você.
              </p>
              <Link to="/meu-perfil" className="ei-btn ei-btn-cheio" style={{ marginTop: 8 }}>
                Abrir meu perfil
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Título de seção com a ação do lado, como na referência. A ação
                não é enfeite: é onde se muda o que chega nesta lista, e a
                pergunta que a pessoa faz ao ver poucas vagas é exatamente
                "como faço chegar mais?". */}
            <div className="ei-secao-linha">
              <h2>
                {aba === "novas" ? "Novas" : aba === "respondidas" ? "Já respondi" : "Todas"}
              </h2>
              <Link to="/meu-perfil" className="ei-secao-acao">
                Minhas funções
              </Link>
            </div>

            {mostradas.length === 0 && (
              <p className="ei-apoio ei-margem">
                {t
                  ? "Nada com esse nome, nesta aba."
                  : aba === "novas"
                    ? "Nenhuma vaga nova agora — você já viu todas."
                    : "Você ainda não respondeu nenhuma."}
              </p>
            )}

            <div>
              {mostradas.map((v) => (
                <article key={v.aviso_id} className="ei-cartao">
                  {/* O cartão abre pela EMPRESA, com a marca dela.
                      ─────────────────────────────────────────────
                      Antes abria com o título da vaga e o nome da empresa
                      vinha numa faixa cinza embaixo, em corpo pequeno.
                      Numa cidade em que as pessoas se conhecem, "que
                      empresa é essa" pesa tanto quanto qual é a vaga — e
                      era a única imagem que o cartão poderia ter e não
                      tinha. Sem imagem nenhuma, a lista é um bloco de
                      texto, seja de que cor for. */}
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span className="ei-empresa-marca" aria-hidden="true">
                      {v.empresa_foto ? (
                        <img src={v.empresa_foto} alt="" loading="lazy" />
                      ) : (
                        v.empresa.trim().charAt(0).toLocaleUpperCase("pt-BR")
                      )}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong className="ei-uma-linha" style={{ lineHeight: 1.25 }}>
                        {v.empresa}
                      </strong>
                      <span className="ei-linha-sub ei-uma-linha">
                        {v.vaga.neighborhood || `${v.vaga.city}/${v.vaga.uf}`}
                      </span>
                    </span>
                    {novas.has(v.aviso_id) && !v.respondida && (
                      <span className="ei-selo ei-selo-laranja">Nova</span>
                    )}
                    {/* "Respondida" cobria as duas respostas e não dizia
                        qual foi. Quem recusou uma vaga e voltou dias depois
                        lia "Respondida" e não sabia se tinha demonstrado
                        interesse ou não — a diferença entre esperar uma
                        ligação e não esperar. */}
                    {v.interessado === true && (
                      <span className="ei-selo ei-selo-verde">Tenho interesse</span>
                    )}
                    {v.interessado === false && (
                      <span className="ei-selo ei-selo-cinza">Não é para mim</span>
                    )}
                  </div>

                  {/* O que é a vaga, com a tarja ao lado do título. */}
                  <div className="ei-cartao-topo" style={{ marginTop: 14 }}>
                    <span
                      className="ei-tarja"
                      aria-hidden="true"
                      /* Verde só para o SIM. Pintar de verde a vaga que a
                         pessoa recusou daria a ela o mesmo sinal de
                         "encaminhado" das que ela quer. */
                      style={v.interessado === true ? { background: "var(--ei-verde)" } : undefined}
                    />
                    {/* ── O TÍTULO É A PORTA — 04/09 ────────────────────
                        A dona: "essa tela está horrível, é muito quebrada."

                        Uma das razões era esta: o caminho para a vaga era
                        um botão laranja gordo no meio do cartão, do mesmo
                        peso do "Tenho interesse" que fica embaixo. Duas
                        ações fortes num cartão só, e a que menos importa
                        no meio — o olho batia nela primeiro.

                        Em toda lista deste app o nome é o caminho (ver
                        `ei-pessoa` na busca e no banco de vagas). Aqui não
                        era, e por isso precisava de um botão para
                        compensar. Agora o cargo abre a vaga, como em todo
                        o resto, e o botão sai da frente. */}
                    <h3 className="ei-cartao-titulo ei-duas-linhas">
                      <Link to={`/vaga-aberta/${v.vaga.id}`} className="ei-cartao-titulo-link">
                        {v.vaga.title}
                      </Link>
                    </h3>
                  </div>

                  {/* O SALÁRIO no cartão, antes da descrição.
                      ─────────────────────────────────────────
                      O cartão não mostrava salário nenhum — a pessoa
                      percorria a lista inteira sem a informação que mais
                      decide se ela abre a vaga. */}
                  <p className="ei-linha-sub" style={{ marginTop: 8 }}>
                    <strong style={{ fontWeight: 600, color: "var(--ei-tinta)" }}>
                      {salarioEmTexto(v.vaga) ?? "Salário não informado"}
                    </strong>
                    {nomeDoContrato(v.vaga.tipo_contrato) && (
                      <> · {nomeDoContrato(v.vaga.tipo_contrato)}</>
                    )}
                  </p>

                  {/* A DESCRIÇÃO SAIU DA LISTA.
                      ─────────────────────────
                      Ela já vinha cortada em duas linhas, e mesmo assim era
                      o pedaço mais alto de cada vaga. Nos prints do Conta
                      Azul que a dona mandou, NENHUMA linha de lista tem
                      parágrafo: uma venda é "R$ 2.800,00 / Águas de
                      Joinville – SC / 10/12/2023 · Nº 222" — três linhas
                      curtas, com o dado que decide em negrito no topo.

                      Duas linhas de descrição cortadas no meio de uma frase
                      não informam nem convencem: quem quer saber abre a
                      vaga, e é para isso que existe "Ver a vaga inteira",
                      logo abaixo. O que decide o toque é o ofício, a
                      empresa e o salário — e os três continuam aqui. */}

                  {/* Duas etiquetas no máximo. Eram três e enchiam a linha
                      inteira, quebrando para uma segunda fileira — mais um
                      pedaço do "está quebrado". "Para começar logo" virou
                      "Urgente": é a mesma informação em uma palavra. */}
                  <div className="ei-chips" style={{ marginTop: 12 }}>
                    <span className="ei-selo ei-selo-cinza">
                      {v.vaga.work_modality === "presencial"
                        ? "Presencial"
                        : v.vaga.work_modality === "remoto"
                          ? "A distância"
                          : "Híbrido"}
                    </span>
                    {v.vaga.available_immediately ? (
                      <span className="ei-selo ei-selo-laranja">Urgente</span>
                    ) : (
                      v.vaga.required_experience && (
                        <span className="ei-selo ei-selo-cinza">{v.vaga.required_experience}</span>
                      )
                    )}
                  </div>

                  {/* O caminho escrito, discreto, ANTES dos botões. O
                      título já abre a vaga, mas quem lê "Vendedor" não
                      pensa em tocar num título — esta linha diz que há
                      mais para ler, sem virar botão. É a mesma forma da
                      ação de seção usada no resto do app.

                      A ordem é a da decisão: o que é a vaga, o caminho
                      para saber mais, e só então escolher. Embaixo dos
                      botões ela chegava tarde — depois de a pessoa já ter
                      decidido com o que estava na tela. */}
                  <div className="ei-vaga-pe">
                    <Link to={`/vaga-aberta/${v.vaga.id}`} className="ei-secao-acao">
                      Ver a vaga inteira
                    </Link>
                  </div>

                  {/* As DUAS respostas, e o estado de cada uma.
                      ───────────────────────────────────────────
                      A dona: "a pessoa escolhe se quer estar disponível ou
                      se não tem interesse."

                      Havia um botão só, o do sim. Quem não queria aquela
                      vaga não tinha o que tocar — e a vaga recusada
                      continuava na lista para sempre, com o mesmo botão
                      pedindo resposta.

                      "Não é para mim" e não "recusar": a pessoa não está
                      recusando um convite, está dizendo que aquele trabalho
                      não serve para ela. E fica desfazível, porque mudar de
                      ideia sobre uma vaga é a coisa mais normal do mundo. */}
                  {v.interessado === true ? (
                    /* Estado que precisa aparecer: sem ele a pessoa toca de novo
                       achando que não funcionou, e depois fica sem saber se a
                       empresa recebeu. */
                    /* ── "A EMPRESA TE LIGA" SAIU DAQUI TAMBÉM — 04/09 ──
                       A dona mandou tirar essa frase, e ela foi tirada da
                       tela da vaga (`VagaAbertaPage`) e sobreviveu aqui.

                       É uma promessa que o app não pode cumprir: quem
                       liga é a empresa, se quiser, quando quiser. Quem lê
                       "a empresa te liga" e não recebe ligação nenhuma
                       conclui que o app não funcionou — e o app fez a
                       parte dele.

                       O texto é o mesmo já aprovado na tela da vaga: diz o
                       que ACONTECEU, que é verdade e é verificável. */
                    <p className="ei-nota-resposta">
                      <strong>Interesse enviado.</strong> A empresa recebeu seu nome e seu
                      telefone.
                    </p>
                  ) : v.interessado === false ? (
                    <div style={{ marginTop: 14 }}>
                      {/* Uma linha, e não a faixa de duas colunas.
                          ─────────────────────────────────────────
                          "Você disse que não é para você" de um lado e "a
                          empresa não é avisada" do outro somam 53 letras
                          numa tela de 390px: o `space-between` quebrava as
                          duas em duas linhas cada e o resultado parecia
                          uma tabela desalinhada, não um aviso.

                          A faixa continua certa para o caso do interesse
                          enviado, onde os dois textos são curtos e cabem
                          lado a lado. */}
                      <p className="ei-nota-resposta">
                        Você marcou que não é para você — a empresa não é avisada.
                      </p>
                      <button
                        type="button"
                        className="ei-btn-inline"
                        style={{ marginTop: 8 }}
                        disabled={respondendo === v.vaga.id}
                        onClick={() => responder(v, true)}
                      >
                        {respondendo === v.vaga.id ? "Enviando…" : "Mudei de ideia, tenho interesse"}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                      <button
                        type="button"
                        className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
                        disabled={respondendo === v.vaga.id}
                        onClick={() => responder(v, true)}
                      >
                        {respondendo === v.vaga.id ? "Enviando…" : "Tenho interesse"}
                      </button>
                      <button
                        type="button"
                        className="ei-btn ei-btn-contorno ei-btn-largo"
                        disabled={respondendo === v.vaga.id}
                        onClick={() => responder(v, false)}
                      >
                        Não é para mim
                      </button>
                    </div>
                  )}

                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* Desenhado aqui e não importado de uma biblioteca: são 8 linhas, e uma
   dependência de ícones custa 40 KB para desenhar meia dúzia deles. */
function IconeMala() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="30"
      height="30"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="7.5" width="19" height="12" rx="2.5" />
      <path d="M8.5 7.5V5.8a1.8 1.8 0 0 1 1.8-1.8h3.4a1.8 1.8 0 0 1 1.8 1.8v1.7" />
      <path d="M2.5 12.5h19" />
    </svg>
  );
}

/* A mesma lupa do Banco de vagas (BancoDeVagasPage) — duplicada, e não
   importada de lá: aquele arquivo não exporta o ícone, e criar um módulo
   só para uma lupa de 20px é mais peça do que o ícone merece. */
function IconeLupa() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20"
         fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21" />
    </svg>
  );
}
