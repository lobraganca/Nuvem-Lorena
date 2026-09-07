"""
Dia 1 do plano de 30 dias — o carrossel do currículo.

Pilar: DOR. Funil: topo. Formato: carrossel de 9 telas.

    "Em quantos lugares você deixou currículo esse ano?
     E quantos ligaram?"

── POR QUE ESTE CARROSSEL NÃO USA O MOLDE DOS PLANOS ──────────────────

Porque ele não vende nada, e o molde do cartão vende. Caixa branca, lista
de vantagens e pílula laranja fazem qualquer frase parecer anúncio — e
anúncio é justamente o que a primeira peça não pode parecer. O trabalho
dela é a pessoa se RECONHECER, e ninguém se reconhece num banner.

── OS DOIS FUNDOS ─────────────────────────────────────────────────────

  AZUL DO EI   a pergunta, a conclusão e o convite. É a voz do Ei.
  PAPEL        a conta e a resposta. É a vida da pessoa.

Sobre os dois se escreve em TINTA. Sobre o azul do Ei, letra branca dá
2,64 de contraste e some — o conserto não foi trocar o azul da marca, foi
trocar a cor da letra. Ver o bloco da paleta em `artes_ei.py`.

── AS QUATRO RODADAS QUE ESTA PEÇA LEVOU ──────────────────────────────

Vale saber qual rodada resolveu o quê antes de mexer em qualquer medida.

1ª — "está muito desalinhado". Cada tela dos lugares tinha altura própria,
porque "Na padaria da esquina." quebrava em duas linhas e "No mercado
grande." não. Daí `conferir_cabe` valer aqui: frase que não cabe estoura
na geração, com o nome dela, em vez de sair torta ou encolhida.

2ª — "achei pobre". Era o acabamento: a letra do sistema no lugar da letra
do app, manchete com espaçamento frouxo, nenhuma moldura.

3ª — "sem degradê, acabamento premium". Caiu o degradê do fundo, o clarão,
a pílula laranja cheia — e o véu que escurecia a foto, que era degradê
também.

4ª — "sem fotos, da cor do Ei, letras menores". As fotos saíram (ela não
tem as de Itabirito, e foto de banco de imagem estragaria o argumento: a
graça de "na padaria da esquina" é reconhecer a padaria). O azul-marinho
que eu tinha escolhido virou o azul do Ei de verdade. E a manchete caiu de
86 para 64 — com menos letra sobra mais espaço, e espaço é o que faz a
peça respirar. Sem foto, o que segura o ato do meio é a CONTA subindo, e
por isso a lista voltou: as quatro linhas sempre nas mesmas alturas, só
mudando de cor.

── O QUE ESTA PEÇA NÃO FAZ ────────────────────────────────────────────

Não promete emprego, não mostra preço e não pede seguidor. A chamada é
"marca alguém que tá nessa", porque em Itabirito o alcance vem do grupo
de WhatsApp e não do algoritmo — e porque um seguidor a mais não emprega
ninguém.
"""

import artes_ei as ei

# Os lugares. São quatro, e são de Itabirito — "na loja do shopping" não
# diria nada aqui. A ordem é a de quem anda pela cidade procurando: começa
# perto de casa e termina no que é mais longe.
LUGARES = [
    "Na padaria da esquina.",
    "Na loja do centro.",
    "No posto da entrada.",
    "No mercado grande.",
]

TOTAL = 9

# ── OS TAMANHOS, DEPOIS DO "LETRAS MENORES" ────────────────────────────
#
# A manchete caiu de 86 para 64 e a lista de 44 para 36. Letra menor num
# formato do mesmo tamanho não é perda: é espaço em branco ganho, e espaço
# em branco é o que separa peça composta de peça cheia. O limite é a tela
# do celular — abaixo de uns 30px a legenda de um carrossel some no feed, e
# por isso o texto de apoio parou em 29.
TAM_MANCHETE = 64
TAM_LUGAR = 36
TAM_APOIO = 29
TAM_CONTA = 76

# A régua do ato 2. Estas alturas são as MESMAS nas cinco telas de papel —
# é isso que faz a lista crescer sem a página remontar embaixo do dedo.
Y_CONTA = 288
LISTA_TOPO = 520
PASSO_LISTA = 150
X_RISCO = 780             # onde começa o traço da resposta em branco
LARGURA_ITEM = X_RISCO - 40 - ei.MARGEM


def _moldura(escura: bool, numero: int):
    """Toda tela começa igual: cor chapada, cabeçalho e rodapé."""
    img, d = ei.peca_lisa(escura)
    ei.cabecalho(img, d, escura, numero, TOTAL)
    ei.rodape(img, d, escura)
    return img, d


