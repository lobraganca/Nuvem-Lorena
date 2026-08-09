import { useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { GRUPOS_DE_ATRIBUTOS, MAX_ATRIBUTOS } from "../types/domain";

/**
 * Etiquetas de atendimento do anúncio: horário, forma de atender, pagamento.
 *
 * Aberto no formulário, isso eram catorze pílulas em três blocos — meia tela
 * de cadastro gasta com o que é opcional, empurrando para baixo o telefone e
 * o botão de salvar, que é o que a pessoa veio fazer. Um campo opcional não
 * pode custar mais rolagem que os obrigatórios.
 *
 * Fica então como os serviços: no formulário aparece só o que a pessoa
 * escolheu, e a lista inteira abre numa folha, onde escolher é a única
 * tarefa. A diferença para os serviços é a chamada — aqui ela precisa
 * explicar o que são as etiquetas, porque ninguém chega ao cadastro
 * procurando por elas.
 */
export function SeletorDeAtributos({
  escolhidos,
  onChange,
}: {
  escolhidos: string[];
  onChange: (atributos: string[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const cheio = escolhidos.length >= MAX_ATRIBUTOS;

  function alterna(item: string) {
    onChange(escolhidos.includes(item) ? escolhidos.filter((x) => x !== item) : [...escolhidos, item]);
  }

  return (
    <>
      {escolhidos.length > 0 && (
        <div className="chip-list" style={{ marginBottom: 10 }}>
          {escolhidos.map((item) => (
            <button
              key={item}
              type="button"
              className="chip chip-selected"
              onClick={() => alterna(item)}
              title={`Tirar "${item}"`}
            >
              {item} <span aria-hidden="true">✕</span>
            </button>
          ))}
        </div>
      )}

      <button type="button" className="btn-adicionar-servico" onClick={() => setAberto(true)}>
        <span className="mais" aria-hidden="true">
          +
        </span>
        {escolhidos.length === 0 ? "Escolher etiquetas" : "Mudar as etiquetas"}
      </button>

      {aberto && (
        <BottomSheet
          title="Mais informações"
          subtitle="Cada etiqueta é uma pergunta a menos no WhatsApp — e uma desistência a menos de quem precisava justamente de sábado, de emergência ou de cartão."
          onClose={() => setAberto(false)}
        >
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
          </div>

          <p className="muted" style={{ margin: "14px 0 0", fontSize: "0.85rem" }}>
            {cheio
              ? `Você marcou ${MAX_ATRIBUTOS} etiquetas — o limite. Anúncio que marca tudo não informa nada.`
              : "Marque só o que você cumpre: etiqueta que não se sustenta vira avaliação ruim."}
          </p>

          <button
            type="button"
            className="btn btn-primary btn-block"
            style={{ marginTop: 14 }}
            onClick={() => setAberto(false)}
          >
            Pronto
          </button>
        </BottomSheet>
      )}
    </>
  );
}
