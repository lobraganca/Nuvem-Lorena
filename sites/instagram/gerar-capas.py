"""Desenha as capas dos destaques do Instagram (@lolemos), no estilo do site.

Uso:  python3 gerar-capas.py && node gerar-png.mjs

Cada capa é um SVG de 1080x1920, o tamanho do story. Ao escolher a capa de um
destaque, o Instagram recorta um círculo no meio da imagem com a largura dela,
então o desenho tem de caber todo no círculo central: nada perto das bordas.

As cores e o contorno claro são os do site com fundo preto (sites/lorenabraganca):
mexer aqui sem mexer lá deixa o perfil e o site com duas caras.
"""
from pathlib import Path

FUNDO, CREME, SOL, ROSA, AZUL = "#111117", "#F2F2EC", "#FFD23F", "#FF9EC4", "#4F5BFF"
PASTA = Path(__file__).parent / "capas"


def estrela(x, y, tam, cor):
    """A estrelinha de quatro pontas do site, o enfeite que amarra as capas."""
    s = tam / 100
    return (f'<path transform="translate({x - 50*s} {y - 50*s}) scale({s})" '
            f'd="M50 4 C54 38 62 46 96 50 C62 54 54 62 50 96 C46 62 38 54 4 50 C38 46 46 38 50 4Z" '
            f'fill="{cor}" stroke="{CREME}" stroke-width="5" stroke-linejoin="round"/>')


def grande(conteudo, escala=5.4):
    """Desenho feito numa grade de 100x100, ampliado e centrado em (540, 960)."""
    return (f'<g transform="translate({540 - 50*escala} {960 - 50*escala}) scale({escala})" '
            f'stroke="{CREME}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">{conteudo}</g>')


def capa(desenho, enfeite):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">'
            f'<rect width="1080" height="1920" fill="{FUNDO}"/>{desenho}{enfeite}</svg>\n')


RAIOS = [(50, 4, 50, 18), (50, 82, 50, 96), (4, 50, 18, 50), (82, 50, 96, 50),
         (17, 17, 27, 27), (73, 73, 83, 83), (83, 17, 73, 27), (27, 73, 17, 83)]

CAPAS = {
    # coração rosa: o mesmo adesivo do site
    "1-sobre-mim": capa(
        grande(f'<path d="M50 88 C20 66 6 50 6 32 C6 18 17 8 30 8 C40 8 46 14 50 22 '
               f'C54 14 60 8 70 8 C83 8 94 18 94 32 C94 50 80 66 50 88Z" fill="{ROSA}"/>'),
        estrela(800, 700, 130, SOL)),
    # o sol do site, que está ao lado da foto na página "em breve"
    "2-novidades": capa(
        grande('<g>' + ''.join(f'<line x1="{a}" y1="{b}" x2="{c}" y2="{d}"/>' for a, b, c, d in RAIOS)
               + f'</g><circle cx="50" cy="50" r="22" fill="{SOL}"/>', 5.6),
        estrela(810, 690, 120, ROSA)),
    "3-bastidores": capa(
        grande(f'<rect x="32" y="17" width="30" height="16" rx="5" fill="{AZUL}"/>'
               f'<rect x="7" y="27" width="86" height="58" rx="13" fill="{AZUL}"/>'
               f'<circle cx="50" cy="56" r="18" fill="{SOL}"/>'
               f'<circle cx="50" cy="56" r="7" fill="{FUNDO}" stroke-width="3"/>'
               f'<circle cx="79" cy="40" r="4" fill="{CREME}" stroke="none"/>'),
        estrela(815, 690, 120, ROSA)),
    "4-contato": capa(
        grande(f'<path d="M20 12 H80 Q94 12 94 26 V60 Q94 74 80 74 H46 L24 92 L28 74 H20 '
               f'Q6 74 6 60 V26 Q6 12 20 12 Z" fill="{SOL}"/>'
               + ''.join(f'<circle cx="{x}" cy="43" r="6" fill="{FUNDO}" stroke="none"/>' for x in (30, 50, 70))),
        estrela(810, 690, 120, ROSA)),
}

if __name__ == "__main__":
    PASTA.mkdir(exist_ok=True)
    for nome, svg in CAPAS.items():
        (PASTA / f"{nome}.svg").write_text(svg)
        print(nome)
