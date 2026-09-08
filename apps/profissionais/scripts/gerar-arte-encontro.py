"""
"Aqui se encontram" — a peça para TURBINAR, com o encontro desenhado.

A dona: "faça um post criativo minimalista para ser turbinado no Instagram
convidando as pessoas e empresas a se cadastrarem com a frase quem contrata
e quem procura aqui se encontram e enfatize Itabirito. Utilize as paletas
da logo anexa."

── O QUE MUDA DAS DUAS PEÇAS ANTERIORES ───────────────────────────────

`gerar-arte-chegou.py` AVISA que o app existe. `gerar-arte-cadastre.py`
PEDE o cadastro. Esta é a terceira, e a diferença dela não é o texto: é
que ela vai ser PAGA.

Anúncio turbinado aparece no meio da rolagem de quem não segue a página e
não pediu para ver — o oposto de um post, que chega a quem já quis. Isso
muda duas coisas, e as duas para menos:

  1. a peça precisa ser entendida em MINIATURA, que é como o Instagram a
     mostra na primeira fração de segundo;
  2. ela precisa dizer ONDE fica, ou o dinheiro vai para gente de fora de
     Itabirito que nunca vai se cadastrar.

Daí o carimbo da cidade ter subido de lugar e de tamanho: nas outras peças
"ITABIRITO · MG" é a tarja pequena e apagada da casa; aqui ele é branco,
maior e espaçado, porque é a informação que decide se a peça vale ou não
para quem está vendo.

── O ENCONTRO, DESENHADO ──────────────────────────────────────────────

O pedido tem duas partes que brigam: "convide as pessoas E as empresas" e
"minimalista". Escrever os dois convites são dois parágrafos; e dois
parágrafos numa peça paga é uma peça que ninguém lê.

A saída é desenhar em vez de escrever. Duas linhas vindo das bordas
opostas e parando na bolinha laranja do logo — o encontro que a frase
descreve, no lugar exato onde ela diz "aqui". Uma linha de desenho no
lugar de duas de texto, e a bolinha deixa de ser enfeite: ela vira o
sentido da peça.

As duas palavras embaixo ("EMPRESAS" e "PESSOAS") são pequenas de
propósito — elas só nomeiam o que a seta já mostrou, e estão na mesma
ordem da frase de cima ("quem contrata" à esquerda, "quem procura" à
direita), para o olho ligar as duas sem esforço.

── A BOLINHA LARANJA PRECISOU DE UM ARO ───────────────────────────────

O laranja do logo (253,170,70) sobre o azul da capa dá 1,39 de contraste —
está medido, e é por isso que `gerar-arte-cadastre.py` proíbe o laranja
fora do bloco de papel. Aqui ele é o ponto central da peça, então não dava
para simplesmente não usar.

O aro branco resolve: quem separa a bolinha do fundo é o aro (branco sobre
azul, 4,98), e o laranja fica sendo a cor de dentro, que não precisa mais
carregar sozinha o trabalho de aparecer. É o mesmo motivo de o logo
funcionar — lá a bolinha é enorme, e tamanho é o que ela tem no lugar de
contraste. Encolhida numa peça, o aro faz o papel do tamanho.

Sem ele, visto na miniatura, o laranja vira uma mancha parda no azul.

── A PALETA É A DO LOGO, E O AZUL É O DE LER ──────────────────────────

O azul do logo é o (1,167,253). Branco sobre ele dá 2,64 — some. O fundo
aqui é o (10,114,196), o mesmo `--ei-acento` da capa do app, onde o branco
dá 4,98 e o texto se lê. É a mesma família de azul, escolhida pelo lado
que passa na régua: a peça mais bonita que não se lê no celular de alguém
não é a mais bonita.
"""

from PIL import ImageDraw

import artes_ei as ei

