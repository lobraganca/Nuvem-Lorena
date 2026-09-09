"""
"Qual sua maior dificuldade pra contratar?" — a peça que PERGUNTA.

A dona: "faça essa propaganda: Empresário de Itabirito: qual sua maior
dificuldade pra contratar? [...] As respostas viram o conteúdo da semana e
te dizem o que a cidade precisa. Responder uma por uma nos Stories, com a
pergunta na tela, é a coisa mais barata que existe e a que mais gera
conversa."

── ESTA PEÇA NÃO VENDE NADA, E É POR ISSO QUE ELA FUNCIONA ────────────

As três anteriores pedem alguma coisa: repare, cadastre-se, clique. Esta
pede uma RESPOSTA — e é a única cujo sucesso não se mede em cadastro, e
sim em quantas empresas escrevem de volta.

Isso muda o desenho inteiro:

  · a pergunta é a peça. Não há manchete E pergunta; a pergunta É a
    manchete, no maior tamanho da série;

  · não há endereço do site em destaque nem convite a se cadastrar. Uma
    peça que pergunta e ao mesmo tempo vende não é uma pergunta — é um
    anúncio disfarçado, e quem lê percebe em um segundo. O endereço fica
    no rodapé, do tamanho de assinatura, porque a peça circula solta no
    WhatsApp e precisa dizer de quem é;

  · e ela é dirigida: "EMPRESÁRIO DE ITABIRITO" no alto não é enfeite de
    lugar, é o crachá de quem a pergunta está chamando. Sem ele a pergunta
    fica no ar e ninguém se sente o dono dela.

── O ESPAÇO VAZIO É O DESENHO ─────────────────────────────────────────

Entre a pergunta e a chamada fica um vão grande, de propósito, e é a única
"ilustração" da peça: é o lugar onde a resposta caberia. Encher esse vão
com enfeite — a rede de pontos, a bolinha, um ícone — transformaria um
convite a falar num cartaz a olhar.

Foi o que fez a peça anterior precisar do desenho das setas: lá havia dois
lados para mostrar. Aqui há uma pergunta e um silêncio, e o silêncio é o
que pede a resposta.

── A CHAMADA É CURTA PORQUE A PROMESSA É PEQUENA ──────────────────────

"Me conta. Eu respondo." — e não "responda nos comentários que eu leio
todas e faço um conteúdo". A dona vai responder uma por uma nos Stories, e
essa é a promessa; escrevê-la inteira na arte encheria o único bloco de
papel da peça com instrução de rede social, que envelhece mal e não cabe
em quatro palavras.

O plano completo (as respostas viram conteúdo da semana) vive na legenda,
que é onde ele pode ser explicado sem competir com a pergunta.

── AZUL E LETRA ───────────────────────────────────────────────────────

O mesmo azul claro da peça anterior, que veio de `artes_ei` justamente
para as duas não divergirem — com a regra que anda amarrada a ele: nenhum
texto branco pequeno. O endereço do rodapé vai em 26px semi pelo mesmo
motivo de lá.
"""

from PIL import Image, ImageDraw

import artes_ei as ei

# ── O CRACHÁ, A PERGUNTA E O PEDIDO ────────────────────────────────────
#
# "EMPRESÁRIO DE ITABIRITO" com a cidade dentro, e não "EMPRESÁRIO" e
# "ITABIRITO" em linhas separadas: é uma pessoa só sendo chamada pelo
# nome, e quebrar isso em duas informações enfraquece as duas.
CRACHA = "EMPRESÁRIO DE ITABIRITO"
PERGUNTA = "Qual a sua maior dificuldade pra contratar?"
CHAMADA = "Me conta. Eu respondo."
ENDERECO = "www.empregoitabirito.com.br"

# O laranja da bolinha do logo, medido no arquivo que a dona mandou. Só
# no fio do bloco de papel — sobre o azul ele some (1,72).
LARANJA_EI = (253, 170, 70)

# ── AS ALTURAS ─────────────────────────────────────────────────────────
# Fixas e todas aqui em cima, como nas outras peças: altura calculada no
# meio do desenho é peça que sai diferente a cada troca de frase.
Y_CRACHA = 268
Y_PERGUNTA = 372
TAM_PERGUNTA = 96
Y_CHAMADA = 906
ALTURA_CHAMADA = 180


