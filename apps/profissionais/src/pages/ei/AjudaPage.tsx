import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pagina } from "../../components/ei/Pagina";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { lerLadoDaSessao } from "../../lib/ladoDaSessao";
import { SUPORTE_WHATSAPP, SUPORTE_WHATSAPP_VISIVEL } from "../../config";
import {
  PERGUNTAS,
  perguntasDoLado,
  procurarPerguntas,
  type Pergunta,
} from "../../lib/perguntasFrequentes";

/**
 * Central de ajuda — as dúvidas de suporte, com busca.
 *
 * ── O pedido — 06/09 ──────────────────────────────────────────────────
 *
 * A dona: "quero criar no app um FAQ com as principais dúvidas de suporte
 * onde tenha todas as funcionalidades explicadas. Talvez até que utilize
 * inteligência artificial para entender a pergunta da pessoa."
 *
 * A parte de "entender a pergunta" está em `perguntasFrequentes.ts`, e o
 * comentário de lá explica por que é busca com sinônimos em vez de um
 * modelo de linguagem — resumo: um modelo responde bonito e às vezes
 * inventa, e aqui a resposta errada é sobre plano, cancelamento e dado
 * pessoal.
 *
 * ── Por que só o lado da pessoa ───────────────────────────────────────
 *
 * Quem entrou para procurar emprego não tem nada a resolver sobre onda de
 * aviso nem sobre cancelamento de plano — e uma lista com as duas metades
 * dobra de tamanho justamente para quem está perdido. O app inteiro já é
 * separado por lado desde 04/09 (ver `ladoDaSessao.ts`); a ajuda segue a
 * mesma regra, com um botão para ver o resto quando alguém quiser.
 *
 * ── Aberta, e não em sanfona fechada ──────────────────────────────────
 *
 * A primeira versão tinha tudo fechado, só os títulos à vista. Fica
 * arrumado e é pior: quem não sabe o nome do que procura precisa TOCAR em
 * dez títulos para descobrir qual responde. Aqui o título abre a resposta,
 * mas a busca já mostra as respostas abertas — quem procurou pela palavra
 * dele quer ler, não quer mais um toque.
 */
