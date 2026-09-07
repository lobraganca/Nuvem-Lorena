"""
A moldura das artes do Ei Emprego — a régua que TODA peça obedece.

Este arquivo existe por causa de uma reprovação: a primeira leva das artes
dos planos saiu desalinhada porque a altura do cartão era calculada a
partir do conteúdo e a letra encolhia sozinha quando a frase não cabia.
Cada peça terminava com medidas próprias. Sozinha ninguém percebe; passando
uma atrás da outra no carrossel, tudo pula.

Consertado lá, veio o segundo pedido — "faça um nos mesmos moldes para os
benefícios do app". "Nos mesmos moldes" só continua verdade se houver UM
molde. Copiar o gerador dos planos e trocar o texto criaria duas réguas que
se separam no primeiro ajuste — e o desalinhamento voltaria, agora entre as
duas séries. Por isso a régua mora aqui e os geradores só trazem o texto.

── A régua ──────────────────────────────────────────────────────────────

    marca do Ei
    ┌──────────────────────────────┐
    │  [selo]      ← lugar SEMPRE reservado, mesmo sem selo
    │  Título
    │  ───         ← a barrinha laranja
    │  DESTAQUE    ← faixa de altura fixa: preço, ou uma palavra grande
    │  ──────────  ← o fio cinza
    │  · linha 1
    │  · linha 2   ← três, sempre três
    │  · linha 3
    │  ( chamada ) ← a pílula laranja
    └──────────────────────────────┘

Duas regras que valem para quem for acrescentar uma série nova:

  1. SÃO SEMPRE TRÊS LINHAS. Uma peça com duas ao lado de outra com três é
     exatamente o desalinhamento que foi reprovado.
  2. O TAMANHO DA LETRA É ESCOLHIDO UMA VEZ, para todas as peças juntas —
     `maior_que_cabe` mede a frase mais comprida de todas. Encolher letra
     peça por peça é o defeito original com outra roupa.
"""

import os
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

APP = Path(__file__).resolve().parent.parent
SAIDA = Path(os.environ.get("SAIDA", "/tmp"))

AZUL = (1, 167, 253)
AZUL_FUNDO = (1, 150, 232)
LARANJA = (245, 124, 0)
ESCURO = (28, 40, 55)
CINZA = (108, 122, 137)
FIO = (232, 237, 242)
BRANCO = (255, 255, 255)

FONTE = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONTE_N = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

L, A = 1080, 1350

CARTAO = (84, 232, 996, 1266)          # esquerda, topo, direita, baixo
PAD = 68
DENTRO_E = CARTAO[0] + PAD             # 152
DENTRO_D = CARTAO[2] - PAD             # 928
LARGURA_DENTRO = DENTRO_D - DENTRO_E   # 776
MEIO = (CARTAO[0] + CARTAO[2]) // 2

C = CARTAO[1]
Y_SELO = C + 52          # topo do selo (altura 62) — lugar sempre reservado
Y_TITULO = C + 156
Y_REGUA = C + 262        # a barrinha laranja
Y_DESTAQUE = C + 306     # topo da faixa grande (preço, ou palavra)
ALTO_DESTAQUE = 150
Y_FIO = C + 508
Y_LINHA = C + 566        # topo da primeira das três linhas
PASSO_LINHA = 78
Y_CHAMADA = C + 846
ALTO_CHAMADA = 104

SELO_ALTO = 62
MARCA_ALTO = 118
MARCA_TOPO = 74

# O espaço que sobra para o texto de uma linha com visto na frente.
LARGURA_LINHA = LARGURA_DENTRO - 58


