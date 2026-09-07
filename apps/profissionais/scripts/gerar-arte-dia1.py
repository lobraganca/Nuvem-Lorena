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

Então ela usa o molde aberto (`artes_ei.py`): fundo cheio, texto grande,
ar. Mesma marca, mesmo azul, mesma tipografia — outra conversa.

── A VIRADA É VISUAL, E NÃO SÓ DE TEXTO ───────────────────────────────

O carrossel tem três atos, e cada um tem o seu fundo:

  1. AZUL   a pergunta. É a voz do Ei chamando.
  2. BRANCO os lugares e a resposta. É a vida da pessoa.
  3. AZUL   a conclusão e o convite. O Ei volta a falar.

── A LISTA JÁ VEM INTEIRA, E SÓ MUDA DE COR ───────────────────────────

A primeira versão do ato 2 mostrava um lugar por tela, sozinho no alto de
uma página branca. Quatro telas seguidas com metade de baixo vazia não
leem como "ar": leem como arquivo que não terminou de carregar. E pior,
"Na padaria da esquina." quebrava em duas linhas enquanto "No mercado
grande." cabia numa — as telas que existem justamente para serem IGUAIS
saíam com alturas diferentes. É o mesmo defeito que reprovou a primeira
leva das artes dos planos, com outra roupa.

Agora as quatro linhas aparecem desde a primeira tela, nas mesmas alturas
sempre. O que muda é a cor: a de agora em escuro com o ponto laranja, as
já passadas em cinza, as que ainda vêm em cinza claro. Nada se mexe entre
uma tela e outra — quem passa o dedo vê a conta subir, não a página
remontar.

E a lista cheia é o que faz a 7ª tela funcionar: depois de quatro páginas
ocupadas, um "Nenhum." sozinho no branco é um susto. Antes, no meio de
telas que já eram vazias, era só mais uma.

── A SEGUNDA RODADA: "ACHEI POBRE" ────────────────────────────────────

A dona olhou a primeira leva e disse isso. Não era o texto — era o
acabamento, e o conserto foi todo em `artes_ei.py`: a letra do app no
lugar da letra do sistema, manchete com o espaçamento apertado, fundo azul
com profundidade em vez de chapado, e um alto e um pé fixos (marca,
"03 / 09", endereço) que fazem nove imagens virarem um carrossel só.

Aqui dentro sobrou o que é desta peça: a lista virou uma tabela de linhas
finas, e não uma lista de bolinhas. Bolinha é o desenho de "tópicos de
apresentação"; linha fina é o de coisa registrada — e o assunto da tela é
justamente um registro do que a pessoa já fez.

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

TAM_MANCHETE = 94
TAM_LUGAR = 48
TAM_APOIO = 36

# A régua do ato 2. Estas alturas são as MESMAS nas cinco telas brancas —
# é isso que faz a lista crescer sem a página remontar embaixo do dedo.
Y_TOPO_BLOCO = 268
LISTA_TOPO = 508
PASSO_LISTA = 138
X_TEXTO = ei.MARGEM
X_RISCO = 820          # onde começa o traço da resposta em branco (tela 6)
LARGURA_ITEM = X_RISCO - 40 - X_TEXTO


def _moldura(escura: bool, numero: int):
    """Toda tela começa igual: fundo, marca, contador e rodapé."""
    img, d = ei.peca_lisa(escura)
    ei.cabecalho(img, d, escura, numero, TOTAL)
    ei.rodape(img, d, escura)
    return img, d


def capa():
    """Ato 1 — a pergunta, na voz do Ei."""
    img, d = _moldura(escura=True, numero=1)
    ei.manchete(d, "Em quantos lugares você deixou currículo esse ano?",
                TAM_MANCHETE, ei.BRANCO, 330)

    # "arraste" com a seta: a peça inteira é escrita para a última tela, e
    # quem para na primeira nunca chega lá. Discreto, no pé, para convidar
    # sem gritar.
    fonte = ei.f(ei.INTER_SEMI, 28)
    ei.escrever(d, (ei.MARGEM, ei.Y_RODAPE - 92), "arraste  →", fonte,
                ei.SOBRE_AZUL_FRACO, 3.0)
    return img


