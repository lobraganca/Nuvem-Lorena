#!/usr/bin/env python3
"""
Gera TODOS os ícones do app a partir de uma imagem só.

── Por que este arquivo existe — 06/09 ───────────────────────────────

A dona mandou a logo certa e disse: "a logo está incorreta". E estava — só
no Android. O ícone do celular era o azul-marinho antigo (#031E52), de
antes da marca virar azul claro; os ícones do site já tinham sido trocados
em algum momento e os do aplicativo não.

Foi o que sempre acontece quando são vinte e poucos arquivos PNG feitos à
mão: alguém troca uns e esquece outros, e a diferença só aparece meses
depois, no celular de alguém.

Agora há UMA fonte — `docs/logo-ei.png` — e este script escreve todos os
tamanhos a partir dela. Trocar a marca de novo é substituir esse arquivo e
rodar:

    cd /home/user/Nuvem-Lorena/apps/profissionais
    python3 scripts/gerar-icones.py

── O que é cada arquivo ──────────────────────────────────────────────

Android (`android/app/src/main/res/mipmap-*/`):

  ic_launcher.png            o ícone quadrado de sempre, para Android antigo
  ic_launcher_round.png      o mesmo, recortado em círculo
  ic_launcher_background.png a camada de trás do ícone adaptativo (só cor)
  ic_launcher_foreground.png a camada da frente (a marca, em transparente)

O ícone adaptativo é o do Android moderno: o sistema junta as duas camadas
e recorta no formato que o fabricante escolheu — círculo, quadrado com
canto, gota. Por isso a marca NÃO pode encostar na borda: o que fica de
fora do recorte some. O `ic_launcher.xml` encolhe as duas camadas em 16,7%,
que é justamente a margem de segurança do Android.

Site e PWA (`public/`):

  icon-192.png, icon-512.png    o ícone do app instalado pelo navegador
  apple-touch-icon.png          o do iPhone
  icon-maskable-512.png         o "recortável": aqui a marca é MENOR de
                                propósito, porque o Android pode cortar as
                                bordas deste também

── A regra de proporção ──────────────────────────────────────────────

Na logo que a dona mandou, a marca ("Ei" mais o pingo) ocupa 48% da
largura do quadrado. Todos os arquivos gerados aqui respeitam essa mesma
proporção — é o que faz o ícone do celular, o do site e o da loja
parecerem o mesmo ícone, e não três parecidos.
"""

from pathlib import Path
from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
LOGO = RAIZ / "docs" / "logo-ei.png"
MARCA = RAIZ / "public" / "marca-ei.png"

# O azul do fundo, lido da própria logo — nunca digitado à mão, para não
# haver uma segunda verdade sobre qual é o azul da marca.
def cor_de_fundo(logo: Image.Image) -> tuple[int, int, int]:
    return logo.convert("RGB").getpixel((3, 3))


# Quanto da largura a marca ocupa dentro do quadrado, na arte original.
PROPORCAO_DA_MARCA = 0.48

# Nas versões "recortáveis" a marca encolhe: o sistema pode comer as
# bordas, e um pingo cortado estraga a marca inteira.
PROPORCAO_RECORTAVEL = 0.40

# Android: pasta → tamanho do ícone comum, tamanho das camadas adaptativas.
DENSIDADES = {
    "mipmap-ldpi": (36, 81),
    "mipmap-mdpi": (48, 108),
    "mipmap-hdpi": (72, 162),
    "mipmap-xhdpi": (96, 216),
    "mipmap-xxhdpi": (144, 324),
    "mipmap-xxxhdpi": (192, 432),
}


def quadrado(logo: Image.Image, lado: int) -> Image.Image:
    """A logo inteira, do tamanho pedido."""
    return logo.convert("RGBA").resize((lado, lado), Image.LANCZOS)


def redondo(logo: Image.Image, lado: int) -> Image.Image:
    """A logo recortada em círculo, para os lançadores que pedem redondo."""
    base = quadrado(logo, lado)
    mascara = Image.new("L", (lado * 4, lado * 4), 0)
    ImageDraw.Draw(mascara).ellipse((0, 0, lado * 4 - 1, lado * 4 - 1), fill=255)
    # Desenhada 4x maior e reduzida depois: é o que deixa a borda do
    # círculo lisa. Desenhada no tamanho final, ela sai serrilhada.
    base.putalpha(mascara.resize((lado, lado), Image.LANCZOS))
    return base


def so_a_cor(cor: tuple[int, int, int], lado: int) -> Image.Image:
    return Image.new("RGBA", (lado, lado), (*cor, 255))


def marca_centrada(
    marca: Image.Image, lado: int, proporcao: float, fundo: tuple[int, int, int] | None
) -> Image.Image:
    """A marca sozinha, centrada num quadrado (com ou sem fundo)."""
    tela = Image.new("RGBA", (lado, lado), (*fundo, 255) if fundo else (0, 0, 0, 0))
    largura = round(lado * proporcao)
    altura = round(largura * marca.height / marca.width)
    pequena = marca.resize((largura, altura), Image.LANCZOS)
    tela.alpha_composite(pequena, ((lado - largura) // 2, (lado - altura) // 2))
    return tela


def main() -> None:
    if not LOGO.exists():
        raise SystemExit(f"Não achei a logo em {LOGO}")

    logo = Image.open(LOGO).convert("RGBA")
    marca = Image.open(MARCA).convert("RGBA")
    # A marca vem com folga em volta; o que interessa é a tinta.
    marca = marca.crop(marca.split()[3].getbbox())
    fundo = cor_de_fundo(logo)
    print(f"logo: {logo.size}  fundo: #{fundo[0]:02x}{fundo[1]:02x}{fundo[2]:02x}")

    escritos = 0
    for pasta, (comum, adaptativo) in DENSIDADES.items():
        destino = RAIZ / "android/app/src/main/res" / pasta
        destino.mkdir(parents=True, exist_ok=True)
        quadrado(logo, comum).save(destino / "ic_launcher.png")
        redondo(logo, comum).save(destino / "ic_launcher_round.png")
        so_a_cor(fundo, adaptativo).save(destino / "ic_launcher_background.png")
        marca_centrada(marca, adaptativo, PROPORCAO_DA_MARCA, None).save(
            destino / "ic_launcher_foreground.png"
        )
        escritos += 4

    web = RAIZ / "public"
    quadrado(logo, 192).convert("RGB").save(web / "icon-192.png")
    quadrado(logo, 512).convert("RGB").save(web / "icon-512.png")
    quadrado(logo, 180).convert("RGB").save(web / "apple-touch-icon.png")
    marca_centrada(marca, 512, PROPORCAO_RECORTAVEL, fundo).convert("RGB").save(
        web / "icon-maskable-512.png"
    )
    escritos += 4

    print(f"{escritos} arquivos escritos.")


if __name__ == "__main__":
    main()
