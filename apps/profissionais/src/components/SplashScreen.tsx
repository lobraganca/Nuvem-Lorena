import { useEffect, useState } from "react";
import { LogoMark } from "./Logo";

/** Quanto tempo a marca fica na tela antes de começar a sumir. */
const HOLD_MS = 700;
/** Duração do desaparecimento (precisa bater com a animação no CSS). */
const FADE_MS = 260;

/**
 * Abertura do app: uma tela azul que aparece e sai rápido, com a marca.
 *
 * Fica montada por cima de tudo, mas não bloqueia o carregamento — o app já
 * está sendo montado atrás. Some sozinha e nunca mais aparece na mesma
 * sessão (recarregar a página traz de volta; navegar entre telas, não).
 *
 * Quem pediu menos animação no sistema não vê a tela: para essas pessoas o
 * "pisca rápido" é justamente o que incomoda.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<"in" | "out" | "gone">(() => {
    if (typeof window === "undefined") return "gone";
    const jaViu = window.sessionStorage.getItem("busca-itabirito-splash") === "1";
    const menosMovimento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    return jaViu || menosMovimento ? "gone" : "in";
  });

  // Lista de dependências vazia de propósito. Com `[phase]`, a troca para
  // "out" disparava a limpeza do efeito, que cancelava o cronômetro do
  // "gone" — a tela ficava invisível (opacidade 0) mas continuava por cima
  // de tudo, com z-index 2000, engolindo todo toque no app. Aqui o efeito
  // roda uma vez e a limpeza só acontece ao desmontar.
  useEffect(() => {
    if (phase !== "in") return;
    try {
      window.sessionStorage.setItem("busca-itabirito-splash", "1");
    } catch {
      /* storage bloqueado: a tela some do mesmo jeito */
    }
    const sair = setTimeout(() => setPhase("out"), HOLD_MS);
    const fim = setTimeout(() => setPhase("gone"), HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(sair);
      clearTimeout(fim);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "gone") return null;

  return (
    <div className={phase === "out" ? "splash splash-out" : "splash"} aria-hidden="true">
      <LogoMark variant="onBlue" />
    </div>
  );
}