def gerar() -> None:
    # ── Antes de desenhar: cabe? ──────────────────────────────────────
    ei.conferir_cabe(ei.INTER_SEMI, 30, [CRACHA], ei.LARGURA_TEXTO, "o crachá")
    ei.conferir_cabe(ei.INTER_PESADA, 40, [CHAMADA], ei.LARGURA_TEXTO - 120, "chamada")
    ei.conferir_cabe(ei.INTER_SEMI, 26, [ENDERECO], ei.LARGURA_TEXTO, "endereço")

    img = Image.new("RGB", (ei.L, ei.A), ei.AZUL_CLARO)
    d = ImageDraw.Draw(img)
    x0, x1 = ei.MARGEM, ei.L - ei.MARGEM

    # O bloco de papel vem antes do texto: o contraste tem de ser medido
    # contra o fundo de verdade, e não contra o azul.
    d.rectangle((x0, Y_CHAMADA, x1, Y_CHAMADA + ALTURA_CHAMADA), fill=ei.PAPEL)
    d.rectangle((x0, Y_CHAMADA, x1, Y_CHAMADA + 8), fill=LARANJA_EI)

    # ── A conferência, com o fundo pronto e ANTES da letra ────────────
    # Régua de 3,0: é o mínimo da norma para LETRA GRANDE, e todo texto
    # branco desta peça é grande. Ver o bloco do AZUL_CLARO em `artes_ei`
    # — quem encolher qualquer um destes tem de escurecer o azul junto.
    ei.conferir_contraste(img, ei.SOBRE_CAPA,
                          (x0, Y_CRACHA, x1, Y_CRACHA + 40), 3.0, "o crachá")
    ei.conferir_contraste(img, ei.SOBRE_CAPA,
                          (x0, Y_PERGUNTA, x1, Y_PERGUNTA + 460), 3.0, "a pergunta")
    ei.conferir_contraste(img, ei.TINTA,
                          (x0 + 40, Y_CHAMADA + 40, x1 - 40, Y_CHAMADA + 130),
                          4.5, "chamada")
    ei.conferir_contraste(img, ei.SOBRE_CAPA,
                          (x0, ei.Y_RODAPE + 30, x1, ei.Y_RODAPE + 70),
                          3.0, "endereço")

    # ── Agora a letra ─────────────────────────────────────────────────
    marca = ei._marca_colorida(38, ei.SOBRE_CAPA)
    img.paste(marca, (ei.MARGEM, ei.Y_CABECALHO), marca)
    d.line((x0, ei.Y_FIO_ALTO, x1, ei.Y_FIO_ALTO), fill=ei.FIO_CLARO, width=2)

    ei.escrever(d, (ei.MARGEM, Y_CRACHA), CRACHA,
                ei.f(ei.INTER_SEMI, 30), ei.SOBRE_CAPA, 7.0)

    # A pergunta ocupa o corpo inteiro da peça. `manchete` já quebra a
    # linha na largura do texto e aperta o tracking na proporção do
    # tamanho — ver `artes_ei`.
    ei.manchete(d, PERGUNTA, TAM_PERGUNTA, ei.SOBRE_CAPA, Y_PERGUNTA,
                entrelinha=1.14)

    # A chamada, centralizada na caixa: é um BOTÃO, e botão tem o texto no
    # meio. O resto da peça é alinhado à esquerda de propósito.
    fonte = ei.f(ei.INTER_PESADA, 40)
    larg = d.textlength(CHAMADA, font=fonte)
    d.text((x0 + (x1 - x0 - larg) / 2, Y_CHAMADA + 68), CHAMADA,
           font=fonte, fill=ei.TINTA)

    d.line((x0, ei.Y_RODAPE, x1, ei.Y_RODAPE), fill=ei.FIO_CLARO, width=2)
    ei.escrever(d, (ei.MARGEM, ei.Y_RODAPE + 36), ENDERECO,
                ei.f(ei.INTER_SEMI, 26), ei.SOBRE_CAPA, 1.0)

    print(f"pronto: {ei.salvar(img, 'ei-pergunta-empresarios.png')}")


if __name__ == "__main__":
    gerar()
