# Pendências para colocar o Avena no ar

Tudo o que ficou para depois, reunido num lugar só. A ordem importa: os itens
de cada bloco dependem do bloco anterior.

Atualizado em 29/07/2026. Domínio: avenaapp.com.br

---

## Bloco 0 — Antes de qualquer usuário real

Estes impedem o lançamento. Não são melhorias; são coisas que, do jeito que
estão, causam dano. O primeiro já foi resolvido para o estágio atual.

### 0.1 Painel administrativo — resolvido para o estágio atual

**Feito:** o painel só existe se o site for compilado com
`VITE_ADMIN_ENABLED=true`. No build público ele não entra no pacote, e
`avenaapp.com.br/admin` cai na página "não encontrada".

**Correção de uma anotação anterior:** eu havia escrito aqui que o painel
mostrava nome e documento dos participantes. Isso estava errado — conferi o
código. Ele expõe faturamento, reservas com valores, e-mails de empresas,
avaliações e mensagens de chamados, além de poder suspender empresas. Sério,
mas documentos de participantes aparecem só para a agência e para quem comprou.

**Ainda falta**, quando houver login: papel de administrador no banco,
verificação **no servidor** a cada ação, regras por linha, registro de quem fez
o quê e segundo fator na sua conta. Detalhes e as duas formas de acessar o
painel hoje: [painel-administrativo.md](painel-administrativo.md).

### 0.2 Os dados vivem só no navegador

Sem banco e sem login, cada pessoa que abre o app tem uma cópia isolada que
some se ela limpar o navegador. A tela "Meus dados" ameniza com backup em
arquivo, mas ninguém deveria confiar memórias de viagem a isso.

### 0.3 Nenhum pagamento é real

O fluxo já é honesto (a reserva nasce "aguardando pagamento" e a tela avisa que
nada é cobrado), mas não entra dinheiro. Detalhes em
[pagamentos-mercado-pago.md](pagamentos-mercado-pago.md).

---

## Bloco 1 — Infraestrutura

### 1.1 Escolher e criar o backend
Recomendação: **Supabase**. Resolve banco, autenticação, armazenamento de
arquivos e funções de servidor num serviço só, com plano gratuito suficiente
para começar.

### 1.2 Autenticação
- Login por e-mail e senha e **login pelo Google** (você pediu isso lá atrás).
- Papéis: turista, profissional, administradora.
- Proteger `/admin` e o painel profissional **no servidor** — ver
  [painel-administrativo.md](painel-administrativo.md).

### 1.3 Migrar os dados do navegador para o banco
As tabelas saem direto dos tipos em `src/types.ts`: experiences, people,
businesses, tours, bookings, reviews, boosts, waitlist, support_tickets,
banners, travelers, follows.

O app foi construído com o estado num lugar só (`AvenaContext`) e a lógica em
`src/lib/`, justamente para que essa troca não exija reescrever as telas.

### 1.4 Fotos em armazenamento de verdade
Hoje as fotos são reduzidas e guardadas como texto dentro do navegador, com um
teto de ~5 MB no total. Com backend, elas passam a ir para o armazenamento de
arquivos (Supabase Storage) e o app guarda só a URL. O redimensionamento que já
existe continua útil — economiza banda e custo.

---

## Bloco 2 — Dinheiro

### 2.1 CNPJ e conta empresarial
Pré-requisito de quase tudo: nota fiscal, contrato com agências, conta do
Mercado Pago empresarial, comprovação de receita.

### 2.2 Split de pagamento
Passo a passo completo em [pagamentos-mercado-pago.md](pagamentos-mercado-pago.md).
Resumo: criar a aplicação no painel de desenvolvedores, quatro endpoints no
servidor, cada agência conectando a própria conta, e **o webhook** — não o
retorno do navegador — confirmando a reserva.

### 2.3 Reembolsos
`computeRefund` já calcula o valor conforme a política do passeio. Falta o
servidor chamar a API de reembolso. **Confirme na documentação atual como a
taxa do marketplace se comporta num reembolso parcial** e escreva a regra nos
Termos antes do primeiro caso.

### 2.4 Cobrança das mensalidades
Pro R$ 39,90 e Avançado R$ 79,00 para agências; Avena Plus R$ 9,90 para
viajantes. Assinatura recorrente é um produto separado do split — no Mercado
Pago é outra API.

Sugestão comercial: **no começo, só comissão.** Cobrar mensalidade de quem
ainda não recebeu nenhuma reserva é pedir fé.

---

## Bloco 3 — Documentos legais

Os Termos de Uso e a Política de Privacidade estão escritos, mas com lacunas
entre colchetes que **precisam ser preenchidas antes de qualquer usuário
aceitar**. Ficam em `src/content/legal.ts`:

| Lacuna | O que é |
|---|---|
| `[RAZÃO SOCIAL]` | Nome da empresa no CNPJ |
| `[00.000.000/0001-00]` | Número do CNPJ |
| `[ENDEREÇO COMPLETO]` | Sede da empresa |
| `[E-MAIL DE CONTATO]` | Canal de atendimento |
| `[NOME DO ENCARREGADO]` | Encarregado de dados (DPO), art. 41 da LGPD |
| `[E-MAIL DO ENCARREGADO]` | Canal do DPO |

Ao alterar qualquer um deles, **suba o `LEGAL_VERSION`** no mesmo arquivo: isso
invalida os aceites anteriores e pede um novo antes da próxima transação.

Outros itens jurídicos pendentes:
- Contrato com as agências parceiras (comissão, responsabilidades, cancelamento).
- Revisão de tudo isso por advogado. O texto foi escrito com base nas práticas
  das grandes plataformas, mas não substitui parecer profissional.

---

## Bloco 4 — Comunicação

### 4.1 E-mail para a agência a cada reserva
Serviço sugerido: **Resend**. Disparado pelo webhook de pagamento aprovado, com
a lista de participantes.

### 4.2 Notificações no celular
As notificações do app hoje funcionam **dentro** do app. Para chegar com o app
fechado é preciso push de verdade (Firebase Cloud Messaging ou o serviço de
push do Supabase).

---

## Bloco 5 — Aplicativo Android e iOS

Recomendação: **Capacitor**. Empacota o site que já existe como app nativo, sem
reescrever nada.

Pontos de atenção já levantados:
- A Apple isenta de comissão a venda de **serviços do mundo real** (um passeio
  é um serviço do mundo real). Isso vale para as reservas.
- **Assinaturas** vendidas dentro do app iOS caem na regra de compra no app.
  Por isso a recomendação de vender os planos de agência **pela web**.
- Ícones, splash screen e as contas de desenvolvedor (Google Play e Apple, esta
  última paga e anual).

---

## Bloco 6 — Publicação

- ~~Domínio próprio~~ — **avenaapp.com.br já registrado.**
- Hospedagem, DNS, e-mails no domínio e a lista de endereços que os serviços
  vão pedir: passo a passo em [publicacao.md](publicacao.md).
- Variáveis de ambiente em produção — ver `.env.example`.
- HTTPS vem automático na Vercel e na Netlify.
- Renovação anual do `.com.br` no registro.br, com renovação automática ligada.

---

## Idiomas — o que continua em português

Por decisão, não por esquecimento:

- **Termos de Uso e Política de Privacidade.** Valem sob a lei brasileira. Em
  inglês e espanhol aparece um aviso explicando isso acima do texto.
- **Painel profissional e painel administrativo.** São lidos por parceiros
  brasileiros e pela administradora.
- **Conteúdo escrito pelas pessoas.** Nome e descrição de passeio, avaliação,
  mensagem. A agência escreve em português e nós não traduzimos por conta
  própria o texto dela.
- **Assistente de ajuda.** O chat ainda responde só em português. É a única
  lacuna que vale fechar depois.

O resto da experiência do viajante está traduzido, incluindo categorias, tipos
de negócio, níveis de esforço, tags de acessibilidade, nomes de plano e
coleções — que são guardados em português no banco e traduzidos só na tela.

## Bloco 7 — Depois do lançamento

- Comunidade de viajantes: os cinco perfis do feed são **dados de demonstração**.
  Com backend, viram gente de verdade e o aviso sai.
- Verificação de Cadastur: hoje o número é digitado e você confere na mão pelo
  painel. Existe consulta pública no site do Ministério do Turismo; dá para
  automatizar depois.
- Disponibilidade real de vagas: o sistema está pronto, mas depende da agência
  manter atualizado. Quando virar problema, integre com o que elas já usam em
  vez de pedir mais um lugar para atualizar.
- Métricas: quantas buscas sem resultado, quantas reservas abandonadas no
  pagamento, quais cidades mais procuradas sem parceiro. Isso diz onde
  prospectar.

---

## Estratégia que não é configuração, mas decide o resto

Você identificou o gargalo da oferta de passeios. As ferramentas para reduzir o
atrito já estão no app (modelos prontos e importação por planilha), mas a
tática importa mais:

1. **Comece por uma cidade só**, com oferta completa, em vez do Brasil inteiro
   com dois passeios por destino.
2. **Cadastre você mesma**, com autorização da agência, e entregue o perfil
   pronto. As ferramentas estão em Admin › Cadastro — ver
   [importar-passeios.md](importar-passeios.md).
3. **Só comissão no começo.** A mensalidade entra quando o volume já justificar
   o desconto na taxa.

## Depois da validação: o que o servidor destrava

Estes itens ficaram esperando de propósito. Não são esquecimento, e nenhum
deles se resolve no navegador — todos precisam de servidor.

### Documento dos participantes (LGPD)

Hoje a reserva pede **só o nome** de cada pessoa. O documento foi retirado
porque era dado pessoal de terceiro guardado no celular do viajante, sem
criptografia, sem prazo de descarte e sem chegar a agência nenhuma.

