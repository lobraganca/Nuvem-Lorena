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

Daí ITABIRITO ser a maior palavra da peça. Nas outras duas a cidade é a
tarja pequena e apagada da casa; aqui ela é a manchete, porque é a
informação que decide se a peça vale ou não para quem está vendo — e
porque a dona pediu a ênfase duas vezes, sendo que na primeira ela virou
só tarja maior, que é ênfase de posição e não de tamanho.

── O ENCONTRO, DESENHADO ──────────────────────────────────────────────

O pedido tem duas partes que brigam: "convide as pessoas E as empresas" e
"minimalista". Escrever os dois convites são dois parágrafos; e dois
parágrafos numa peça paga é uma peça que ninguém lê.

A saída é desenhar em vez de escrever. Duas linhas vindo das bordas
opostas e parando na bolinha laranja do logo — o encontro que a frase
descreve, no lugar exato onde ela diz "aqui". Uma linha de desenho no
lugar de duas de texto, e a bolinha deixa de ser enfeite: ela vira o
sentido da peça.

As duas palavras embaixo ("EMPRESAS" e "PESSOAS") só nomeiam o que a seta
já mostrou, e estão na mesma ordem da frase de cima ("quem contrata" à
esquerda, "quem procura" à direita), para o olho ligar as duas sem
esforço. Eram menores e num branco apagado; subiram para 26px em negrito
e branco puro quando o azul clareou — ver a seção do azul, adiante.

── A BOLINHA LARANJA PRECISOU DE UM ARO ───────────────────────────────

O laranja do logo (253,170,70) some sobre qualquer azul da marca: 1,39
sobre o azul da capa, 1,72 sobre o azul claro daqui. Está medido, e é por
isso que `gerar-arte-cadastre.py` proíbe o laranja fora do bloco de papel.
Aqui ele é o ponto central da peça, então não dava para simplesmente não
usar.

O aro branco resolve: quem separa a bolinha do fundo é o aro (branco sobre
o azul daqui, 3,27 — acima do mínimo de 3,0 que a norma pede para desenho,
não para letra), e o laranja fica sendo a cor de dentro, que não precisa
mais carregar sozinha o trabalho de aparecer. É o mesmo motivo de o logo
funcionar — lá a bolinha é enorme, e tamanho é o que ela tem no lugar de
contraste. Encolhida numa peça, o aro faz o papel do tamanho.

Sem ele, visto na miniatura, o laranja vira uma mancha parda no azul.

── O AZUL: ATÉ ONDE DÁ PARA CLAREAR ───────────────────────────────────

A dona: "o azul está muito escuro" — com a logo anexada de novo, ou seja,
pedindo o azul dela: o (1,167,253).

Sobre esse azul o branco dá **2,64** de contraste. Não é pouco: é ilegível
por qualquer régua (o mínimo é 3,0 para letra grande e 4,5 para o resto).
E letra escura ela já recusou, em 07/09 — "as letras em preto não ficou
bom". Então o pedido, ao pé da letra, não fecha: azul da logo E letra
branca não existem juntos.

O que dá para fazer é ir até o limite. Medida a escala inteira entre o
azul de antes e o da logo:

    (10,114,196)  4,98   ← o de antes, que ela achou escuro
    (9,122,205)   4,49   ← o mais claro que ainda passa em letra pequena
    (4,148,233)   3,27   ← ESTE, o mais claro que passa em letra grande
    (3,154,239)   3,06   ← o limite absoluto, sem folga nenhuma
    (1,167,253)   2,64   ← o da logo. Branco some.

Ficou o (4,148,233): bem mais claro que o anterior, na mesma família do
azul da logo, e com folga sobre o mínimo de 3,0.

O preço é que a peça não pode ter letra pequena branca — 3,27 só vale para
letra grande (a régua chama de grande o que passa de 24px em negrito).
Por isso TODO texto branco daqui subiu de tamanho e de peso: as duas
palavras dos lados, o endereço do rodapé. Não é enfeite; é o que torna o
azul claro possível.