def _linha_da_lista(d, i: int, cor_texto, negrito: bool, marcador) -> int:
    """Uma linha da tabela. Devolve o y do fio de baixo.

    Fio fino em vez de bolinha: bolinha é o desenho de "tópicos de
    apresentação" e faz a tela parecer slide de escritório. Linha fina é o
    desenho de coisa anotada — que é exatamente o assunto aqui.
    """
    y = LISTA_TOPO + i * PASSO_LISTA
    fonte = ei.f(ei.INTER_PESADA if negrito else ei.INTER_SEMI, TAM_LUGAR)
    ei.escrever(d, (X_TEXTO, y), LUGARES[i], fonte, cor_texto, -TAM_LUGAR * 0.018)

    fio = y + TAM_LUGAR + 34
    d.line((ei.MARGEM, fio, ei.L - ei.MARGEM, fio), fill=ei.FIO, width=2)
    if marcador is not None:
        # A marca da linha de agora: um traço laranja curto EM CIMA do fio,
        # como quem passa a caneta. Some nas outras, e é só ele que muda de
        # lugar entre uma tela e outra.
        d.rounded_rectangle((ei.MARGEM, fio - 2, ei.MARGEM + 96, fio + 4), 3,
                            fill=marcador)
    return fio


def lugar(numero: int):
    """Ato 2 — a conta subindo, com a lista inteira sempre na tela."""
    img, d = _moldura(escura=False, numero=numero + 1)

    # "1 lugar" / "2 lugares": o número é o assunto, a palavra só o explica.
    fn = ei.f(ei.INTER_PRETA, 150)
    fp = ei.f(ei.INTER_SEMI, 46)
    n = f"{numero}"
    base = Y_TOPO_BLOCO + 150
    # O mesmo azul escuro da marca no alto, e não o ciano do logo: dois
    # azuis diferentes na mesma página leem como descuido, e o ciano em
    # cima do branco fica lavado.
    largura = ei.escrever(d, (ei.MARGEM, Y_TOPO_BLOCO), n, fn, ei.AZUL_TOPO, -150 * 0.03)
    d.text((ei.MARGEM + largura + 20, base - 8), "lugar" if numero == 1 else "lugares",
           font=fp, fill=ei.ESCURO, anchor="ls")

    for i in range(len(LUGARES)):
        if i == numero - 1:
            _linha_da_lista(d, i, ei.ESCURO, True, ei.LARANJA)
        elif i < numero:
            _linha_da_lista(d, i, ei.ESCURO, False, None)
        else:
            _linha_da_lista(d, i, ei.CINZA_CLARO, False, None)
    return img


def pergunta():
    """A virada. A mesma lista, agora com o espaço da resposta em branco.

    O traço vazio ao lado de cada lugar é o desenho da pergunta: é um
    formulário que ninguém preencheu. Dizer "nenhum" na tela seguinte só
    tem força porque aqui há quatro espaços esperando resposta.
    """
    img, d = _moldura(escura=False, numero=6)
    ei.manchete(d, "E quantos ligaram?", TAM_MANCHETE, ei.ESCURO, Y_TOPO_BLOCO)

    for i in range(len(LUGARES)):
        fio = _linha_da_lista(d, i, ei.CINZA, False, None)
        # O traço da resposta começa sempre no mesmo x, e não colado no fim
        # de cada frase: quatro riscos de tamanhos diferentes viram sujeira,
        # quatro iguais viram uma coluna de respostas em branco.
        d.line((X_RISCO, fio - 16, ei.L - ei.MARGEM, fio - 16),
               fill=ei.CINZA_CLARO, width=5)
    return img


def silencio():
    """A tela quase vazia. O vazio é o assunto — não preencher é o desenho."""
    img, d = _moldura(escura=False, numero=7)
    fim = ei.manchete(d, "Nenhum.", 132, ei.ESCURO, 590)
    ei.apoio(d, "Talvez um. Você lembra qual.", TAM_APOIO, ei.CINZA, fim + 26)
    return img


