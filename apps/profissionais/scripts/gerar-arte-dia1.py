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

── O QUE ESTA PEÇA NÃO FAZ ────────────────────────────────────────────

Não promete emprego, não mostra preço e não pede seguidor. A chamada é
"marca alguém que tá nessa", porque em Itabirito o alcance vem do grupo
de WhatsApp e não do algoritmo — e porque um seguidor a mais não emprega
ninguém.
"""

import artes_ei as ei

# Os lugares. São quatro, e são de Itabirito — "na loja do shopping" não
# diria nada aqui. Cada um vira uma tela, na ordem em que se anda pela
# cidade procurando: começa perto de casa e termina no que é mais longe.
LUGARES = [
    "Na padaria da esquina.",
    "Na loja do centro.",
    "No posto da entrada.",
    "No mercado grande.",
]

TAM_MANCHETE = 92
TAM_LUGAR = 48
TAM_APOIO = 38

# A régua do ato 2. Estas alturas são as MESMAS nas cinco telas brancas —
# é isso que faz a lista crescer sem a página remontar embaixo do dedo.
Y_CONTA = 196          # o número grande da contagem
Y_REGUA = 372          # a barrinha laranja, a mesma marca do molde dos planos
LISTA_TOPO = 470
PASSO_LISTA = 132
X_PONTO = ei.MARGEM + 14
X_TEXTO = ei.MARGEM + 62
# A linha do lugar tem de terminar ANTES do traço da tela 6 (x=820),
# senão texto e resposta em branco se encostam. 800 é o limite com folga.
LARGURA_ITEM = 800 - X_TEXTO

PALIDO = (203, 212, 221)   # o que ainda não aconteceu — visível, mas apagado


def capa():
    """Ato 1 — a pergunta, na voz do Ei."""
    img, d = ei.peca_lisa(ei.AZUL_FUNDO)
    ei.manchete(d, "Em quantos lugares você deixou currículo esse ano?",
                TAM_MANCHETE, ei.BRANCO, 250)
    ei.marca_no_pe(img, clara=True)
    return img


def _lista(d, ate: int) -> None:
    """As quatro linhas, sempre nas mesmas alturas. Só a cor muda.

    `ate` é quantas já aconteceram. A última delas é a de agora (escuro,
    com o ponto laranja), as anteriores viram cinza e as que faltam ficam
    pálidas. `ate=0` pinta todas pálidas; `ate=4` não deixa nenhuma.
    """
    fonte = ei.f(ei.FONTE_N, TAM_LUGAR)
    for i, texto in enumerate(LUGARES):
        y = LISTA_TOPO + i * PASSO_LISTA
        meio = y + TAM_LUGAR // 2 + 2
        if i == ate - 1:
            d.ellipse((X_PONTO - 15, meio - 15, X_PONTO + 15, meio + 15), fill=ei.LARANJA)
            cor = ei.ESCURO
        elif i < ate:
            d.ellipse((X_PONTO - 10, meio - 10, X_PONTO + 10, meio + 10), fill=ei.CINZA)
            cor = ei.CINZA
        else:
            d.ellipse((X_PONTO - 10, meio - 10, X_PONTO + 10, meio + 10),
                      outline=PALIDO, width=3)
            cor = PALIDO
        d.text((X_TEXTO, y), texto, font=fonte, fill=cor)


def lugar(numero: int):
    """Ato 2 — a conta subindo, com a lista inteira sempre na tela."""
    img, d = ei.peca_lisa(ei.BRANCO)

    # "1 lugar" / "2 lugares": o número é o assunto, a palavra só o explica.
    fn = ei.f(ei.FONTE_N, 132)
    fp = ei.f(ei.FONTE_N, 52)
    n = f"{numero}"
    largura = d.textlength(n, font=fn)
    base = Y_CONTA + 132
    d.text((ei.MARGEM, base), n, font=fn, fill=ei.AZUL, anchor="ls")
    d.text((ei.MARGEM + largura + 18, base), "lugar" if numero == 1 else "lugares",
           font=fp, fill=ei.ESCURO, anchor="ls")

    d.rounded_rectangle((ei.MARGEM, Y_REGUA, ei.MARGEM + 108, Y_REGUA + 6), 3,
                        fill=ei.LARANJA)
    _lista(d, numero)
    ei.marca_no_pe(img, clara=False)
    return img


def pergunta():
    """A virada. A mesma lista, agora com o espaço da resposta em branco.

    O traço vazio ao lado de cada lugar é o desenho da pergunta: é um
    formulário que ninguém preencheu. Dizer "nenhum" na tela seguinte só
    tem força porque aqui há quatro espaços esperando resposta.
    """
    img, d = ei.peca_lisa(ei.BRANCO)

    # Sem a barrinha laranja das outras quatro: a manchete tem duas linhas e
    # desce até onde ela ficaria. Aqui é o texto que ocupa o cabeçalho — o
    # que precisa continuar na mesma altura é a LISTA, e ela continua.
    ei.manchete(d, "E quantos ligaram?", TAM_MANCHETE, ei.ESCURO, Y_CONTA)

    fonte = ei.f(ei.FONTE_N, TAM_LUGAR)
    for i, texto in enumerate(LUGARES):
        y = LISTA_TOPO + i * PASSO_LISTA
        meio = y + TAM_LUGAR // 2 + 2
        d.text((X_TEXTO, y), texto, font=fonte, fill=ei.CINZA)
        # O traço começa sempre no mesmo x, e não colado no fim de cada
        # frase: quatro riscos de tamanhos diferentes viram sujeira, quatro
        # iguais viram uma coluna de respostas em branco.
        d.line((820, meio + 26, ei.L - ei.MARGEM, meio + 26), fill=PALIDO, width=4)

    ei.marca_no_pe(img, clara=False)
    return img


def silencio():
    """A tela quase vazia. O vazio é o assunto — não preencher é o desenho."""
    img, d = ei.peca_lisa(ei.BRANCO)
    ei.manchete(d, "Nenhum.", 108, ei.ESCURO, 560)
    ei.apoio(d, "Talvez um. Você lembra qual.", TAM_APOIO, ei.CINZA, 700)
    ei.marca_no_pe(img, clara=False)
    return img


def conclusao():
    """Ato 3 — o Ei volta a falar, e diz a única coisa nova do carrossel."""
    img, d = ei.peca_lisa(ei.AZUL_FUNDO)
    fim = ei.manchete(d, "O problema não é falta de vaga.", TAM_MANCHETE, ei.BRANCO, 250)
    ei.manchete(d, "É você não ficar sabendo.", TAM_MANCHETE, ei.BRANCO, fim + 40)
    ei.marca_no_pe(img, clara=True)
    return img


def convite():
    """O convite. Uma linha laranja só, e nenhuma promessa de emprego."""
    img, d = ei.peca_lisa(ei.AZUL_FUNDO)
    fim = ei.manchete(d, "No Ei Emprego a vaga procura você.", TAM_MANCHETE,
                      ei.BRANCO, 250)
    fim = ei.apoio(d, "Você marca o que faz. Quando abre uma vaga do seu "
                      "ofício em Itabirito, o aviso chega no seu celular.",
                   TAM_APOIO, ei.BRANCO, fim + 44)

    # A faixa laranja com o endereço: a única coisa a fazer depois de ler.
    alto = 116
    topo = ei.A - ei.MARGEM - 150 - alto
    d.rounded_rectangle((ei.MARGEM, topo, ei.L - ei.MARGEM, topo + alto),
                        alto // 2, fill=ei.LARANJA)
    ei.centrado(d, topo + (alto - 46) // 2, "empregoitabirito.com.br",
                ei.f(ei.FONTE_N, 46), ei.BRANCO)
    ei.centrado(d, topo + alto + 26, "Cadastro grátis · 5 minutos",
                ei.f(ei.FONTE, 32), ei.BRANCO)
    return img


def main() -> None:
    # Uma linha que quebra em duas desalinha a lista inteira — e a lista só
    # existe para ser igual nas cinco telas. Estoura aqui, com o nome da
    # frase, em vez de sair torto na arte.
    ei.conferir_cabe(ei.FONTE_N, TAM_LUGAR, LUGARES, LARGURA_ITEM, "a lista de lugares")

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
