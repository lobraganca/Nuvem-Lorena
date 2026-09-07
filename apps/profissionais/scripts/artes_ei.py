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

MARGEM = 96
LARGURA_TEXTO = L - MARGEM * 2   # 888


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


def peca_lisa(cor_fundo) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    """Uma peça de fundo cheio, sem cartão. O começo do molde aberto."""
    img = Image.new("RGB", (L, A), cor_fundo)
    return img, ImageDraw.Draw(img)


def manchete(d, texto: str, tamanho: int, cor, topo: int, entrelinha: float = 1.12) -> int:
    """Texto grande, alinhado à esquerda, quebrado na medida.

    À esquerda e não centralizado: manchete centralizada de três linhas
    obriga o olho a procurar onde cada linha começa, e estas são para ler
    de relance, rolando o dedo.

    Devolve onde o bloco terminou, para quem quiser pôr algo embaixo.
    """
    fonte = f(FONTE_N, tamanho)
    y = topo
    for linha in quebrar(d, texto, fonte, LARGURA_TEXTO):
        d.text((MARGEM, y), linha, font=fonte, fill=cor)
        y += round(tamanho * entrelinha)
    return y


def apoio(d, texto: str, tamanho: int, cor, topo: int, entrelinha: float = 1.35) -> int:
    """O mesmo, em corpo de texto."""
    fonte = f(FONTE, tamanho)
    y = topo
    for linha in quebrar(d, texto, fonte, LARGURA_TEXTO):
        d.text((MARGEM, y), linha, font=fonte, fill=cor)
        y += round(tamanho * entrelinha)
    return y


def marca_no_pe(img: Image.Image, clara: bool) -> None:
    """O "Ei" pequeno, no rodapé.

    Pequeno de propósito: numa peça de dor, marca grande no topo faz a
    frase virar anúncio antes de ser lida. Ela assina, não anuncia.

    `clara=True` é a marca branca (sobre o azul); `False` pinta o mesmo
    desenho de azul, para o fundo claro — em vez de uma segunda arte, que
    um dia divergiria da primeira.
    """
    alto = 44
    marca = _marca()
    largura = round(marca.width * alto / marca.height)
    pequena = marca.resize((largura, alto), Image.LANCZOS)
    if not clara:
        tinta = Image.new("RGBA", pequena.size, AZUL + (255,))
        tinta.putalpha(pequena.split()[3])
        pequena = tinta
    img.paste(pequena, (MARGEM, A - MARGEM - alto), pequena)


def salvar(img: Image.Image, nome: str) -> Path:
    caminho = SAIDA / nome
    img.save(caminho)
    return caminho
