# Publicações automáticas no Instagram (@procuro.app)

Seis artes prontas (`imagens/`) chamando profissionais para se cadastrarem
no procurô, com a legenda de cada uma em `legendas.json`. Uma rotina
agendada publica uma delas às segundas, quartas e sextas, sem precisar de
ninguém apertar nada.

## Como a publicação acontece

Um Routine (gatilho agendado) do Claude Code dispara às 11h (horário de
Brasília) nas segundas, quartas e sextas. Ele:

1. Confere, pelo Windsor.ai, que a conta de Instagram ligada é a do
   procurô — nunca a do Avena. Se não bater, ele para e avisa, em vez de
   publicar no lugar errado.
2. Escolhe a próxima arte da lista (gira entre as seis, sem repetir a
   mesma duas vezes seguidas).
3. Publica a imagem com a legenda correspondente.

As imagens são lidas por URL pública (é assim que a API do Instagram
exige), apontando para este repositório no GitHub — por isso elas
precisam continuar aqui, neste caminho, para o gatilho continuar
funcionando. Se as imagens forem movidas ou apagadas, o próximo disparo
falha ao buscar a URL.

## Para trocar as artes ou legendas

Gerar novas imagens é rodar `template.html` com um título e legenda
diferentes por trás de um screenshot (1080×1350, JPEG) — o jeito mais
simples é pedir para o Claude gerar um novo lote no mesmo estilo. Depois
de trocar os arquivos aqui, quem mantém a rotina (Claude) precisa
atualizar o texto do gatilho agendado com as novas URLs e legendas, já
que elas ficam embutidas no comando do disparo, não lidas deste arquivo
em tempo real.

## Para pausar ou mudar a frequência

Peça para o Claude pausar, apagar ou trocar os dias/horário do gatilho
"Publicar no Instagram — procurô" (é um Routine do Claude Code, visto em
`list_triggers`).