export function AjudaPage() {
  useTituloDaPagina("Ajuda");
  const [busca, setBusca] = useState("");
  const [tudo, setTudo] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);

  const lado = lerLadoDaSessao();
  const doLado = useMemo(
    () =>
      tudo || lado == null
        ? PERGUNTAS
        : perguntasDoLado(lado === "company" ? "empresa" : "profissional"),
    [lado, tudo]
  );

  const procurando = busca.trim().length >= 2;
  const achadas = useMemo(
    /* A busca sempre varre TODAS as perguntas, mesmo as do outro lado:
       quem digita "cancelar plano" quer a resposta, e não um "nada
       encontrado" porque o app decidiu que aquilo não é assunto dele. */
    () => (procurando ? procurarPerguntas(busca) : doLado),
    [busca, doLado, procurando]
  );

  /* Agrupa para a lista ganhar títulos. Na busca não agrupa: ali a ordem é
     a da relevância, e cortá-la em seções embaralharia justamente o que a
     busca acabou de ordenar. */
  const grupos = useMemo(() => {
    if (procurando) return null;
    const mapa = new Map<string, Pergunta[]>();
    for (const q of achadas) {
      const lista = mapa.get(q.grupo) ?? [];
      lista.push(q);
      mapa.set(q.grupo, lista);
    }
    return [...mapa.entries()];
  }, [achadas, procurando]);

  const zap = `https://wa.me/${SUPORTE_WHATSAPP}?text=${encodeURIComponent(
    busca.trim()
      ? `Olá! Minha dúvida no Ei Emprego: ${busca.trim()}`
      : "Olá! Preciso de ajuda no Ei Emprego."
  )}`;

  function Cartao({ q, abertaSempre }: { q: Pergunta; abertaSempre: boolean }) {
    const mostrando = abertaSempre || aberta === q.id;
    return (
      <div className="ei-cartao ei-duvida">
        <button
          type="button"
          className="ei-duvida-titulo"
          aria-expanded={mostrando}
          onClick={() => setAberta(mostrando && !abertaSempre ? null : q.id)}
        >
          <span>{q.pergunta}</span>
          {!abertaSempre && (
            <span className="ei-duvida-seta" aria-hidden="true">
              {mostrando ? "−" : "+"}
            </span>
          )}
        </button>
        {mostrando && (
          <div className="ei-duvida-resposta">
            {q.resposta.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {q.link && (
              <Link className="ei-btn ei-btn-tonal" to={q.link.para}>
                {q.link.texto}
              </Link>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    /* `.ei` e `.ei-tela` em volta, como toda tela do app. Sem eles, todo o
       desenho daqui é ignorado: as regras do arquivo de estilo são
       escritas como `.ei .ei-duvida`, e a primeira foto desta tela saiu
       com os cartões encolhidos no tamanho do texto. */
    <div className="ei">
      <div className="ei-tela">
        <Pagina titulo="Ajuda" />
        <p className="ei-apoio">
          Procure pela sua dúvida do jeito que você falaria. Se não achar, o suporte
          responde no WhatsApp.
        </p>

        <div className="ei-busca" style={{ marginTop: 14 }}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={busca}
            aria-label="Procurar na ajuda"
            placeholder="Procurar na ajuda"
            onChange={(e) => setBusca(e.target.value)}
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

        {procurando && achadas.length === 0 && (
          <div className="ei-cartao ei-margem">
            <p style={{ margin: "0 0 10px" }}>
              <strong>Não achei nada sobre "{busca.trim()}".</strong>
            </p>
            <p className="ei-apoio" style={{ margin: "0 0 12px" }}>
              Tente com outra palavra — ou mande a pergunta para o suporte do jeito que
              você escreveu aqui.
            </p>
            <a className="ei-btn ei-btn-cheio" href={zap} target="_blank" rel="noreferrer">
              Perguntar no WhatsApp
            </a>
          </div>
        )}

        {procurando && achadas.length > 0 && (
          <>
            <p className="ei-apoio ei-margem">
              {achadas.length === 1
                ? "1 resposta para o que você procurou:"
                : `${achadas.length} respostas para o que você procurou:`}
            </p>
            {achadas.map((q) => (
              /* Na busca, a resposta vem aberta: quem digitou a palavra dele
                 veio ler, e mais um toque seria só um pedágio. */
              <Cartao key={q.id} q={q} abertaSempre />
            ))}
          </>
        )}

        {!procurando &&
          grupos?.map(([grupo, lista]) => (
            <div key={grupo}>
              <h2 className="ei-secao">{grupo}</h2>
              {lista.map((q) => (
                <Cartao key={q.id} q={q} abertaSempre={false} />
              ))}
            </div>
          ))}

        {!procurando && lado != null && (
          <button
            type="button"
            className="ei-btn ei-btn-texto ei-margem"
            onClick={() => setTudo((t) => !t)}
          >
            {tudo
              ? "Mostrar só as dúvidas do meu lado"
              : lado === "company"
                ? "Ver também as dúvidas de quem procura emprego"
                : "Ver também as dúvidas de quem contrata"}
          </button>
        )}

        {/* O caminho para gente de verdade, sempre no fim: uma central de
            ajuda que não tem saída para uma pessoa é um beco com jeito de
            atendimento. */}
        <div className="ei-cartao ei-margem">
          <p style={{ margin: "0 0 6px" }}>
            <strong>Não resolveu?</strong>
          </p>
          <p className="ei-apoio" style={{ margin: "0 0 12px" }}>
            Chame no WhatsApp {SUPORTE_WHATSAPP_VISIVEL} e, se puder, mande um print da
            tela — com a imagem a resposta costuma vir na primeira mensagem.
          </p>
          <a className="ei-btn ei-btn-cheio" href={zap} target="_blank" rel="noreferrer">
            Falar com o suporte
          </a>
        </div>

        <p className="ei-apoio ei-margem">
          <Link to="/termos">Termos de Uso</Link> ·{" "}
          <Link to="/privacidade">Política de Privacidade</Link>
        </p>
      </div>
    </div>
  );
}
