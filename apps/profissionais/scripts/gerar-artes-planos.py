"""
Artes dos planos do Ei Emprego — uma peça por plano, mais uma capa.

A régua (cartão, alturas, tamanhos) mora em `artes_ei.py` e é a mesma das
artes dos benefícios. Aqui fica só o texto.

Os preços e os limites saem de `src/types/domain.ts` (PLANOS_EMPRESA):
mudou preço lá, roda este arquivo de novo em vez de redesenhar à mão.
"""

import artes_ei as ei

# São TRÊS benefícios em todas de propósito. Na tela do app os cartões
# mostram só o que diferencia, porque lá as colunas ficam lado a lado e o
# que se repete atrapalha a comparação. Aqui cada peça é vista sozinha, e
# uma peça com dois itens ao lado de outra com três é exatamente o
# desalinhamento que foi reprovado.
PLANOS = [
    {
        "nome": "Ei Conecta",
        "centavos": 2990,
        "selo": None,
        "linhas": [
            "1 vaga aberta por vez",
            "Recebe quem se interessou, com telefone",
            "30 dias no ar por vaga",
        ],
    },
    {
        "nome": "Ei Onda",
        "centavos": 5990,
        "selo": None,
        "linhas": [
            "3 vagas abertas ao mesmo tempo",
            "Sua vaga na lista de vagas em aberto",
            "Recebe quem se interessou, com telefone",
        ],
    },
    {
        "nome": "Ei Impulso",
        "centavos": 8990,
        "selo": "MAIS ESCOLHIDO",
        "linhas": [
            "5 vagas abertas ao mesmo tempo",
            "Sua vaga na lista de vagas em aberto",
            "Recebe quem se interessou, com telefone",
        ],
    },
    {
        "nome": "Ei Máximo",
        "centavos": 12990,
        "selo": None,
        "linhas": [
            "10 vagas abertas ao mesmo tempo",
            "Sua vaga na lista de vagas em aberto",
            "Recebe quem se interessou, com telefone",
        ],
    },
    {
        "nome": "Ei Infinit",
        "centavos": None,
        "selo": None,
        "linhas": [
            "Vagas abertas sem limite",
            "Sua vaga na lista de vagas em aberto",
            "Condição combinada com você",
        ],
    },
]

CAPA = {
    "titulo": "Contrate em",
    "destaque": "Itabirito",
    "linhas": [
        "Publique sua vaga e receba",
        "quem é da cidade, com telefone",
        "para chamar na hora.",
    ],
    "chamada": "Arraste e escolha seu plano",
}

CHAMADA = "empregoitabirito.com.br"
CHAMADA_INFINIT = "Fale com a gente no WhatsApp"

# Os tamanhos são os da casa (`artes_ei`). Aqui só se confere que o texto
# cabe neles — se não couber, o gerador para e diz qual frase encurtar.
ei.conferir_cabe(ei.FONTE, ei.TAM_LINHA,
                 [t for p in PLANOS for t in p["linhas"]] + CAPA["linhas"],
                 ei.LARGURA_LINHA, "uma linha")
ei.conferir_cabe(ei.FONTE_N, ei.TAM_TITULO, [p["nome"] for p in PLANOS],
                 ei.LARGURA_DENTRO, "um título")
# O título da capa é desenhado 8px menor (é frase, não nome do plano),
# então é nesse tamanho que ele tem de ser conferido.
ei.conferir_cabe(ei.FONTE_N, ei.TAM_TITULO - 8, [CAPA["titulo"]],
                 ei.LARGURA_DENTRO, "o título da capa")
ei.conferir_cabe(ei.FONTE_N, ei.TAM_CHAMADA,
                 [CHAMADA, CHAMADA_INFINIT, CAPA["chamada"]],
                 ei.LARGURA_DENTRO - 80, "uma chamada")


def capa():
    """A primeira do carrossel usa a MESMA régua das outras.

    Não é enfeite: quem passa o dedo de uma peça para a próxima vê o
    cartão, o título e o botão continuarem no lugar.
    """
    img, d = ei.nova_peca()
    ei.titulo(d, CAPA["titulo"], ei.TAM_TITULO - 8)
    ei.regua(d)
    ei.destaque(d, CAPA["destaque"], 96)
    ei.fio(d)
    ei.linhas(d, CAPA["linhas"], ei.TAM_LINHA, com_visto=False)
    ei.chamada(d, CAPA["chamada"], ei.TAM_CHAMADA)
    return img


def plano(p):
    img, d = ei.nova_peca()
    if p["selo"]:
        ei.selo(d, p["selo"])
    ei.titulo(d, p["nome"], ei.TAM_TITULO)
    ei.regua(d)
    if p["centavos"] is None:
        ei.destaque(d, "Sob consulta", 76)
    else:
        ei.preco(d, p["centavos"])
    ei.fio(d)
    ei.linhas(d, p["linhas"], ei.TAM_LINHA)
    ei.chamada(d, CHAMADA_INFINIT if p["centavos"] is None else CHAMADA, ei.TAM_CHAMADA)
    return img


def main() -> None:
    print(f"linhas {ei.TAM_LINHA}px · título {ei.TAM_TITULO}px · chamada {ei.TAM_CHAMADA}px")
    print("  ", ei.salvar(capa(), "plano-0-capa.png"))
    for i, p in enumerate(PLANOS, start=1):
        apelido = p["nome"].split()[-1].lower().replace("á", "a")
        print("  ", ei.salvar(plano(p), f"plano-{i}-{apelido}.png"))


if __name__ == "__main__":
    main()
