/**
 * Anúncios pagos — a única coisa pela qual a empresa paga no Avena.
 *
 * Cadastrar é gratuito e não há mensalidade. O que se vende aqui é posição:
 * aparecer antes de quem não pagou. Isso só tem valor enquanto a lista de
 * quem não pagou continuar boa — um resultado inteiro de patrocinados vale
 * zero para o viajante e, em pouco tempo, zero para o anunciante também.
 * Daí os limites lá embaixo não serem uma cortesia, e sim o que mantém o
 * produto de pé.
 *
 * Dois lugares, porque respondem a perguntas diferentes:
 *
 *   • **cidade** — aparece no topo da busca da própria cidade. Quem vê já
 *     escolheu o destino e está decidindo com quem vai. É a posição que
 *     converte, e a mais barata, porque o público é pequeno.
 *
 *   • **inicio** — aparece na primeira tela, para quem ainda não escolheu
 *     nada. É alcance, não intenção: mais gente, menos decisão. Custa mais
 *     porque o espaço é um só e todo mundo passa por ele.
 *
 * Os preços estão aqui e em nenhum outro lugar. Mudar este arquivo muda o que
 * é cobrado, o que aparece nas telas e o que o painel soma.
 */
import type { Boost } from "../types";

export type AdPlacement = "cidade" | "inicio";

export interface AdProduct {
  placement: AdPlacement;
  label: string;
  /** O que a empresa está comprando, em uma frase. */
  what: string;
  /** Quem vai ver. */
  who: string;
  dailyPrice: number;
}

export const AD_PRODUCTS: AdProduct[] = [
  {
    placement: "cidade",
    label: "Destaque na cidade",
    what: "Seu passeio no topo da busca da sua cidade, marcado como patrocinado.",
    who: "Quem já escolheu o destino e está decidindo com quem vai.",
    dailyPrice: 9.9,
  },
  {
    placement: "inicio",
    label: "Destaque na tela inicial",
    what: "Seu passeio na primeira tela do app, marcado como patrocinado.",
    who: "Todo mundo que abre o Avena, tenha escolhido o destino ou não.",
    dailyPrice: 19.9,
  },
];

/** Períodos oferecidos. Três dias é um fim de semana; quatorze, uma temporada. */
export const AD_PACKAGES = [3, 7, 14];

/**
 * Quantos patrocinados cabem ao mesmo tempo em cada lugar.
 *
 * Baixo de propósito. Dois anúncios no topo de uma busca ainda deixam a lista
 * ser uma lista; seis fazem dela um catálogo de quem pagou, e aí ninguém
 * confia no primeiro resultado — nem no que vem depois.
 */
export const MAX_SPONSORED: Record<AdPlacement, number> = {
  cidade: 2,
  inicio: 3,
};

export function adProduct(placement: AdPlacement): AdProduct {
  return AD_PRODUCTS.find((p) => p.placement === placement) ?? AD_PRODUCTS[0];
}

export function adDailyPrice(placement: AdPlacement): number {
  return adProduct(placement).dailyPrice;
}

export function adPrice(placement: AdPlacement, days: number): number {
  return Math.round(adDailyPrice(placement) * days * 100) / 100;
}

/**
 * Um anúncio está no ar quando foi pago e a data de hoje está dentro do
 * período. O pagamento vem primeiro na frase e no código: sem ele, contratar
 * o anúncio seria o bastante para subir na busca.
 */
export function isAdLive(ad: Boost, now = new Date()): boolean {
  if (!ad.paidAt) return false;
  return new Date(ad.startsAt) <= now && now < new Date(ad.endsAt);
}

export function liveAds(ads: Boost[], now = new Date()): Boost[] {
  return ads.filter((a) => isAdLive(a, now));
}

/**
 * Os anúncios que devem aparecer num lugar, já limitados.
 *
 * Ordenados pelo mais antigo primeiro: quem contratou antes tem a vaga, o que
 * é a única regra de desempate que não exige um leilão para ser explicada.
 */
export function adsFor(
  ads: Boost[],
  placement: AdPlacement,
  now = new Date()
): Boost[] {
  return liveAds(ads, now)
    .filter((a) => a.placement === placement)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, MAX_SPONSORED[placement]);
}

/** Anúncio no ar para um passeio, em qualquer lugar. */
export function liveAdForTour(
  ads: Boost[],
  tourId: string,
  now = new Date()
): Boost | undefined {
  return liveAds(ads, now).find((a) => a.tourId === tourId);
}

/** O que a Avena recebeu de anúncios. Só o que foi pago conta. */
export function adRevenue(ads: Boost[]): number {
  const total = ads
    .filter((a) => a.paidAt)
    .reduce((sum, a) => sum + a.pricePaid, 0);
  return Math.round(total * 100) / 100;
}
