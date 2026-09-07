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

── A VIRADA É VISUAL, E NÃO SÓ DE TEXTO ───────────────────────────────

O carrossel tem três atos, e cada um tem o seu fundo:

  1. TINTA  a pergunta. É a voz do Ei chamando.
  2. PAPEL  os lugares e a resposta. É a vida da pessoa.
  3. TINTA  a conclusão e o convite. O Ei volta a falar.

── AS TRÊS RODADAS QUE ESTA PEÇA LEVOU ────────────────────────────────

Cada uma consertou uma coisa diferente, e vale saber qual foi qual antes
de mexer em qualquer medida daqui.

1ª — "está muito desalinhado". O ato do meio mostrava um lugar por tela,
sozinho no alto de uma página vazia, e "Na padaria da esquina." quebrava
em duas linhas enquanto "No mercado grande." cabia numa. Telas que existem
para serem IGUAIS saíam com alturas diferentes. Daí `conferir_cabe` valer
também aqui: frase que não cabe estoura na geração, com o nome dela, em
vez de sair torta.

2ª — "achei pobre". Era o acabamento: a letra do sistema no lugar da letra
do app, manchete com espaçamento frouxo, nenhuma moldura. Consertado em
`artes_ei.py` (Inter, tracking negativo, cabeçalho e rodapé fixos).

3ª — "sem degradê, acabamento premium". Caiu o fundo com degradê, caiu o
clarão, caiu a pílula laranja cheia. E caiu o véu escuro que ficava por
cima da foto — que era um degradê também. A foto passou a ter MOLDURA
própria, com o texto fora dela, do jeito que revista impressa monta uma
página. Ganhou nos três lados: sem degradê nenhum, a foto aparece inteira
sem nada escurecendo o assunto, e o contraste do texto parou de depender
da foto que ela mandar.

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

TAM_MANCHETE = 86
TAM_LUGAR = 44
TAM_APOIO = 34

# ── AS FOTOS ───────────────────────────────────────────────────────────
#
# Cinco telas têm fotografia: a capa e os quatro lugares. Os arquivos vão
# em `scripts/fotos-dia1/` com estes nomes (ver o LEIA-ME de lá); enquanto
# não existirem, entra o retângulo riscado, que mostra o enquadramento e
# nunca deve ir para o ar.
#
# São fotos de ITABIRITO, tiradas pela dona. Foto de banco de imagem
# estragaria a peça: a graça de "na padaria da esquina" é a pessoa
# reconhecer a padaria. Uma padaria genérica diz o contrário do que a frase
# promete, e quem mora lá percebe na hora.
FOTO_CAPA = "1-cidade.jpg"
FOTO_LUGARES = ["2-padaria.jpg", "3-loja.jpg", "4-posto.jpg", "5-mercado.jpg"]

# As molduras. Larguras iguais, alturas iguais dentro de cada ato — é o
# que faz as quatro telas dos lugares serem a MESMA tela com outra foto.
CAIXA_CAPA = (ei.MARGEM, 236, ei.L - ei.MARGEM, 700)
CAIXA_LUGAR = (ei.MARGEM, 236, ei.L - ei.MARGEM, 792)

# A régua do ato 2 (as telas de papel). Repetida igual nas cinco.
Y_FIO_FOTO = 842          # o fio fino logo abaixo da moldura
Y_CONTA = 884             # o número grande
Y_NOME = 1024             # o nome do lugar
LISTA_TOPO = 456          # a lista de resumo, na tela 6
PASSO_LISTA = 132
X_RISCO = 800             # onde começa o traço da resposta em branco
LARGURA_ITEM = X_RISCO - 40 - ei.MARGEM


def _moldura(escura: bool, numero: int):
    """Toda tela começa igual: cor chapada, cabeçalho e rodapé."""
    img, d = ei.peca_lisa(escura)
    ei.cabecalho(img, d, escura, numero, TOTAL)
    ei.rodape(img, d, escura)
    return img, d