def f(caminho: str, tamanho: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(caminho, tamanho)


# ── OS TAMANHOS DA CASA ─────────────────────────────────────────────────
#
# Fixos, e iguais em TODA série. Foram escolhidos medindo o texto das artes
# dos planos com `maior_que_cabe`, e depois congelados aqui.
#
# Congelados por quê: enquanto cada série calculava o próprio tamanho, uma
# frase comprida numa peça encolhia a letra da série inteira — e duas
# séries lado a lado saíam com letras diferentes sem ninguém pedir. Agora é
# o contrário: o tamanho manda no texto. Frase que não cabe não encolhe a
# letra; ela estoura na hora de gerar, com o nome dela na mensagem, e quem
# escreveu encurta a frase.
TAM_LINHA = 34
TAM_TITULO = 82
TAM_CHAMADA = 39


def maior_que_cabe(caminho: str, frases, largura: int, teto: int, piso: int = 20) -> int:
    """O maior tamanho de letra em que TODAS as frases cabem.

    Serve para ESCOLHER um tamanho da casa (uma vez, na mesa de desenho),
    não para encolher a letra a cada geração — ver o bloco acima.
    """
    medidor = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    for t in range(teto, piso - 1, -1):
        fonte = f(caminho, t)
        if all(medidor.textlength(frase, font=fonte) <= largura for frase in frases):
            return t
    return piso


def conferir_cabe(caminho: str, tamanho: int, frases, largura: int, onde: str) -> None:
    """Recusa gerar se alguma frase estourar a largura.

    É de propósito que isto pare tudo em vez de encolher: texto que vaza a
    borda do cartão foi apontado numa rodada, texto encolhido sozinho foi
    apontado na seguinte. Falhar aqui custa um minuto de reescrita; qualquer
    um dos dois custa uma rodada inteira.
    """
    medidor = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    fonte = f(caminho, tamanho)
    for frase in frases:
        largura_real = medidor.textlength(frase, font=fonte)
        if largura_real > largura:
            raise SystemExit(
                f"não cabe em {onde} ({tamanho}px): {largura_real:.0f}px de {largura}px\n"
                f"  «{frase}»\n"
                f"  encurte a frase — a letra não encolhe."
            )


def marca_branca() -> Image.Image:
    """O 'Ei' em branco, tirado da própria logo que a dona mandou.

    Não é digitado nem redesenhado: a tinta branca da `docs/logo-ei.png`
    vira o desenho e o azul vira transparência. Assim a marca da arte é a
    mesma do ícone do celular, e não uma parecida.
    """
    logo = Image.open(APP / "docs/logo-ei.png").convert("RGB")
    r, g, b = logo.split()
    minimo = ImageChops.darker(ImageChops.darker(r, g), b)
    alfa = minimo.point(lambda v: 0 if v < 100 else (255 if v > 210 else (v - 100) * 255 // 110))
    m = Image.merge("RGBA", (Image.new("L", logo.size, 255),) * 3 + (alfa,))
    return m.crop(alfa.getbbox())


_MARCA = None


def _marca() -> Image.Image:
    global _MARCA
    if _MARCA is None:
        _MARCA = marca_branca()
    return _MARCA


def nova_peca() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    """Fundo azul, sombra, cartão branco e a marca — o começo de toda peça."""
    img = Image.new("RGB", (L, A), AZUL_FUNDO)

    brilho = Image.new("L", (L // 4, A // 4), 0)
    d = ImageDraw.Draw(brilho)
    d.ellipse((-L // 8, -A // 8, L // 4 + L // 8, A // 8 + 60), fill=110)
    brilho = brilho.filter(ImageFilter.GaussianBlur(28)).resize((L, A), Image.LANCZOS)
    img.paste(Image.new("RGB", (L, A), (86, 200, 255)), (0, 0), brilho)

    sombra = Image.new("L", (L, A), 0)
    ds = ImageDraw.Draw(sombra)
    ds.rounded_rectangle((CARTAO[0] + 6, CARTAO[1] + 16, CARTAO[2] + 6, CARTAO[3] + 22),
                         46, fill=90)
    sombra = sombra.filter(ImageFilter.GaussianBlur(26))
    img.paste(Image.new("RGB", (L, A), (0, 74, 116)), (0, 0), sombra)

    marca = _marca()
    largura = round(marca.width * MARCA_ALTO / marca.height)
    pequena = marca.resize((largura, MARCA_ALTO), Image.LANCZOS)
    img.paste(pequena, ((L - largura) // 2, MARCA_TOPO), pequena)

    d = ImageDraw.Draw(img)
    d.rounded_rectangle(CARTAO, 46, fill=BRANCO)
    return img, d


def centrado(d, y: int, texto: str, fonte, cor) -> None:
    d.text((MEIO, y), texto, font=fonte, fill=cor, anchor="ma")


def selo(d, texto: str) -> None:
    """A pílula do topo. Só ela falta quando não há selo — o LUGAR fica."""
    fonte = f(FONTE_N, 27)
    largura = d.textlength(texto, font=fonte) + 56
    x = MEIO - largura / 2
    d.rounded_rectangle((x, Y_SELO, x + largura, Y_SELO + SELO_ALTO), SELO_ALTO // 2, fill=LARANJA)
    centrado(d, Y_SELO + (SELO_ALTO - 34) // 2, texto, fonte, BRANCO)


def titulo(d, texto: str, tamanho: int) -> None:
    centrado(d, Y_TITULO, texto, f(FONTE_N, tamanho), ESCURO)


def regua(d) -> None:
    d.rounded_rectangle((MEIO - 54, Y_REGUA, MEIO + 54, Y_REGUA + 6), 3, fill=LARANJA)


def destaque(d, texto: str, tamanho: int, cor=AZUL) -> None:
    """Uma palavra grande na faixa do preço.

    A faixa tem a MESMA altura de quando há preço. É isso que mantém as
    três linhas de baixo na mesma altura em todas as peças, com preço ou
    sem preço.
    """
    centrado(d, Y_DESTAQUE + (ALTO_DESTAQUE - tamanho) // 2 - 8, texto, f(FONTE_N, tamanho), cor)


def preco(d, centavos: int) -> None:
    """R$ pequeno, número grande, /mês pequeno — os três na mesma linha de
    apoio, senão o cifrão parece flutuar."""
    fr, fn, fm = f(FONTE_N, 44), f(FONTE_N, 132), f(FONTE, 38)
    valor = f"{centavos // 100},{centavos % 100:02d}"
    lr = d.textlength("R$ ", font=fr)
    ln = d.textlength(valor, font=fn)
    lm = d.textlength(" /mês", font=fm)
    x = MEIO - (lr + ln + lm) / 2
    base = Y_DESTAQUE + ALTO_DESTAQUE - 26
    d.text((x, base), "R$ ", font=fr, fill=CINZA, anchor="ls")
    d.text((x + lr, base), valor, font=fn, fill=AZUL, anchor="ls")
    d.text((x + lr + ln, base), " /mês", font=fm, fill=CINZA, anchor="ls")


def fio(d) -> None:
    d.line((DENTRO_E, Y_FIO, DENTRO_D, Y_FIO), fill=FIO, width=2)


def _visto(d, x: int, y: int, r: int = 17) -> None:
    d.ellipse((x - r, y - r, x + r, y + r), fill=LARANJA)
    d.line([(x - 8, y), (x - 2, y + 6), (x + 8, y - 7)], fill=BRANCO, width=4)


def linhas(d, frases, tamanho: int, com_visto: bool = True) -> None:
    """As três linhas. Sempre três — ver o cabeçalho deste arquivo."""
    if len(frases) != 3:
        raise ValueError(f"a régua pede três linhas, vieram {len(frases)}")
    fonte = f(FONTE, tamanho)
    for i, frase in enumerate(frases):
        y = Y_LINHA + i * PASSO_LINHA
        if com_visto:
            _visto(d, DENTRO_E + 17, y + tamanho // 2 + 2)
            d.text((DENTRO_E + 58, y), frase, font=fonte, fill=ESCURO)
        else:
            centrado(d, y, frase, fonte, ESCURO)


def chamada(d, texto: str, tamanho: int) -> None:
    """A pílula laranja do rodapé.

    Peça de DIVULGAÇÃO pode ter preço e caminho de pagamento. Tela do app
    da Play Store não pode — isso é outro assunto, e mora em
    `src/lib/plataforma.ts` (`podeVender`).
    """
    d.rounded_rectangle((DENTRO_E, Y_CHAMADA, DENTRO_D, Y_CHAMADA + ALTO_CHAMADA),
                        ALTO_CHAMADA // 2, fill=LARANJA)
    centrado(d, Y_CHAMADA + (ALTO_CHAMADA - tamanho - 8) // 2, texto, f(FONTE_N, tamanho), BRANCO)


# ══════════════════════════════════════════════════════════════════════
#  O MOLDE ABERTO — para conteúdo, e não para oferta
# ══════════════════════════════════════════════════════════════════════
#
# Tudo acima é o molde do CARTÃO: fundo azul, caixa branca, título, preço,
# três linhas e uma pílula laranja. Ele foi feito para vender — plano,
# destaque, benefício — e faz isso bem.
#
# Ele é o molde errado para o conteúdo do Instagram que NÃO vende. O plano
# de 30 dias começa por uma semana inteira de dor, sem oferta nenhuma:
# "em quantos lugares você deixou currículo esse ano? E quantos ligaram?".
# Numa caixa branca com lista e botão, essa frase vira anúncio — e anúncio
# é justamente o que ela não pode parecer, porque o objetivo dela é a
# pessoa se reconhecer.
#
# Então existe um segundo molde, sem caixa: fundo cheio, texto grande, ar.
# A MARCA é a mesma (mesmo azul, mesmo laranja, mesma tipografia, mesmo
# "Ei"), e é isso que faz as duas séries parecerem da mesma conta sem
# parecerem o mesmo post.

# ── A LETRA: A MESMA DO APP ────────────────────────────────────────────
#
# A primeira leva do molde aberto saiu na DejaVu Sans, que é a letra que
# vem no Linux. A dona olhou e disse: "achei pobre". Estava certa, e a
# letra era metade do motivo — a DejaVu é larga, de desenho antigo, e
# aparece em tudo que foi feito sem escolher tipografia. Ninguém sabe
# nomear isso; todo mundo reconhece.
#
# A Inter é a que o app já usa (`estilo-ei.css`). Usar a mesma nas artes
# não é capricho: é o que faz o post e a tela do celular parecerem a mesma
# empresa. Os arquivos estão em `scripts/fontes/` de propósito — baixar na
# hora de gerar quebraria no dia em que a rede saísse, e a arte tem de sair
# igual daqui a um ano. A licença da Inter (SIL OFL) permite guardá-la aqui.
FONTES = Path(__file__).resolve().parent / "fontes"
INTER = str(FONTES / "Inter-400.ttf")
INTER_MEDIA = str(FONTES / "Inter-500.ttf")
INTER_SEMI = str(FONTES / "Inter-600.ttf")
INTER_NEGRITO = str(FONTES / "Inter-700.ttf")
INTER_PESADA = str(FONTES / "Inter-800.ttf")
INTER_PRETA = str(FONTES / "Inter-900.ttf")

MARGEM = 110
LARGURA_TEXTO = L - MARGEM * 2   # 860

# ── AS OUTRAS TRÊS COISAS QUE FAZIAM PARECER POBRE ─────────────────────
#
#  1. FUNDO CHAPADO. Um retângulo de uma cor só é o que sai de qualquer
#     gerador. `fundo_azul` põe um brilho no alto e escurece no pé — de
#     leve, quase imperceptível olhando de perto, e é justamente aí que
#     está o efeito: a peça ganha profundidade sem ganhar enfeite.
#
#  2. LETRA GRANDE COM ESPAÇO DE LETRA PEQUENA. Toda fonte é desenhada
#     com o espaçamento certo para corpo de texto. Ampliada para 96px,
#     esse mesmo espaçamento fica FROUXO — a manchete parece esticada. Em
#     revista e em anúncio bom, manchete grande sempre leva o espaçamento
#     apertado. É o que `escrever` faz com `tracking` negativo, e é a
#     diferença mais visível entre "digitado" e "composto".
#
#  3. NENHUMA MOLDURA. Uma folha com texto no meio e nada em volta parece
#     inacabada. `cabecalho` e `rodape` dão à peça um alto e um pé fixos —
#     a marca, o número da tela ("03/09") e o endereço. Repetidos em todas,
#     eles são o que faz nove imagens virarem UM carrossel.

CINZA_CLARO = (203, 212, 221)   # o que ainda não aconteceu

# ── O AZUL DO FUNDO É MAIS ESCURO QUE O AZUL DA MARCA, E ISSO É MEDIDO ──
#
# O azul do logo (1,167,253) é lindo num ícone e péssimo como fundo de
# texto: BRANCO sobre ele dá 2,55 de contraste, quando o mínimo é 4,5 para
# letra pequena e 3 para manchete. A primeira leva do molde aberto usava
# ele, e a peça parecia lavada — a manchete não "batia".
#
# Estes dois são o MESMO matiz do logo (200,5°, saturação cheia), só mais
# escuros. A marca continua reconhecível e o branco passa a ter 4,6 no alto
# e 8,1 no pé. Não é palpite: `conferir_contraste` mede a peça pronta e
# recusa gerar se algum texto ficar abaixo do mínimo — foi assim que a tela
# "Quem está contratando" foi consertada, depois de ser apontada de olho
# três vezes sem ninguém medir.
AZUL_TOPO = (0, 114, 174)
AZUL_PE = (0, 78, 119)
AZUL_BRILHO = (40, 170, 232)    # o clarão do alto, de leve

SOBRE_AZUL = (224, 241, 254)    # o texto de apoio sobre o fundo azul
SOBRE_AZUL_FRACO = (168, 208, 235)   # o discreto ("arraste", endereço)


def escrever(d, xy, texto: str, fonte, cor, tracking: float = 0.0) -> float:
    """Escreve uma linha, com espaçamento de letra ajustável.

    O Pillow não tem `letter-spacing`, então cada letra é desenhada no seu
    lugar. A posição vem de medir o PEDAÇO DE TEXTO INTEIRO até ali, e não
    de somar a largura de cada letra: assim o encaixe que a fonte já faz
    entre pares ("Va", "To") continua valendo, e só o tracking é somado por
    cima. Somando larguras soltas, palavra grande sai com buraco entre as
    letras — que é o defeito que este código existe para evitar.

    O ESPAÇO ENTRE PALAVRAS NÃO ENCOLHE. Apertando tudo por igual, "Em
    quantos" saiu quase colado — parecia uma palavra só. Aperto de
    manchete é entre LETRAS; o espaço entre palavras é o que separa uma
    ideia da outra e tem de continuar do tamanho que a fonte desenhou.

    Devolve a largura total, já com o tracking.
    """
    x, y = xy
    if not tracking:
        d.text((x, y), texto, font=fonte, fill=cor)
        return d.textlength(texto, font=fonte)
    desloc = 0.0
    for i, letra in enumerate(texto):
        d.text((x + d.textlength(texto[:i], font=fonte) + desloc, y),
               letra, font=fonte, fill=cor)
        if letra != " ":
            desloc += tracking
    return d.textlength(texto, font=fonte) + desloc


def largura_com_tracking(d, texto: str, fonte, tracking: float = 0.0) -> float:
    apertadas = sum(1 for letra in texto if letra != " ")
    return d.textlength(texto, font=fonte) + apertadas * tracking


def quebrar(d, texto: str, fonte, largura: int) -> list[str]:
    """Quebra o texto em linhas que cabem na largura.

    Escrito à mão porque o `textwrap` do Python conta CARACTERES, e a
    largura de uma letra na tela não tem nada a ver com isso: "MMMM" e
    "iiii" têm quatro letras e larguras muito diferentes. Quebrar por
    caractere numa manchete grande estoura a margem ou deixa metade da
    linha vazia.
    """
    palavras = texto.split()
    linhas: list[str] = []
    atual = ""
    for palavra in palavras:
        tentativa = f"{atual} {palavra}".strip()
        if d.textlength(tentativa, font=fonte) <= largura or not atual:
            atual = tentativa
        else:
            linhas.append(atual)
            atual = palavra
    if atual:
        linhas.append(atual)
    return linhas


def fundo_azul() -> Image.Image:
    """O azul da marca, com profundidade.

    Não é um azul diferente: é o MESMO, com um brilho suave no alto à
    esquerda e um escurecimento no pé. De perto quase não se vê; é no
    conjunto que a peça deixa de parecer um retângulo pintado.
    """
    degrade = Image.new("RGB", (2, A))
    dd = ImageDraw.Draw(degrade)
    for y in range(A):
        p = y / (A - 1)
        dd.line((0, y, 2, y), fill=tuple(
            round(AZUL_TOPO[i] + (AZUL_PE[i] - AZUL_TOPO[i]) * p) for i in range(3)))
    img = degrade.resize((L, A), Image.BILINEAR)

    brilho = Image.new("L", (L // 4, A // 4), 0)
    db = ImageDraw.Draw(brilho)
    db.ellipse((-L // 10, -A // 9, L // 3, A // 7), fill=62)
    brilho = brilho.filter(ImageFilter.GaussianBlur(30)).resize((L, A), Image.LANCZOS)
    img.paste(Image.new("RGB", (L, A), AZUL_BRILHO), (0, 0), brilho)
    return img


def _luminancia(cor) -> float:
    def canal(v: float) -> float:
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * canal(cor[0]) + 0.7152 * canal(cor[1]) + 0.0722 * canal(cor[2])


def contraste(a, b) -> float:
    """A razão de contraste da WCAG entre duas cores. 21 é preto no branco."""
    l1, l2 = sorted((_luminancia(a), _luminancia(b)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)


def conferir_contraste(img: Image.Image, cor_texto, caixa, minimo: float, onde: str) -> None:
    """Mede o contraste do texto contra o fundo REAL, e recusa se for baixo.

    A `img` tem de ser o FUNDO, sem o texto desenhado. Medindo a peça
    pronta, os pixels da própria letra entram na conta e o resultado é
    1,00 — branco contra branco. Foi o que aconteceu na primeira vez que
    isto rodou, e é um erro que se repete facilmente porque a mensagem
    ("contraste 1,00") parece um problema de cor, e não de medição.

    Contra o fundo real, e não contra a cor que eu acho que está lá: o
    fundo é um degradê com um clarão por cima, então o pior ponto não é o
    que se escolheria de cabeça. Mede-se a caixa inteira e vale o pior.

    O mínimo da WCAG é 4,5 para letra de corpo e 3 para letra grande
    (manchete). Isto existe porque a tela "Quem está contratando" saiu com
    1,1 de contraste, foi apontada três vezes de olho ("essa tela tá ruim")
    e só foi consertada quando alguém mediu.
    """
    e, t, di, b = (max(0, caixa[0]), max(0, caixa[1]),
                   min(L, caixa[2]), min(A, caixa[3]))
    recorte = img.convert("RGB").crop((e, t, di, b))
    # Um pixel a cada 8 já encontra o pior ponto de um degradê, e evita
    # medir um milhão de pontos a cada peça.
    pequeno = recorte.resize((max(1, recorte.width // 8), max(1, recorte.height // 8)))
    pior = min(contraste(cor_texto, px) for px in pequeno.getdata())
    if pior < minimo:
        raise SystemExit(
            f"contraste baixo em {onde}: {pior:.2f}, mínimo {minimo}\n"
            f"  texto {cor_texto} sobre o fundo dali\n"
            f"  escureça o fundo ou clareie o texto — não deixe passar."
        )


def peca_lisa(escura: bool) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    """Uma peça de fundo cheio, sem cartão. O começo do molde aberto.

    `escura=True` é o azul da marca; `False` é o branco. Recebe um SIM ou
    NÃO em vez de uma cor porque tudo mais na peça — cor da letra, cor da
    marca, cor do fio do rodapé — decorre dessa escolha, e passar a cor
    solta já deixou uma peça com fundo azul e fio cinza-claro invisível.
    """
    img = fundo_azul() if escura else Image.new("RGB", (L, A), BRANCO)
    return img, ImageDraw.Draw(img)


def _marca_colorida(alto: int, cor=None) -> Image.Image:
    marca = _marca()
    largura = round(marca.width * alto / marca.height)
    pequena = marca.resize((largura, alto), Image.LANCZOS)
    if cor is None:
        return pequena
    tinta = Image.new("RGBA", pequena.size, cor + (255,))
    tinta.putalpha(pequena.split()[3])
    return tinta


# O alto e o pé, iguais em todas as telas do carrossel.
Y_CABECALHO = 96
Y_RODAPE = A - 138


def cabecalho(img, d, escura: bool, numero: int, total: int) -> None:
    """A marca à esquerda, o número da tela à direita.

    O contador ("03 / 09") é pequeno e some no canto, mas é ele que avisa
    que há mais para arrastar — sem isso, muita gente lê a primeira tela e
    passa reto, e o carrossel inteiro é escrito para a última.
    """
    # No fundo branco a marca vai no azul ESCURO, não no azul do logo: o
    # ciano do logo sobre branco dá 2,3 de contraste e some no papel. O logo
    # nunca vive sobre branco no app — ele mora dentro do quadrado azul —
    # então não há versão "certa" a copiar, e a legível é a que serve.
    marca = _marca_colorida(40, None if escura else AZUL_TOPO)
    img.paste(marca, (MARGEM, Y_CABECALHO), marca)

    fonte = f(INTER_SEMI, 24)
    texto = f"{numero:02d} / {total:02d}"
    cor = (255, 255, 255) if escura else CINZA
    largura = largura_com_tracking(d, texto, fonte, 2.0)
    escrever(d, (L - MARGEM - largura, Y_CABECALHO + 8), texto, fonte, cor, 2.0)


def rodape(img, d, escura: bool) -> None:
    """Um fio fino e o endereço. É a assinatura, e não um anúncio.

    O endereço no pé de TODA tela existe porque carrossel bom é
    fotografado e mandado no WhatsApp solto, sem a legenda junto. A tela
    que chega sozinha tem de dizer onde fica o app.
    """
    cor_fio = (255, 255, 255, 90) if escura else FIO
    if escura:
        fio_img = Image.new("RGBA", (L - MARGEM * 2, 2), cor_fio)
        img.paste(fio_img, (MARGEM, Y_RODAPE), fio_img)
    else:
        d.line((MARGEM, Y_RODAPE, L - MARGEM, Y_RODAPE), fill=FIO, width=2)

    fonte = f(INTER_MEDIA, 26)
    cor = SOBRE_AZUL_FRACO if escura else CINZA
    escrever(d, (MARGEM, Y_RODAPE + 34), "empregoitabirito.com.br", fonte, cor, 0.6)


def manchete(d, texto: str, tamanho: int, cor, topo: int,
             entrelinha: float = 1.06, fonte_arq: str = None) -> int:
    """Texto grande, alinhado à esquerda, com o espaçamento apertado.

    À esquerda e não centralizado: manchete centralizada de três linhas
    obriga o olho a procurar onde cada linha começa, e estas são para ler
    de relance, rolando o dedo.

    O tracking negativo é proporcional ao tamanho (`-0.022em`) — o aperto
    que uma manchete de 96px precisa não é o mesmo de uma de 48px, e um
    valor fixo em pixels erraria nos dois.

    Devolve onde o bloco terminou, para quem quiser pôr algo embaixo.
    """
    fonte = f(fonte_arq or INTER_PESADA, tamanho)
    tracking = -tamanho * 0.022
    y = topo
    for linha in quebrar(d, texto, fonte, LARGURA_TEXTO):
        escrever(d, (MARGEM, y), linha, fonte, cor, tracking)
        y += round(tamanho * entrelinha)
    return y


def apoio(d, texto: str, tamanho: int, cor, topo: int, entrelinha: float = 1.42) -> int:
    """O mesmo, em corpo de texto — sem aperto, que aqui atrapalharia ler."""
    fonte = f(INTER, tamanho)
    y = topo
    for linha in quebrar(d, texto, fonte, LARGURA_TEXTO):
        d.text((MARGEM, y), linha, font=fonte, fill=cor)
        y += round(tamanho * entrelinha)
    return y


def salvar(img: Image.Image, nome: str) -> Path:
    caminho = SAIDA / nome
    img.save(caminho)
    return caminho
