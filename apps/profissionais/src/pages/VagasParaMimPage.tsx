import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

  async function responder(v: VagaParaMim, interessado: boolean) {
    if (!user) return;
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
          <p className="ei-apoio">Carregando…</p>
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

  const mostradas =
    aba === "novas"
      ? vagas.filter((v) => novas.has(v.aviso_id) && !v.respondida)
      : aba === "respondidas"
        ? vagas.filter((v) => v.respondida)
        : vagas;

  return (
    <div className="ei">
      <div className="ei-tela">
        {/* Cabeçalho de página do Notion: migalha, ícone e título. */}
        <Pagina icone="💼" titulo="Vagas" ondeEstou="Vagas" />

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
          <Callout emoji="🔔">
            <button type="button" className="ei-btn-inline" disabled={ligandoAviso} onClick={ligarAviso}>
              {ligandoAviso ? "Ligando…" : "Avisar no celular"}
            </button>{" "}
            quando chegar vaga do seu ofício.
          </Callout>
        )}

        {avisoLigado && (
          <Callout emoji="✅">Aviso ligado neste aparelho.</Callout>
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
                {aba === "novas"
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
                    <h3 className="ei-cartao-titulo ei-duas-linhas">{v.vaga.title}</h3>
                  </div>

                  {v.vaga.description && (
                    /* Duas linhas e para. Sem o corte, uma vaga bem escrita
                       enchia meio cartão de parágrafo e empurrava o botão
                       para fora da tela — e o que decide se a pessoa toca é
                       o ofício e a empresa, não o texto inteiro. */
                    <p className="ei-corpo ei-duas-linhas" style={{ marginTop: 10 }}>
                      {v.vaga.description}
                    </p>
                  )}

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
                    <div className="ei-faixa" style={{ marginTop: 14 }}>
                      <span>Interesse enviado</span>
                      <span className="ei-faixa-valor">a empresa te liga</span>
                    </div>
                  ) : v.interessado === false ? (
                    <div style={{ marginTop: 14 }}>
                      <div className="ei-faixa">
                        <span>Você disse que não é para você</span>
                        <span className="ei-faixa-valor">a empresa não é avisada</span>
                      </div>
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
