/**
 * O contorno cinza da lista, enquanto ela ainda não chegou.
 *
 * O que havia antes era a palavra "Carregando…" solta no alto da tela. Em
 * 4G ruim ela fica lá dois, três segundos com o resto da tela em branco — e
 * branco parece app travado. A dona relatou exatamente isso ("está muito
 * quebrado") olhando uma lista que só estava lenta.
 *
 * O esqueleto resolve por dois motivos, e o segundo é o que importa mais:
 *
 * 1. Diz que ALGO vem — a forma na tela já é a forma da lista.
 * 2. Ocupa a altura que a lista vai ocupar. Sem isso, o conteúdo chega e
 *    empurra a tela para baixo bem na hora em que a pessoa foi tocar em
 *    algo — o toque acerta o item errado.
 *
 * `aria-hidden`: para quem usa leitor de tela, retângulo cinza não é
 * informação. O aviso de que está carregando vai no `aria-live` de quem
 * chama, não aqui.
 */
export default function Esqueleto({ linhas = 4 }: { linhas?: number }) {
  return (
    <div className="ei-esqueleto" aria-hidden="true">
      {Array.from({ length: linhas }).map((_, i) => (
        <div className="ei-esqueleto-linha" key={i}>
          <div className="ei-esqueleto-foto" />
          <div className="ei-esqueleto-texto">
            <div className="ei-esqueleto-barra" style={{ width: "62%" }} />
            <div className="ei-esqueleto-barra ei-esqueleto-barra-fina" style={{ width: "38%" }} />
          </div>
        </div>
      ))}
      <span className="ei-so-leitor" aria-live="polite">Carregando a lista…</span>
    </div>
  );
}
