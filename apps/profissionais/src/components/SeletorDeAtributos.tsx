import { GRUPOS_DE_ATRIBUTOS, MAX_ATRIBUTOS } from "../types/domain";

/**
 * Etiquetas de atendimento do anúncio: horário, forma de atender, pagamento.
 *
 * Ao contrário dos serviços, aqui a lista inteira fica aberta no formulário —
 * são catorze opções curtas, e escondê-las atrás de um botão faria a pessoa
 * não descobrir que elas existem. Serviço a pessoa já sabe qual é o dela e
 * vai procurar; etiqueta ela só marca se enxergar.
 */
export function SeletorDeAtributos({
  escolhidos,
  onChange,
}: {
  escolhidos: string[];
  onChange: (atributos: string[]) => void;
}) {
  const cheio = escolhidos.length >= MAX_ATRIBUTOS;

  function alterna(item: string) {
    onChange(escolhidos.includes(item) ? escolhidos.filter((x) => x !== item) : [...escolhidos, item]);
  }

  return (
    <div className="atributos-grupos">
      {GRUPOS_DE_ATRIBUTOS.map((g) => (
        <div key={g.grupo} className="atributos-grupo">
          <h4>{g.grupo}</h4>
          <div className="chip-list">
            {(g.itens as readonly string[]).map((item) => {
              const marcado = escolhidos.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  className={marcado ? "chip chip-selected" : "chip"}
                  aria-pressed={marcado}
                  disabled={!marcado && cheio}
                  onClick={() => alterna(item)}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {cheio && (
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          Você marcou {MAX_ATRIBUTOS} etiquetas — o limite. Anúncio que marca tudo não informa nada.
        </p>
      )}
    </div>
  );
}
