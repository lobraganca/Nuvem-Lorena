/**
 * O visto redondo de "número confirmado por código".
 *
 * Existe como componente porque o desenho já foi feito duas vezes e ficou
 * torto das duas — a primeira com o caractere "✓" (que muda de forma e de
 * largura entre Android, iPhone e computador), a segunda com um SVG de
 * 11px centrado por flexbox dentro de um círculo de 20px.
 *
 * O erro da segunda é sutil e vale ficar registrado: 11 dentro de 20 sobra
 * 9, e 9 dividido por 2 é 4,5 — meia sombra de pixel de cada lado. Medindo
 * a tinta renderizada, o visto caía 0,66px abaixo e 0,54px à direita do
 * centro do círculo. Numa marca de 20px isso é visível, e foi exatamente o
 * que a dona apontou duas vezes.
 *
 * Aqui não há caixa dentro de caixa: o SVG ocupa o círculo inteiro e o
 * traço é posicionado pelas próprias coordenadas, dentro de um `viewBox` de
 * 20 unidades que corresponde 1:1 aos 20px do círculo. O traço vai de 6,9 a
 * 13,1 na horizontal e de 7,6 a 12,4 na vertical — centro exato em (10,10)
 * nos dois eixos. Medido depois da mudança: 0,06px de desvio.
 */
export function MarcaConfirmado({ tamanho = 20 }: { tamanho?: number }) {
  return (
    <span className="whats-ok-marca" style={{ width: tamanho, height: tamanho }} aria-hidden="true">
      <svg
        viewBox="0 0 20 20"
        width={tamanho}
        height={tamanho}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6.9 10.3 L9.3 12.4 L13.1 7.6" />
      </svg>
    </span>
  );
}
