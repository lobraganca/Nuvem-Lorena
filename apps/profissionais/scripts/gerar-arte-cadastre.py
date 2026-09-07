"""
"Uma nova era chegou" — a peça que CHAMA PARA O CADASTRO.

A dona: "preciso de uma propaganda para o Ei chamando as pessoas para
cadastrarem. Com a chamada onde quem quer contratar e quem quer trabalhar
se encontram. Colocando Itabirito e dizendo que uma nova era chegou. Com o
site www.empregoitabirito.com.br"

── O QUE MUDA DA PEÇA DE LANÇAMENTO ───────────────────────────────────

`gerar-arte-chegou.py` AVISA que o app existe. Esta PEDE uma ação — e
peça que pede ação tem de terminar num verbo, num lugar só, grande o
bastante para ser lido de relance na rolagem.

Por isso a chamada de cadastro é o único bloco de papel da peça: numa
tela azul inteira, o creme é a coisa que o olho procura primeiro. Duas
caixas de papel dividiriam essa atenção, e é o erro que faz um anúncio
"bonito" não converter nada.

── A ORDEM DAS TRÊS FRASES ────────────────────────────────────────────

  1. UMA NOVA ERA CHEGOU  — o que aconteceu (a manchete dela)
  2. onde os dois se encontram — o que é (a chamada dela)
  3. cadastre-se, é de graça — o que fazer (o único pedido)

Nessa ordem porque é a ordem da cabeça de quem lê: o que é isso, para que
serve, o que eu faço. Invertida, o "cadastre-se" chega antes de a pessoa
saber para quê — e aí ele é só mais um anúncio pedindo dados.

── "É DE GRAÇA" É VERDADE, E POR ISSO ESTÁ ESCRITO ────────────────────

Cadastrar não custa nada, nos dois lados: quem procura emprego nunca paga,
e quem contrata só paga para PUBLICAR vaga. A frase não é isca. Se um dia
o cadastro passar a custar, esta linha sai daqui no mesmo dia.

── E A REDE DE CONEXÕES NÃO ENTRA AQUI ────────────────────────────────

A capa do app e a peça de lançamento têm a rede de pontos ao fundo, e
ficou tentador repetir. Na primeira versão desta peça ela entrou — e
apareceu como uma tirinha de linhas espremida entre a frase e a caixa,
metade escondida atrás do papel. Lia-se como defeito, não como desenho.

O motivo é o mesmo que está escrito acima: esta peça tem UM ponto de
atenção, a caixa de papel. Enfeite que disputa com ela não está ajudando
— está tirando. A rede continua nas outras duas, onde há espaço vazio de
verdade para ela morar.

── O LARANJA DO LOGO NÃO PODE IR SOBRE O AZUL ─────────────────────────

Medido: o laranja da bolinha (253,170,70) sobre o azul do Ei dá 1,39 de
contraste. No logo ele funciona porque a bolinha é enorme; reduzida ao
tamanho de um detalhe, ela sumiria. Então o laranja aparece SÓ dentro do
bloco de papel, onde ele lê — e a marca do alto vai em tinta, como nas
outras peças.
"""

import artes_ei as ei

TARJA = "ITABIRITO · MG"
MANCHETE = "Uma nova era chegou."
FRASE = "Onde quem quer contratar e quem quer trabalhar se encontram."
CHAMADA = "Cadastre-se. É de graça."
# Com o "www." porque foi assim que ela escreveu, e é assim que se lê em
# voz alta numa cidade onde o link corre por WhatsApp e por conversa.
ENDERECO = "www.empregoitabirito.com.br"

# O laranja da bolinha do logo, medido no arquivo que ela mandou.
LARANJA_EI = (253, 170, 70)

# ── AS ALTURAS ─────────────────────────────────────────────────────────
# Fixas e todas aqui em cima. Altura calculada no meio do desenho é peça
# que sai diferente a cada troca de frase — e "está desalinhado" foi a
# primeira coisa apontada na primeira arte deste projeto.
Y_TARJA = 300
Y_MANCHETE = 372
Y_FRASE = 716
Y_CHAMADA = 936
ALTURA_CHAMADA = 180


