/**
 * A short list of Brazilian destinations with their coordinates.
 *
 * It exists so the first memory can be created in two taps and one line. There
 * is no geocoding service here — the app works offline — so a place off this
 * list goes to the full form, where the person drops a pin on the map. That is
 * the honest trade: fast for the common case, and never a wrong pin.
 */
export interface Destination {
  city: string;
  state: string;
  lat: number;
  lng: number;
}

export const POPULAR_DESTINATIONS: Destination[] = [
  { city: "Rio de Janeiro", state: "RJ", lat: -22.9068, lng: -43.1729 },
  { city: "Arraial do Cabo", state: "RJ", lat: -22.9661, lng: -42.0278 },
  { city: "Paraty", state: "RJ", lat: -23.2178, lng: -44.7131 },
  { city: "Fernando de Noronha", state: "PE", lat: -3.8447, lng: -32.4108 },
  { city: "Recife", state: "PE", lat: -8.0476, lng: -34.877 },
  { city: "Porto de Galinhas", state: "PE", lat: -8.5069, lng: -35.0069 },
  { city: "Salvador", state: "BA", lat: -12.9777, lng: -38.5016 },
  { city: "Chapada Diamantina", state: "BA", lat: -12.6, lng: -41.4 },
  { city: "Ouro Preto", state: "MG", lat: -20.3856, lng: -43.5035 },
  { city: "Belo Horizonte", state: "MG", lat: -19.9167, lng: -43.9345 },
  { city: "Serra do Cipó", state: "MG", lat: -19.3333, lng: -43.6167 },
  { city: "São Paulo", state: "SP", lat: -23.5505, lng: -46.6333 },
  { city: "Ilhabela", state: "SP", lat: -23.7781, lng: -45.3581 },
  { city: "Ubatuba", state: "SP", lat: -23.4336, lng: -45.0838 },
  { city: "Florianópolis", state: "SC", lat: -27.5954, lng: -48.548 },
  { city: "Bonito", state: "MS", lat: -21.1261, lng: -56.4836 },
  { city: "Jalapão", state: "TO", lat: -10.5, lng: -46.5 },
  { city: "Lençóis Maranhenses", state: "MA", lat: -2.4864, lng: -43.1281 },
  { city: "Jericoacoara", state: "CE", lat: -2.7961, lng: -40.5142 },
  { city: "Fortaleza", state: "CE", lat: -3.7319, lng: -38.5267 },
  { city: "Manaus", state: "AM", lat: -3.119, lng: -60.0217 },
  { city: "Foz do Iguaçu", state: "PR", lat: -25.5478, lng: -54.5882 },
  { city: "Curitiba", state: "PR", lat: -25.4284, lng: -49.2733 },
  { city: "Gramado", state: "RS", lat: -29.3788, lng: -50.8739 },
  { city: "Alter do Chão", state: "PA", lat: -2.5106, lng: -54.9531 },
  { city: "Chapada dos Veadeiros", state: "GO", lat: -14.1333, lng: -47.5167 },
];

export function findDestination(city: string): Destination | undefined {
  const wanted = city.trim().toLowerCase();
  return POPULAR_DESTINATIONS.find((d) => d.city.toLowerCase() === wanted);
}
