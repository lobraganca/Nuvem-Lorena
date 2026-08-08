# Busca Itabirito

Marketplace de busca de profissionais por cidade (hoje focado em Itabirito, mas
modelado para expandir para outras cidades sem mudar o schema). Login via
Google, avaliações de usuários, selo de verificação pago e "turbinar anúncio"
como destaque pago — ambos cobrados como assinatura mensal recorrente via
Mercado Pago.

Este app é **independente** do restante do repositório (o site de turismo
"Avena", na raiz). Vive em `apps/profissionais/`, tem seu próprio
`package.json`, seu próprio projeto Supabase e não reaproveita código do
Avena — só segue, como referência, o mesmo padrão de organização
(`src/lib`, `supabase/migrations`, Edge Functions para o que precisa de
segredo do lado do servidor).

## Identidade visual

- **Fundo branco.** O navy da marca virou a cor da tinta (`--color-navy`):
  títulos, texto e o wordmark.
- Dourado como **única** cor de destaque, em duas forças e não por capricho:
  sobre branco o dourado claro (`--color-primary-gold`) tem contraste de
  ~2:1 — serve de preenchimento (botão, selo), mas como texto seria
  ilegível. O `--color-primary-gold-deep` é a versão que passa em contraste
  e é a única usada em link, ícone e rótulo.
- Cinza-azulado (`--color-text-muted`) para o texto secundário.
- Cards se separam do fundo por sombra suave (`--shadow-card`), não por
  borda pesada.
- O teal só sobrevive onde é semântico (botão do WhatsApp, onde ler como
  "verde" ajuda). A versão anterior da marca tinha um ícone de pessoa em
  verde-água e o teal era cor secundária de tudo; com a logo nova ele saiu do
  wordmark, e mantê-lo em selo/etiquetas deixaria cada card parecendo um
  semáforo. Hoje só o selo de verificação — a informação que pesa na decisão —
  é colorido; destaque e tipo de pessoa são neutros.
- Wordmark: "BUSCA" em branco com o **A final em dourado, desenhado sem
  travessão** (duas hastes que se encontram no ápice — nenhuma fonte comum
  entrega isso, então é um SVG em `src/components/Logo.tsx` dimensionado em
  `em` para escalar junto com o texto), e "ITABIRITO" abaixo em dourado com
  entreletra larga. Os ícones do PWA em `public/` repetem esse A em dourado
  sobre navy. Os tokens de cor ficam em `src/theme.css`.

## Cultura: valorizar quem é da cidade

O app é sobre gente que mora na mesma cidade de quem contrata, e isso muda o
desenho em pontos concretos — não é só texto de marketing:

