"""Desenha as capas dos destaques do Instagram (@lolemos), no estilo do site.

Uso:  python3 gerar-capas.py && node gerar-png.mjs

Cada capa é um SVG de 1080x1920, o tamanho do story. Ao escolher a capa de um
destaque, o Instagram recorta um círculo no meio da imagem com a largura dela,
então o desenho tem de caber todo no círculo central: nada perto das bordas.

O estilo é o "B" que ela escolheu em 25/10, entre três: desenho de traço fino e
claro, com o sublinhado amarelo do título do site embaixo. A primeira versão,
de adesivos coloridos com contorno e estrelinha, ela achou infantil. Não volte
a pôr cor dentro do desenho: o amarelo fica só no sublinhado.

As cores são as do site com fundo preto (sites/lorenabraganca): mexer aqui
sem mexer lá deixa o perfil e o site com duas caras.
"""
from pathlib import Path

FUNDO, CREME, SOL = "#111117", "#F2F2EC", "#FFD23F"
PASTA = Path(__file__).parent / "capas"


def desenho(conteudo, escala=4.6, traco=4.6):
    """Desenho feito numa grade de 100x100, ampliado e centrado um pouco acima
    do meio, para o desenho e o sublinhado juntos ficarem no centro do círculo."""
    return (f'<g transform="translate({540 - 50*escala} {900 - 50*escala}) scale({escala})" '
            f'fill="none" stroke="{CREME}" stroke-width="{traco}" '
            f'stroke-linecap="round" stroke-linejoin="round">{conteudo}</g>')


# o marca-texto do "novidades" do site, largo como o desenho
SUBLINHADO = f'<rect x="370" y="1180" width="340" height="26" rx="13" fill="{SOL}"/>'


def capa(conteudo):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">'
            f'<rect width="1080" height="1920" fill="{FUNDO}"/>{desenho(conteudo)}{SUBLINHADO}</svg>\n')


CAPAS = {
    # uma pessoa: cabeça e ombros
    "1-sobre-mim": capa('<circle cx="50" cy="34" r="15"/>'
                        '<path d="M20 84 C20 64 33 56 50 56 C67 56 80 64 80 84"/>'),
    # a estrela de quatro pontas do site, só no contorno
    "2-novidades": capa('<path d="M50 8 C53 38 62 47 92 50 C62 53 53 62 50 92 '
                        'C47 62 38 53 8 50 C38 47 47 38 50 8Z"/>'),
    "3-bastidores": capa('<path d="M36 26 L41 17 H59 L64 26"/>'
                         '<rect x="8" y="26" width="84" height="56" rx="10"/>'
                         '<circle cx="50" cy="54" r="16"/>'),
    "4-contato": capa('<path d="M20 14 H80 Q92 14 92 26 V58 Q92 70 80 70 H46 L28 86 L30 70 H20 '
                      'Q8 70 8 58 V26 Q8 14 20 14 Z"/>'),
}

if __name__ == "__main__":
    PASTA.mkdir(exist_ok=True)
    for velho in PASTA.glob("*"):
        velho.unlink()
    for nome, svg in CAPAS.items():
        (PASTA / f"{nome}.svg").write_text(svg)
        print(nome)