def capa():
    """Ato 1 — a pergunta, e a cidade logo acima dela."""
    img, d = _moldura(escura=True, numero=1)
    ei.foto_ou_exemplo(img, d, CAIXA_CAPA, FOTO_CAPA, "a cidade", True)
    ei.manchete(d, "Em quantos lugares você deixou currículo esse ano?",
                TAM_MANCHETE, ei.BRANCO, 762)
    return img


def lugar(numero: int):
    """Ato 2 — um lugar por tela, e a foto é o lugar.

    A lista que estas telas tinham antes saiu daqui: a foto já diz "é este
    lugar" melhor do que qualquer linha escrita, e quatro listas seguidas
    eram repetição sem função. Quem carrega a conta subindo é o número
    grande, e a lista inteira reaparece de uma vez na tela 6 — depois de
    quatro fotos, o resumo bate mais forte do que batia repetido quatro
    vezes.
    """
    img, d = _moldura(escura=False, numero=numero + 1)
    ei.foto_ou_exemplo(img, d, CAIXA_LUGAR, FOTO_LUGARES[numero - 1],
                       LUGARES[numero - 1], False)

    # O fio fino entre a foto e o texto. Sem ele a imagem e a letra ficam
    # apenas próximas; com ele viram duas partes da mesma página.
    d.line((ei.MARGEM, Y_FIO_FOTO, ei.L - ei.MARGEM, Y_FIO_FOTO),
           fill=ei.FIO_PAPEL, width=2)

    # "1 lugar" / "2 lugares": o número é o assunto, a palavra só o explica.
    fn = ei.f(ei.INTER_PRETA, 104)
    fp = ei.f(ei.INTER_SEMI, 38)
    largura = ei.escrever(d, (ei.MARGEM, Y_CONTA), f"{numero}", fn, ei.TINTA,
                          -104 * 0.03)
    d.text((ei.MARGEM + largura + 16, Y_CONTA + 104 - 6),
           "lugar" if numero == 1 else "lugares",
           font=fp, fill=ei.SOBRE_PAPEL_FRACO, anchor="ls")

    ei.manchete(d, LUGARES[numero - 1], 62, ei.TINTA, Y_NOME)
    return img


def pergunta():
    """A virada. A lista inteira, com o espaço da resposta em branco.

    O traço vazio ao lado de cada lugar é o desenho da pergunta: é um
    formulário que ninguém preencheu. Dizer "nenhum" na tela seguinte só
    tem força porque aqui há quatro espaços esperando resposta.
    """
    img, d = _moldura(escura=False, numero=6)
    ei.manchete(d, "E quantos ligaram?", TAM_MANCHETE, ei.TINTA, ei.Y_CORPO)

    fonte = ei.f(ei.INTER_SEMI, TAM_LUGAR)
    for i, texto in enumerate(LUGARES):
        y = LISTA_TOPO + i * PASSO_LISTA
        ei.escrever(d, (ei.MARGEM, y), texto, fonte, ei.SOBRE_PAPEL_FRACO,
                    -TAM_LUGAR * 0.018)
        base = y + TAM_LUGAR + 30
        d.line((ei.MARGEM, base, ei.L - ei.MARGEM, base), fill=ei.FIO_PAPEL, width=2)
        # O traço da resposta começa sempre no mesmo x, e não colado no fim
        # de cada frase: quatro riscos de tamanhos diferentes viram sujeira,
        # quatro iguais viram uma coluna de respostas em branco.
        d.line((X_RISCO, base - 18, ei.L - ei.MARGEM, base - 18),
               fill=(188, 196, 204), width=5)
    return img


def silencio():
    """A tela quase vazia. O vazio é o assunto — não preencher é o desenho.

    Ela só funciona porque as cinco anteriores estão cheias. Numa sequência
    que já fosse vazia, esta seria só mais uma.
    """
    img, d = _moldura(escura=False, numero=7)
    ei.sobrenome(d, "a resposta", False, 560)
    fim = ei.manchete(d, "Nenhum.", 124, ei.TINTA, 620)
    ei.apoio(d, "Talvez um. Você lembra qual.", TAM_APOIO,
             ei.SOBRE_PAPEL_FRACO, fim + 24)
    return img


