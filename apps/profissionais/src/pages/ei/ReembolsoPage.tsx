import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pagina } from "../../components/ei/Pagina";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { useAuth } from "../../lib/useAuth";
import { mensagemDeErro } from "../../lib/erros";
import {
  pedirReembolso,
  meusPedidosDeReembolso,
  type EfeitoDoReembolso,
  type PedidoDeReembolso,
} from "../../lib/reembolso";

/**
 * "Quero meu dinheiro de volta, e é por isso."
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "a pessoa ao pedir reembolso ter onde escrever o motivo, e isso
 * chegar pra mim no painel do administrador."
 *
 * ── Por que uma tela, e não um campo dentro da tela de planos ──────────
 *
 * Quem pede reembolso está insatisfeito. Pedir isso no meio de uma tela
 * que mostra três preços é oferecer mais compra a quem quer desfazer uma
 * — e é assim que a pessoa desiste do app inteiro em vez de só do plano.
 * Aqui a tela faz uma coisa só, e faz bem.
 *
 * ── O texto não é uma condição ─────────────────────────────────────────
 *
 * Dentro dos 7 dias o dinheiro volta sem justificativa nenhuma (art. 49
 * do Código de Defesa do Consumidor). A tela diz isso ANTES do campo, com
 * todas as letras: sem essa frase, um campo obrigatório chamado "motivo"
 * parece uma peneira, e quem tem direito desiste achando que o motivo
 * dele não é bom o bastante.
 */
