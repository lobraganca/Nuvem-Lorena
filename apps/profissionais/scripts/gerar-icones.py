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

── E de novo, pelo mesmo motivo — 08/09 ──────────────────────────────

A dona: "quando abri o app pelo navegador apareceu uma logo antiga.
Troque todas as logos pela anexa." A anexa era, byte por byte, o
`docs/logo-ei.png` que já estava aqui — ou seja, a fonte estava certa e
alguma coisa depois dela é que não tinha sido refeita.

Era a `public/marca-ei.png`: o "Ei" recortado do fundo, que é o que o
cabeçalho, a tela de abertura e a capa da tela inicial mostram. Ela
entrava aqui como MATÉRIA-PRIMA, feita à mão uma vez, e por isso passou
incólume pela troca de 06/09 — o script trocou tudo o que gerava, e ela
não era gerada.

Um arquivo feito à mão no meio de um gerador é exatamente o buraco que
este script existe para tapar. Agora ela também SAI daqui: o fundo é
removido em código, e não há mais nenhuma imagem de marca que alguém
precise lembrar de refazer.

── Como o fundo é removido ───────────────────────────────────────────

Pelo canal VERMELHO, e só por ele. Na arte da marca o azul do fundo tem
R≈1, o branco do "Ei" tem R=255 e o laranja do pingo tem R=253 — as duas
tintas quase iguais e o fundo do outro lado da régua. Então
`alfa = (R - R_do_fundo)` já é a máscara da marca inteira, pingo
incluído.

Isso importa por causa da costura entre o branco e o laranja: ali os dois
se misturam, e qualquer método que pergunte "esta cor é o fundo?" erra,
porque a mistura não é nenhuma das duas. O comentário do arquivo antigo
registra o resultado disso — "0,04% dos pixels destoam, todos na costura".
Pelo vermelho a costura nem existe como problema: branco e laranja têm o
mesmo R, então a máscara ali vale 1 dos dois lados.

Depois de achar o alfa, a cor é "desmisturada": um pixel de borda é
`alfa` da tinta mais `(1-alfa)` do azul, e o que se quer guardar é só a
tinta. Sem isso a marca sai com uma auréola azulada — que só aparece
quando ela é usada sobre fundo branco, que é justamente o cabeçalho.

── O que é cada arquivo ──────────────────────────────────────────────

Site (`public/`):

  marca-ei.png               o "Ei" sem fundo, transparente. É a marca que
                             aparece DENTRO do app: cabeçalho, abertura e
                             o carimbo no canto da capa

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


def recortar_a_marca(logo: Image.Image) -> Image.Image:
    """O "Ei" sem o fundo azul, cortado rente à tinta.

    Ver a explicação no cabeçalho do arquivo: o alfa sai do canal vermelho,
    porque nele o fundo e as duas tintas ficam em extremos opostos, e a
    costura entre o branco e o laranja deixa de ser um caso especial.
    """
    rgb = logo.convert("RGB")
    fundo = cor_de_fundo(logo)
    vermelho = rgb.split()[0]
    largura, altura = logo.size

    # Os dois extremos da régua saem da própria imagem, e nenhum é chutado.
    #
    # O teto é o vermelho mais alto que existe: a tinta cheia.
    #
    # O piso NÃO é a cor do fundo lida num pixel só. O azul chapado não é
    # chapado de verdade — na arte que a dona mandou ele varia de 0 a 10 de
    # vermelho, sobra de compressão. Com o piso em 1 essas sobras viravam
    # alfa 1 ou 2: invisível na tela, mas suficiente para o corte rente
    # achar tinta em todo canto e devolver o quadrado inteiro, com a marca
    # perdida no meio de uma moldura de nada. Foi o que aconteceu na
    # primeira tentativa.
    #
    # Então o piso é medido: o vermelho mais alto na moldura de fora, onde
    # só existe fundo (a marca ocupa os 48% do meio).
    borda = max(
        max(vermelho.crop((0, 0, largura, 40)).getextrema()),
        max(vermelho.crop((0, altura - 40, largura, altura)).getextrema()),
        max(vermelho.crop((0, 0, 40, altura)).getextrema()),
        max(vermelho.crop((largura - 40, 0, largura, altura)).getextrema()),
    )
    pico = vermelho.getextrema()[1]
    faixa = max(1, pico - borda)
    alfa = vermelho.point(lambda v: max(0, min(255, round((v - borda) * 255 / faixa))))

    # Desmisturar: o pixel de borda é `a` de tinta sobre `1-a` de azul, e o
    # que se guarda é só a tinta. Sem isto a marca leva junto uma auréola
    # azul, invisível sobre o azul da abertura e escancarada no cabeçalho
    # branco.
    pintados = []
    for (r, g, b), a in zip(rgb.get_flattened_data(), alfa.get_flattened_data()):
        if a == 0:
            pintados.append((0, 0, 0, 0))
        elif a == 255:
            pintados.append((r, g, b, 255))
        else:
            f = 255 / a
            pintados.append((
                max(0, min(255, round(fundo[0] + (r - fundo[0]) * f))),
                max(0, min(255, round(fundo[1] + (g - fundo[1]) * f))),
                max(0, min(255, round(fundo[2] + (b - fundo[2]) * f))),
                a,
            ))

    marca = Image.new("RGBA", logo.size)
    marca.putdata(pintados)
    return marca.crop(marca.split()[3].getbbox())


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
    fundo = cor_de_fundo(logo)
    # Recortada da logo, e não lida de um arquivo pronto: era o arquivo
    # pronto que ficava para trás a cada troca de marca (ver o cabeçalho).
    marca = recortar_a_marca(logo)
    print(f"logo: {logo.size}  fundo: #{fundo[0]:02x}{fundo[1]:02x}{fundo[2]:02x}")
    print(f"marca recortada: {marca.size}")

    MARCA.parent.mkdir(parents=True, exist_ok=True)
    marca.save(MARCA)

    escritos = 1
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