Para voltar a pedir, é preciso, na ordem:

1. Servidor com banco de dados e criptografia em repouso.
2. Prazo de retenção definido (ex.: apagar 90 dias depois da viagem).
3. Caminho para a pessoa pedir exclusão, como manda a LGPD.
4. Aí sim: `COLLECT_PARTICIPANT_DOCUMENTS = true` em `src/lib/dataCollection.ts`.

Ligar a constante antes disso recria a exposição.

### Cadastur verificado de verdade

O app hoje mostra o número e diz que **a empresa informou** — não que a
Avena conferiu. Para virar selo de verdade, é preciso consultar o cadastro
do Ministério do Turismo pelo servidor e guardar a data da consulta. Sem
isso, manter a ressalva na tela.

### Senha, conta e backup

Conta só existe no aparelho: celular perdido ou formatado = memórias
perdidas, e senha esquecida só tem a saída de apagar tudo. Servidor resolve
os três de uma vez — conta na nuvem, recuperação por e-mail, backup
automático.

### Pagamento

A tela de pagamento avisa que é demonstração. Enquanto não houver endpoint
recebendo o webhook do Mercado Pago, **nada é vendido de fato** — a reserva
confirmada é uma promessa. Detalhes em `pagamentos-mercado-pago.md`.

### Denúncia e remoção humana

O filtro de palavras barra o óbvio, mas quem quer ofender contorna
qualquer lista. Antes de abrir para o público, é preciso um botão de
denunciar e alguém para analisar.

## Decisões de preço, e por que foram essas

Lorena deixou a escolha comigo. Ficou assim, e tudo mora em
`src/lib/pricing.ts` — trocar um número lá muda o app inteiro.

### Taxa de serviço: 10%, paga pelo viajante, somada ao preço

Viator e GetYourGuide cobram 20% a 30%, escondidos dentro do repasse do
operador. O Airbnb cobra cerca de 14% do hóspede. Dez por cento fica bem
abaixo de todos, e número redondo passa mais confiança que 8,7%.

O custo dessa escolha é a visibilidade: taxa que aparece é taxa que o
viajante pode questionar. Por isso a tela de reserva **explica o que a taxa
paga** logo abaixo do valor, em vez de só nomeá-la. A explicação diz apenas
o que é verdade hoje — cadastro dos parceiros, registro da reserva e canal
de ajuda. Nada de "garantia" ou "seguro", que não existem.

Se a conversão sofrer, o caminho de volta é curto: descontar da agência,
como era antes, ou dividir entre os dois lados.

### Adesão: zero durante o lançamento

Isto é decisão, não esquecimento. Marketplace de dois lados sem viajante
não pode cobrar entrada de agência — ela estaria comprando loja em rua sem
movimento. Cobrar antes de haver demanda é o jeito mais rápido de não ter
oferta nenhuma, e sem oferta não há demanda.

Quando houver movimento real, `JOINING_FEE` vira um número. **Os parceiros
que entraram no lançamento mantêm a isenção** — é a única forma justa de
tratar quem correu o risco de ser primeiro.

Os planos pagos (Pro e Avançado) continuam existindo, mas como **opcionais
de visibilidade**, não como pedágio: no plano gratuito a empresa recebe
reserva do mesmo jeito. A página para empresas diz isso com essas palavras.

## Cadastro de parceiro fora do app

O botão "Anuncie seu negócio" está preparado para levar a uma página da web
em vez de abrir uma tela dentro do aplicativo. Hoje ele continua interno,
porque `PARTNER_SITE_URL` em `src/lib/partnerSite.ts` está vazio. Basta
preencher com o endereço do site de parceiros — por exemplo
`https://avenaapp.com.br/parceiros` — e ele passa a abrir no navegador.

### Por que isso importa, e é dinheiro

**Apple e Google cobram de 15% a 30% de tudo que é vendido dentro de um
aplicativo.** A taxa de adesão que a agência paga é exatamente esse tipo de
venda. Se o parceiro se cadastra e paga dentro do app, a loja fica com uma
fatia. Levando para o site, você fica com o valor inteiro.

É o que todo marketplace desse formato faz: o lado de quem compra fica no
app, o lado de quem vende fica no site.

**Cuidado com a regra da Apple:** não basta abrir o link. As diretrizes
proíbem "direcionar" o usuário para pagar fora quando o item é consumido
dentro do app. O caminho seguro é o cadastro de empresa ser um fluxo
separado, de conta de negócio — que é o que já é aqui. Vale confirmar as
regras vigentes antes de submeter, porque elas mudam.

### O segundo motivo

Cadastrar empresa significa Cadastur, documentos, fotos e conta de
recebimento. É trabalho de computador, não de celular.

### O comportamento hoje

- **No navegador:** continua tudo dentro do site, sem quicar a pessoa para
  fora à toa.
- **No app instalado:** abre o site de parceiros no navegador, quando o
  endereço estiver configurado.
