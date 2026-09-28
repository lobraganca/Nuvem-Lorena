"""
Gera todas as imagens de marca do avena.app a partir de UMA fonte:
logo-avena.jpg (a arte que a dona mandou, letra creme no fundo verde).

    cd /home/user/Nuvem-Lorena/apps/avena-app
    python3 gerar-marca.py        # precisa do Pillow: pip install pillow

Nenhuma imagem de marca se edita à mão. No Ei Itabirito a marca velha
sobreviveu três vezes a uma troca de logo porque havia arquivo fora do
gerador (ver o CLAUDE.md); aqui, trocar a logo é trocar o .jpg e rodar isto.

Saídas:
  marca-avena.png  o nome recortado, fundo transparente — a página usa como
                   máscara, então a cor dele vem do CSS e segue o tema
  icone-avena.png  512×512, só o "a", para aba do navegador e atalho no celular
  og-avena.png     1200×630, a prévia do link no WhatsApp e no Instagram
"""
from pathlib import Path
import warnings
from PIL import Image

warnings.filterwarnings("ignore", category=DeprecationWarning)

AQUI = Path(__file__).parent
fonte = Image.open(AQUI / "logo-avena.jpg").convert("RGB")
cinza = fonte.convert("L")

# As duas cores medem-se na própria arte: o fundo é a mediana do que é
# escuro, a letra é o que há de mais claro (a média puxaria a borda
# suavizada e daria um creme sujo).
valores = sorted(cinza.getdata())
fundo_l = valores[len(valores) // 2]
letra_l = valores[int(len(valores) * 0.995)]
px = list(fonte.getdata())
escuros = sorted((p for p in px if sum(p) < 150), key=sum)
FUNDO = escuros[len(escuros) // 2]
claros = sorted((p for p in px if sum(p) > 3 * letra_l - 30), key=sum)
LETRA = claros[len(claros) // 2]
print("fundo #%02x%02x%02x · letra #%02x%02x%02x" % (*FUNDO, *LETRA))

# transparência = quanto o pixel se afasta do fundo em direção à letra
def alfa(v):
    t = (v - fundo_l - 8) / max(1, letra_l - fundo_l - 8)
    return int(255 * min(1, max(0, t)))

mascara = cinza.point(alfa)
caixa = mascara.getbbox()
folga = 6
caixa = (caixa[0] - folga, caixa[1] - folga, caixa[2] + folga, caixa[3] + folga)
nome = Image.new("RGBA", fonte.size, LETRA + (0,))
nome.putalpha(mascara)
nome = nome.crop(caixa)
nome.save(AQUI / "marca-avena.png", optimize=True)

# o "a" sozinho: a primeira coluna vazia depois da primeira letra
m = mascara.crop(caixa)
larg, alt = m.size
# As letras desta serifa se tocam ("a" encosta no "v"), então não há coluna
# vazia entre elas: o corte vai na coluna de MENOS tinta, perto de onde o
# primeiro quinto da palavra termina.
tinta = [sum(m.getpixel((x, y)) for y in range(alt)) for x in range(larg)]
inicio = next(x for x in range(larg) if tinta[x] > 0)
quinto = (larg - inicio) // 5
fim = min(range(inicio + quinto * 7 // 10, inicio + quinto * 13 // 10), key=lambda x: tinta[x])
letra_a = nome.crop((inicio, 0, fim, alt))

# A serifa do "v" avança por cima do "a" e o corte reto leva um pedacinho
# dela junto. Fica só o maior pedaço de tinta contínua, que é o "a".
def so_o_maior_pedaco(img):
    w, h = img.size
    a = img.getchannel("A").load()
    visto, maior = set(), set()
    for x0 in range(w):
        for y0 in range(h):
            if a[x0, y0] > 40 and (x0, y0) not in visto:
                pedaco, pilha = set(), [(x0, y0)]
                visto.add((x0, y0))
                while pilha:
                    x, y = pilha.pop()
                    pedaco.add((x, y))
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visto and a[nx, ny] > 40:
                            visto.add((nx, ny))
                            pilha.append((nx, ny))
                if len(pedaco) > len(maior):
                    maior = pedaco
    xs = [x for x, _ in maior]; ys = [y for _, y in maior]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    # apaga o que está fora do pedaço, com 2px de margem para a borda suave
    limpo = img.copy(); la = limpo.getchannel("A")
    perto = {(x + dx, y + dy) for x, y in maior for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2)}
    for x in range(w):
        for y in range(h):
            if (x, y) not in perto:
                la.putpixel((x, y), 0)
    limpo.putalpha(la)
    return limpo.crop((max(0, x0 - 2), max(0, y0 - 2), min(w, x1 + 3), min(h, y1 + 3)))

letra_a = so_o_maior_pedaco(letra_a)

def no_quadro(img, w, h, ocupa):
    base = Image.new("RGB", (w, h), FUNDO)
    esc = min(w * ocupa / img.width, h * ocupa / img.height)
    r = img.resize((round(img.width * esc), round(img.height * esc)), Image.LANCZOS)
    base.paste(r, ((w - r.width) // 2, (h - r.height) // 2), r)
    return base

no_quadro(letra_a, 512, 512, 0.62).save(AQUI / "icone-avena.png", optimize=True)
no_quadro(nome, 1200, 630, 0.62).save(AQUI / "og-avena.png", optimize=True)
print("ok:", nome.size, "marca · icone 512 · og 1200×630")
