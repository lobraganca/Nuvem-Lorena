import { useAvena } from "../store/AvenaContext";
import { effectiveStatus } from "../lib/bookingStatus";
import { formatBRL } from "../lib/money";

/**
 * O extrato: o que entrou, o que está para entrar, e o que voltou.
 *
 * O painel mostrava um total e mais nada. Para quem vive disso, "R$ 3.480" sem
 * as linhas que somam é um número que não dá para conferir — e conferir é
 * exatamente o que se faz com dinheiro.
 *
 * Três blocos, porque são três realidades diferentes: o que já foi pago e o
 * passeio já aconteceu, o que foi pago e ainda vai acontecer, e o que foi
 * devolvido. Misturar os três num total só foi o que fez a tela não servir.
 */
export function PayoutStatement({ businessId }: { businessId: string }) {
  const { bookings } = useAvena();
  const hoje = new Date().toISOString().slice(0, 10);

  const minhas = bookings
    .filter((b) => b.businessId === businessId)
    .sort((a, b) => b.travelDate.localeCompare(a.travelDate));

  const pagas = minhas.filter((b) => effectiveStatus(b) === "confirmada");
  const realizadas = pagas.filter((b) => b.travelDate < hoje);
  const futuras = pagas.filter((b) => b.travelDate >= hoje);
  const devolvidas = minhas.filter((b) => b.status === "cancelada" && b.refundAmount);

  const soma = (lista: typeof minhas) =>
    lista.reduce((total, b) => total + b.businessPayout, 0);

  function Linha({ titulo, lista }: { titulo: string; lista: typeof minhas }) {
    if (lista.length === 0) return null;
    return (
      <>
        <div className="payout-head">
          <span>{titulo}</span>
          <strong>R$ {formatBRL(soma(lista))}</strong>
        </div>
        {lista.map((b) => (
          <div key={b.id} className="payout-row">
            <span>
              {new Date(b.travelDate).toLocaleDateString("pt-BR")} · {b.tourTitle}
            </span>
            <span className="payout-value">R$ {formatBRL(b.businessPayout)}</span>
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      <h2 className="timeline-title">Extrato</h2>
      {minhas.length === 0 ? (
        <p className="muted">Nada ainda. As reservas pagas aparecem aqui.</p>
      ) : (
        <div className="payout-statement">
          <Linha titulo="Recebido (passeios já realizados)" lista={realizadas} />
          <Linha titulo="A receber (passeios ainda por vir)" lista={futuras} />

          {devolvidas.length > 0 && (
            <>
              <div className="payout-head">
                <span>Devolvido ao viajante</span>
                <strong>
                  R${" "}
                  {formatBRL(
                    devolvidas.reduce((t, b) => t + (b.refundAmount ?? 0), 0)
                  )}
                </strong>
              </div>
              {devolvidas.map((b) => (
                <div key={b.id} className="payout-row">
                  <span>
                    {new Date(b.travelDate).toLocaleDateString("pt-BR")} ·{" "}
                    {b.tourTitle}
                  </span>
                  <span className="payout-value">
                    − R$ {formatBRL(b.refundAmount ?? 0)}
                  </span>
                </div>
              ))}
            </>
          )}

          {/* O que este extrato não é, dito antes de alguém levá-lo ao
              contador. */}
          <p className="muted">
            Os valores são o que você recebe: o preço cheio que anunciou, sem
            desconto do Avena. Quem transfere é o Mercado Pago, e o extrato
            oficial é o dele. A nota fiscal é emitida por você — o Avena não
            emite nota em seu nome.
          </p>
        </div>
      )}
    </>
  );
}