export function ReembolsoPage() {
  useTituloDaPagina("Pedir reembolso");
  const navegar = useNavigate();
  const { user, loading } = useAuth();

  const [motivo, setMotivo] = useState("");
  const [contato, setContato] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [pronto, setPronto] = useState(false);
  /* O que o pedido causou no plano (0124). `null` enquanto não se sabe —
     e a tela só usa depois de enviar. */
  const [efeito, setEfeito] = useState<EfeitoDoReembolso | null>(null);
  const [anteriores, setAnteriores] = useState<PedidoDeReembolso[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navegar("/login", { replace: true });
      return;
    }
    /* O telefone da conta já vem preenchido: quem está pedindo dinheiro de
       volta não deve ter de digitar o próprio número de novo. */
    setContato(user.phone ? formatarTelefone(user.phone) : "");
    meusPedidosDeReembolso(user.id)
      .then(setAnteriores)
      /* Falhar aqui não pode travar o pedido novo: a lista de anteriores é
         conforto, o formulário é o que a pessoa veio fazer. */
      .catch(() => {});
  }, [user, loading, navegar]);

  async function enviar() {
    if (!user) return;
    if (motivo.trim().length < 5) {
      setErro("Escreva o motivo, mesmo que em poucas palavras.");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      setEfeito(await pedirReembolso({ userId: user.id, motivo, contato }));
      setPronto(true);
      setMotivo("");
      setAnteriores(await meusPedidosDeReembolso(user.id));
    } catch (err) {
      setErro(mensagemDeErro(err, "Não consegui enviar seu pedido agora."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="ei">
      <div className="ei-tela">
        <Pagina titulo="Pedir reembolso" voltar="/perfil" />

        {pronto ? (
          <>
            {/* ── O QUE ACONTECEU COM O PLANO, DITO AQUI — 06/09 ────────
                Antes esta tela dizia sempre a mesma frase: "seu pedido
                chegou". Agora o pedido MEXE no plano na hora (ver a 0124),
                e não dizer o que mudou seria a pior parte do app — a
                empresa descobriria pela vaga sumida.

                Três frases porque são três situações de verdade, e a
                diferença entre elas é dinheiro e vaga no ar. */}
            <div className="ei-cartao">
              <h2 className="ei-titulo" style={{ marginTop: 0 }}>
                Pedido enviado
              </h2>

              {efeito === "encerrado_agora" && (
                <>
                  <p className="ei-corpo">
                    Como faz <strong>menos de 7 dias</strong> que você assinou,
                    o valor volta inteiro — é o seu direito de arrependimento.
                  </p>
                  <p className="ei-corpo">
                    O plano <strong>já foi encerrado</strong> e as suas vagas
                    saíram do ar agora. Quem já tinha se interessado continua
                    guardado: se você voltar atrás, a vaga volta com eles.
                  </p>
                </>
              )}

              {efeito === "ate_o_vencimento" && (
                <>
                  <p className="ei-corpo">
                    Seu plano <strong>não vai renovar</strong>, e continua
                    valendo até o fim do mês que você já pagou.
                  </p>
                  <p className="ei-corpo">
                    Até lá está tudo no ar do mesmo jeito — as vagas saem
                    sozinhas no dia do vencimento. Se quiser voltar atrás antes
                    disso, é só falar com a gente.
                  </p>
                </>
              )}

              {efeito === "sem_plano" && (
                <p className="ei-corpo">
                  Não achei nenhum plano ativo nesta conta, então não havia
                  nada para encerrar. Seu pedido chegou do mesmo jeito e a
                  gente vai olhar a cobrança.
                </p>
              )}

              <p className="ei-corpo">
                A gente responde pelo seu telefone, e o dinheiro volta pelo
                mesmo caminho do pagamento — o prazo é do banco ou do cartão,
                normalmente até 10 dias.
              </p>
              <Link className="ei-btn-inline" to="/perfil">
                Voltar para a Conta
              </Link>
            </div>
          </>
        ) : (
          <>
            {/* A garantia ANTES do campo. Ver o comentário no topo. */}
            <div className="ei-cartao">
              <p className="ei-corpo" style={{ marginTop: 0 }}>
                <strong>Até 7 dias corridos, devolvemos tudo</strong> — é o seu
                direito de arrependimento, e você não precisa justificar.
              </p>
              <p className="ei-corpo" style={{ marginBottom: 0 }}>
                Mesmo assim, escrever o que aconteceu ajuda demais: é assim que a
                gente descobre o que está errado no app.
              </p>
            </div>

            <div className="ei-cartao">
              <div className="ei-campo">
                <label htmlFor="motivo-reembolso">Por que você quer o reembolso?</label>
                <textarea
                  id="motivo-reembolso"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={5}
                />
              </div>

              <div className="ei-campo">
                <label htmlFor="contato-reembolso">Telefone para a gente responder</label>
                <input
                  id="contato-reembolso"
                  inputMode="tel"
                  value={contato}
                  onChange={(e) => setContato(e.target.value)}
                />
              </div>

              {erro && (
                <p className="ei-campo-erro" role="alert">
                  {erro}
                </p>
              )}

              <button
                type="button"
                className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
                disabled={enviando}
                onClick={enviar}
              >
                {enviando ? "Enviando…" : "Enviar pedido"}
              </button>
            </div>
          </>
        )}

        {anteriores.length > 0 && (
          <>
            <h2 className="ei-secao">Seus pedidos</h2>
            <div className="ei-lista">
              {anteriores.map((p) => (
                <div key={p.id} className="ei-cartao">
                  <div className="ei-onda-topo">
                    <span className="ei-apoio">
                      {new Date(p.created_at).toLocaleDateString("pt-BR")}
                    </span>
                    <span
                      className={
                        p.status === "resolvido"
                          ? "ei-selo ei-selo-verde"
                          : p.status === "lido"
                            ? "ei-selo ei-selo-laranja"
                            : "ei-selo ei-selo-cinza"
                      }
                    >
                      {p.status === "resolvido"
                        ? "Resolvido"
                        : p.status === "lido"
                          ? "Estamos vendo"
                          : "Recebido"}
                    </span>
                  </div>
                  <p className="ei-corpo" style={{ marginBottom: 0 }}>
                    {p.motivo}
                  </p>
                  {p.observacao && (
                    <p className="ei-apoio" style={{ marginTop: 8, marginBottom: 0 }}>
                      Resposta: {p.observacao}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** (31) 99999-9999 a partir dos dígitos que vieram da conta. */
function formatarTelefone(cru: string): string {
  const d = cru.replace(/\D/g, "").replace(/^55/, "");
  if (d.length < 10) return cru;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  const meio = resto.length > 8 ? resto.slice(0, 5) : resto.slice(0, 4);
  return `(${ddd}) ${meio}-${resto.slice(meio.length)}`;
}
