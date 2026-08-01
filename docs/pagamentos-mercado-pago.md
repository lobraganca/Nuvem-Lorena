# Pagamentos com Mercado Pago — o que falta e como fazer

Este documento é o passo a passo para ligar o pagamento real. O código do app já
está preparado; o que falta é uma parte que **não pode** viver no navegador.

## Por que a conta sozinha não basta

Você tem uma conta do Mercado Pago. Ela serve para **receber** dinheiro. Mas o
Avena não é uma loja: é um intermediário entre o viajante e a agência. O modelo
correto chama-se **split de pagamento** (ou "marketplace") e funciona assim:

- O viajante paga a **agência**, direto.
- O Mercado Pago retém a **taxa da Avena** no mesmo instante e envia para você.
- O dinheiro **nunca passa por uma conta da Avena**.

Isso não é preciosismo técnico. Se o dinheiro passasse pela sua conta antes de
chegar na agência, a Avena estaria custodiando recursos de terceiros — atividade
de instituição de pagamento, regulada pelo Banco Central, com exigências de
capital, compliance e autorização que não fazem sentido para o seu estágio.
Além disso, você passaria a ser a vendedora do passeio para efeitos fiscais,
recolhendo imposto sobre o valor cheio em vez de sobre a sua comissão.

Para fazer split você precisa de três coisas além da conta:

1. **Uma aplicação** criada no painel de desenvolvedores do Mercado Pago.
2. **Cada agência conectando a própria conta** ao Avena, via OAuth. Sem isso não
   existe para onde mandar o dinheiro dela.
3. **Um servidor**, porque o token de acesso não pode ficar no navegador.

## Passo 1 — Sua conta

O recomendado é conta **empresarial, com CNPJ**. Mas dá para começar como
**pessoa física**, e vale entender o que muda, porque a diferença não é
técnica — é fiscal e de credibilidade.

### Recebendo como pessoa física

**Funciona.** O Mercado Pago aceita conta de pessoa física, e o split
(marketplace) reparte para uma conta PF como reparte para uma PJ. Do lado do
código não muda nada: o app manda o mesmo pedido e o servidor usa a mesma
chave. Nenhuma tela do Avena precisa ser alterada.

**O que muda de verdade:**

| | Pessoa física | CNPJ |
|---|---|---|
| Imposto sobre a sua taxa | IRPF, carnê-leão mensal, alíquota até 27,5% | Simples Nacional, a partir de 6% |
| Nota fiscal da taxa | Não emite | Emite |
| Contrato com agência | Assinado por você, pessoa | Assinado pela empresa |
| Termos de Uso | Seu nome e CPF na tela | Razão social e CNPJ |
| Limites e análise do Mercado Pago | Mais apertados | Mais folgados |

**A conta que decide.** A taxa é 5%. Numa reserva de R$ 220, você recebe
R$ 11. Como pessoa física, até R$ 3,03 disso vira imposto na faixa mais alta;
como CNPJ no Simples, cerca de R$ 0,66. Na escala de dez reservas por mês a
diferença é irrelevante e não justifica esperar; na de mil por mês, ela paga o
contador muitas vezes.

**Três coisas para confirmar antes**, e nenhuma delas eu tenho como verificar
por você:

1. **Com o Mercado Pago**, se a aplicação de marketplace/split pode ser criada
   por conta PF e quais os limites. A política deles muda, e o que vale é o que
   eles disserem hoje.
2. **Com um contador**, o carnê-leão e se um MEI resolveria. MEI sai no mesmo
   dia, custa cerca de R$ 70 por mês e dá CNPJ — **mas a lista de ocupações do
   MEI é fechada, e intermediação de negócios pode não estar nela**. Não afirme
   que dá antes de perguntar.
3. **Se você vai emitir nota fiscal da taxa.** Sem CNPJ, não emite. Algumas
   agências pedem, e isso pode custar parceiros.

### A recomendação

