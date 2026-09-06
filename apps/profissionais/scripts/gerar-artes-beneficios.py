"""
Artes dos benefícios do app — uma capa e cinco motivos para se cadastrar.

Mesma régua das artes dos planos: as duas séries importam `artes_ei.py`, e
não uma cópia dela. Copiar o gerador e trocar o texto criaria duas réguas
que se separam no primeiro ajuste — e o desalinhamento voltaria, agora
entre uma série e a outra.

── Para quem é esta série ──────────────────────────────────────────────

Para quem PROCURA emprego. A série dos planos já fala com a empresa; esta
fala com a pessoa, que é quem precisa aparecer na lista antes de qualquer
empresa achar graça em assinar.

── Cada frase daqui é conferível no código ─────────────────────────────

Peça de divulgação que promete o que o app não faz volta como reclamação,
e quem procura emprego é o público que menos pode levar promessa furada.
Então, item por item:

  "Cadastrar não custa nada"  o cadastro do profissional é grátis. O que
                              se paga (opcional) é o destaque de 7 dias —
                              ver `src/pages/ei/DestaquePage.tsx`. Por isso
                              a frase é sobre CADASTRAR, e não um "tudo de
                              graça" que seria mentira.
  "Vagas da cidade"           filtro de cidade nos dois lados.
  "Confirma o número por SMS" Twilio Verify, no Auth do Supabase.
  "Avisamos quando abre vaga" a Edge Function `enviar-avisos-de-vaga`.
  "Quem contrata te encontra" o banco de talentos, com telefone.

E em lugar nenhum se promete emprego — a mesma linha que a `DestaquePage`
já segue, e pelo mesmo motivo.
"""

import artes_ei as ei

CAPA = {
    "titulo": "Procura emprego",
    "destaque": "em Itabirito",
    "linhas": [
        "O Ei liga quem procura emprego",
        "a quem está contratando,",
        "aqui na nossa cidade.",
    ],
    "chamada": "Arraste e veja por quê",
}

BENEFICIOS = [
    {
        "titulo": "De graça",
        "arquivo": "gratis",
        "destaque": "R$ 0,00",
        "selo": None,
        "linhas": [
            "Cadastrar não custa nada",
            "Sem mensalidade e sem taxa",
            "Só precisa de um celular",
        ],
    },
    {
        "titulo": "Só daqui",
        "arquivo": "daqui",
        "destaque": "Aqui perto",
        "selo": None,
        "linhas": [
            "Vagas da cidade e da região",
            "Empresa daqui, gente daqui",
            "Nada de vaga em outro estado",
        ],
    },
    {
        "titulo": "Rapidinho",
        "arquivo": "rapido",
        "destaque": "5 minutos",
        "selo": None,
        "linhas": [
            "Sem currículo e sem anexo",
            "Confirma o número por SMS",
            "Pronto, já aparece na busca",
        ],
    },
    {
        # "Sem correr atrás" media 778px no título de 82px, dois a mais que
        # a largura do cartão — e a régua recusou. Encurtar a frase é o
        # conserto certo; encolher a letra é o defeito que ela apontou.
        "titulo": "Não corra atrás",
        "arquivo": "te-acham",
        "destaque": "Te acham",
        # O selo vai aqui porque este é o motivo que mais convence quem
        # está cansado de deixar currículo em balcão.
        "selo": "O MAIS PEDIDO",
        "linhas": [
            "Quem contrata te encontra na busca",
            "Diga em que você é bom",
            "Com foto, seu perfil aparece mais",
        ],
    },
    {
        "titulo": "Aviso de vaga",
        "arquivo": "aviso",
        "destaque": "No celular",
        "selo": None,
        "linhas": [
            "Avisamos quando abre vaga da sua área",
            "Você se candidata pelo app",
            "A empresa recebe seu contato",
        ],
    },
]

CHAMADA = "empregoitabirito.com.br"

# Os tamanhos são os da casa. Frase que não couber para o gerador e diz
# qual é — a letra não encolhe para acomodar texto comprido.
ei.conferir_cabe(ei.FONTE, ei.TAM_LINHA,
                 [t for b in BENEFICIOS for t in b["linhas"]] + CAPA["linhas"],
                 ei.LARGURA_LINHA, "uma linha")
ei.conferir_cabe(ei.FONTE_N, ei.TAM_TITULO, [b["titulo"] for b in BENEFICIOS],
                 ei.LARGURA_DENTRO, "um título")
# O título da capa é desenhado 8px menor (é frase, não nome), então é nesse
# tamanho que ele tem de ser conferido.
ei.conferir_cabe(ei.FONTE_N, ei.TAM_TITULO - 8, [CAPA["titulo"]],
                 ei.LARGURA_DENTRO, "o título da capa")
ei.conferir_cabe(ei.FONTE_N, ei.TAM_CHAMADA, [CHAMADA, CAPA["chamada"]],
                 ei.LARGURA_DENTRO - 80, "uma chamada")
ei.conferir_cabe(ei.FONTE_N, 96, [b["destaque"] for b in BENEFICIOS] + [CAPA["destaque"]],
                 ei.LARGURA_DENTRO, "um destaque")


def capa():
    img, d = ei.nova_peca()
    ei.titulo(d, CAPA["titulo"], ei.TAM_TITULO - 8)
    ei.regua(d)
    ei.destaque(d, CAPA["destaque"], 96)
    ei.fio(d)
    ei.linhas(d, CAPA["linhas"], ei.TAM_LINHA, com_visto=False)
    ei.chamada(d, CAPA["chamada"], ei.TAM_CHAMADA)
    return img


def beneficio(b):
    img, d = ei.nova_peca()
    if b["selo"]:
        ei.selo(d, b["selo"])
    ei.titulo(d, b["titulo"], ei.TAM_TITULO)
    ei.regua(d)
    ei.destaque(d, b["destaque"], 96)
    ei.fio(d)
    ei.linhas(d, b["linhas"], ei.TAM_LINHA)
    ei.chamada(d, CHAMADA, ei.TAM_CHAMADA)
    return img


def main() -> None:
    print(f"linhas {ei.TAM_LINHA}px · título {ei.TAM_TITULO}px · chamada {ei.TAM_CHAMADA}px")
    print("  ", ei.salvar(capa(), "beneficio-0-capa.png"))
    for i, b in enumerate(BENEFICIOS, start=1):
        print("  ", ei.salvar(beneficio(b), f'beneficio-{i}-{b["arquivo"]}.png'))


if __name__ == "__main__":
    main()