def capa():
    """Ato 1 — a pergunta, na voz do Ei."""
    img, d = _moldura(escura=True, numero=1)
    # O bloco desce para o meio da página. Com a letra menor, deixá-lo
    # colado no cabeçalho abria 500px de vazio embaixo — e vazio embaixo lê
    # como página que não terminou de carregar, não como respiro.
    ei.sobrenome(d, "quem procura emprego em itabirito", True, 470)
    ei.manchete(d, "Em quantos lugares você deixou currículo esse ano?",
                TAM_MANCHETE, ei.TINTA, 558)

    # "arraste" com a seta: a peça inteira é escrita para a última tela, e
    # quem para na primeira nunca chega lá. Discreto, no pé, para convidar
    # sem gritar.
    ei.escrever(d, (ei.MARGEM, ei.Y_RODAPE - 84), "arraste  →",
                ei.f(ei.INTER_SEMI, 25), ei.SOBRE_AZUL_FRACO, 3.0)
    return img


def _linha(d, i: int, cor, negrito: bool, marcar: bool) -> None:
    """Uma linha da lista. Devolve nada — as alturas são fixas de propósito.

    Fio fino em vez de bolinha: bolinha é o desenho de "tópicos de
    apresentação" e faz a tela parecer slide de escritório. Fio é o de
    coisa anotada, que é exatamente o assunto.
    """
    y = LISTA_TOPO + i * PASSO_LISTA
    fonte = ei.f(ei.INTER_PESADA if negrito else ei.INTER_SEMI, TAM_LUGAR)
    ei.escrever(d, (ei.MARGEM, y), LUGARES[i], fonte, cor, -TAM_LUGAR * 0.018)

    fio = y + TAM_LUGAR + 30
    d.line((ei.MARGEM, fio, ei.L - ei.MARGEM, fio), fill=ei.FIO_PAPEL, width=2)
    if marcar:
        # A marca da linha de agora: um traço do azul do Ei em cima do fio,
        # como quem passa a caneta. É o único lugar onde o azul aparece nas
        # telas de papel, e é ele que muda de posição entre uma e outra.
        d.rounded_rectangle((ei.MARGEM, fio - 3, ei.MARGEM + 92, fio + 4), 3,
                            fill=ei.AZUL_EI)


def lugar(numero: int):
    """Ato 2 — a conta subindo, com a lista inteira sempre na tela.

    As quatro linhas aparecem desde a primeira: o que muda é a cor — a de
    agora em tinta cheia com o traço azul, as já passadas em tinta, as que
    faltam apagadas. Nada se mexe entre uma tela e outra, e quem passa o
    dedo vê a conta subir em vez de a página remontar.

    A lista cheia é também o que faz a 7ª tela funcionar: depois de cinco
    páginas ocupadas, um "Nenhum." sozinho é um susto.
    """
    img, d = _moldura(escura=False, numero=numero + 1)

    # "1 lugar" / "2 lugares": o número é o assunto, a palavra só o explica.
    fn = ei.f(ei.INTER_PRETA, TAM_CONTA)
    fp = ei.f(ei.INTER_SEMI, 32)
    largura = ei.escrever(d, (ei.MARGEM, Y_CONTA), f"{numero}", fn, ei.TINTA,
                          -TAM_CONTA * 0.03)
    d.text((ei.MARGEM + largura + 14, Y_CONTA + TAM_CONTA - 4),
           "lugar" if numero == 1 else "lugares",
           font=fp, fill=ei.SOBRE_PAPEL_FRACO, anchor="ls")

    for i in range(len(LUGARES)):
        if i == numero - 1:
            _linha(d, i, ei.TINTA, True, True)
        elif i < numero:
            _linha(d, i, ei.TINTA, False, False)
        else:
            _linha(d, i, ei.CINZA_CLARO, False, False)
    return img


def pergunta():
    """A virada. A mesma lista, agora com o espaço da resposta em branco.

    O traço vazio ao lado de cada lugar é o desenho da pergunta: é um
    formulário que ninguém preencheu. Dizer "nenhum" na tela seguinte só
    tem força porque aqui há quatro espaços esperando resposta.
    """
    img, d = _moldura(escura=False, numero=6)
    ei.manchete(d, "E quantos ligaram?", TAM_MANCHETE, ei.TINTA, Y_CONTA)

    fonte = ei.f(ei.INTER_SEMI, TAM_LUGAR)
    for i, texto in enumerate(LUGARES):
        y = LISTA_TOPO + i * PASSO_LISTA
        ei.escrever(d, (ei.MARGEM, y), texto, fonte, ei.SOBRE_PAPEL_FRACO,
                    -TAM_LUGAR * 0.018)
        fio = y + TAM_LUGAR + 30
        d.line((ei.MARGEM, fio, ei.L - ei.MARGEM, fio), fill=ei.FIO_PAPEL, width=2)
        # O traço da resposta começa sempre no mesmo x, e não colado no fim
        # de cada frase: quatro riscos de tamanhos diferentes viram sujeira,
        # quatro iguais viram uma coluna de respostas em branco.
        d.line((X_RISCO, fio - 16, ei.L - ei.MARGEM, fio - 16),
               fill=(188, 196, 204), width=5)
    return img