def gerar() -> None:
    # ── Antes de desenhar: cabe? ──────────────────────────────────────
    # Falhar aqui custa um minuto de reescrita. Texto vazando a borda foi
    # apontado numa rodada; texto encolhido sozinho, na seguinte.
    ei.conferir_cabe(ei.INTER_SEMI, 23, [TARJA], ei.LARGURA_TEXTO, "tarja")
    ei.conferir_cabe(ei.INTER_MEDIA, 25, [ENDERECO], ei.LARGURA_TEXTO, "endereço")
    ei.conferir_cabe(ei.INTER_PESADA, 40, [CHAMADA], ei.LARGURA_TEXTO - 120, "chamada")

    # O laranja só vale dentro do papel — sobre o azul ele some (1,39).
    if ei.contraste(LARANJA_EI, ei.PAPEL) < 1.6:
        raise SystemExit("o laranja sumiu no papel: escolha outro acento")

    img, d = ei.peca_lisa(escura=True)

    # A caixa da chamada, desenhada ANTES do texto para o contraste ser
    # medido contra o fundo de verdade — creme, e não azul.
    x0, x1 = ei.MARGEM, ei.L - ei.MARGEM
    d.rectangle((x0, Y_CHAMADA, x1, Y_CHAMADA + ALTURA_CHAMADA), fill=ei.PAPEL)
    d.rectangle((x0, Y_CHAMADA, x1, Y_CHAMADA + 8), fill=LARANJA_EI)

    # ── A conferência, com o fundo pronto e ANTES da letra ────────────
    # Medindo a peça acabada, os pixels da própria letra entram na conta e
    # o resultado é 1,00 — o erro que a primeira geração destas artes
    # cometeu, e que engana porque parece problema de cor.
    ei.conferir_contraste(img, ei.TINTA,
                          (ei.MARGEM, Y_TARJA, x1, Y_TARJA + 40), 4.5, "tarja")
    ei.conferir_contraste(img, ei.TINTA,
                          (ei.MARGEM, Y_MANCHETE, x1, Y_MANCHETE + 290), 3.0, "manchete")
    ei.conferir_contraste(img, ei.TINTA,
                          (ei.MARGEM, Y_FRASE, x1, Y_FRASE + 120), 4.5, "frase")
    ei.conferir_contraste(img, ei.TINTA,
                          (x0 + 40, Y_CHAMADA + 40, x1 - 40, Y_CHAMADA + 130),
                          4.5, "chamada")
    ei.conferir_contraste(img, ei.SOBRE_AZUL_FRACO,
                          (ei.MARGEM, ei.Y_RODAPE + 30, x1, ei.Y_RODAPE + 70),
                          4.5, "endereço")

    # ── Agora a letra ─────────────────────────────────────────────────
    marca = ei._marca_colorida(38, ei.TINTA)
    img.paste(marca, (ei.MARGEM, ei.Y_CABECALHO), marca)
    d.line((ei.MARGEM, ei.Y_FIO_ALTO, x1, ei.Y_FIO_ALTO), fill=ei.FIO_AZUL, width=2)

    ei.sobrenome(d, TARJA, escura=True, y=Y_TARJA)
    ei.manchete(d, MANCHETE, 104, ei.TINTA, Y_MANCHETE)
    ei.apoio(d, FRASE, 38, ei.TINTA, Y_FRASE, entrelinha=1.36)

    # A chamada, centralizada na caixa. Centralizada aqui e à esquerda no
    # resto da peça de propósito: é um BOTÃO, e botão tem o texto no meio.
    fonte = ei.f(ei.INTER_PESADA, 40)
    larg = d.textlength(CHAMADA, font=fonte)
    d.text((x0 + (x1 - x0 - larg) / 2, Y_CHAMADA + 68), CHAMADA,
           font=fonte, fill=ei.TINTA)

    # O laranja do logo, num fio no alto da caixa. É o único ponto de cor
    # da peça, e existe para o olho parar aqui — que é onde está o pedido.
    #
    # Fio, e não as duas bolinhas da primeira versão: soltas nas pontas do
    # bloco, elas pareciam marcador de lista sem lista, ou sujeira. O fio
    # é o mesmo elemento que já fecha o cabeçalho e o rodapé da peça, então
    # ele lê como parte do desenho e não como enfeite avulso.

    d.line((ei.MARGEM, ei.Y_RODAPE, x1, ei.Y_RODAPE), fill=ei.FIO_AZUL, width=2)
    ei.escrever(d, (ei.MARGEM, ei.Y_RODAPE + 36), ENDERECO,
                ei.f(ei.INTER_MEDIA, 25), ei.SOBRE_AZUL_FRACO, 1.0)

    print(f"pronto: {ei.salvar(img, 'ei-nova-era-cadastre.png')}")


if __name__ == "__main__":
    gerar()
