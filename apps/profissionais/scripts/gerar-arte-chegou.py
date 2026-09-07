"""
"Chegou o Ei em Itabirito" — o anúncio de lançamento, para o Instagram.

A dona: "me faça uma propaganda em arte nas cores e layout para publicar
no Instagram dizendo que chegou o Ei em Itabirito. Onde quem quer
contratar e quem quer trabalhar se encontram. Www.empregoitabirito.com.br"

── É UM ANÚNCIO, E ANÚNCIO TEM UMA COISA SÓ PARA DIZER ────────────────

O carrossel do Dia 1 (`gerar-arte-dia1.py`) tem nove telas porque conta
uma história: a dor, a conta, a virada. Este não conta história nenhuma —
ele avisa que uma coisa existe. Então é UMA peça, com três informações e
nada mais: o nome, o que é, e onde fica.

A tentação aqui é encher: "grátis", "sem cadastro", "baixe o app",
"cinco vagas hoje". Cada uma dessas linhas rouba do anúncio a única coisa
que ele precisa entregar — a pessoa lembrar o nome e o endereço.

── AS DUAS METADES SÃO O ASSUNTO ──────────────────────────────────────

"Onde quem quer contratar e quem quer trabalhar se encontram" é a frase
dela, e ela descreve um ENCONTRO. Então a peça desenha isso: dois blocos,
um de cada lado, e um fio ligando os dois no meio.

É o mesmo desenho da rede de conexões da tela inicial do app (ver a capa,
em `Vitrine.tsx`) — quem vir o post e depois abrir o site reconhece. Uma
peça que não se parece com o produto anunciado faz a pessoa achar que
errou de endereço.

── AS REGRAS DA CASA, TODAS HERDADAS ──────────────────────────────────

Fundo chapado (sem degradê), azul do Ei, texto em TINTA sobre ele —
branco sobre este azul dá 2,64 de contraste e some. Inter, margem de 128,
e o endereço no pé. O que é medido: cada frase tem de caber na largura
(`conferir_cabe`) e cada bloco de texto tem de passar no contraste contra
o fundo REAL (`conferir_contraste`), inclusive por cima do fio da rede.
"""

import artes_ei as ei
from PIL import ImageDraw

# ── O TEXTO ────────────────────────────────────────────────────────────
#
# "Chegou o Ei" e não "Chegou o Ei Emprego": o nome comprido em corpo de
# manchete quebra em duas linhas e some o impacto. O nome inteiro aparece
# na marca, no alto, e no endereço, no pé — duas vezes, que basta.
TARJA = "AGORA EM ITABIRITO"
MANCHETE = "Chegou o Ei"
# A frase é dela, palavra por palavra. Só a pontuação é minha.
FRASE = "Onde quem quer contratar e quem quer trabalhar se encontram."
LADO_A = "QUEM CONTRATA"
LADO_B = "QUEM PROCURA"
# Com o "www." porque foi assim que ela escreveu, e é assim que se lê em
# voz alta numa cidade onde o link corre por WhatsApp e por conversa.
ENDERECO = "www.empregoitabirito.com.br"

# ── AS ALTURAS ─────────────────────────────────────────────────────────
#
# Fixas e escritas aqui em cima, e não espalhadas pelo desenho: peça com
# altura calculada no meio do código é peça que sai diferente a cada
# mudança de frase, e "está desalinhado" foi a primeira coisa que a dona
# apontou na primeira arte.
Y_TARJA = 332
Y_MANCHETE = 404
Y_ENCONTRO = 762          # a linha dos dois blocos
ALTURA_BLOCO = 152
Y_FRASE = 1012


def _rede(d, topo: int, base: int) -> None:
    """A rede de conexões, bem clara, na faixa vazia da peça.

    Só entre `topo` e `base` de propósito: sob a manchete ela roubaria
    contraste da letra, que é o defeito que a capa do app já pagou. Aqui
    ela mora onde não há texto, e o `conferir_contraste` no fim confirma
    que nenhum bloco escrito passou por cima dela.

    Pontos e fios fixos, escritos à mão. Sorteados, a peça sairia
    diferente a cada geração — e uma arte que muda sozinha entre uma
    conferência e a publicação é uma arte que não dá para aprovar.
    """
    nos = [(150, 60), (330, 20), (520, 78), (700, 24), (900, 66),
           (240, 150), (450, 168), (660, 140), (860, 172)]
    fios = [(0, 1), (1, 2), (2, 3), (3, 4), (5, 6), (6, 7), (7, 8),
            (0, 5), (2, 6), (4, 8), (1, 6), (3, 7)]
    for a, b in fios:
        d.line((nos[a][0], topo + nos[a][1], nos[b][0], topo + nos[b][1]),
               fill=ei.FIO_CAPA, width=2)
    for x, y in nos:
        d.ellipse((x - 5, topo + y - 5, x + 5, topo + y + 5), fill=ei.FIO_CAPA)


