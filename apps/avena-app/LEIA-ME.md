# avena.app — a página do diagnóstico

A página para onde o link da bio do Instagram (@avena.app) vai apontar. Ela
apresenta o serviço ("eu monto a sua ferramenta": área de membros,
agendamento de clientes, app, sistema, loja, automação) e leva a pessoa a
um diagnóstico de 8 perguntas **antes** de qualquer proposta.

É **outro produto**: não tem nada a ver com o Ei Itabirito
(`apps/profissionais/`) nem com o Avena de turismo (a raiz). Não usa banco,
não tem build — é um arquivo só, `index.html`.

## As 8 perguntas

1. Para quem é (empresa, autônomo, ideia própria, grupo) e a área
2. O que atrapalha hoje (várias) + texto livre
3. Como resolve hoje (papel, planilha, WhatsApp, sistema pronto…)
4. Que ferramenta imagina (área de membros, agendamento, app, sistema, loja, automação, "não sei")
5. O que precisa ter (várias funções)
6. Quem usa, quantas pessoas, onde (navegador, loja de apps, computador)
7. Prazo, investimento e forma de pagamento
8. Contato (nome e WhatsApp obrigatórios)

No fim a pessoa vê o diagnóstico — tipo de ferramenta sugerida, tamanho do
projeto (enxuto / intermediário / robusto) e o que entra na primeira versão —
e envia as respostas pelo WhatsApp, pelo Instagram ou copiando o texto.

**A página não mostra preço nem prazo.** O tamanho do projeto é uma régua,
não uma promessa; o valor vai na proposta.

## O que falta preencher (no começo do `<script>`, bloco `CONFIG`)

| Campo | O que pôr | Sem ele |
|---|---|---|
| `whatsapp` | número que recebe os diagnósticos, só dígitos: `5531999998888` | o botão do WhatsApp some; ficam Instagram e "copiar" |
| `instagram` | usuário sem o @ (já está `avena.app`) | — |
| `webhook` | opcional: endereço que guarda cada diagnóstico (planilha do Google via Apps Script, Formspree, Make) | o diagnóstico só chega se a pessoa tocar no botão de enviar |

**Por que o webhook importa:** sem ele, quem responde tudo e fecha a página
antes de tocar em "Enviar" se perde. Com ele, toda resposta completa fica
guardada.

## A logo

Salvar a arte como `logo-avena.png` nesta pasta. A página procura esse
arquivo; enquanto ele não existir, aparece o nome escrito "avena.app".
A mesma imagem vira o ícone da aba do navegador.

As cores ficam todas no bloco `:root` do começo do `<style>` — quando a
logo chegar, trocar a identidade é mexer só ali. O amarelo é o da fita
métrica: a ideia da página inteira é "tirar as medidas antes de fazer a
proposta".

## Faixas de investimento

As da pergunta 7 (até R$ 2 mil, 2–5 mil, 5–15 mil, acima de 15 mil) são um
palpite inicial. Ajustar à tabela real de preços.

## Colocar no ar

Na Vercel, **projeto novo** (não mexer no do Ei Itabirito):

1. Add New > Project > este repositório
2. Root Directory: `apps/avena-app`
3. Framework Preset: Other — sem comando de build
4. Depois, em Settings > Domains, ligar o domínio

O workflow do Ei (`publicar-busca-itabirito.yml`) só escuta
`apps/profissionais/**`, então mexer aqui não republica o Ei.

## Rascunho

As respostas ficam salvas no navegador da pessoa enquanto ela responde:
quem sai no meio e volta continua de onde parou.
