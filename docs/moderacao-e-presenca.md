# Moderação de conteúdo e status online

## Moderação

### Onde vale

| Tela | Moderado |
|---|---|
| Avaliação de agência | sim |
| Mensagem no chat | sim |
| Perfil (nome, usuário, bio) | sim |
| Cadastro de empresa (nome, descrição) | sim |
| Passeio (título, descrição) | sim |
| **Chamado de suporte** | **não, de propósito** |
| **Diário da experiência** | **não, de propósito** |

### As duas exceções, e por quê

**O chamado de suporte não é filtrado.** Quem foi ofendido precisa poder
escrever o que ouviu. Bloquear a denúncia porque ela cita o xingamento seria
proteger quem ofendeu. Foi testado: uma denúncia citando ofensa e ameaça passa
normalmente.

**O diário da sua experiência não é filtrado.** É o seu caderno de viagem, não
é publicado. Filtrar o que a pessoa escreve para si mesma seria vigilância, não
moderação.

### O que bloqueia

Quatro categorias, com mensagens diferentes:

- **Palavrão** — xingamento comum.
- **Sexual** — conteúdo e oferta de cunho sexual.
- **Ódio** — termo discriminatório. A mensagem avisa que pode levar à suspensão.
- **Ameaça** — a mensagem avisa que pode ser levada às autoridades.

Reconhece disfarce: `p0rra`, `c@ralho`, `caralhoooo`, maiúsculas e acentos são
normalizados antes da comparação.

### O que NÃO bloqueia, e isso é essencial

**Crítica dura passa.** "Passeio péssimo, atrasou duas horas, o guia foi
grosseiro, não recomendo" é publicado sem qualquer aviso. Uma plataforma de
avaliações que filtra reclamação perde o motivo de existir — e o aviso de
bloqueio diz isso em voz alta, para ninguém suavizar a verdade com medo.

**Palavras comuns do turismo passam.** Um filtro ingênuo destruiria este app em
particular:

| Palavra | Por que não pode ser bloqueada |
|---|---|
| piranha | peixe que se pesca |
| macaco | animal que se fotografa |
| rola | verbo comum |
| pau | pau-brasil, pau de arara |
| reputação, disputa | contêm "puta" |
| cuidado, cultura, curso, documento | contêm "cu" |
| acompanhante, programa | palavras normais de viagem |

Por isso a comparação é por palavra inteira, e termos ambíguos ficaram
deliberadamente fora da lista.

### O que este filtro não resolve

- **Contexto.** "Volta pra sua terra" está na lista; variações não previstas,
  não. Sarcasmo e insinuação escapam.
- **Slur dependente de contexto.** Algumas palavras são ofensa numa frase e
  animal na outra. Não dá para resolver com lista sem quebrar o app.
- **Foto e imagem.** Só texto é analisado.
- **Outros idiomas.** A lista é de português.

É por isso que o filtro fica **ao lado** do botão de denúncia e do poder da
administradora de remover avaliação — não no lugar deles. Nenhuma plataforma
séria modera só com lista de palavras.

### Onde mexer

`src/lib/moderation.ts`. As listas estão no topo, separadas por categoria.
Ao acrescentar uma palavra, pergunte: **ela pode aparecer numa frase honesta
sobre uma viagem?** Se puder, deixe fora.

---

## Quem pode avaliar

**Só quem fez o passeio pela plataforma.** Para o botão de avaliar aparecer, a
reserva precisa cumprir, ao mesmo tempo:

1. ter sido **paga** — reserva aguardando pagamento não avalia;
2. ter uma **data que já passou** — avaliação escrita antes do passeio não diz
   nada sobre como o dia foi;
3. **não estar cancelada nem expirada**;
4. **não ter sido avaliada** ainda — uma reserva, uma avaliação.

A regra mora em `src/lib/reviewEligibility.ts`, não dentro de uma tela, e é
aplicada **duas vezes**: a tela não desenha o formulário quando não cabe, e a
função que grava recusa qualquer avaliação sem uma reserva elegível por trás.
Isso importa porque uma condição escrita só no JSX se perde na primeira
refatoração.

Cada motivo de bloqueio tem sua própria mensagem, para o viajante entender por
que não pode avaliar em vez de achar que o botão sumiu.

### Isso é argumento de venda, não só regra

A página da empresa diz em voz alta: *"Só avalia quem reservou e pagou o passeio
por aqui, depois que ele aconteceu"*, e cada avaliação leva o selo **Avaliação
verificada**. É o que separa essas notas das de qualquer site onde qualquer um
escreve — aqui, toda nota tem uma reserva paga e uma data por trás.

### Limite honesto

Enquanto os dados vivem no navegador, quem controla o aparelho pode editar o
que está guardado. A trava impede o caminho normal e qualquer erro de
programação futuro; ela não substitui o servidor. Com backend, a mesma função
roda no servidor antes de gravar — e aí passa a valer contra qualquer um.

---

## Status online do profissional

O viajante vê um ponto verde e "Online agora" quando a agência está usando o
app, na busca e na página da empresa.

### Como é medido

Derivado da última vez que a agência **realmente usou** o painel, nunca de um
botão de "ficar online". Um indicador que se pode deixar ligado mente, e mentir
aqui é pior que não informar: a pessoa escreve esperando resposta em minutos e
recebe silêncio.

| Tempo desde a última atividade | Mostra |
|---|---|
| até 5 min | Online agora (verde) |
| até 1 hora | Esteve online há X min |
| até 24 horas | Esteve online há X h |
| mais que isso | nada |

Acima de um dia não aparece nada de propósito: "visto há 3 semanas" soa como
acusação e enche a busca de ruído.

### Limite honesto

Presença de verdade exige servidor — um navegador não tem como saber que a aba
de outra pessoa está aberta. O que existe hoje reflete a última visita
registrada **neste aparelho**. Quando houver backend, a mesma função passa a ler
o `lastSeenAt` do banco e o comportamento visível não muda.

### Próximo passo natural

Com backend, o dado mais útil para o viajante não é o ponto verde, e sim
**"responde em média em X horas"**, calculado dos tempos reais de resposta. É o
que as grandes plataformas mostram, porque prevê melhor a experiência do que
saber quem está com o app aberto agora.