def _bloco(d, x: int, y: int, largura: int, texto: str) -> None:
    """Um dos dois lados do encontro: retângulo de papel com uma palavra.

    Papel e não azul mais claro: sobre o azul do Ei, um azul vizinho vira
    mancha e a palavra dentro dele perde contraste. O creme separa os dois
    lados do fundo sem inventar cor nova na peça.
    """
    d.rectangle((x, y, x + largura, y + ALTURA_BLOCO), fill=ei.PAPEL)
    fonte = ei.f(ei.INTER_SEMI, 27)
    palavras = texto.split()
    alt_linha = 38
    topo = y + (ALTURA_BLOCO - alt_linha * len(palavras)) // 2
    for i, palavra in enumerate(palavras):
        larg = ei.largura_com_tracking(d, palavra, fonte, 3.0)
        ei.escrever(d, (x + (largura - larg) / 2, topo + i * alt_linha),
                    palavra, fonte, ei.TINTA, 3.0)


def gerar() -> None:
    largura_bloco = (ei.LARGURA_TEXTO - 84) // 2   # 84 é o vão do meio
    x_a = ei.MARGEM
    x_b = ei.MARGEM + largura_bloco + 84

    # ── Antes de desenhar: tudo cabe? ─────────────────────────────────
    # Falhar aqui custa um minuto de reescrita. Texto vazando a borda foi
    # apontado numa rodada, e texto encolhido sozinho na seguinte.
    ei.conferir_cabe(ei.INTER_PESADA, 118, [MANCHETE], ei.LARGURA_TEXTO, "manchete")
    ei.conferir_cabe(ei.INTER_SEMI, 23, [TARJA], ei.LARGURA_TEXTO, "tarja")
    ei.conferir_cabe(ei.INTER_MEDIA, 25, [ENDERECO], ei.LARGURA_TEXTO, "endereço")
    for palavra in LADO_A.split() + LADO_B.split():
        ei.conferir_cabe(ei.INTER_SEMI, 27, [palavra], largura_bloco - 24, "bloco do encontro")

    img, d = ei.peca_lisa(escura=True)

    # A rede vive na faixa entre a manchete e os blocos, que é a única
    # parte da peça sem texto nenhum.
    _rede(d, Y_MANCHETE + 190, Y_ENCONTRO - 20)

    # O fio que LIGA os dois blocos. É o desenho da frase: sem ele são dois
    # cartões soltos; com ele, um encontro.
    meio = Y_ENCONTRO + ALTURA_BLOCO // 2
    d.line((x_a + largura_bloco, meio, x_b, meio), fill=ei.PAPEL, width=4)
    d.ellipse((x_a + largura_bloco + 34, meio - 12,
               x_a + largura_bloco + 58, meio + 12), fill=ei.PAPEL)

    # ── A conferência do contraste vem AQUI, com o fundo pronto e ANTES
    #    do texto. Medindo a peça acabada, os pixels da própria letra
    #    entram na conta e o resultado é 1,00 — o erro que a primeira
    #    geração destas artes cometeu.
    ei.conferir_contraste(img, ei.SOBRE_CAPA,
                          (ei.MARGEM, Y_MANCHETE, ei.L - ei.MARGEM, Y_MANCHETE + 190),
                          3.0, "manchete")
    ei.conferir_contraste(img, ei.SOBRE_CAPA_FRACO,
                          (ei.MARGEM, Y_TARJA, ei.L - ei.MARGEM, Y_TARJA + 40),
                          4.5, "tarja")
    ei.conferir_contraste(img, ei.SOBRE_CAPA,
                          (ei.MARGEM, Y_FRASE, ei.L - ei.MARGEM, Y_FRASE + 140),
                          4.5, "frase")
    ei.conferir_contraste(img, ei.SOBRE_CAPA_FRACO,
                          (ei.MARGEM, ei.Y_RODAPE + 30, ei.L - ei.MARGEM, ei.Y_RODAPE + 70),
                          4.5, "endereço")

    # ── Agora o texto ─────────────────────────────────────────────────
    marca = ei._marca_colorida(38, ei.SOBRE_CAPA)
    img.paste(marca, (ei.MARGEM, ei.Y_CABECALHO), marca)
    d.line((ei.MARGEM, ei.Y_FIO_ALTO, ei.L - ei.MARGEM, ei.Y_FIO_ALTO),
           fill=ei.FIO_CAPA, width=2)

    ei.sobrenome(d, TARJA, escura=True, y=Y_TARJA)
    ei.manchete(d, MANCHETE, 118, ei.SOBRE_CAPA, Y_MANCHETE)

    _bloco(d, x_a, Y_ENCONTRO, largura_bloco, LADO_A)
    _bloco(d, x_b, Y_ENCONTRO, largura_bloco, LADO_B)

    ei.apoio(d, FRASE, 38, ei.SOBRE_CAPA, Y_FRASE, entrelinha=1.36)

    d.line((ei.MARGEM, ei.Y_RODAPE, ei.L - ei.MARGEM, ei.Y_RODAPE),
           fill=ei.FIO_CAPA, width=2)
    ei.escrever(d, (ei.MARGEM, ei.Y_RODAPE + 36), ENDERECO,
                ei.f(ei.INTER_MEDIA, 25), ei.SOBRE_CAPA_FRACO, 1.0)

    caminho = ei.salvar(img, "ei-chegou-itabirito.png")
    print(f"pronto: {caminho}")


if __name__ == "__main__":
    gerar()
