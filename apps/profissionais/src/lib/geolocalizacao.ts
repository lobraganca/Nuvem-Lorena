import { useEffect, useState } from "react";
import { CITIES, DEFAULT_CITY } from "../types/domain";

/**
 * Coordenadas aproximadas do centro de cada cidade atendida — só o
 * suficiente para saber qual delas está mais perto de quem abriu o app,
 * não para localizar ninguém com precisão.
 */
const COORDENADAS: Record<string, { lat: number; lon: number }> = {
  "Itabirito": { lat: -20.2551, lon: -43.8006 },
  "Ouro Preto": { lat: -20.3855, lon: -43.5035 },
  "Belo Horizonte": { lat: -19.9167, lon: -43.9345 },
  "Congonhas": { lat: -20.4989, lon: -43.8586 },
};

function distanciaKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Longe demais para chutar.
 *
 * A lista de coordenadas tem quatro cidades, todas mineiras e vizinhas
 * entre si. Enquanto o app atendia só elas, "a mais próxima" era sempre a
 * certa ou quase. Com o app aberto ao Brasil, a mesma conta responde
 * "Itabirito" para quem abre em Fortaleza — porque das quatro é a menos
 * distante, a 1.800 km.
 *
 * Chute errado é pior que nenhum chute: a pessoa vê banners de uma cidade
 * que não é a dela e conclui que o app não serve para ela.
 *
 * 120 km é o raio em que a resposta ainda quer dizer alguma coisa — dá
 * para atender uma cidade vizinha, não outro estado. Além disso, o app
 * simplesmente não adivinha, e a escolha continua no filtro, que é de
 * quem procura.
 */
const RAIO_MAXIMO_KM = 120;

function cidadeMaisProxima(pos: { lat: number; lon: number }): string | null {
  let melhor: string | null = null;
  let menorDist = Infinity;
  for (const cidade of CITIES) {
    const c = COORDENADAS[cidade];
    if (!c) continue;
    const d = distanciaKm(pos, c);
    if (d < menorDist) {
      menorDist = d;
      melhor = cidade;
    }
  }
  if (menorDist > RAIO_MAXIMO_KM) return null;
  return melhor;
}

const CHAVE_CACHE = "busca-itabirito-cidade-aproximada";

/**
 * A cidade de quem está usando o app agora — para banners vendidos por
 * localização, não para nenhuma outra decisão do produto.
 *
 * Pede a localização ao navegador, sem travar nada: enquanto não responde
 * (ou se a pessoa nega, ou o aparelho não suporta), devolve a cidade padrão.
 * Ninguém vê um pedido de permissão bloqueando a tela nem uma lista vazia
 * esperando resposta — o pior caso é mostrar o mesmo que já mostraria sem
 * geolocalização nenhuma.
 *
 * O resultado fica guardado na aba (sessionStorage): perguntar de novo a
 * cada carregamento não muda a resposta e só repete o pedido de permissão.
 */
export function useCidadeAproximada(): string {
  const [cidade, setCidade] = useState<string>(() => {
    try {
      return window.sessionStorage.getItem(CHAVE_CACHE) || DEFAULT_CITY;
    } catch {
      return DEFAULT_CITY;
    }
  });

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(CHAVE_CACHE)) return;
    } catch {
      /* segue sem cache */
    }
    if (!("geolocation" in navigator)) return;

    let respondeu = false;
    const tempoLimite = setTimeout(() => {
      respondeu = true;
    }, 4000);

    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        if (respondeu) return; // já desistimos; não troca a tela depois do fato
        clearTimeout(tempoLimite);
        const encontrada = cidadeMaisProxima({
          lat: posicao.coords.latitude,
          lon: posicao.coords.longitude,
        });
        // Fora do raio: mantém a cidade padrão em vez de mudar para uma
        // que fica a mil quilômetros de quem está lendo.
        if (!encontrada) return;
        setCidade(encontrada);
        try {
          window.sessionStorage.setItem(CHAVE_CACHE, encontrada);
        } catch {
          /* sem cache, pergunta de novo na próxima aba — aceitável */
        }
      },
      () => {
        // Negou, ou erro de posição: fica na cidade padrão, sem tela de erro.
        clearTimeout(tempoLimite);
      },
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 600_000 }
    );

    return () => clearTimeout(tempoLimite);
  }, []);

  return cidade;
}
