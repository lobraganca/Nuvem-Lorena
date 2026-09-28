# avena.app — a página do diagnóstico

A página para onde o link da bio do Instagram (@avena.app) vai apontar. Ela
apresenta o serviço em duas formas — **eu monto para você** ou **eu te
ensino a montar** (mentoria) — com área de membros, agendamento de
clientes, gestão da empresa, dashboard de resultados, app, loja e automação, e leva a pessoa a um diagnóstico
de 9 perguntas **antes** de qualquer proposta.

É **outro produto**: não tem nada a ver com o Ei Itabirito
(`apps/profissionais/`) nem com o Avena de turismo (a raiz). Não usa banco,
não tem build — é um arquivo só, `index.html`.

## As 9 perguntas

1. Como prefere (que eu monte / aprender a montar / não sei), para quem é e a área
2. O que atrapalha hoje (várias) + texto livre
3. Como resolve hoje (papel, planilha, WhatsApp, sistema pronto…)
4. Que ferramenta imagina (área de membros, agendamento, gestão da empresa, dashboard, app, loja, automação, "não sei")
5. O que precisa ter (várias funções)
6. Quem usa e quantas pessoas
7. Onde vai ficar: domínio próprio, domínio que já tem ou endereço grátis
   (seuapp.vercel.app); e se publica na Play Store, na App Store ou só pelo link
8. Prazo, investimento e forma de pagamento
9. Contato (nome e WhatsApp obrigatórios)

No fim a pessoa vê o diagnóstico — tipo de ferramenta sugerida, se é
mentoria ou feito para ela, tamanho do projeto (enxuto / intermediário /
robusto), o que entra na primeira versão e onde vai ficar —
e envia as respostas pelo WhatsApp, pelo Instagram ou copiando o texto.

**A página não mostra preço nem prazo.** O tamanho do projeto é uma régua,
não uma promessa; o valor vai na proposta. Os únicos valores que aparecem
são de terceiros, para a pessoa não se assustar depois: domínio .com.br
(por volta de R$ 40/ano no Registro.br), Google Play (US$ 25 uma vez) e
Apple (US$ 99/ano). Se algum deles mudar, corrigir na pergunta 7 e no FAQ.

## O que falta preencher (no começo do `<script>`, bloco `CONFIG`)

| Campo | O que pôr | Sem ele |
|---|---|---|
| `whatsapp` | número que recebe os diagnósticos, só dígitos: `5531999998888` | o botão do WhatsApp some; ficam Instagram e "copiar" |
| `instagram` | usuário sem o @ (já está `avena.app`) | — |
| `webhook` | opcional: endereço que guarda cada diagnóstico (planilha do Google via Apps Script, Formspree, Make) | o diagnóstico só chega se a pessoa tocar no botão de enviar |

**Por que o webhook importa:** sem ele, quem responde tudo e fecha a página
antes de tocar em "Enviar" se perde. Com ele, toda resposta completa fica
guardada.

## A logo e as cores

A fonte única é `logo-avena.jpg` (a arte que a dona mandou em 28/09). Tudo
o que é marca sai dela:

```bash
cd /home/user/Nuvem-Lorena/apps/avena-app
python3 gerar-marca.py      # precisa do Pillow: pip install pillow
```

| Arquivo | O que é |
|---|---|
| `marca-avena.png` | o nome recortado, fundo transparente — o topo da página |
| `icone-avena.png` | só o "a", 512×512 — aba do navegador e atalho no celular |
| `og-avena.png` | 1200×630 — a prévia quando o link é mandado no WhatsApp |

**Nenhuma dessas imagens se edita à mão.** Trocar a logo é trocar o `.jpg`
e rodar o comando. (No Ei Itabirito, a marca velha sobreviveu três vezes a
uma troca de logo por causa de arquivo fora do gerador.)

As cores da página também saíram da arte — verde `#1b251a`, creme
`#d1ccb9` — e ficam no bloco `:root` do começo do `<style>`. O dourado é o
da fita métrica, a ideia da página: "tirar as medidas" antes da proposta.

**Quando o domínio existir**, trocar `og-avena.png` no `<meta
property="og:image">` pelo endereço completo (`https://.../og-avena.png`):
WhatsApp e Instagram não leem endereço relativo, e sem isso o link vai sem
imagem.

## Faixas de investimento

As da pergunta 8 (até R$ 2 mil, 2–5 mil, 5–15 mil, acima de 15 mil) são um
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
