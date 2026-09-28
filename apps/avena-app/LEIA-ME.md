# avena.app — a página do diagnóstico

A página para onde o link da bio do Instagram (@avena.app) vai apontar. Ela
apresenta o serviço em duas formas — **eu monto para você** ou **eu te
ensino a montar** (mentoria) — com área de membros, agendamento de
clientes, gestão da empresa, dashboard de resultados, app, loja e automação, e leva a pessoa a um diagnóstico
de 10 perguntas **antes** de qualquer proposta.

É **outro produto**: não tem nada a ver com o Ei Itabirito
(`apps/profissionais/`) nem com o Avena de turismo (a raiz). Não usa banco,
não tem build — é um arquivo só, `index.html`.

## As 10 perguntas

1. **Nome e WhatsApp**, primeiro de tudo (pedido da dona, 28/09): quem
   desiste no meio já deixou o contato. Daí em diante a página chama a
   pessoa pelo primeiro nome ("Prazer, Maria.")
2. Como prefere (que eu monte / aprender a montar / não sei), para quem é e a área
3. O que atrapalha hoje (várias) + texto livre
4. Como resolve hoje (papel, planilha, WhatsApp, sistema pronto…)
5. Que ferramenta imagina (área de membros, agendamento, planilha em app, gestão da empresa, dashboard, app, loja, automação, "não sei")
6. O que precisa ter (várias funções) e se vai guardar arquivos (vídeo, PDF, imagem, áudio, planilha)
7. Quem usa e quantas pessoas
8. Onde vai ficar: domínio próprio, domínio que já tem ou endereço grátis
   (seuapp.vercel.app); e se publica na Play Store, na App Store ou só pelo link
9. Prazo, investimento e forma de pagamento
10. Empresa, cidade e e-mail (opcionais), como conheceu, se quer a sessão
    ao vivo às 18h (e os melhores dias) e observações

No fim a pessoa vê o diagnóstico — tipo de ferramenta sugerida, se é
mentoria ou feito para ela, tamanho do projeto (enxuto / intermediário /
robusto), o que entra na primeira versão e onde vai ficar —
e envia as respostas pelo WhatsApp, pelo Instagram ou copiando o texto.

**A página não mostra preço nem prazo.** O tamanho do projeto é uma régua,
não uma promessa; o valor vai na proposta. Os únicos valores que aparecem
são de terceiros, para a pessoa não se assustar depois: domínio .com.br
(por volta de R$ 40/ano no Registro.br), Google Play (US$ 25 uma vez) e
Apple (US$ 99/ano). Se algum deles mudar, corrigir na pergunta 8 e no FAQ.

## O que falta preencher (no começo do `<script>`, bloco `CONFIG`)

| Campo | O que pôr | Sem ele |
|---|---|---|
| `whatsapp` | número que recebe os diagnósticos, só dígitos: `5531999998888` | o botão do WhatsApp some; ficam Instagram e "copiar" |
| `instagram` | usuário sem o @ (já está `avena.app`) | — |
| `webhook` | opcional: endereço que guarda cada diagnóstico (planilha do Google via Apps Script, Formspree, Make) | o diagnóstico só chega se a pessoa tocar no botão de enviar |
| `sessao.horario` | o horário da sessão de diagnóstico ao vivo (está `18h`) | — |
| `sessao.com` | nome de quem conduz a sessão | a frase fica "uma conversa individual, só com você" |
| `sobre.nome`, `sobre.texto`, `sobre.foto` | a seção "Quem monta": nome, apresentação e a foto (arquivo nesta pasta) | a seção não aparece — de propósito, para não ir ao ar com texto de mentira |

**Por que o webhook importa:** sem ele, quem responde tudo e fecha a página
antes de tocar em "Enviar" se perde. Com ele, cada pessoa chega **duas
vezes**: ao passar do primeiro passo (só nome e WhatsApp, `etapa:
"começou"`) e ao terminar (tudo, `etapa: "completo"`). Quem tem "começou"
e não tem "completo" desistiu no meio — e o telefone está ali.

## A planilha que recebe os diagnósticos (28/09)

[avena · Diagnósticos](https://docs.google.com/spreadsheets/d/1KTN7In3zPEDcR7b6jqZnXN3rR5ZdRCS1klZbc6yAwNU/edit),
no Google Drive da dona (`lobraganca@gmail.com`). Uma linha por pessoa, 31
colunas, na ordem de `COLUNAS` em `planilha-apps-script.gs`.

O que escreve nela é o `planilha-apps-script.gs`, colado pela dona em
Extensões > Apps Script e implantado como App da Web ("Executar como: Eu",
"Qualquer pessoa"). O endereço `/exec` que sai dali vai em `CONFIG.webhook`.

- A coluna **Situação** diz "Só deixou o contato" (passou do primeiro
  passo e parou) ou "Completo". O "Completo" **substitui** a linha do
  mesmo WhatsApp, em vez de criar outra.
- O telefone é gravado como texto, para não virar número e perder o zero.
- Texto que começa com `=`, `+`, `-` ou `@` ganha um apóstrofo na frente:
  sem isso, quem preenche a página poderia escrever uma fórmula dentro da
  planilha da dona.
- **Mudou o script? Tem de implantar de novo** (Implantar > Gerenciar
  implantações > editar > Nova versão). Só salvar não muda o que está no
  ar, e o endereço `/exec` continua o mesmo.
- **Coluna nova na página** = campo novo em `COLUNAS` **e** título novo
  na planilha, na mesma posição. O script escreve por posição.

## Como a página está organizada (28/09)

A ordem se inspirou em páginas de venda longas (a dona mandou uma de
referência): primeiro a dor, depois a solução, a prova, para quem é, e
chamadas para o diagnóstico espalhadas pelo caminho.

1. Abertura (faixa verde) — "Eu monto a sua ferramenta, sob medida", e o
   atalho para a sessão ao vivo das 18h
2. **O problema** — uma semana de exemplo; o amarelo é o que se repete e
   podia rodar sozinho (11 horas, somadas dos próprios blocos)
3. **O que passa a acontecer** — cinco frases curtas
4. **Duas formas** — eu monto para você / eu te ensino a montar
5. **O que dá para criar** — a planilha que vira app (antes e depois),
   três telas de exemplo e os nove tipos de ferramenta
6. **Para quem é / não é**
7. Como funciona → a sessão das 18h → o diagnóstico
8. Quem monta (escondida até ser preenchida) e perguntas
9. Fechamento, na faixa verde

**Tudo o que é exemplo diz "exemplo" na tela** (a ficha, a semana, as
três telas). Depoimento e número de clientes só entram quando existirem de
verdade: prova inventada é o que derruba a confiança de quem descobre.

No celular, uma barra com o botão do diagnóstico fica presa embaixo e some
quando já há outro botão dele na tela.

A página não recebe arquivos (não tem servidor). Quem quiser mostrar a
planilha, um PDF ou um vídeo é orientado, no fim, a mandar na conversa do
WhatsApp.

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

As da pergunta 9 (até R$ 2 mil, 2–5 mil, 5–15 mil, acima de 15 mil) são um
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