def silencio():
    """A tela quase vazia. O vazio é o assunto — não preencher é o desenho."""
    img, d = _moldura(escura=False, numero=7)
    ei.sobrenome(d, "a resposta", False, 596)
    fim = ei.manchete(d, "Nenhum.", 84, ei.TINTA, 654)
    ei.apoio(d, "Talvez um. Você lembra qual.", TAM_APOIO,
             ei.SOBRE_PAPEL_FRACO, fim + 22)
    return img


def conclusao():
    """Ato 3 — o Ei volta a falar, e diz a única coisa nova do carrossel.

    As duas frases têm pesos diferentes de propósito: a primeira tira uma
    culpa ("não é falta de vaga"), a segunda entrega o motivo. Em pesos
    iguais elas competem; assim a segunda é onde o olho para.
    """
    img, d = _moldura(escura=True, numero=8)
    # As duas linhas na MESMA cor, separadas só pelo peso. Desbotar a
    # primeira (era o que estava aqui) parece defeito de impressão: a frase
    # some em vez de ceder o lugar. Peso é o jeito certo de dizer "esta é a
    # de apoio" sem tirar a legibilidade dela.
    fim = ei.manchete(d, "O problema não é falta de vaga.", TAM_MANCHETE,
                      ei.TINTA, 540, fonte_arq=ei.INTER_MEDIA)
    ei.manchete(d, "É você não ficar sabendo.", TAM_MANCHETE, ei.TINTA,
                fim + 30, fonte_arq=ei.INTER_PRETA)
    return img


def convite():
    """O convite. Uma chamada só, e nenhuma promessa de emprego.

    A pílula é de TINTA sobre o azul, e não mais laranja cheia: lozango
    laranja gritando no pé é desenho de anúncio de liquidação. Em tinta ela
    tem 5,4 de contraste com o fundo e 12,8 com a própria letra, continua
    sendo obviamente um botão, e usa uma cor que a peça já tem.
    """
    img, d = _moldura(escura=True, numero=9)
    ei.sobrenome(d, "o convite", True)
    fim = ei.manchete(d, "No Ei Emprego a vaga procura você.", TAM_MANCHETE,
                      ei.TINTA, 356)
    ei.apoio(d, "Você marca o que faz. Quando abre uma vaga do seu ofício em "
                "Itabirito, o aviso chega no seu celular.",
             TAM_APOIO, ei.SOBRE_AZUL_FRACO, fim + 36)

    alto = 100
    topo = ei.Y_RODAPE - 96 - alto
    d.rounded_rectangle((ei.MARGEM, topo, ei.L - ei.MARGEM, topo + alto),
                        alto // 2, fill=ei.TINTA)
    fonte = ei.f(ei.INTER_PESADA, 36)
    frase = "Cadastro grátis em 5 minutos"
    largura = ei.largura_com_tracking(d, frase, fonte, -0.4)
    ei.escrever(d, ((ei.L - largura) / 2, topo + (alto - 48) // 2), frase, fonte,
                ei.PAPEL, -0.4)
    return img


def main() -> None:
    # Frase que não cabe estoura aqui, com o nome dela, em vez de sair
    # torta ou encolhida — o defeito da primeira rodada.
    ei.conferir_cabe(ei.INTER_PESADA, TAM_LUGAR, LUGARES, LARGURA_ITEM,
                     "a lista de lugares")

    # O contraste, nas cores chapadas. Sem degradê não há "pior ponto" — mas
    # a conferência fica, porque a cor pode mudar, e esquecer disso é o que
    # deixou a tela "Quem está contratando" em 1,1 por três rodadas.
    #
    # A primeira linha é a que importa mais: ela é o motivo de o texto sobre
    # o azul do Ei ser escuro. Branco ali dá 2,64 e reprovaria.
    for cor, fundo, minimo, onde in [
        (ei.TINTA, ei.AZUL_EI, 4.5, "a manchete sobre o azul do Ei"),
        (ei.SOBRE_AZUL_FRACO, ei.AZUL_EI, 4.5, "o discreto sobre o azul do Ei"),
        (ei.TINTA, ei.PAPEL, 4.5, "a manchete sobre o papel"),
        (ei.SOBRE_PAPEL_FRACO, ei.PAPEL, 4.5, "o apoio sobre o papel"),
        (ei.PAPEL, ei.TINTA, 4.5, "a letra dentro da pílula"),
    ]:
        real = ei.contraste(cor, fundo)
        if real < minimo:
            raise SystemExit(f"contraste baixo: {onde} está em {real:.2f}, "
                             f"mínimo {minimo}")

    telas = [("dia1-1-pergunta.png", capa())]
    for i in range(1, len(LUGARES) + 1):
        telas.append((f"dia1-{i + 1}-lugar{i}.png", lugar(i)))
    telas += [
        ("dia1-6-e-quantos.png", pergunta()),
        ("dia1-7-silencio.png", silencio()),
        ("dia1-8-conclusao.png", conclusao()),
        ("dia1-9-convite.png", convite()),
    ]
    for nome, img in telas:
        print("  ", ei.salvar(img, nome))


if __name__ == "__main__":
    main()
