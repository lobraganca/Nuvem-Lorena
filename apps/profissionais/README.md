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

- Fundo navy escuro (`--color-bg: #0B1D33`).
- Dourado (`--color-primary-gold`) como cor de destaque/CTA — botões de
  "assinar selo" e "turbinar anúncio".
- Teal (`--color-accent-teal`) como cor secundária — selo de verificado,
  links, WhatsApp.
- Wordmark "busca" em branco + "ITABIRITO" em teal, com letter-spacing largo,
  como placeholder da logo (`src/components/Logo.tsx`) até o PNG oficial ser
  fornecido. Os tokens de cor ficam em `src/theme.css`.

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
  controlando quem pode dar update; o trigger controla o quê.
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

Duas assinaturas recorrentes mensais por profissional:

- **Selo de verificação** — R$ 10,90/mês (`type: "verification"`).
- **Turbinar anúncio** — destaque na listagem, ordenado antes dos demais
  (`type: "boost"`).

Fluxo:

1. No painel (`/painel`), o dono do anúncio clica em "Assinar selo" ou
   "Turbinar anúncio".
2. O frontend chama `startSubscriptionCheckout` (`src/lib/payments.ts`), que
   invoca a Edge Function `mercadopago-create-subscription`.
3. Essa function (rodando no servidor, com `MP_ACCESS_TOKEN`) cria uma
   **preapproval** (assinatura recorrente) na API do Mercado Pago, salva uma
   linha `pending` em `subscriptions` e devolve o `init_point` — o frontend
   redireciona o usuário para lá para autorizar o pagamento.
4. **TODO / esqueleto documentado:** `mercadopago-webhook`
   (`supabase/functions/mercadopago-webhook/index.ts`) já recebe as
   notificações do Mercado Pago e tem, comentado e explicado passo a passo, o
   que falta para: consultar o status real da preapproval, localizar a
   assinatura pelo `external_reference`, e então marcar
   `professionals.verified = true` / `professionals.boosted = true` (com as
   respectivas datas de validade) e `subscriptions.status = 'active'`. Isso
   foi deixado como esqueleto porque validar assinatura/segurança do webhook
   e o cálculo exato de `current_period_end` merece ser feito com a conta real
   do Mercado Pago em mãos — mas toda a criação da assinatura já funciona.
5. Ao expirar (`verified_until`/`boosted_until` no passado), a listagem deixa
   de considerar o profissional como verificado/turbinado — hoje isso é uma
   checagem simples de data; um cron/Edge Function agendada para "desligar"
   badges vencidos é um próximo passo natural, não implementado ainda.

Deploy das functions:

```bash
supabase functions deploy mercadopago-create-subscription
supabase functions deploy mercadopago-create-plus-subscription
supabase functions deploy mercadopago-buy-credits
supabase functions deploy mercadopago-sponsor-category
supabase functions deploy mercadopago-webhook
supabase secrets set MP_ACCESS_TOKEN=seu_access_token_de_producao
supabase secrets set PUBLIC_APP_URL=https://seu-dominio.com
```

E cadastre a URL do webhook
(`https://<projeto>.functions.supabase.co/mercadopago-webhook`) no painel do
Mercado Pago.

## Fontes de renda

O app tem hoje **5 fontes de renda**, todas cobradas via Mercado Pago
(assinatura recorrente via `preapproval`, ou cobrança avulsa via
`checkout/preferences` — Checkout Pro):

| Fonte | Preço | Tipo de cobrança | Edge Function |
|---|---|---|---|
| Selo de verificação | R$ 10,90/mês | Recorrente (preapproval) | `mercadopago-create-subscription` |
| Turbinar anúncio (destaque) | R$ 19,90/mês | Recorrente (preapproval) | `mercadopago-create-subscription` |
| Pagar por contato (pay-per-lead) | R$ 2,90/lead (pacotes de 10/25/50 créditos) | Avulsa (preference) | `mercadopago-buy-credits` |
| Banner de categoria patrocinada | R$ 29,90 (7 dias) / R$ 49,90 (15 dias) / R$ 79,90 (30 dias) | Avulsa (preference) | `mercadopago-sponsor-category` |
| Empresa Plus (analytics, só `pj`) | R$ 29,90/mês | Recorrente (preapproval) | `mercadopago-create-plus-subscription` |

Como cada uma funciona:

- **Selo de verificação / Turbinar anúncio** — já documentado acima:
  assinatura recorrente, controla `professionals.verified`/`boosted` (+
  `_until`).
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
- **Empresa Plus** — assinatura recorrente adicional, só oferecida a
  anúncios `entity_type = 'pj'` (`mercadopago-create-plus-subscription`).
  Com `plus_active` ativo, `/analytics/:id` mostra visualizações de perfil
  (`profile_views`, incrementado a cada `getProfessional`, best-effort),
  total de leads (`lead_events`, só relevante se o modo pay-per-lead também
  estiver ativo — senão mostra "N/A") e a avaliação média/contagem que já
  existiam.

**Confirmação de pagamento — todas dependem do webhook.** Igual ao selo e
ao turbinar anúncio, a criação da cobrança (assinatura ou preferência)
já funciona de ponta a ponta, mas a confirmação de pagamento das **3 novas
Edge Functions também fica esqueleto/best-effort**, seguindo o mesmo padrão
documentado em `mercadopago-webhook`: hoje o webhook recebe a notificação
do Mercado Pago e só loga; falta implementar, para cada `external_reference`
novo, o tratamento correspondente:

- `credits:<professionalId>:<quantity>` → upsert somando `quantity` ao
  saldo em `lead_credits`.
- `sponsor:<sponsorshipId>` → marcar `category_sponsorships.status =
  'active'` (e, à parte, um job/cron para marcar `'expired'` quando
  `ends_at` passar — não incluído).
- `<professionalId>:plus` → mesmo tratamento do selo/boost, mas setando
  `professionals.plus_active`/`plus_until`.

Até esse trecho ser implementado, os pagamentos dessas 3 fontes de renda
são cobrados normalmente no Mercado Pago, mas **não** liberam o benefício
automaticamente — precisa ser feito manualmente (ou completando o TODO) até
o webhook ir para produção.

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
- Confirmação de pagamento via webhook está esqueletada, não conectada de
  ponta a ponta (ver seção acima).
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
