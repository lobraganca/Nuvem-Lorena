import { useState, type MouseEvent } from "react";
import { VisorDeFoto } from "./VisorDeFoto";

/**
 * Ver a foto sem sair da lista.
 *
 * ── Por que existe — 06/09 ────────────────────────────────────────────
 *
 * A dona, depois de a foto passar a abrir na ficha da pessoa: "ainda não
 * consegui ver a função pra ver a foto. Coloque dentro do card do
 * candidato também."
 *
 * Duas coisas estavam erradas, e a segunda explica a primeira.
 *
 * 1. A foto só abria DENTRO da ficha — e para chegar lá é preciso sair da
 *    lista, abrir a pessoa e voltar. Quem está escolhendo entre doze
 *    interessados não faz esse caminho doze vezes.
 * 2. Nada dizia que dava para tocar. Era um retrato igual a qualquer
 *    outro; a única forma de descobrir era tocar por acidente. Uma função
 *    sem marca visível é uma função que não existe — foi literalmente o
 *    que ela relatou.
 *
 * Daí a lupa no canto do retrato: ela diz que ali tem algo para tocar, e o
 * alvo é o retrato inteiro (84px), não o iconezinho de 26.
 *
 * ── Por que o toque é tratado no LINK, e não num botão ────────────────
 *
 * O cartão da pessoa é um `<Link>` inteiro, e o retrato está dentro dele.
 * Botão dentro de link é inválido e, pior, imprevisível: o toque dispara
 * os dois, e a lista navegaria para a ficha ao mesmo tempo que abre a
 * foto — a foto piscaria e sumiria.
 *
 * A primeira tentativa foi pôr o botão POR CIMA do retrato, como irmão do
 * link, posicionado à mão. Ele nasceu 6px fora do lugar e o teste pegou:
 * o cartão é uma grade com uma faixa de selo em cima, então "o topo do
 * retrato" não é o topo do cartão mais o recuo — é isso mais o vão da
 * grade. Número copiado à mão é número que desalinha sozinho no primeiro
 * ajuste do cartão.
 *
 * O que ficou não tem número nenhum para errar: a marca é um enfeite
 * DENTRO do retrato (`pointer-events: none`), e quem decide o que o toque
 * faz é o próprio link — se o dedo caiu sobre o retrato e há foto, ele
 * segura a navegação e abre a foto.
 *
 * Quem usa teclado não alcança a foto pela lista, e isso é de propósito:
 * o mesmo retrato, em tamanho grande e como botão de verdade, está na
 * ficha da pessoa — a um Enter de distância.
 */
export function useVisorDeFoto() {
  const [aberta, setAberta] = useState<{ foto: string; nome: string } | null>(null);

  return {
    abrir: (foto: string, nome: string) => setAberta({ foto, nome }),
    visor: aberta ? (
      <VisorDeFoto foto={aberta.foto} nome={aberta.nome} aoFechar={() => setAberta(null)} />
    ) : null,
  };
}

/**
 * O que pôr no `onClick` do cartão para o toque no retrato abrir a foto.
 *
 * Devolve `undefined` sem foto: sem retrato não há o que ampliar, e
 * segurar a navegação nesse caso tiraria da pessoa o toque que ela quis
 * dar.
 */
export function aoTocarNoRetrato(
  foto: string | null | undefined,
  nome: string,
  abrir: (foto: string, nome: string) => void
) {
  if (!foto) return undefined;
  return (e: MouseEvent<HTMLElement>) => {
    const alvo = e.target as HTMLElement | null;
    if (!alvo?.closest?.(".ei-pessoa-retrato")) return;
    e.preventDefault();
    e.stopPropagation();
    abrir(foto, nome);
  };
}

/**
 * A lupa no canto do retrato. Enfeite puro — quem responde ao toque é o
 * cartão (ver acima), e por isso ela não recebe evento nenhum.
 */
export function MarcaDeLupa() {
  return (
    <span className="ei-pessoa-lupa-marca" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      >
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M10.5 7.8v5.4M7.8 10.5h5.4" />
        <path d="M20 20l-4.6-4.6" />
      </svg>
    </span>
  );
}
