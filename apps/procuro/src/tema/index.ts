/**
 * As medidas e as cores do procurô, num lugar só.
 *
 * Existe porque cor escrita à mão dentro da tela é cor que ninguém acha
 * depois. No dia em que o azul mudar meio tom, quem escreveu `#12245C` em
 * quarenta arquivos vai trocar trinta e oito e não achar os outros dois —
 * e os dois que sobraram é que vão aparecer no print.
 *
 * Os nomes dizem PARA QUE SERVE, não qual é a cor. `textoApagado` continua
 * fazendo sentido se um dia o cinza virar azul-acinzentado; `cinzaClaro`
 * não faria.
 */

/**
 * A paleta vem da marca: o azul do fundo da logo, o dourado do circunflexo
 * sobre o "o", e o branco do lettering.
 *
 * O dourado é acento, não segunda cor. Ele aparece no que a pessoa deve
 * fazer a seguir e no que é pago — e em mais nada. Acento usado em tudo
 * deixa de acentuar.
 */
export const cores = {
  /** O azul da marca. Fundo das telas de identidade e dos botões principais. */
  marca: '#12245C',
  /** Um degrau acima, para dar profundidade sem virar outra cor. */
  marcaClara: '#1E3572',
  /** Um degrau abaixo, para pressionado e sombra. */
  marcaEscura: '#0C1940',

  /** O dourado do circunflexo. Só para ação e para o que é pago. */
  destaque: '#E0A44C',
  destaqueEscuro: '#C2873A',
  /** Fundo de etiqueta dourada, bem lavado, para texto escuro por cima. */
  destaqueLavado: '#FBF2E4',

  /** Fundo geral do app. Branco puro cansa em tela de celular no sol. */
  fundo: '#F4F6FB',
  /** Cartão, campo, barra — o que fica por cima do fundo. */
  superficie: '#FFFFFF',
  /** Agrupador de seção, aquele bloco levemente azulado atrás dos cartões. */
  superficieAfundada: '#E8ECF7',

  texto: '#111A33',
  textoApagado: '#5A6683',
  /** Texto sobre o azul da marca. */
  textoSobreMarca: '#FFFFFF',

  borda: '#DDE3F0',
  bordaForte: '#C3CCE2',

  /** Estados. Verde de "deu certo", vermelho de "não dá", âmbar de "atenção". */
  sucesso: '#1E8E5A',
  sucessoLavado: '#E6F5EE',
  erro: '#C2352B',
  erroLavado: '#FBEBEA',
  atencao: '#B87A15',
  atencaoLavado: '#FDF4E3',
} as const;

/**
 * Espaçamento numa escala só. Números soltos (13, 17, 22) fazem a tela
 * parecer torta sem ninguém saber dizer por quê — o olho percebe o ritmo
 * quebrado antes de a cabeça achar o culpado.
 */
export const espaco = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * Cantos. O app é redondo: cartão bem arredondado, botão em cápsula.
 * É o que dá a sensação de macio que a referência tem.
 */
export const canto = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  /** Cápsula — para botão e etiqueta. Número alto, não 9999: no Android
   *  valor gigante em `borderRadius` já causou canto quadrado em versão
   *  antiga do React Native. */
  capsula: 999,
} as const;

/**
 * Tipografia. Tamanhos com nome de papel, não de medida, para a tela dizer
 * `tipo.titulo` e não `fontSize: 28`.
 */
export const tipo = {
  gigante: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  titulo: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3 },
  secao: { fontSize: 18, fontWeight: '700' as const },
  corpoForte: { fontSize: 15, fontWeight: '600' as const },
  corpo: { fontSize: 15, fontWeight: '400' as const },
  apoio: { fontSize: 13, fontWeight: '400' as const },
  etiqueta: { fontSize: 11, fontWeight: '600' as const },
} as const;

/**
 * Sombra. Escrita nas duas plataformas porque `elevation` não faz nada no
 * iOS e `shadowOffset` não faz nada no Android — usar só uma delas dá um
 * app que parece chapado em metade dos aparelhos.
 */
export const sombra = {
  cartao: {
    shadowColor: '#0C1940',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  elevada: {
    shadowColor: '#0C1940',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;

/**
 * Altura mínima de qualquer coisa em que se toca.
 *
 * 44 não é número escolhido a esmo: é o mínimo que a Apple e o Google
 * recomendam, e é a diferença entre "não funciona" e "funciona" para quem
 * tem dedo grosso, pressa, ou mão tremendo.
 */
export const ALVO_DE_TOQUE = 44;