# "EMPREGO EM ITABIRITO", e não só o nome da cidade: num anúncio pago quem
# vê não conhece a marca nem pediu para ver. Três palavras dão o assunto e
# o lugar antes de a pessoa decidir se continua olhando — e é a decisão que
# ela toma em menos de um segundo. Só "ITABIRITO · MG" diz onde, mas não
# diz do quê, e a manchete sozinha levaria mais um instante para explicar.
CIDADE = "EMPREGO EM ITABIRITO"
FRASE = "Quem contrata e quem procura, aqui se encontram."
LADO_E = "EMPRESAS"
LADO_D = "PESSOAS"
CHAMADA = "Cadastre-se. É de graça."
ENDERECO = "www.empregoitabirito.com.br"

# O laranja da bolinha do logo, medido no arquivo que a dona mandou.
LARANJA_EI = (253, 170, 70)

# ── AS ALTURAS ─────────────────────────────────────────────────────────
# Fixas e todas aqui em cima, como nas outras peças: altura calculada no
# meio do desenho é peça que sai diferente a cada troca de frase, e
# "está desalinhado" foi a primeira coisa apontada neste projeto.
Y_CIDADE = 286
Y_FRASE = 392
Y_ENCONTRO = 792          # a linha do encontro
Y_LADOS = 838             # as duas palavras, embaixo dela
Y_CHAMADA = 946
ALTURA_CHAMADA = 180

# O desenho do encontro.
RAIO_BOLA = 40
ARO = 7                   # a espessura do aro branco
VAO = 34                  # o respiro entre a ponta da seta e o aro
SETA_L, SETA_A = 26, 22   # a ponta da seta