Comece como pessoa física se isso for o que destrava as primeiras reservas
reais — a validação vale mais do que a economia fiscal nesse volume. Abra o
CNPJ em paralelo, não depois: ele leva dias, e migrar a conta do Mercado Pago
mais tarde é trabalho de uma tarde, não um recomeço.

## Passo 2 — Criar a aplicação

No painel de desenvolvedores do Mercado Pago, crie uma aplicação do tipo
marketplace / split. Você vai receber:

- `MP_APP_ID` (Client ID)
- `MP_CLIENT_SECRET` (Client Secret)
- Um `redirect_uri` que você cadastra apontando para o seu servidor

**Nunca** coloque o Client Secret no código do site. Ele fica só no servidor,
como variável de ambiente.

## Passo 3 — O servidor (a parte que falta)

Precisa de quatro endpoints. Podem ser Edge Functions do Supabase, uma função
serverless da Vercel, ou qualquer backend simples.

### `GET /api/mercadopago/connect?businessId=...`
Redireciona a agência para a tela de autorização do Mercado Pago. É o que o
botão "Conectar minha conta Mercado Pago" já chama no app.

### `GET /api/mercadopago/callback`
Recebe o `code` da autorização, troca por um `access_token` **da agência**,
e guarda esse token no banco associado ao `businessId`. Guarde também o
`refresh_token`: o de acesso expira.

### `POST /api/checkout`
Recebe `{ bookingId }`. O servidor:

1. Busca a reserva **no banco** (nunca confia em valores vindos do navegador).
2. Recalcula o preço e a comissão a partir do passeio e do plano da agência.
3. Monta a preferência — o formato está em
   `src/lib/payments/mercadopago.ts`, função `buildPreference` — com
   `marketplace_fee` igual à comissão.
4. Envia ao Mercado Pago **com o token da agência**.
5. Devolve `{ initPoint, preferenceId }` para o app redirecionar.

### `POST /api/mercadopago/webhook`
É aqui que a reserva vira confirmada — **não** na volta do navegador, que pode
ser forjada ou simplesmente não acontecer se a pessoa fechar a aba.

1. Confirma a notificação consultando a API do Mercado Pago.
2. Encontra a reserva pelo `external_reference`.
3. Mapeia o status com `bookingStatusFromPayment` (já implementado).
4. Atualiza a reserva e dispara o e-mail para a agência.

## Passo 4 — Ligar no app

Quando o servidor existir, defina no ambiente de produção:

```
VITE_PAYMENTS_ENABLED=true
VITE_CHECKOUT_ENDPOINT=/api/checkout
```

O app passa a redirecionar para o Mercado Pago de verdade e o aviso de
"ambiente de demonstração" some sozinho. Nenhuma outra mudança de código é
necessária: a integração tem um ponto de entrada só, a função `createCheckout`.

## Reembolsos

O cancelamento já calcula o valor a devolver segundo a política do passeio
(`computeRefund`). Falta o servidor chamar a API de reembolso do Mercado Pago
com o token da agência. Confira na documentação atual como a taxa do
marketplace se comporta num reembolso parcial — isso muda o quanto você
efetivamente fica, e é melhor decidir e escrever nos Termos antes do primeiro
caso real.

## Ordem sugerida

1. CNPJ e conta empresarial.
2. Backend com banco (Supabase resolve banco + autenticação + funções).
3. Login de verdade — hoje os dados vivem só no navegador.
4. Split de pagamento com uma agência piloto, em ambiente de teste do Mercado
   Pago (sandbox), com cartões de teste.
5. Webhook e e-mail para a agência.
6. Só então, primeira venda real.

## Sobre as credenciais

Eu não peço, não recebo e não guardo suas chaves. Client Secret e tokens de
agência ficam exclusivamente no servidor, em variáveis de ambiente. Se alguma
chave sua aparecer em código, em conversa ou em captura de tela, gere uma nova
no painel imediatamente — a antiga deve ser considerada comprometida.
