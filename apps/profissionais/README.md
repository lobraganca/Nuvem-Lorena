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
supabase functions deploy mercadopago-webhook
supabase secrets set MP_ACCESS_TOKEN=seu_access_token_de_producao
supabase secrets set PUBLIC_APP_URL=https://seu-dominio.com
```

E cadastre a URL do webhook
(`https://<projeto>.functions.supabase.co/mercadopago-webhook`) no painel do
Mercado Pago.

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
- Sem upload de foto de perfil do profissional (fica para uma v2).
- Sem paginação na listagem de busca.