Ir até o (1,167,253) exigiria letra escura — que é a saída que existe, e
que ela pode pedir a qualquer momento: sobre o azul da logo a tinta escura
dá 5,41, folgado. São as duas únicas combinações que funcionam.
"""

from PIL import Image, ImageDraw

import artes_ei as ei

# ── ITABIRITO É A MAIOR PALAVRA DA PEÇA ────────────────────────────────
#
# A dona pediu "enfatize Itabirito" duas vezes. Na primeira, virou a tarja
# de cima — que é ênfase de posição, não de tamanho, e ela pediu de novo.
#
# Agora é ênfase de verdade: a cidade é a palavra MAIOR da peça, e a frase
# dela passa a ser a linha de apoio. A troca não perde nada — a frase
# continua inteira e legível —, e ganha o que um anúncio de cidade
# precisa: quem mora aqui reconhece o nome de longe, na rolagem, antes de
# ler qualquer outra coisa.
#
# "EMPREGO EM" fica pequeno em cima, como quem apresenta: lidos juntos,
# os dois dão o assunto e o lugar, que é o que decide se a pessoa para.
ANTES_DA_CIDADE = "EMPREGO EM"
CIDADE = "ITABIRITO"
FRASE = "Quem contrata e quem procura, aqui se encontram."
LADO_E = "EMPRESAS"
LADO_D = "PESSOAS"
CHAMADA = "Cadastre-se. É de graça."
ENDERECO = "www.empregoitabirito.com.br"

# O laranja da bolinha do logo, medido no arquivo que a dona mandou.
LARANJA_EI = (253, 170, 70)

# O azul claro e o fio dele moram em `artes_ei` desde 09/09: esta peça
# deixou de ser a única a usá-los, e constante copiada é constante que
# diverge. A escala medida e a regra que vem junto (nada de letra branca
# pequena) estão lá.
AZUL_CLARO = ei.AZUL_CLARO

# ── AS ALTURAS ─────────────────────────────────────────────────────────
# Fixas e todas aqui em cima, como nas outras peças: altura calculada no
# meio do desenho é peça que sai diferente a cada troca de frase, e
# "está desalinhado" foi a primeira coisa apontada neste projeto.
Y_ANTES = 268
Y_CIDADE = 322
TAM_CIDADE = 142
Y_FRASE = 542
Y_ENCONTRO = 782          # a linha do encontro
Y_LADOS = 826             # as duas palavras, embaixo dela
Y_CHAMADA = 936
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
    ei.conferir_cabe(ei.INTER_SEMI, 30, [ANTES_DA_CIDADE], ei.LARGURA_TEXTO, "o 'emprego em'")
    ei.conferir_cabe(ei.INTER_PRETA, TAM_CIDADE, [CIDADE], ei.LARGURA_TEXTO, "cidade")
    ei.conferir_cabe(ei.INTER_PESADA, 40, [CHAMADA], ei.LARGURA_TEXTO - 120, "chamada")
    ei.conferir_cabe(ei.INTER_SEMI, 26, [ENDERECO], ei.LARGURA_TEXTO, "endereço")

    # O fundo é pintado aqui, e não por `peca_lisa`: este azul é só desta
    # peça. Mexer no da casa mudaria as outras duas, que já estão prontas.
    img = Image.new("RGB", (ei.L, ei.A), AZUL_CLARO)
    d = ImageDraw.Draw(img)
    x0, x1 = ei.MARGEM, ei.L - ei.MARGEM

    fio = ei.FIO_CLARO

    # A caixa da chamada e o desenho do encontro vêm ANTES do texto: o
    # contraste tem de ser medido contra o fundo de verdade. Medindo a peça
    # acabada, os pixels da própria letra entram na conta e o resultado é
    # 1,00 — o erro que a primeira geração destas artes cometeu.
    d.rectangle((x0, Y_CHAMADA, x1, Y_CHAMADA + ALTURA_CHAMADA), fill=ei.PAPEL)
    d.rectangle((x0, Y_CHAMADA, x1, Y_CHAMADA + 8), fill=LARANJA_EI)
    encontro(d, Y_ENCONTRO)

    # ── A conferência, com o fundo pronto e ANTES da letra ────────────
    #
    # Aqui a régua é 3,0, e não 4,5 como nas outras peças. Não é bar mais
    # baixa por conveniência: 3,0 é o mínimo da norma para LETRA GRANDE, e
    # todo texto branco desta peça é grande — é por isso que as duas
    # palavras dos lados e o endereço subiram de tamanho e de peso quando o
    # azul clareou. Se alguém encolher qualquer um deles, tem de escurecer
    # o azul junto; as duas coisas andam amarradas.
    ei.conferir_contraste(img, ei.SOBRE_CAPA,
                          (x0, Y_ANTES, x1, Y_ANTES + 40), 3.0, "o 'emprego em'")
    ei.conferir_contraste(img, ei.SOBRE_CAPA,
                          (x0, Y_CIDADE, x1, Y_CIDADE + 170), 3.0, "cidade")
    ei.conferir_contraste(img, ei.SOBRE_CAPA,
                          (x0, Y_FRASE, x1, Y_FRASE + 150), 3.0, "frase")
    # Só as pontas, e não a faixa inteira: no meio dela está o aro branco
    # da bolinha, e medir por cima dele reprovava um texto que nunca
    # encosta ali. A régua vale onde a letra está.
    ei.conferir_contraste(img, ei.SOBRE_CAPA,
                          (x0, Y_LADOS, x0 + 260, Y_LADOS + 36), 3.0, "lado esquerdo")
    ei.conferir_contraste(img, ei.SOBRE_CAPA,
                          (x1 - 260, Y_LADOS, x1, Y_LADOS + 36), 3.0, "lado direito")
    ei.conferir_contraste(img, ei.TINTA,
                          (x0 + 40, Y_CHAMADA + 40, x1 - 40, Y_CHAMADA + 130),
                          4.5, "chamada")
    ei.conferir_contraste(img, ei.SOBRE_CAPA,
                          (x0, ei.Y_RODAPE + 30, x1, ei.Y_RODAPE + 70),
                          3.0, "endereço")

    # ── Agora a letra ─────────────────────────────────────────────────
    marca = ei._marca_colorida(38, ei.SOBRE_CAPA)
    img.paste(marca, (ei.MARGEM, ei.Y_CABECALHO), marca)
    d.line((x0, ei.Y_FIO_ALTO, x1, ei.Y_FIO_ALTO), fill=fio, width=2)

    # "EMPREGO EM" pequeno, apresentando; a cidade embaixo, enorme.
    ei.escrever(d, (ei.MARGEM, Y_ANTES), ANTES_DA_CIDADE,
                ei.f(ei.INTER_SEMI, 30), ei.SOBRE_CAPA, 7.0)

    # A cidade em Inter-900, o peso mais pesado que existe na casa, e com o
    # tracking negativo de manchete: num nome de nove letras deste tamanho,
    # o espaço solto entre elas é o que faria a palavra parecer esticada em
    # vez de firme.
    ei.escrever(d, (ei.MARGEM, Y_CIDADE), CIDADE,
                ei.f(ei.INTER_PRETA, TAM_CIDADE), ei.SOBRE_CAPA,
                -TAM_CIDADE * 0.028)

    # A frase, agora como apoio da cidade — inteira, e ainda a segunda
    # coisa que se lê.
    ei.manchete(d, FRASE, 54, ei.SOBRE_CAPA, Y_FRASE, entrelinha=1.24,
                fonte_arq=ei.INTER_NEGRITO)

    # As duas palavras, nas pontas das setas e na ordem da frase de cima.
    # Branco puro e 26px em negrito: com o azul claro, o tom apagado
    # (234,246,255) cairia abaixo do mínimo, e letra pequena aqui também.
    fonte_lado = ei.f(ei.INTER_NEGRITO, 26)
    ei.escrever(d, (ei.MARGEM, Y_LADOS), LADO_E, fonte_lado, ei.SOBRE_CAPA, 5.0)
    larg_d = ei.largura_com_tracking(d, LADO_D, fonte_lado, 5.0)
    ei.escrever(d, (x1 - larg_d, Y_LADOS), LADO_D, fonte_lado, ei.SOBRE_CAPA, 5.0)

    # A chamada, centralizada na caixa: é um BOTÃO, e botão tem o texto no
    # meio. O resto da peça é alinhado à esquerda de propósito.
    fonte = ei.f(ei.INTER_PESADA, 40)
    larg = d.textlength(CHAMADA, font=fonte)
    d.text((x0 + (x1 - x0 - larg) / 2, Y_CHAMADA + 68), CHAMADA,
           font=fonte, fill=ei.TINTA)

    d.line((x0, ei.Y_RODAPE, x1, ei.Y_RODAPE), fill=fio, width=2)
    ei.escrever(d, (ei.MARGEM, ei.Y_RODAPE + 36), ENDERECO,
                ei.f(ei.INTER_SEMI, 26), ei.SOBRE_CAPA, 1.0)

    print(f"pronto: {ei.salvar(img, 'ei-encontro-itabirito.png')}")


if __name__ == "__main__":
    gerar()
