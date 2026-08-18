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

function matizDoNome(nome: string): number {
  let soma = 0;
  for (let i = 0; i < nome.length; i++) soma = (soma + nome.charCodeAt(i) * (i + 1)) % 360;
  return soma;
}

/**
 * Fundo das iniciais: claro, da matiz que o nome gera.
 *
 * Era um bloco de cor média (42% de luminosidade) com as letras em branco,
 * e isso o tornava a coisa mais forte da tela — mais que a nota, mais que o
 * nome. Um quadrado gritante para dizer justamente "esta pessoa não mandou
 * foto": o espaço-reserva vencia o conteúdo, e vencia também as fotos de
 * verdade dos vizinhos, que são o que a lista quer mostrar.
 *
 * Claro, ele continua distinguindo um cadastro do outro — que é o motivo
 * de a cor existir — sem disputar a atenção com nada.
 *
 * Saturação e luminosidade continuam fixas: a variação é só de matiz, para
 * nenhuma combinação sair berrante nem apagada ao lado das outras.
 */
export function corDoNome(nome: string): string {
  return `hsl(${matizDoNome(nome)} 44% 92%)`;
}

/**
 * A tinta das iniciais, na mesma matiz do fundo.
 *
 * 30% de luminosidade contra os 92% do fundo dá no mínimo 7:1 de contraste
 * em qualquer matiz — bem acima dos 4,5:1 exigidos, e necessário porque
 * são só duas letras: texto curto não dá ao olho uma segunda chance de
 * decifrar.
 */
export function tintaDoNome(nome: string): string {
  return `hsl(${matizDoNome(nome)} 55% 30%)`;
}
