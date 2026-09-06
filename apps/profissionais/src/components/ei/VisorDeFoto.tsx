/**
 * A foto em tela cheia.
 *
 * ── Por que é um componente, e não duas cópias ────────────────────────
 *
 * Ele nasceu dentro de `Pagina.tsx` em 06/09, quando a miniatura da barra
 * virou botão. Horas depois a dona pediu a foto também na ficha da pessoa
 * ("coloque a foto também quando abre o card da pessoa") — e aí eram dois
 * lugares abrindo o mesmo visor.
 *
 * Duas cópias de um overlay divergem no primeiro conserto: uma fecha com
 * Esc e a outra não, uma tranca a rolagem e a outra não. Aqui é um só.
 *
 * ── Sem "X" de fechar ─────────────────────────────────────────────────
 *
 * Toca em qualquer lugar e fecha, que é o gesto que toda galeria de
 * celular ensina. Um "X" no canto seria mais uma coisa para acertar com o
 * dedo, num retrato que ocupa a tela inteira.
 *
 * O Esc existe para quem está no computador: fechar só por toque deixaria
 * essa pessoa presa numa foto em tela cheia.
 */
export function VisorDeFoto({
  foto,
  nome,
  aoFechar,
}: {
  foto: string;
  nome: string;
  aoFechar: () => void;
}) {
  return (
    <div
      className="ei-visor-foto"
      role="dialog"
      aria-modal="true"
      aria-label={`Foto de ${nome}`}
      tabIndex={-1}
      /* O foco vem para cá ao abrir, senão o Esc não chega: teclado só
         alcança quem está focado. */
      ref={(el) => el?.focus()}
      onClick={aoFechar}
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === "Enter" || e.key === " ") aoFechar();
      }}
    >
      <img src={foto} alt={`Foto de ${nome}`} />
      <span className="ei-visor-foto-nota">Toque para fechar</span>
    </div>
  );
}
