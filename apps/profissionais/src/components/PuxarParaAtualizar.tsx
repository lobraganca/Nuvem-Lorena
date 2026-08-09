import { useEffect, useRef, useState } from "react";

/** A partir de quantos pixels puxados a soltura recarrega. */
const LIMITE = 72;
/** Teto do quanto o indicador desce, para o gesto não virar elástico infinito. */
const MAXIMO = 110;

/**
 * Arrastar para baixo e soltar para atualizar.
 *
 * No app instalado na tela do celular não existe barra do navegador — e sem
 * ela não existe o gesto de recarregar. A pessoa fica presa na versão que
 * abriu, sem nenhum jeito de pedir a nova, e o app parece travado quando na
 * verdade só está mostrando o que carregou dias atrás.
 *
 * Só aparece no app instalado: no navegador comum o gesto já existe de
 * fábrica, e dois comportamentos disputando o mesmo movimento é pior que
 * nenhum.
 */
export function PuxarParaAtualizar() {
  const [distancia, setDistancia] = useState(0);
  const [recarregando, setRecarregando] = useState(false);
  const inicio = useRef<number | null>(null);

  useEffect(() => {
    const instalado =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!instalado) return;

    function comecou(e: TouchEvent) {
      // Só vale se a página já está no topo. No meio da lista, puxar para
      // baixo é rolar — sequestrar esse movimento deixaria a busca inusável.
      if (window.scrollY > 0 || e.touches.length !== 1) {
        inicio.current = null;
        return;
      }
      inicio.current = e.touches[0].clientY;
    }

    function moveu(e: TouchEvent) {
      if (inicio.current === null) return;
      const puxado = e.touches[0].clientY - inicio.current;
      if (puxado <= 0) {
        setDistancia(0);
        return;
      }
      // Raiz quadrada: o indicador acompanha o dedo no começo e vai ficando
      // pesado — é o que faz o gesto parecer preso a alguma coisa em vez de
      // uma barra deslizando solta.
      setDistancia(Math.min(MAXIMO, Math.sqrt(puxado) * 7));
    }

    function soltou() {
      if (inicio.current === null) return;
      inicio.current = null;
      setDistancia((d) => {
        if (d >= LIMITE) {
          setRecarregando(true);
          window.location.reload();
          return LIMITE;
        }
        return 0;
      });
    }

    window.addEventListener("touchstart", comecou, { passive: true });
    window.addEventListener("touchmove", moveu, { passive: true });
    window.addEventListener("touchend", soltou);
    window.addEventListener("touchcancel", soltou);
    return () => {
      window.removeEventListener("touchstart", comecou);
      window.removeEventListener("touchmove", moveu);
      window.removeEventListener("touchend", soltou);
      window.removeEventListener("touchcancel", soltou);
    };
  }, []);

  if (distancia === 0 && !recarregando) return null;

  const pronto = distancia >= LIMITE;
  return (
    <div className="puxar-atualizar" style={{ transform: `translateY(${distancia}px)` }} aria-hidden="true">
      <span className={recarregando ? "puxar-roda girando" : "puxar-roda"} />
      <span>{recarregando ? "Atualizando…" : pronto ? "Solte para atualizar" : "Puxe para atualizar"}</span>
    </div>
  );
}