def conclusao():
    """Ato 3 — o Ei volta a falar, e diz a única coisa nova do carrossel.

    As duas frases têm pesos diferentes de propósito: a primeira tira uma
    culpa ("não é falta de vaga"), a segunda entrega o motivo. Em pesos
    iguais elas competem; assim a segunda é onde o olho para.
    """
    img, d = _moldura(escura=True, numero=8)
    fim = ei.manchete(d, "O problema não é falta de vaga.", TAM_MANCHETE,
                      ei.SOBRE_AZUL, 300, fonte_arq=ei.INTER_MEDIA)
    ei.manchete(d, "É você não ficar sabendo.", TAM_MANCHETE, ei.BRANCO, fim + 34,
                fonte_arq=ei.INTER_PRETA)
    return img


def convite():
    """O convite. Uma faixa laranja só, e nenhuma promessa de emprego."""
    img, d = _moldura(escura=True, numero=9)
    fim = ei.manchete(d, "No Ei Emprego a vaga procura você.", TAM_MANCHETE,
                      ei.BRANCO, 268)
    ei.apoio(d, "Você marca o que faz. Quando abre uma vaga do seu ofício em "
                "Itabirito, o aviso chega no seu celular.",
             TAM_APOIO, ei.SOBRE_AZUL, fim + 40)

    alto = 112
    topo = ei.Y_RODAPE - 76 - alto
    d.rounded_rectangle((ei.MARGEM, topo, ei.L - ei.MARGEM, topo + alto),
                        alto // 2, fill=ei.LARANJA)
    fonte = ei.f(ei.INTER_PESADA, 44)
    largura = ei.largura_com_tracking(d, "Cadastro grátis em 5 minutos", fonte, -0.6)
    ei.escrever(d, ((ei.L - largura) / 2, topo + (alto - 56) // 2),
                "Cadastro grátis em 5 minutos", fonte, ei.BRANCO, -0.6)
    return img


def main() -> None:
    # Uma linha que quebra em duas desalinha a lista inteira — e a lista só
    # existe para ser igual nas cinco telas. Estoura aqui, com o nome da
    # frase, em vez de sair torto na arte.
    ei.conferir_cabe(ei.INTER_PESADA, TAM_LUGAR, LUGARES, LARGURA_ITEM,
                     "a lista de lugares")

    telas = [("dia1-1-pergunta.png", capa())]
    for i in range(1, len(LUGARES) + 1):
        telas.append((f"dia1-{i + 1}-lugar{i}.png", lugar(i)))
    telas += [
        ("dia1-6-e-quantos.png", pergunta()),
        ("dia1-7-silencio.png", silencio()),
        ("dia1-8-conclusao.png", conclusao()),
        ("dia1-9-convite.png", convite()),
    ]
    # A conferência de contraste. Mede o FUNDO azul limpo, sem o texto: o
    # fundo é um degradê com um clarão por cima, a cor exata debaixo de cada
    # letra não é a que se escolheria de cabeça, e medir a peça pronta
    # mediria a letra contra ela mesma.
    #
    # 3 é o mínimo da WCAG para letra grande (manchete) e 4,5 para o resto.
    # Aqui as manchetes brancas passam dos 4,5 também; só o rodapé e o
    # "arraste", que são pequenos e discretos de propósito, ficam nos 3.
    fundo = ei.fundo_azul()
    ei.conferir_contraste(fundo, ei.BRANCO, (0, 240, ei.L, 960), 4.5,
                          "as manchetes brancas das telas azuis")
    ei.conferir_contraste(fundo, ei.SOBRE_AZUL, (0, 240, ei.L, 1120), 4.0,
                          "o texto de apoio das telas azuis")
    ei.conferir_contraste(fundo, ei.SOBRE_AZUL_FRACO,
                          (0, ei.Y_RODAPE - 110, ei.L, ei.A), 3.0,
                          "o rodapé das telas azuis")

    for nome, img in telas:
        print("  ", ei.salvar(img, nome))


if __name__ == "__main__":
    main()