- A tela de início abre com **os dois caminhos** ("Quero contratar" / "Quero
  ser encontrado") antes de qualquer explicação, e um dos cartões diz, sem
  rodeio, que quem anuncia ali é vizinho.
- O título da busca é "Contrate quem é daqui", com o motivo logo abaixo:
  cada serviço fechado é dinheiro que fica na cidade.
- A seção de avaliações se chama **"Avaliações da vizinhança"** e lembra que
  avaliação boa é a melhor propaganda que aquela pessoa vai ter.
- **Nota 1 ou 2 abre um recado antes do envio**: sugere resolver no WhatsApp
  primeiro, e explica que crítica específica ajuda enquanto nota baixa sem
  explicação só machuca.
- Nessas notas, **marcar ao menos uma etiqueta passa a ser obrigatório**
  (`ProfessionalPage.submitReview`). É a única obrigatoriedade do formulário:
  de 3 estrelas para cima a nota sozinha basta. A ideia não é dificultar a
  crítica — é impedir o drive-by de uma estrela sem dizer o que houve, que
  não ensina nada a quem recebe nem a quem lê.

## Pessoas online e visualizações

- **Quantas pessoas estão com o app aberto** aparece na busca, via Realtime
  Presence do Supabase (`src/lib/presence.ts`): cada aba entra num canal e se
  anuncia; quem fecha some sozinho, sem tabela, cron de limpeza ou heartbeat
  escrito à mão. Nenhum dado pessoal trafega — só uma chave aleatória por
  aba. Sem banco configurado o hook devolve `null` e a tela simplesmente não
  mostra nada, em vez de piscar "0 pessoas".
- **Visualizações dos últimos 30 dias** aparecem em cada anúncio do painel
  (`countRecentProfileViews`), e são **grátis para todo anunciante**. Saber
  que 40 pessoas viram o anúncio no último mês é o que faz alguém entender
  que o cadastro está valendo a pena; trancar isso atrás de assinatura
  afastaria justamente quem ainda está decidindo se fica. O Empresa Plus
  continua valendo pelo resto — histórico completo, leads e evolução.

## Primeiro acesso: tela de início e tour

Quem abre o app pela primeira vez não cai na busca — cai em `/inicio`
(`src/pages/BoasVindasPage.tsx`), no mesmo espírito da tela de boas-vindas do
Avena: logo, o que o app faz em quatro cartões, e a pergunta que separa as
duas pessoas que chegam aqui querendo coisas opostas — **"Quero contratar"**
(vai para a busca) e **"Quero ser encontrado"** (vai direto para o painel de
anúncio). Sem isso, o profissional teria que descobrir sozinho onde se
cadastra, no meio de uma tela feita para quem procura.

Nessa tela o header e a barra de navegação inferior somem de propósito:
oferecer cinco caminhos justamente na tela cujo trabalho é perguntar qual
deles a pessoa quer seria trabalhar contra ela.

Quem escolhe "Quero contratar" recebe, na busca, o **tour guiado**
(`src/components/TourGuide.tsx`): a tela escurece, o passo atual recorta um
elemento real (filtros, resultados, Favoritos, Painel) e explica para que
serve. O recorte é feito com `box-shadow` em volta da caixa medida do
elemento, então o buraco acompanha o elemento de verdade em vez de uma
posição chutada; se o alvo não estiver na tela, o passo vira um cartão
centralizado e o texto continua se sustentando sozinho. Os alvos são marcados
com `data-tour="..."` no JSX.

O estado fica no `localStorage`, isolado em `src/lib/onboarding.ts` (com
`try/catch` para não quebrar em navegação anônima com storage bloqueado). São
duas chaves distintas de propósito: a tela de início é vista uma vez, e o
tour só roda para quem foi pela busca. Em **Perfil → "Rever apresentação do
app"** as duas são zeradas.

## Configuração inicial (Supabase, Google, Mercado Pago)

Passo a passo detalhado, do zero até o app com dados reais:
**[CONFIGURACAO.md](./CONFIGURACAO.md)**.

Atalho importante que vive lá: as 23 migrations já vêm concatenadas em
`supabase/banco-completo.sql`, para montar o banco colando **um arquivo só**
no SQL Editor em vez de 23 na ordem certa. Esse arquivo é gerado — depois de
criar qualquer migration nova, rode `npm run sql:unico` para atualizá-lo.

## Como rodar localmente

```bash
cd apps/profissionais
npm install
cp .env.example .env.local   # preencha com as chaves do SEU Supabase
npm run dev
```

Build de produção (também usado para validar TypeScript):

```bash
npm run build
```

## Variáveis de ambiente

### Frontend (`.env.local`, veja `.env.example`)

| Variável | Para quê |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase deste app |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima (pública) do mesmo projeto |
| `VITE_MERCADOPAGO_PUBLIC_KEY` | Opcional; só necessária se algum checkout embutido (Bricks) for adicionado no navegador no futuro |

### Backend — Edge Functions (`supabase secrets set ...`, nunca no `.env` do frontend)

| Variável | Para quê |
|---|---|
| `MP_ACCESS_TOKEN` | **Access token do Mercado Pago.** Nunca deve aparecer no código nem no bundle do frontend — é usado só dentro das Edge Functions para chamar a API do Mercado Pago |
| `PUBLIC_APP_URL` | URL pública do app, usada como `back_url` do checkout |
| `RESEND_API_KEY` | API key da [Resend](https://resend.com), usada pelos e-mails transacionais (`notify-suspension`, `notify-new-review` e o aviso de renovação do plano anual em `renew-annual-plans`). Sem ela, as functions logam e seguem sem quebrar |
| `RESEND_FROM_EMAIL` | Remetente verificado na Resend (ex: `"Busca Itabirito <avisos@seudominio.com>"`) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Injetadas automaticamente pelo Supabase ao rodar/publicar as functions |

## Banco de dados (Supabase)

Migrations em `supabase/migrations/`:

- `0001_esquema.sql` — tabelas `profiles`, `professionals`, `reviews`,
  `subscriptions` e a view `professional_ratings` (média/contagem de notas).
  Um trigger em `auth.users` cria o `profile` automaticamente no primeiro
  login (inclusive via Google).
- `0002_seguranca.sql` — RLS: leitura pública de `professionals`/`reviews`,
  escrita restrita ao dono (`professionals`) ou ao autor (`reviews`); só o
  dono do anúncio enxerga/cria as próprias `subscriptions`. A confirmação de
  pagamento (marcar `verified`/`boosted`) é feita pela Edge Function do
  webhook usando a `service_role` key, que ignora RLS por desenho.
- `0003_cpf_avaliacao.sql` / `0004_exige_cpf_para_avaliar.sql` — CPF do
  avaliador (associado ao `profile`, exigido para avaliar).
- `0005_pessoa_fisica_juridica.sql` — `professionals.entity_type` (`pf`/`pj`),
  `document` (CPF ou CNPJ do anunciante — **diferente** do CPF de avaliação
  em `profiles.cpf`) e `company_name` (razão social/nome fantasia, só
  relevante para `pj`).
- `0006_foto_e_responsavel.sql` — `professionals.photo_url` (foto de rosto
  para `pf`, logo para `pj`) e `responsible_name` (nome do responsável pela
  empresa, obrigatório só para `pj`).
- `0007_denuncias.sql` — tabela `reports` (canal de denúncias de anúncios).
  RLS permite `insert` público (inclusive sem login) e não tem policy de
  `select` pública — denúncias não são um dado público.
- `0008_admins.sql` — tabela `admins` (marca quem enxerga o painel
  administrativo em `/admin`) e as policies de `select`/`update` de `reports`
  para quem estiver nela. Ver seção "Painel administrativo" abaixo.
- `0009_suspensao_e_bloqueio.sql` — `professionals.suspended` /
  `suspended_reason` (tirar anúncio do ar pelo painel admin) e a mudança na
  policy pública de `select` de `professionals` para esconder suspensos do
  público; tabela `document_bans` (CPF/CNPJ bloqueados para novo cadastro)
  e a função `public.check_document_banned` (RPC `security definer` usada
  no cadastro, sem expor a lista de bloqueados).
- `0010_resposta_favoritos.sql` — resposta do dono do anúncio a uma
  avaliação (`reviews.reply`/`replied_at`) e a tabela `favorites`.
- `0011_trigger_reviews_campo_restrito.sql` — a policy de update de
  `reviews` do dono do anúncio (0010) liberava, no papel, a linha inteira —
  então nada impedia reescrever `rating`/`comment` via API direta em vez de
  só responder. Este trigger `BEFORE UPDATE` valida campo a campo: o autor
  da avaliação só pode mudar `rating`/`comment` (não `reply`/`replied_at`);
  o dono do anúncio só pode mudar `reply`/`replied_at` (nunca `rating`/
  `comment`), com `replied_at = now()` setado automaticamente. RLS continua
  controlando quem pode dar update; o trigger controla o quê. **Atenção ao
  mexer em `reviews`:** como o trigger lista os campos um a um, toda coluna
  nova precisa entrar nessa conta — foi o que a `0020` fez com `tags`.
- `0012_views_publicas_sem_documento.sql` — fecha exposição de dados
  sensíveis: cria as views `professionals_public` (todas as colunas de
  `professionals` exceto `document`, o CPF/CNPJ do anunciante) e
  `profiles_public` (`id`, `full_name`, `avatar_url`, `created_at`, sem
  `cpf`); troca a policy pública de `select` de `profiles` para só permitir
  ao próprio dono ler a própria linha (`auth.uid() = id`) — leitura de nome/
  avatar de terceiros deve usar `profiles_public`. Toda leitura pública de
  profissionais no client (`searchProfessionals`, `getProfessional`,
  `getFavoriteProfessionals`) passou a usar `professionals_public`;
  `getMyProfessionals` (painel do dono) e o painel admin continuam lendo a
  tabela `professionals` direto, porque o dono/admin pode ver o próprio
  documento.
- `0013_rate_limit_denuncias.sql` — coluna opcional
  `reports.reporter_fingerprint` e um índice único parcial
  `(professional_id, reporter_id) where reporter_id is not null and status =
  'pending'`, impedindo um mesmo usuário logado de abrir mais de uma
  denúncia pendente para o mesmo anúncio.
- `0014_pay_per_lead.sql` — `professionals.contact_mode`
  (`whatsapp_livre`/`pay_per_lead`), tabelas `lead_credits` (saldo de
  créditos pré-pagos por profissional) e `lead_events` (histórico de
  cliques no WhatsApp que consumiram crédito); função `security definer`
  `public.consume_lead_credit` (RPC, decremento atômico do saldo); views
  `lead_credits_public` (só expõe se há saldo, não o valor) e
  `professionals_public` atualizada com `contact_mode`.
- `0015_patrocinio_categoria.sql` — tabela `category_sponsorships` (banner
  de categoria patrocinada, com `status`/`ends_at`); leitura pública
  restrita a patrocínios `status = 'active'` e `ends_at > now()`.
- `0016_empresa_plus.sql` — `professionals.plus_active`/`plus_until`
  (mesmo padrão de `verified`/`boosted`), tabela `profile_views`
  (contagem de visualizações de perfil, sem dado pessoal, insert público);
  amplia `subscriptions.type` para aceitar `'plus'`; `professionals_public`
  atualizada com `plus_active`/`plus_until`.
- `0017_assinatura_anual.sql` — `subscriptions.billing_cycle`
  (`'monthly'`/`'annual'`), para diferenciar a assinatura recorrente mensal
  do plano anual à vista com desconto (ver seção "Fontes de renda").
- `0018_sugestoes.sql` — tabela `suggestions` (canal de sugestões gerais
  sobre a plataforma, ver seção "Sugestões dos usuários"); insert público
  (não exige login), leitura restrita a admin (mesmo padrão de `reports`).
- `0019_renovacao_anual.sql` — `subscriptions.auto_renew` (true quando o
  Mercado Pago cobra sozinho — mensal ou anual via `preapproval`; false no
  anual à vista no Pix/boleto) e `subscriptions.renewal_notified_at` (quando
  o aviso de renovação deste ciclo foi enviado, para o cron não reenviar o
  e-mail todo dia; o webhook zera ao confirmar o pagamento). Faz backfill de
  `auto_renew = false` nas linhas anuais existentes — antes desta migration,
  toda linha anual era pagamento único. Ver seção "Fontes de renda".
- `0020_etiquetas_avaliacao.sql` — `reviews.tags` (`text[]`, default `'{}'`)
  para as etiquetas rápidas da avaliação, e a atualização do trigger de
  0011: `tags` entra no conjunto de campos que **o autor** pode mudar
  (junto com `rating`/`comment`) e no conjunto que **o dono do anúncio**
  não pode mudar. Sem essa parte, editar uma avaliação com etiquetas
  falharia em runtime. Ver seção "Avaliação por toque" abaixo.
- `0021_idempotencia_pagamentos.sql` — tabela `processed_payments` (livro de
  eventos de pagamento já processados, para o Mercado Pago não creditar duas
  vezes ao reenviar a mesma notificação) e a função `add_lead_credits`
  (soma atômica de créditos de contato, só para a `service_role` do webhook).
  Ver "Idempotência" na seção do webhook.

### Avaliação por toque (etiquetas rápidas)

O formulário de avaliação segue o modelo de app de corrida (99/Uber): **a
pessoa não precisa escrever nada**. O fluxo, todo dentro do `BottomSheet`
da página do profissional:

1. **Nota** — 5 estrelas tocáveis (`.star-picker`/`.star-btn` em
   `theme.css`), cada uma um `<button>` com `aria-label` ("3 estrelas").
2. **Etiquetas rápidas** — chips de múltipla escolha, nenhuma obrigatória.
   O conjunto **muda com a nota**: `POSITIVE_REVIEW_TAGS` para 4-5,
   `NEGATIVE_REVIEW_TAGS` para 1-2 e `MIXED_REVIEW_TAGS` (as 4 qualidades +
   os 4 problemas mais comuns) para a nota 3 — ver `tagsForRating` em
   `src/types/domain.ts`. Ao trocar a nota, as etiquetas já marcadas que não
   pertencem ao conjunto novo são descartadas, para não sobrar um "Atrasou"
   preso numa avaliação de 5 estrelas.
3. **Comentário** — continua existindo, mas é opcional e discreto ("Quer
   escrever algo? (opcional)"). Enviar só com a nota funciona.

As etiquetas são as mesmas para todas as categorias de propósito: texto
genérico o bastante para servir de encanador a manicure, e um conjunto único
mantém a agregação comparável entre profissionais. Mudar a lista é editar os
arrays em `src/types/domain.ts` — não exige migração, porque a coluna é
`text[]` livre (a migration só limita a quantidade por linha).

No topo da seção de avaliações, `aggregateReviewTags` (em
`src/lib/professionals.ts`) conta as etiquetas mais recebidas pelo
profissional e mostra as 5 mais frequentes com a contagem (`Pontual (12)`).
É calculado no client a partir das reviews já carregadas — a página baixa a
lista inteira de qualquer jeito, então não vale uma view SQL só para isso.

### Storage — fotos/logos dos anúncios

O upload de foto de rosto (pessoa física) ou logo (pessoa jurídica) usa o
Supabase Storage, que **não** pode ser criado via migration SQL. Antes de
usar em produção, crie o bucket manualmente uma única vez:

1. No painel do Supabase: **Storage → New bucket**.
2. Nome exatamente `professional-photos` (constante `PROFESSIONAL_PHOTOS_BUCKET`
   em `src/lib/storage.ts`).
3. Marque como **Public bucket** (a URL pública é salva em
   `professionals.photo_url` e usada direto no `<img>` dos cards/perfil).
4. Não é necessária nenhuma policy adicional de leitura (bucket público já
   resolve); para permitir upload pelo usuário logado, garanta que exista uma
   policy de `INSERT` no Storage liberando `authenticated` no bucket
   `professional-photos` (padrão do Supabase ao marcar o bucket como
   público com upload autenticado).

Para aplicar num projeto Supabase novo:

```bash
supabase link --project-ref <seu-projeto>
supabase db push
```

### Login com Google

No painel do Supabase: **Authentication → Providers → Google**, habilite e
configure o Client ID/Secret do Google Cloud, com a URL de callback que o
próprio Supabase mostra na tela. Nenhuma mudança de código é necessária além
disso — `src/lib/auth.ts` já chama `signInWithOAuth({ provider: "google" })`.

## Painel administrativo

Rota `/admin` (não aparece no menu público) mostra hoje:

- **Denúncias** (`reports`) — motivo, detalhes, profissional denunciado
  (com link para o perfil público) e botões para marcar como "Revisada" ou
  "Descartada". Denúncias pendentes ficam destacadas com a cor dourada do
  tema.
- **Sugestões dos usuários** (`suggestions`) — canal de feedback geral
  sobre a plataforma (ideias, categorias que faltam etc), diferente das
  denúncias (que são sobre um anúncio específico). Qualquer visitante pode
  enviar (link "Enviar sugestão" no rodapé, presente em qualquer página,
  sem exigir login — quando logado, o `user_id` é capturado
  automaticamente). O admin vê a mensagem, a data e o status (`new`/
  `reviewed`), com botão para marcar como revisada. Leitura é restrita a
  admin via RLS (mesma policy reaproveitada de `reports`, checando a tabela
  `admins`) — não há select público em `suggestions`.
- **Profissionais cadastrados** — lista com filtro rápido por cidade e
  categoria.
- **Tirar anúncio do ar** — direto de uma denúncia ou da lista geral, o
  admin pode suspender um anúncio (`professionals.suspended = true` +
  `suspended_reason`). Um anúncio suspenso some da busca e do perfil
  público (a policy pública de `select` em `professionals` passou a exigir
  `suspended = false`); o dono continua vendo o próprio anúncio (para saber
  o que houve) e admins veem tudo. Dá para reativar a qualquer momento.
- **Bloquear novo cadastro pelo mesmo documento** — ao suspender, o admin
  pode escolher "tirar do ar e bloquear cadastro": o CPF/CNPJ daquele
  anúncio vai para `document_bans`. Novos cadastros (`upsertProfessional`
  em `src/lib/professionals.ts`) checam esse bloqueio antes de salvar,
  via a função Postgres `security definer` `public.check_document_banned`
  (RPC) — a tabela `document_bans` em si não tem select público, só a
  função expõe "está bloqueado ou não" sem vazar a lista inteira.
- **Aviso por e-mail ao dono** — ao suspender, o painel chama a Edge
  Function `notify-suspension`, que busca o e-mail do dono
  (`auth.users.email`, via `service_role`) e envia o aviso usando a API da
  [Resend](https://resend.com). A suspensão em si **não depende** do
  e-mail funcionar: se `RESEND_API_KEY` não estiver configurada, ou o
  envio falhar, a function loga o problema e responde `sent: false` sem
  quebrar o fluxo — o painel mostra se o e-mail foi confirmado ou não.

  Para configurar o envio de e-mail:

  1. Crie uma conta gratuita em https://resend.com.
  2. Verifique um domínio (ou use o domínio de teste da Resend para testar).
  3. Gere uma API key em **API Keys → Create API Key**.
  4. `supabase secrets set RESEND_API_KEY=re_xxx`
  5. `supabase secrets set RESEND_FROM_EMAIL="Busca Itabirito <avisos@seudominio.com>"`
  6. `supabase functions deploy notify-suspension`

  O mesmo Resend configurado acima também é usado pela Edge Function
  `notify-new-review` (`supabase functions deploy notify-new-review`), que
  avisa o dono do anúncio por e-mail quando ele recebe uma avaliação nova.
  É chamada pelo client logo após `addReview` dar certo, de forma
  best-effort — se falhar, a avaliação já foi salva normalmente.

O projeto não tem sistema de roles — "ser admin" é simplesmente ter uma
linha na tabela `admins` (`0008_admins.sql`). Não existe fluxo de
auto-promoção nem UI para isso de propósito: a tabela não tem nenhuma
policy pública de select/insert/update, só `service_role` ou acesso direto
ao Supabase Studio conseguem mexer nela. Para promover um usuário a admin,
depois do primeiro login dele no app:

1. Pegue o `id` do usuário em **Authentication → Users** no painel do
   Supabase (é o mesmo `id` de `public.profiles`).
2. Rode no **SQL Editor** do Supabase:

   ```sql
   insert into public.admins (user_id) values ('<uuid-do-usuario>');
   ```

Para remover o acesso, `delete from public.admins where user_id = '<uuid>';`.

Próximos passos possíveis (não implementados): gestão manual de
assinaturas/verificação (marcar `verified`/`boosted` sem depender do
webhook do Mercado Pago), histórico/auditoria de ações do admin, desbloqueio
de documento pela UI (hoje é `delete from public.document_bans where
document = '...'` direto no banco) e um sistema de roles mais rico se o
time de admins crescer.

## Mercado Pago — modelo de monetização implementado

Três assinaturas por profissional, cada uma com **três formas de pagamento**
à escolha do dono do anúncio (BottomSheet no painel/analytics):

- **Selo de verificação** — R$ 10,90/mês, ou R$ 104,64/ano
  (`type: "verification"`).
- **Turbinar anúncio** — destaque na listagem, ordenado antes dos demais —
  R$ 19,90/mês, ou R$ 191,04/ano (`type: "boost"`).
- **Empresa Plus** (analytics, só `entity_type = 'pj'`) — R$ 29,90/mês, ou
  R$ 287,04/ano (`type: "plus"`).

O valor anual é **20% de desconto sobre 12x o valor mensal**, sempre
arredondado para 2 casas decimais (ex: 10,90 × 12 × 0,8 = 104,64).

**Por que três formas de pagamento diferentes:** a API do Mercado Pago só
faz débito automático com **cartão de crédito** (`preapproval`) — Pix e
boleto não têm cobrança recorrente no Brasil. Por isso:

| Caminho | Endpoint do Mercado Pago | Renova sozinho? | Meios de pagamento | Edge Function |
|---|---|---|---|---|
| **Mensal no cartão** | `POST /preapproval` (`frequency: 1, frequency_type: "months"`) | **Sim**, todo mês | Só cartão | `mercadopago-create-subscription` (verification/boost), `mercadopago-create-plus-subscription` (plus) |
| **Anual no cartão** | `POST /preapproval` (`frequency: 12, frequency_type: "months"`) | **Sim**, todo ano | Só cartão | `mercadopago-create-annual-subscription` |
| **Anual no Pix/boleto** | `POST /checkout/preferences` (Checkout Pro, pagamento único) | **Não** — mas o app avisa por e-mail com a cobrança pronta 7 dias antes de vencer | Pix, cartão ou boleto | `mercadopago-create-annual-payment` + `renew-annual-plans` (agendada) |

O `external_reference` distingue os caminhos:

- `"<professionalId>:<type>"` — preapproval **mensal** (formato original).
- `"<professionalId>:<type>:annual"` — preapproval **anual recorrente**.
- `"annual:<professionalId>:<type>"` — **pagamento único** anual (Checkout
  Pro), inclusive quando gerado pela renovação automatizada.

Fluxo (exemplo do selo — turbinar/plus seguem o mesmo padrão):

1. No painel (`/painel`) ou em `/analytics/:id` (caso do Plus), o dono clica
   em "Assinar selo" e escolhe, no BottomSheet, entre os três caminhos — o
   texto de cada card deixa explícito quem renova sozinho e quem depende de
   pagar o link avisado por e-mail.
2. O frontend chama a função correspondente em `src/lib/payments.ts`
   (`startSubscriptionCheckout`, `startAnnualSubscriptionCheckout` ou
   `startAnnualCheckout`), que invoca a Edge Function da tabela acima. Ela
   cria a `preapproval`/`preference` no Mercado Pago, salva uma linha
   `pending` em `subscriptions` (com `billing_cycle` e `auto_renew`
   corretos) e devolve o `init_point`, para onde o usuário é redirecionado.
3. `mercadopago-webhook` (`supabase/functions/mercadopago-webhook/index.ts`)
   recebe a notificação do Mercado Pago e confirma o pagamento — ver seção
   seguinte para o detalhe de como ele distingue os formatos de evento e as
   validades de 1 mês / 1 ano.
4. Ao expirar (`verified_until`/`boosted_until`/`plus_until` no passado), a
   listagem deixa de considerar o profissional como verificado/turbinado/
   plus — é uma checagem simples de data (`isCurrentlyVerified`/
   `isCurrentlyBoosted`/`isCurrentlyPlusActive` em `src/lib/professionals.ts`),
   sem precisar de nenhum cron para "desligar" o badge.

Deploy das functions:

```bash
supabase functions deploy mercadopago-create-subscription
supabase functions deploy mercadopago-create-plus-subscription
supabase functions deploy mercadopago-create-annual-subscription
supabase functions deploy mercadopago-create-annual-payment
supabase functions deploy mercadopago-buy-credits
supabase functions deploy mercadopago-sponsor-category
supabase functions deploy mercadopago-webhook
supabase functions deploy renew-annual-plans
supabase secrets set MP_ACCESS_TOKEN=seu_access_token_de_producao
supabase secrets set PUBLIC_APP_URL=https://seu-dominio.com
```

E cadastre a URL do webhook
(`https://<projeto>.functions.supabase.co/mercadopago-webhook`) no painel do
Mercado Pago.

## Webhook — como cada evento é confirmado

`mercadopago-webhook` trata os **dois formatos de notificação diferentes**
que o Mercado Pago manda, nunca confiando cegamente no corpo do webhook
(pode ser forjado) — sempre revalida consultando a API do Mercado Pago com
`MP_ACCESS_TOKEN`:

- `type: "subscription_preapproval"` (ou `topic: "preapproval"`, dependendo
  de como foi configurado no painel do Mercado Pago) — usado pelas
  assinaturas **recorrentes no cartão**, mensais e anuais. Consulta
  `GET /preapproval/{id}`; se `status === "authorized"`, marca
  `subscriptions.status = 'active'` e, em `professionals`, o campo
  correspondente (`verified`/`verified_until`, `boosted`/`boosted_until`,
  `plus_active`/`plus_until`). A **validade depende do ciclo**: o
  `external_reference` no formato `"<id>:<type>:annual"` vale **1 ano**; sem
  o sufixo (`"<id>:<type>"`, formato mensal original) vale **1 mês**. Se o
  sufixo faltar em uma preapproval antiga, o webhook cai no `billing_cycle`
  já gravado na linha de `subscriptions`; sem os dois, assume mensal — o
  comportamento que sempre existiu. Se `status` virar `cancelled`/`paused`,
  só reflete em `subscriptions.status` — o `verified`/`boosted`/
  `plus_active` cai sozinho quando `..._until` expira.
- `type: "payment"` — usado por **todos os pagamentos avulsos** via Checkout
  Pro: créditos de contato, patrocínio de categoria e o plano anual no
  Pix/boleto. Consulta `GET /v1/payments/{id}`; se `status === "approved"`,
  lê o prefixo do `external_reference`:
  - `credits:<professionalId>:<quantity>` → upsert somando `quantity` ao
    saldo em `lead_credits`.
  - `sponsor:<sponsorshipId>` → marca `category_sponsorships.status =
    'active'` e grava `mercadopago_payment_id` (a virada para `'expired'`
    quando `ends_at` passa é feita pela function agendada
    `renew-annual-plans`, ver "Fontes de renda").
  - `annual:<professionalId>:<type>` → mesmo efeito da preapproval
    autorizada, mas com validade de **1 ano** (`..._until` = agora + 1 ano).
    A linha `pending` mais recente em `subscriptions` (`billing_cycle:
    'annual'`) vira `active`; **se não houver `pending`**, é o pagamento de
    uma renovação avisada por e-mail (o cron não cria linha nova), e a linha
    `active` existente é estendida em vez de duplicada. Nos dois casos,
    `renewal_notified_at` volta a `null`, liberando o aviso do ciclo
    seguinte.
  - `"<id>:<type>"` / `"<id>:<type>:annual"` (sem prefixo conhecido) → é a
    **cobrança recorrente de uma preapproval**: o Mercado Pago manda um
    `payment` a cada renovação, carregando o mesmo `external_reference` da
    assinatura. O webhook empurra `..._until` +1 mês (mensal) ou +1 ano
    (anual). Sem isso a assinatura seria cobrada de novo mas o benefício
    expiraria no fim do primeiro período.
- Qualquer outro `type`/`topic` não reconhecido é ignorado (responde 200
  vazio). Falha de rede/parse ao consultar a API do Mercado Pago é
  capturada (try/catch) e logada com `console.error`, sem derrubar a
  function — o webhook sempre responde 200 rapidamente, mesmo em erro
  interno, para não sofrer reenvio agressivo do Mercado Pago.

### Idempotência (por que o mesmo pagamento não conta duas vezes)

O Mercado Pago envia **mais de uma notificação para o mesmo pagamento**
(`payment.created`, `payment.updated` e reenvios automáticos), todas com o
mesmo `data.id`. Antes de aplicar qualquer efeito, o webhook reserva esse id
na tabela `processed_payments` (migration `0021`); se o id já estiver
reservado, o evento é uma duplicata e é ignorado. Se o processamento falhar
no meio, a reserva é desfeita para que o reenvio do Mercado Pago consiga
tentar de novo.

Isso é o que impede a compra de créditos de contato — o único fluxo que
**soma** ao estado, em vez de gravar um valor final — de creditar em dobro. A
soma em si é feita pela função `add_lead_credits` (`security definer`, sem
`grant` para `anon`/`authenticated`), atômica no banco, para não perder uma
compra quando dois pagamentos são confirmados ao mesmo tempo.

Pela mesma razão, a validade (`..._until`) é calculada **somando ao tempo que
ainda resta**, não a partir de `now()`: a cobrança da renovação anual é gerada
7 dias antes do vencimento, e quem paga assim que recebe o e-mail perderia
esses dias se a conta partisse de agora.

## Fontes de renda

O app tem hoje **5 fontes de renda**, todas cobradas via Mercado Pago
(assinatura recorrente via `preapproval`, ou cobrança avulsa via
`checkout/preferences` — Checkout Pro), com o webhook confirmando
automaticamente todas elas:

Cada uma das 3 assinaturas tem **3 caminhos de pagamento** — dois renovam
sozinhos (cartão), um depende do usuário pagar de novo (Pix/boleto), mas com
a cobrança e o aviso gerados automaticamente:

| Fonte | Mensal no cartão (renova sozinho) | Anual no cartão (renova sozinho) | Anual no Pix/boleto (**não** renova sozinho — avisamos por e-mail) |
|---|---|---|---|
| Selo de verificação | R$ 10,90/mês | R$ 104,64/ano (equiv. R$ 8,72/mês) | R$ 104,64/ano |
| Turbinar anúncio (destaque) | R$ 19,90/mês | R$ 191,04/ano (equiv. R$ 15,92/mês) | R$ 191,04/ano |
| Empresa Plus (analytics, só `pj`) | R$ 29,90/mês | R$ 287,04/ano (equiv. R$ 23,92/mês) | R$ 287,04/ano |

Edge Function de cada coluna: `mercadopago-create-subscription`
(verification/boost) e `mercadopago-create-plus-subscription` (plus) para o
mensal; `mercadopago-create-annual-subscription` para o anual no cartão;
`mercadopago-create-annual-payment` (+ `renew-annual-plans`) para o anual no
Pix/boleto.

As outras 2 fontes de renda são cobranças avulsas, sem recorrência nenhuma:

| Fonte | Preço | Edge Function |
|---|---|---|
| Pagar por contato (pay-per-lead) | R$ 2,90/lead (pacotes de 10/25/50 créditos), Pix/cartão/boleto | `mercadopago-buy-credits` |
| Banner de categoria patrocinada | R$ 29,90 (7 dias) / R$ 49,90 (15 dias) / R$ 79,90 (30 dias), Pix/cartão/boleto | `mercadopago-sponsor-category` |

**Pix funciona em todo pagamento avulso** (créditos, patrocínio e o anual à
vista) **mas nunca em cobrança recorrente** — não é uma limitação do app, é
a própria API do Mercado Pago que não aceita Pix em `preapproval` no Brasil.
É exatamente por isso que o anual no Pix/boleto existe separado do anual no
cartão.

Como cada uma funciona:

- **Selo de verificação / Turbinar anúncio / Empresa Plus** — já
  documentado acima: mensal no cartão, anual no cartão (ambos `preapproval`,
  débito automático de verdade) ou anual no Pix/boleto (pagamento único),
  todos confirmados pelo webhook, controlando `professionals.verified`/
  `boosted`/`plus_active` (+ `_until`).
- **Pagar por contato** — alternativa ao WhatsApp livre. O dono escolhe o
  modo em `/painel` (`professionals.contact_mode`); no modo
  `pay_per_lead`, cada clique em "Chamar no WhatsApp" na página do
  profissional chama a RPC `consume_lead_credit` (decremento atômico,
  evita saldo negativo em cliques concorrentes) **antes** de abrir o link —
  se não houver saldo, o botão vira o aviso "Este profissional está sem
  créditos de contato no momento". O saldo é comprado em pacotes
  (`mercadopago-buy-credits`, Checkout Pro).
- **Banner de categoria patrocinada** — o dono compra um período (7/15/30
  dias) de destaque para a categoria do próprio anúncio
  (`mercadopago-sponsor-category`, Checkout Pro). Enquanto a linha em
  `category_sponsorships` estiver `status = 'active'` e dentro do período,
  a `HomePage` mostra um banner dourado acima da lista sempre que a busca
  estiver filtrada por aquela categoria (sem filtro de categoria, não
  aparece banner).
- **Empresa Plus** — com `plus_active` ativo, `/analytics/:id` mostra
  visualizações de perfil (`profile_views`, incrementado a cada
  `getProfessional`, best-effort), total de leads (`lead_events`, só
  relevante se o modo pay-per-lead também estiver ativo — senão mostra
  "N/A") e a avaliação média/contagem que já existiam.

### Rotina diária (`renew-annual-plans`) — renovação do anual e faxina

Uma única Edge Function agendada faz as duas tarefas periódicas do app:

1. **Aviso de renovação do plano anual no Pix/boleto.** Varre
   `subscriptions` com `billing_cycle = 'annual'`, `auto_renew = false`,
   `status = 'active'` e `renewal_notified_at is null`, e para cada plano
   cujo `verified_until`/`boosted_until`/`plus_until` vence nos **próximos 7
   dias**: cria uma nova preferência de pagamento no Mercado Pago (mesmo
   `external_reference` `annual:<id>:<type>` do fluxo normal, então o webhook
   confirma a renovação sem nenhum código especial) e manda um e-mail via
   Resend ao dono do anúncio com o **link já pronto** e a data de
   vencimento. Só então grava `renewal_notified_at = now()` — se o e-mail
   falhar, o cron tenta de novo amanhã em vez de deixar o dono sem aviso.
   O webhook zera `renewal_notified_at` ao confirmar o pagamento, liberando
   o aviso do ciclo seguinte. Planos vencidos há mais de 7 dias são
   ignorados (plano abandonado — o dono pode simplesmente assinar de novo no
   painel). Quem paga no cartão (`auto_renew = true`) nunca entra nessa
   varredura: o Mercado Pago cobra sozinho.
2. **Expiração dos patrocínios de categoria.** Marca
   `category_sponsorships.status = 'expired'` onde `ends_at < now()` e o
   status ainda é `'active'` (era um TODO conhecido). A leitura pública já
   filtrava por `ends_at > now()`, então isso é higiene de dados/painel, não
   fechamento de brecha.

Sem `RESEND_API_KEY` configurada, a function **não quebra**: loga o aviso,
pula os e-mails (sem marcar ninguém como avisado, para o aviso sair assim
que a chave for configurada) e ainda assim expira os patrocínios vencidos —
mesmo padrão de `notify-suspension`.

Só quem apresenta a `service_role` key no header `Authorization` consegue
disparar a rotina; nenhum usuário final a chama.

**Como agendar (pg_cron + pg_net, direto no SQL Editor do Supabase).**
Rode uma vez, trocando `<projeto>` pela ref do seu projeto e
`<SERVICE_ROLE_KEY>` pela service role key (Settings → API):

```sql
-- Extensões necessárias (uma vez por projeto).
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Roda todo dia às 12:00 UTC (09:00 no horário de Brasília).
select cron.schedule(
  'renovacao-anual-diaria',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://<projeto>.functions.supabase.co/renew-annual-plans',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Para conferir/remover o agendamento:

```sql
select * from cron.job;                        -- lista os jobs
select * from cron.job_run_details             -- histórico de execuções
  order by start_time desc limit 20;
select cron.unschedule('renovacao-anual-diaria');
```

Para testar na mão, sem esperar o cron:

```bash
curl -X POST https://<projeto>.functions.supabase.co/renew-annual-plans \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
# → {"expiredSponsorships":0,"notified":0}
```

## Sugestões dos usuários

Canal simples de feedback geral sobre a plataforma (ideias, "poderia ter
tal categoria" etc) — diferente do canal de denúncias (`reports`), que é
sobre um anúncio específico. Link "Enviar sugestão" no rodapé do app
(`src/App.tsx`), acessível em qualquer página, sem exigir login: abre um
`BottomSheet` com um textarea e o botão "Enviar" (`sendSuggestion` em
`src/lib/suggestions.ts`). Quando o usuário está logado, o `user_id` é
capturado automaticamente; anônimo, fica `null`. Sem policy de select
pública em `suggestions` — só admin lê (mesma policy reaproveitada de
`reports`), na aba "Sugestões dos usuários" do painel `/admin` (ver seção
"Painel administrativo" acima).

## PWA

O app já é um PWA de verdade (instalável, com ícone e splash básicos, e
funciona offline para o "shell" estático):

- `public/manifest.json` — nome, cores do tema (navy `#0B1D33`) e ícones.
- `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`
  e `public/apple-touch-icon.png` — **placeholders** gerados a partir da
  mesma lupa/silhueta do favicon do `index.html`, só para o app ser
  instalável desde já. **Troque esses 4 arquivos pelos ícones finais da
  logo oficial quando ela existir** (mantenha os mesmos nomes/tamanhos, ou
  ajuste os caminhos em `public/manifest.json` e no `<link rel="apple-touch-icon">`
  do `index.html`).
- Service worker registrado via `vite-plugin-pwa` (`vite.config.ts`), gerado
  automaticamente no `npm run build` (`dist/sw.js`). Ele faz cache só do
  shell (HTML/CSS/JS/ícones do build) — **não** cacheia respostas do
  Supabase (busca, login, avaliações), que sempre vão direto pra rede.

## Publicação nas lojas (futuro)

O app não está publicado nas lojas ainda — isso é trabalho para depois. O
que já está pronto nesta branch é só a base técnica:

**Já pronto:**
- PWA completo (manifest, ícones placeholder, service worker) — ver seção
  acima. Já dá pra "Adicionar à tela inicial" no Android/iOS hoje.
- Capacitor configurado (`capacitor.config.ts`, `appId: com.buscaitabirito.app`)
  e as dependências `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`
  e `@capacitor/ios` já instaladas em `package.json`.
- Script `npm run cap:sync` (builda o web app e sincroniza com os projetos
  nativos, quando eles existirem).

**O que falta antes de publicar de verdade:**
- Gerar os projetos nativos Android/iOS (comandos abaixo) — eles **não**
  foram gerados nesta branch de propósito, para não versionar projetos
  nativos grandes sem necessidade agora.
- Trocar os 4 ícones placeholder pelos ícones/splash screen oficiais da
  marca (a logo real ainda não existe — ver `src/components/Logo.tsx`).
- Conta de desenvolvedor **Google Play** (taxa única de US$ 25).
- Conta de desenvolvedor **Apple Developer Program** (US$ 99/ano).
- Ajustar a política de pagamento in-app da Apple: hoje o selo de
  verificação e o "turbinar anúncio" são cobrados via Mercado Pago fora do
  app. Para publicar na App Store, assinaturas recorrentes desse tipo
  normalmente precisam passar pelo **In-App Purchase** da Apple (guideline
  3.1.1) — vale revisar com calma se o modelo se qualifica para alguma
  exceção (ex.: "reader apps"/serviços prestados fora do app) ou se vai
  precisar de um fluxo de assinatura via StoreKit em paralelo ao Mercado
  Pago só para a versão iOS. O Google Play é mais flexível quanto a isso,
  mas vale revisar a Payments Policy também.

**Passo a passo para quando for publicar:**

```bash
# 1. Gerar os projetos nativos (roda uma vez, dentro de apps/profissionais)
npm run build
npx cap add android
npx cap add ios       # só é possível/necessário numa máquina Mac
npx cap sync

# 2. Sempre que o código mudar, antes de testar/publicar de novo:
npm run cap:sync
```

- **Android**: abra a pasta `android/` gerada no **Android Studio**
  (`npx cap open android` depois de instalado o CLI do Capacitor com esse
  comando disponível, ou abra manualmente). De lá, gere o APK/AAB assinado
  e suba no Google Play Console.
- **iOS**: abra a pasta `ios/` gerada no **Xcode** (`npx cap open ios`,
  só funciona em macOS). De lá, configure o signing com a conta Apple
  Developer e envie pelo Xcode/Transporter para o App Store Connect.

**Pré-requisitos:**
- Android Studio instalado (qualquer SO) para gerar/testar/assinar o app
  Android.
- Xcode instalado — só existe para macOS — para gerar/testar/assinar o app
  iOS. Sem um Mac (físico ou na nuvem), não dá pra publicar na App Store.
- Contas de desenvolvedor ativas nas duas lojas (valores acima).
- Ícones e splash screen finais da marca prontos antes de submeter (as
  lojas rejeitam apps com ícone placeholder óbvio).

## O que é mock/simplificado neste MVP

- Lista de cidades (`CITIES` em `src/types/domain.ts`) é uma lista fixa
  pequena, com Itabirito como padrão — trocar/ampliar é só editar o array.
- Confirmação de pagamento via webhook já está fechada para todos os fluxos
  (ver "Webhook — como cada evento é confirmado"), mas **não valida
  assinatura/HMAC do Mercado Pago** — a proteção é revalidar todo evento
  contra a API do Mercado Pago com o `MP_ACCESS_TOKEN`, o que impede um
  webhook forjado de liberar benefício, mas não impede um terceiro de
  disparar processamento repetido de eventos legítimos.
- **Paginação da busca/listagem admin** é incremental simples (`limit`/
  `offset` via `page`/`pageSize` em `searchProfessionals`, botão "Carregar
  mais"), não infinite scroll automático nem cursor-based.
- **Anti-abuso de denúncias é best-effort, não é segurança forte:**
  - Denunciante logado: bloqueado por um índice único parcial no banco (não
    dá para abrir duas denúncias pendentes para o mesmo anúncio) — isso é
    real e não pode ser burlado pelo client.
  - Denunciante anônimo (sem login): a única trava é uma chave no
    `localStorage` do navegador (`busca-itabirito-denunciado-<id>`). Isso
    reduz spam casual do mesmo navegador, mas **não impede** alguém de
    limpar o localStorage, usar aba anônima ou outro navegador/dispositivo
    para denunciar de novo. Não há rate limit de IP nem CAPTCHA — se abuso
    real acontecer, a mitigação natural seria adicionar isso no backend
    (Edge Function na frente do insert, por exemplo), não implementado
    nesta versão.
