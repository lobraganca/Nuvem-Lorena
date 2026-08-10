import { useEffect, useRef, useState } from "react";

/**
 * Anima um número de onde ele estava até o valor novo, em vez de trocar de
 * repente. Dois momentos usam isso: a primeira leitura (sobe de 0 até o
 * total real) e qualquer atualização seguinte (sobe do valor antigo até o
 * novo, quando alguém cadastra ou avalia enquanto a tela está aberta).
 *
 * Não inventa nenhum valor intermediário que "pareça" estar subindo — a
 * animação só corre entre dois números que já são reais; ela é sobre COMO
 * mostrar a mudança, nunca sobre fabricar uma.
 */
export function useContagemAnimada(valor: number, duracaoMs = 900): number {
  const [exibido, setExibido] = useState(valor);
  const anterior = useRef(valor);
  const quadro = useRef<number | null>(null);

  useEffect(() => {
    const de = anterior.current;
    const ate = valor;
    if (de === ate) return;

    const inicio = performance.now();
    function passo(agora: number) {
      const t = Math.min(1, (agora - inicio) / duracaoMs);
      // Ease-out: rápido no começo, desacelera no fim — sobe animada, não
      // um contador de caça-níquel.
      const suavizado = 1 - Math.pow(1 - t, 3);
      setExibido(Math.round(de + (ate - de) * suavizado));
      if (t < 1) {
        quadro.current = requestAnimationFrame(passo);
      } else {
        anterior.current = ate;
      }
    }
    quadro.current = requestAnimationFrame(passo);
    return () => {
      if (quadro.current !== null) cancelAnimationFrame(quadro.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return exibido;
}