def encontro(d: ImageDraw.ImageDraw, y: int) -> None:
    """Duas linhas vindo das bordas e parando na bolinha do logo."""
    centro = ei.L // 2
    parada = RAIO_BOLA + ARO + VAO

    for lado in (-1, 1):
        # A PONTA é o ponto mais perto da bolinha, e a BASE fica atrás
        # dela, mais longe do centro — `+ lado`, não `- lado`. Com o sinal
        # trocado a seta aponta para fora, e o desenho passa a dizer o
        # contrário da frase: em vez de dois lados se encontrando, dois se
        # afastando. Foi assim que saiu na primeira geração.
        ponta = centro + lado * parada
        base = ponta + lado * SETA_L
        inicio = centro + lado * (centro - ei.MARGEM)
        d.line((inicio, y, base, y), fill=ei.SOBRE_CAPA, width=4)
        d.polygon(
            [(ponta, y),
             (base, y - SETA_A // 2),
             (base, y + SETA_A // 2)],
            fill=ei.SOBRE_CAPA,
        )

    # O aro primeiro, a bolinha por cima: assim a borda sai lisa, sem a
    # serrilha que aparece quando se desenha um anel por fora de um disco.
    fora = RAIO_BOLA + ARO
    d.ellipse((centro - fora, y - fora, centro + fora, y + fora), fill=ei.SOBRE_CAPA)
    d.ellipse((centro - RAIO_BOLA, y - RAIO_BOLA,
               centro + RAIO_BOLA, y + RAIO_BOLA), fill=LARANJA_EI)


def gerar() -> None:
    # ── Antes de desenhar: cabe? ──────────────────────────────────────
    ei.conferir_cabe(ei.INTER_SEMI, 34, [CIDADE], ei.LARGURA_TEXTO, "cidade")
    ei.conferir_cabe(ei.INTER_PESADA, 40, [CHAMADA], ei.LARGURA_TEXTO - 120, "chamada")
    ei.conferir_cabe(ei.INTER_MEDIA, 25, [ENDERECO], ei.LARGURA_TEXTO, "endereço")

    img, d = ei.peca_lisa(escura=True)
    x0, x1 = ei.MARGEM, ei.L - ei.MARGEM

    # A caixa da chamada e o desenho do encontro vêm ANTES do texto: o
    # contraste tem de ser medido contra o fundo de verdade. Medindo a peça
    # acabada, os pixels da própria letra entram na conta e o resultado é
    # 1,00 — o erro que a primeira geração destas artes cometeu.
    d.rectangle((x0, Y_CHAMADA, x1, Y_CHAMADA + ALTURA_CHAMADA), fill=ei.PAPEL)
    d.rectangle((x0, Y_CHAMADA, x1, Y_CHAMADA + 8), fill=LARANJA_EI)
    encontro(d, Y_ENCONTRO)

    # ── A conferência, com o fundo pronto e ANTES da letra ────────────
    ei.conferir_contraste(img, ei.SOBRE_CAPA,
                          (x0, Y_CIDADE, x1, Y_CIDADE + 46), 4.5, "cidade")
    ei.conferir_contraste(img, ei.SOBRE_CAPA,
                          (x0, Y_FRASE, x1, Y_FRASE + 330), 3.0, "frase")
    # Só as pontas, e não a faixa inteira: no meio dela está o aro branco
    # da bolinha, e medir por cima dele reprovava um texto que nunca
    # encosta ali. A régua vale onde a letra está.
    ei.conferir_contraste(img, ei.SOBRE_CAPA_FRACO,
                          (x0, Y_LADOS, x0 + 260, Y_LADOS + 36), 4.5, "lado esquerdo")
    ei.conferir_contraste(img, ei.SOBRE_CAPA_FRACO,
                          (x1 - 260, Y_LADOS, x1, Y_LADOS + 36), 4.5, "lado direito")
    ei.conferir_contraste(img, ei.TINTA,
                          (x0 + 40, Y_CHAMADA + 40, x1 - 40, Y_CHAMADA + 130),
                          4.5, "chamada")
    ei.conferir_contraste(img, ei.SOBRE_CAPA_FRACO,
                          (x0, ei.Y_RODAPE + 30, x1, ei.Y_RODAPE + 70),
                          4.5, "endereço")

    # ── Agora a letra ─────────────────────────────────────────────────
    marca = ei._marca_colorida(38, ei.SOBRE_CAPA)
    img.paste(marca, (ei.MARGEM, ei.Y_CABECALHO), marca)
    d.line((x0, ei.Y_FIO_ALTO, x1, ei.Y_FIO_ALTO), fill=ei.FIO_CAPA, width=2)

    # O carimbo da cidade: branco e maior que a tarja das outras peças —
    # numa peça paga, é ele que separa quem pode se cadastrar de quem só
    # vai rolar por cima.
    ei.escrever(d, (ei.MARGEM, Y_CIDADE), CIDADE,
                ei.f(ei.INTER_SEMI, 34), ei.SOBRE_CAPA, 7.0)

    ei.manchete(d, FRASE, 86, ei.SOBRE_CAPA, Y_FRASE, entrelinha=1.12)

    # As duas palavras, nas pontas das setas e na ordem da frase de cima.
    fonte_lado = ei.f(ei.INTER_SEMI, 24)
    ei.escrever(d, (ei.MARGEM, Y_LADOS), LADO_E, fonte_lado, ei.SOBRE_CAPA_FRACO, 5.0)
    larg_d = ei.largura_com_tracking(d, LADO_D, fonte_lado, 5.0)
    ei.escrever(d, (x1 - larg_d, Y_LADOS), LADO_D, fonte_lado, ei.SOBRE_CAPA_FRACO, 5.0)

    # A chamada, centralizada na caixa: é um BOTÃO, e botão tem o texto no
    # meio. O resto da peça é alinhado à esquerda de propósito.
    fonte = ei.f(ei.INTER_PESADA, 40)
    larg = d.textlength(CHAMADA, font=fonte)
    d.text((x0 + (x1 - x0 - larg) / 2, Y_CHAMADA + 68), CHAMADA,
           font=fonte, fill=ei.TINTA)

    d.line((x0, ei.Y_RODAPE, x1, ei.Y_RODAPE), fill=ei.FIO_CAPA, width=2)
    ei.escrever(d, (ei.MARGEM, ei.Y_RODAPE + 36), ENDERECO,
                ei.f(ei.INTER_MEDIA, 25), ei.SOBRE_CAPA_FRACO, 1.0)

    print(f"pronto: {ei.salvar(img, 'ei-encontro-itabirito.png')}")


if __name__ == "__main__":
    gerar()
