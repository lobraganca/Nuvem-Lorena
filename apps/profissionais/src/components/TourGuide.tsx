import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface TourStep {
  /**
   * Valor do atributo `data-tour` do elemento que este passo explica. Se o
   * elemento não estiver na tela (some numa largura diferente, ou a lista de
   * resultados está vazia), o passo vira um cartão centralizado em vez de
   * sumir — o texto continua fazendo sentido sozinho.
   */
  target?: string;
  title: string;
  text: string;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;

/**
 * Tour guiado de primeiro acesso: escurece a tela, recorta o elemento do
 * passo atual e explica para que ele serve.
 *
 * O recorte é feito com `box-shadow` gigante em volta da caixa do elemento —
 * assim não é preciso desenhar máscara nenhuma, e o buraco acompanha o
 * elemento real, não uma posição chutada.
 */
export function TourGuide({ steps, onFinish }: { steps: TourStep[]; onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = steps[index];
  const isLast = index === steps.length - 1;

  // Mede o alvo do passo atual (e remede quando a tela muda de tamanho ou
  // rola, senão o buraco fica no lugar errado).
  useLayoutEffect(() => {
    function measure() {
      if (!step?.target) {
        setRect(null);
        return;
      }
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - PADDING, left: r.left - PADDING, width: r.width + PADDING * 2, height: r.height + PADDING * 2 });
    }

    measure();
    // Depois da rolagem suave terminar, a posição muda — remede.
    const t = setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  // O foco vai para o cartão a cada passo, para quem usa leitor de tela
  // acompanhar o tour em vez de continuar preso na página atrás.
  useEffect(() => {
    cardRef.current?.focus();
  }, [index]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onFinish();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onFinish]);

  if (!step) return null;

  function next() {
    if (isLast) onFinish();
    else setIndex((i) => i + 1);
  }

  // O cartão fica abaixo do alvo quando cabe, senão acima — e centralizado
  // quando o passo não aponta para nada.
  const cardStyle: React.CSSProperties = rect
    ? rect.top + rect.height + 200 < window.innerHeight
      ? { top: rect.top + rect.height + 12 }
      : { top: Math.max(12, rect.top - 200) }
    : // Sem alvo o cartão fica no meio da tela — precisa repetir o
      // translateX(-50%) da classe, senão o inline sobrescreve e o cartão
      // desliza para a direita.
      { top: "50%", transform: "translate(-50%, -50%)" };

  return (
    <div className="tour-root" role="dialog" aria-modal="true" aria-label="Tour de primeiro acesso">
      {rect ? (
        <div
          className="tour-spotlight"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      ) : (
        <div className="tour-dim" />
      )}

      <div className="tour-card" style={cardStyle} ref={cardRef} tabIndex={-1}>
        <p className="tour-progress">
          Passo {index + 1} de {steps.length}
        </p>
        <h3 className="tour-title">{step.title}</h3>
        <p className="tour-text">{step.text}</p>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={onFinish}>
            Pular
          </button>
          <button type="button" className="btn btn-primary" onClick={next}>
            {isLast ? "Começar a usar" : "Próximo"}
          </button>
        </div>
      </div>
    </div>
  );
}
