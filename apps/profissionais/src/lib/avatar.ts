/**
 * Iniciais em cor, no lugar do bonequinho genérico.
 *
 * Sem foto, todos os cadastros ficavam idênticos — a mesma silhueta cinza
 * repetida na lista inteira, que é o oposto do que um cartão de visita
 * precisa fazer. As iniciais distinguem à primeira vista, e a cor vem do
 * próprio nome, então é sempre a mesma para a mesma pessoa.
 *
 * Mora aqui, e não dentro de uma tela, porque a busca e os favoritos
 * mostram a mesma pessoa: com cada tela desenhando o seu próprio
 * espaço-reserva, o mesmo cadastro aparecia com iniciais coloridas num
 * lugar e um emoji cinza no outro.
 */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function corDoNome(nome: string): string {
  let soma = 0;
  for (let i = 0; i < nome.length; i++) soma = (soma + nome.charCodeAt(i) * (i + 1)) % 360;
  // Saturação e luminosidade fixas: a variação é só de matiz, para nenhuma
  // combinação sair berrante nem apagada ao lado das outras.
  return `hsl(${soma} 42% 42%)`;
}
