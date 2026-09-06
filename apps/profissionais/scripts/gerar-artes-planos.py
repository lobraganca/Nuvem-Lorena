"""
Artes dos planos do Ei Emprego — uma peça por plano, mais uma capa.

O que a rodada anterior errou, e que este arquivo existe para não repetir:
a altura do cartão era calculada A PARTIR DO CONTEÚDO, e o tamanho da letra
dos benefícios encolhia sozinho quando a frase não cabia. Resultado: cinco
peças de alturas diferentes, com as linhas em alturas diferentes. Passando
uma atrás da outra no carrossel, tudo pula.

Aqui a geometria é FIXA e igual nas cinco:

  · a mesma caixa branca, nas mesmas coordenadas;
  · a mesma régua vertical — nome, régua laranja, preço, benefícios e botão
    sempre nas mesmas alturas;
  · o selo "MAIS ESCOLHIDO" ocupa lugar reservado mesmo onde não aparece,
    senão o nome do plano sobe só num cartão;
  · TRÊS benefícios em todas, nem duas nem quatro;
  · UM tamanho de letra para os benefícios, escolhido depois de medir a
    frase mais comprida de TODAS as peças — a letra não encolhe por peça.
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
BRANCO = (255, 255, 255)

FONTE = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONTE_N = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

L, A = 1080, 1350


def f(caminho: str, tamanho: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(caminho, tamanho)


# ── A régua vertical, escrita uma vez e usada nas cinco ──────────────────
CARTAO = (84, 232, 996, 1266)          # esquerda, topo, direita, baixo
PAD = 68
DENTRO_E = CARTAO[0] + PAD             # 152
DENTRO_D = CARTAO[2] - PAD             # 928
LARGURA_DENTRO = DENTRO_D - DENTRO_E   # 776
MEIO = (CARTAO[0] + CARTAO[2]) // 2

C = CARTAO[1]
Y_SELO = C + 52          # topo do selo (altura 62) — lugar sempre reservado
Y_NOME = C + 156         # topo do nome do plano
Y_REGUA = C + 262        # a barrinha laranja
Y_PRECO = C + 306        # topo da faixa do preço (altura 150)
ALTO_PRECO = 150
Y_LINHA = C + 508        # o fio cinza que separa preço de benefícios
Y_BENEFICIO = C + 566    # topo do primeiro benefício
PASSO_BENEFICIO = 78     # de um para o outro
Y_BOTAO = C + 846        # topo da pílula laranja (altura 104)
ALTO_BOTAO = 104

SELO_ALTO = 62
MARCA_ALTO = 118
MARCA_TOPO = 74


# ── Os planos ────────────────────────────────────────────────────────────
# Os preços e os limites saem de `src/types/domain.ts` (PLANOS_EMPRESA).
#
# São três benefícios em TODAS de propósito. Na tela do app os cartões
# mostram só o que diferencia, porque lá as colunas ficam lado a lado e o
# que se repete atrapalha a comparação. Aqui cada peça é vista sozinha, e
# uma peça com dois itens ao lado de outra com três é exatamente o
# desalinhamento que ela apontou.
PLANOS = [
    {
        "nome": "Ei Conecta",
        "centavos": 2990,
        "selo": None,
        "beneficios": [
            "1 vaga aberta por vez",
            "Recebe quem se interessou, com telefone",
            "30 dias no ar por vaga",
        ],
    },
    {
        "nome": "Ei Onda",
        "centavos": 5990,
        "selo": None,
        "beneficios": [
            "3 vagas abertas ao mesmo tempo",
            "Sua vaga na lista de vagas em aberto",
            "Recebe quem se interessou, com telefone",
        ],
    },
    {
        "nome": "Ei Impulso",
        "centavos": 8990,
        "selo": "MAIS ESCOLHIDO",
        "beneficios": [
            "5 vagas abertas ao mesmo tempo",
            "Sua vaga na lista de vagas em aberto",
            "Recebe quem se interessou, com telefone",
        ],
    },
    {
        "nome": "Ei Máximo",
        "centavos": 12990,
        "selo": None,
        "beneficios": [
            "10 vagas abertas ao mesmo tempo",
            "Sua vaga na lista de vagas em aberto",
            "Recebe quem se interessou, com telefone",
        ],
    },
    {
        "nome": "Ei Infinit",
        "centavos": None,
        "selo": None,
        "beneficios": [
            "Vagas abertas sem limite",
            "Sua vaga na lista de vagas em aberto",
            "Condição combinada com você",
        ],
    },
]


def marca_branca() -> Image.Image:
    """O 'Ei' em branco, tirado da própria logo que ela mandou.

    Não é digitado nem redesenhado: a tinta branca da `docs/logo-ei.png`
    vira o desenho, e o azul vira transparência. Assim a marca da arte é a
    mesma do ícone do celular, e não uma parecida.
    """
    logo = Image.open(APP / "docs/logo-ei.png").convert("RGB")
    r, g, b = logo.split()
    minimo = ImageChops.darker(ImageChops.darker(r, g), b)
    alfa = minimo.point(lambda v: 0 if v < 100 else (255 if v > 210 else (v - 100) * 255 // 110))
    m = Image.merge("RGBA", (Image.new("L", logo.size, 255),) * 3 + (alfa,))
    return m.crop(alfa.getbbox())


MARCA = marca_branca()


def fundo() -> Image.Image:
    """Azul da marca com um brilho suave em cima."""
    img = Image.new("RGB", (L, A), AZUL_FUNDO)
    brilho = Image.new("L", (L // 4, A // 4), 0)
    d = ImageDraw.Draw(brilho)
    d.ellipse((-L // 8, -A // 8, L // 4 + L // 8, A // 8 + 60), fill=110)
    brilho = brilho.filter(ImageFilter.GaussianBlur(28)).resize((L, A), Image.LANCZOS)
    img.paste(Image.new("RGB", (L, A), (86, 200, 255)), (0, 0), brilho)
    return img


def sombra(img: Image.Image, caixa, raio: int) -> None:
    """Sombra borrada embaixo do cartão, para ele descolar do fundo."""
    s = Image.new("L", (L, A), 0)
    d = ImageDraw.Draw(s)
    d.rounded_rectangle((caixa[0] + 6, caixa[1] + 16, caixa[2] + 6, caixa[3] + 22), raio, fill=90)
    s = s.filter(ImageFilter.GaussianBlur(26))
    img.paste(Image.new("RGB", (L, A), (0, 74, 116)), (0, 0), s)


def colar_marca(img: Image.Image, alto: int, topo: int) -> None:
    largura = round(MARCA.width * alto / MARCA.height)
    pequena = MARCA.resize((largura, alto), Image.LANCZOS)
    img.paste(pequena, ((L - largura) // 2, topo), pequena)


def centrado(d: ImageDraw.ImageDraw, y: int, texto: str, fonte, cor, meio: int = MEIO) -> None:
    d.text((meio, y), texto, font=fonte, fill=cor, anchor="ma")


def maior_que_cabe(caminho: str, frases, largura: int, teto: int, piso: int = 20) -> int:
    """O maior tamanho de letra em que TODAS as frases cabem.

    O erro da rodada passada foi encolher a letra frase por frase: aí cada
    peça ganhava um tamanho diferente e nada alinhava entre elas. Aqui se
    mede tudo junto, uma vez, e o número que sai vale para as cinco.
    """
    medidor = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    for t in range(teto, piso - 1, -1):
        fonte = f(caminho, t)
        if all(medidor.textlength(frase, font=fonte) <= largura for frase in frases):
            return t
    return piso


TODOS_BENEFICIOS = [b for p in PLANOS for b in p["beneficios"]]
LARGURA_TEXTO_BENEFICIO = LARGURA_DENTRO - 58  # o espaço do visto laranja
TAM_BENEFICIO = maior_que_cabe(FONTE, TODOS_BENEFICIOS, LARGURA_TEXTO_BENEFICIO, 38)

BOTOES = ["empregoitabirito.com.br", "Fale com a gente no WhatsApp"]
TAM_BOTAO = maior_que_cabe(FONTE_N, BOTOES, LARGURA_DENTRO - 80, 40)

NOMES = [p["nome"] for p in PLANOS]
TAM_NOME = maior_que_cabe(FONTE_N, NOMES, LARGURA_DENTRO, 82)


def visto(d: ImageDraw.ImageDraw, x: int, y: int, r: int = 17) -> None:
    """O certinho laranja de cada benefício."""
    d.ellipse((x - r, y - r, x + r, y + r), fill=LARANJA)
    d.line([(x - 8, y), (x - 2, y + 6), (x + 8, y - 7)], fill=BRANCO, width=4)


def preco_em_reais(centavos: int) -> str:
    return f"{centavos // 100},{centavos % 100:02d}"


def desenhar_plano(plano) -> Image.Image:
    img = fundo()
    sombra(img, CARTAO, 46)
    d = ImageDraw.Draw(img)

    colar_marca(img, MARCA_ALTO, MARCA_TOPO)
    d.rounded_rectangle(CARTAO, 46, fill=BRANCO)

    # O selo. O lugar dele existe sempre; só a pílula é que falta.
    if plano["selo"]:
        fonte = f(FONTE_N, 27)
        largura = d.textlength(plano["selo"], font=fonte) + 56
        x = MEIO - largura / 2
        d.rounded_rectangle((x, Y_SELO, x + largura, Y_SELO + SELO_ALTO), SELO_ALTO // 2,
                            fill=LARANJA)
        centrado(d, Y_SELO + (SELO_ALTO - 34) // 2, plano["selo"], fonte, BRANCO)

    centrado(d, Y_NOME, plano["nome"], f(FONTE_N, TAM_NOME), ESCURO)
    d.rounded_rectangle((MEIO - 54, Y_REGUA, MEIO + 54, Y_REGUA + 6), 3, fill=LARANJA)

    # ── O preço ──────────────────────────────────────────────────────
    # A faixa tem a MESMA altura no Infinit, que não tem preço de tabela:
    # o texto muda, o espaço não. É o que mantém os benefícios de todas as
    # peças na mesma altura.
    if plano["centavos"] is None:
        fonte = f(FONTE_N, 76)
        alto = 76
        centrado(d, Y_PRECO + (ALTO_PRECO - alto) // 2 - 8, "Sob consulta", fonte, AZUL)
    else:
        fr = f(FONTE_N, 44)
        fn = f(FONTE_N, 132)
        fm = f(FONTE, 38)
        valor = preco_em_reais(plano["centavos"])
        lr = d.textlength("R$ ", font=fr)
        ln = d.textlength(valor, font=fn)
        lm = d.textlength(" /mês", font=fm)
        x = MEIO - (lr + ln + lm) / 2
        base = Y_PRECO + ALTO_PRECO - 26   # todos apoiados na mesma linha
        d.text((x, base), "R$ ", font=fr, fill=CINZA, anchor="ls")
        d.text((x + lr, base), valor, font=fn, fill=AZUL, anchor="ls")
        d.text((x + lr + ln, base), " /mês", font=fm, fill=CINZA, anchor="ls")

    d.line((DENTRO_E, Y_LINHA, DENTRO_D, Y_LINHA), fill=(232, 237, 242), width=2)

    fonte = f(FONTE, TAM_BENEFICIO)
    for i, beneficio in enumerate(plano["beneficios"]):
        y = Y_BENEFICIO + i * PASSO_BENEFICIO
        visto(d, DENTRO_E + 17, y + TAM_BENEFICIO // 2 + 2)
        d.text((DENTRO_E + 58, y), beneficio, font=fonte, fill=ESCURO)

    # ── A chamada ────────────────────────────────────────────────────
    # Este arquivo é peça de DIVULGAÇÃO, não tela do app: aqui pode haver
    # preço e caminho de pagamento. Dentro do app da Play Store não pode —
    # ver `podeVender()` em src/lib/plataforma.ts.
    d.rounded_rectangle((DENTRO_E, Y_BOTAO, DENTRO_D, Y_BOTAO + ALTO_BOTAO), ALTO_BOTAO // 2,
                        fill=LARANJA)
    chamada = BOTOES[1] if plano["centavos"] is None else BOTOES[0]
    centrado(d, Y_BOTAO + (ALTO_BOTAO - TAM_BOTAO - 8) // 2, chamada, f(FONTE_N, TAM_BOTAO), BRANCO)
    return img


def desenhar_capa() -> Image.Image:
    """A primeira do carrossel — e ela usa a MESMA régua das outras.

    Não é enfeite: quem passa o dedo de uma peça para a próxima vê o
    cartão, o título e o botão continuarem no lugar. Por isso o título
    ocupa a linha do nome do plano, "Itabirito" ocupa a faixa do preço e
    as três frases ocupam os três lugares dos benefícios.
    """
    img = fundo()
    sombra(img, CARTAO, 46)
    d = ImageDraw.Draw(img)
    colar_marca(img, MARCA_ALTO, MARCA_TOPO)
    d.rounded_rectangle(CARTAO, 46, fill=BRANCO)

    centrado(d, Y_NOME, "Contrate em", f(FONTE_N, TAM_NOME - 8), ESCURO)
    d.rounded_rectangle((MEIO - 54, Y_REGUA, MEIO + 54, Y_REGUA + 6), 3, fill=LARANJA)
    centrado(d, Y_PRECO + (ALTO_PRECO - 96) // 2 - 8, "Itabirito", f(FONTE_N, 96), AZUL)
    d.line((DENTRO_E, Y_LINHA, DENTRO_D, Y_LINHA), fill=(232, 237, 242), width=2)

    fonte = f(FONTE, TAM_BENEFICIO)
    linhas = [
        "Publique sua vaga e receba",
        "quem é da cidade, com telefone",
        "para chamar na hora.",
    ]
    for i, linha in enumerate(linhas):
        centrado(d, Y_BENEFICIO + i * PASSO_BENEFICIO, linha, fonte, ESCURO)

    d.rounded_rectangle((DENTRO_E, Y_BOTAO, DENTRO_D, Y_BOTAO + ALTO_BOTAO), ALTO_BOTAO // 2,
                        fill=LARANJA)
    centrado(d, Y_BOTAO + (ALTO_BOTAO - TAM_BOTAO - 8) // 2, "Arraste e escolha seu plano",
             f(FONTE_N, TAM_BOTAO), BRANCO)
    return img


def main() -> None:
    print(f"benefícios {TAM_BENEFICIO}px · nome {TAM_NOME}px · botão {TAM_BOTAO}px")
    desenhar_capa().save(SAIDA / "plano-0-capa.png")
    arquivos = ["plano-0-capa.png"]
    for i, plano in enumerate(PLANOS, start=1):
        apelido = plano["nome"].split()[-1].lower()
        apelido = apelido.replace("á", "a").replace("ó", "o")
        nome = f"plano-{i}-{apelido}.png"
        desenhar_plano(plano).save(SAIDA / nome)
        arquivos.append(nome)
    for a in arquivos:
        print("  ", SAIDA / a)


if __name__ == "__main__":
    main()