def conclusao():
    """Ato 3 — o Ei volta a falar, e diz a única coisa nova do carrossel.

    As duas frases têm pesos diferentes de propósito: a primeira tira uma
    culpa ("não é falta de vaga"), a segunda entrega o motivo. Em pesos
    iguais elas competem; assim a segunda é onde o olho para.
    """
    img, d = _moldura(escura=True, numero=8)
    fim = ei.manchete(d, "O problema não é falta de vaga.", TAM_MANCHETE,
                      ei.SOBRE_TINTA, 380, fonte_arq=ei.INTER_MEDIA)
    ei.manchete(d, "É você não ficar sabendo.", TAM_MANCHETE, ei.BRANCO,
                fim + 36, fonte_arq=ei.INTER_PRETA)
    return img


def convite():
    """O convite. Uma chamada só, e nenhuma promessa de emprego.

    A pílula é de PAPEL sobre a tinta, e não mais laranja cheia. Lozango
    laranja gritando no pé é o desenho de anúncio de liquidação; a mesma
    pílula na cor do papel tem 13 de contraste, continua sendo obviamente
    um botão, e não briga com nada. O laranja fica onde ele rende: no
    versalete pequeno lá em cima.
    """
    img, d = _moldura(escura=True, numero=9)
    ei.sobrenome(d, "o convite", True)
    fim = ei.manchete(d, "No Ei Emprego a vaga procura você.", TAM_MANCHETE,
                      ei.BRANCO, 330)
    ei.apoio(d, "Você marca o que faz. Quando abre uma vaga do seu ofício em "
                "Itabirito, o aviso chega no seu celular.",
             TAM_APOIO, ei.SOBRE_TINTA, fim + 40)

    alto = 108
    topo = ei.Y_RODAPE - 92 - alto
    d.rounded_rectangle((ei.MARGEM, topo, ei.L - ei.MARGEM, topo + alto),
                        alto // 2, fill=ei.PAPEL)
    fonte = ei.f(ei.INTER_PESADA, 40)
    frase = "Cadastro grátis em 5 minutos"
    largura = ei.largura_com_tracking(d, frase, fonte, -0.4)
    ei.escrever(d, ((ei.L - largura) / 2, topo + (alto - 52) // 2), frase, fonte,
                ei.TINTA, -0.4)
    return img


def main() -> None:
    # Frase que não cabe estoura aqui, com o nome dela, em vez de sair
    # torta ou encolhida — o defeito da primeira rodada.
    ei.conferir_cabe(ei.INTER_PESADA, 62, LUGARES, ei.LARGURA_TEXTO,
                     "o nome do lugar")
    ei.conferir_cabe(ei.INTER_SEMI, TAM_LUGAR, LUGARES, LARGURA_ITEM,
                     "a lista de resumo da tela 6")

    # O contraste, medido nas cores chapadas. Com fundo de cor única não há
    # ponto pior — mas a conferência fica, porque a cor pode mudar e o
    # esquecimento é justamente o que deixou a tela "Quem está contratando"
    # em 1,1 de contraste por três rodadas.
    for cor, fundo, minimo, onde in [
        (ei.BRANCO, ei.TINTA, 4.5, "manchete branca sobre a tinta"),
        (ei.SOBRE_TINTA, ei.TINTA, 4.5, "texto de apoio sobre a tinta"),
        (ei.SOBRE_TINTA_FRACO, ei.TINTA, 3.0, "o discreto sobre a tinta"),
        (ei.TINTA, ei.PAPEL, 4.5, "manchete escura sobre o papel"),
        (ei.SOBRE_PAPEL_FRACO, ei.PAPEL, 4.5, "o apoio sobre o papel"),
        (ei.AMBAR_ESCURO, ei.PAPEL, 4.5, "o versalete âmbar sobre o papel"),
        (ei.AMBAR_CLARO, ei.TINTA, 4.5, "o versalete âmbar sobre a tinta"),
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
