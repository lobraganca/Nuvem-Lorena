# Colocando o procurô no ar — passo a passo

Guia detalhado, do zero até o app rodando com dados reais. Feito para ser
seguido na ordem, marcando cada caixinha.

Leva cerca de **40 minutos** na primeira vez. A parte mais demorada é o login
do Google (passo 4), que envolve um segundo site além do Supabase.

> **Sobre os nomes dos botões**: o painel do Supabase muda de aparência de
> tempos em tempos. Se um botão não estiver exatamente onde este guia diz,
> procure pelo nome parecido no mesmo menu — a lógica continua a mesma.

---

## Passo 1 — Criar o projeto

- [ ] Entre em **https://supabase.com/dashboard** com a sua conta.
- [ ] Clique em **New project** (botão verde, no topo). Se você tiver mais de
      uma organização, ele pergunta em qual criar — qualquer uma serve.
- [ ] Preencha:
  - **Name**: `busca-itabirito` (é só um apelido, aparece só para você).
  - **Database Password**: clique em **Generate a password** e **guarde essa
    senha** num lugar seguro. Você provavelmente nunca vai usá-la (o app não
    precisa dela), mas ela é a única forma de conectar direto no banco por
    fora, e o Supabase não mostra de novo depois.
  - **Region**: **South America (São Paulo)**. O banco fica fisicamente mais
    perto de quem vai usar o app, e isso se traduz em busca mais rápida.
  - **Pricing plan**: Free.
- [ ] Clique em **Create new project** e espere. Demora uns 2 minutos — ele
      está montando um banco de dados de verdade para você.

> **Não reaproveite o projeto do Avena.** Este app tem banco próprio de
> propósito: são produtos diferentes, e misturar as duas bases significaria
> que um problema num derruba o outro.

---

## Passo 2 — Montar as tabelas (as migrations)

O app precisa de 15 tabelas, com as regras de segurança de cada uma. Isso
está descrito em 23 arquivos `.sql` na pasta `supabase/migrations/`.

Para não te fazer colar 23 arquivos na ordem certa, **eles já vêm juntos num
arquivo só**: `supabase/banco-completo.sql`.

- [ ] No menu da esquerda, clique em **SQL Editor** (ícone de folha com
      `>_`).
- [ ] Clique em **New query** (ou no `+` no topo da lista).
- [ ] Abra o arquivo `apps/profissionais/supabase/banco-completo.sql` no seu
      computador, **selecione tudo** (Ctrl+A / Cmd+A), copie, e cole na caixa
      grande do SQL Editor.
- [ ] Clique em **Run** (canto inferior direito, ou Ctrl+Enter).
- [ ] Espere alguns segundos. No fim deve aparecer **"Success. No rows
      returned"** numa faixa embaixo.

**Deu erro?** Leia a mensagem antes de tentar de novo:

| Mensagem | O que significa | O que fazer |
|---|---|---|
| `already exists` | Você já tinha rodado antes | Tudo bem, pode seguir |
| `permission denied` | Está no projeto errado | Confira o nome do projeto no topo |
| Outro erro | Alguma coisa saiu de ordem | Me mande a mensagem inteira |

- [ ] **Confirme que funcionou**: menu **Table Editor**. Você deve ver a lista
      de tabelas — `professionals`, `reviews`, `profiles`, `favorites`,
      `contact_requests` e outras. Se elas estão aí, o banco está pronto.

---

## Passo 3 — Pegar as chaves do projeto

- [ ] Menu da esquerda, lá embaixo: **Project Settings** (ícone de
      engrenagem) → **API**.
- [ ] Você vai ver três coisas importantes:

| O que | Onde aparece | Pode ficar no app? |
|---|---|---|
| **Project URL** | No topo, algo como `https://abcdefgh.supabase.co` | ✅ Sim |
| **anon public** | Em "Project API keys" | ✅ Sim — ela é limitada pelas regras de segurança do banco |
| **service_role** | Logo abaixo, com aviso vermelho | ❌ **Nunca** |

> **Por que a `anon` pode ser pública e a `service_role` não:** a `anon`
> obedece às regras de segurança que criamos dentro do banco — com ela, uma
> pessoa só consegue ver o que qualquer visitante poderia ver. Já a
> `service_role` **ignora todas as regras**: quem tiver ela lê o CPF de todo
> mundo. Ela só existe para o código que roda no servidor.

- [ ] No seu computador, dentro de `apps/profissionais/`, crie um arquivo
      chamado **`.env.local`** com este conteúdo (colando os seus valores):

```
VITE_SUPABASE_URL=https://SEUPROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=cole-a-chave-anon-aqui
```

- [ ] Esse arquivo **não vai para o GitHub** (o `.gitignore` já cuida disso).

---

## Passo 4 — Login com Google

Esta é a parte mais chata, porque envolve o Google Cloud além do Supabase. Faça
na ordem, porque um lado pede uma informação do outro.

### 4a. Pegue a URL de retorno no Supabase

- [ ] No Supabase: **Authentication** → **Providers** (em painéis mais novos
      pode estar como **Sign In / Providers**).
- [ ] Ache **Google** na lista e clique para expandir.
- [ ] Ligue o botão **Enable Sign in with Google**.
- [ ] Vai aparecer um campo **Callback URL (for OAuth)** com algo como
      `https://abcdefgh.supabase.co/auth/v1/callback`. **Copie essa URL.**
- [ ] Deixe essa aba aberta.

### 4b. Crie a credencial no Google

- [ ] Em outra aba, abra **https://console.cloud.google.com**.
- [ ] No topo, crie um projeto novo (**Select a project** → **New project**),
      nome `procurô`.
- [ ] Menu (☰) → **APIs & Services** → **OAuth consent screen**:
  - **User Type**: **External** → Create.
  - **App name**: `procurô`
  - **User support email**: seu e-mail
  - **Developer contact**: seu e-mail
  - Salve e vá avançando até o fim.
- [ ] Menu → **APIs & Services** → **Credentials** → **Create Credentials** →
      **OAuth client ID**:
  - **Application type**: **Web application**
  - **Name**: `procurô Web`
  - Em **Authorized redirect URIs**, clique em **Add URI** e cole **a URL de
    retorno que você copiou do Supabase** no passo 4a.
  - **Create**.
- [ ] O Google mostra **Client ID** e **Client Secret**. Copie os dois.

### 4c. Volte ao Supabase

- [ ] Cole o **Client ID** e o **Client Secret** nos campos correspondentes.
- [ ] **Save**.

> **Enquanto testa no seu computador**, o login só funciona se o endereço
> local estiver autorizado. No Supabase, em **Authentication → URL
> Configuration**, coloque `http://localhost:5173` em **Site URL** e também em
> **Redirect URLs**. Quando publicar o app de verdade, troque pelo endereço
> real.

---

## Passo 5 — Pasta das fotos (Storage)

As fotos de rosto e as logos precisam de um lugar para morar. Isso **não dá
para fazer por SQL** — tem que ser pelo painel.

- [ ] Menu → **Storage** → **New bucket**.
- [ ] **Name**: exatamente `professional-photos` (com hífen, tudo minúsculo —
      o app procura por esse nome).
- [ ] Ligue **Public bucket**. As fotos aparecem para qualquer visitante da
      busca, então precisam ser públicas mesmo.
- [ ] **Create bucket**.

---

## Passo 6 — Rodar o app e virar admin

- [ ] No seu computador:

```bash
cd apps/profissionais
npm install
npm run dev
```

- [ ] Abra `http://localhost:5173`. O aviso amarelo de "ambiente de
      demonstração" deve ter sumido — se ele ainda aparece, o `.env.local`
      não está sendo lido (confira o nome do arquivo e reinicie o `npm run
      dev`).
- [ ] Entre com o Google pela tela de Perfil.
- [ ] Volte ao Supabase: **Authentication** → **Users**. Você vai se ver na
      lista. Copie o valor da coluna **UID**.
- [ ] **SQL Editor** → **New query** → cole, trocando pelo seu UID:

```sql
insert into public.admins (user_id) values ('cole-seu-uid-aqui');
```

- [ ] **Run**. Agora o item **Admin** aparece no menu de baixo do app, e você
      enxerga denúncias, sugestões e pode suspender anúncios.

> Fiz a promoção a admin ser assim de propósito: a tabela `admins` não tem
> nenhuma regra que permita alguém se promover pelo app. Só por dentro do
> painel do Supabase, que só você acessa.

---

## Passo 7 — Pagamentos (pode deixar para depois)

O app funciona sem isso — só as assinaturas ficam inativas. Quando quiser
ligar, você precisa da **CLI do Supabase**, porque Edge Functions não sobem
pelo painel.

```bash
npm install -g supabase
supabase login
supabase link --project-ref SEUPROJETO   # o código que aparece na URL do painel

supabase secrets set MP_ACCESS_TOKEN=seu-token-do-mercado-pago
supabase secrets set PUBLIC_APP_URL=https://seu-endereco-do-app
supabase secrets set RESEND_API_KEY=sua-chave-da-resend   # e-mails, opcional

supabase functions deploy mercadopago-create-subscription
supabase functions deploy mercadopago-create-annual-subscription
supabase functions deploy mercadopago-create-annual-payment
supabase functions deploy mercadopago-create-plus-subscription
supabase functions deploy mercadopago-buy-credits
supabase functions deploy mercadopago-sponsor-category
supabase functions deploy mercadopago-webhook
supabase functions deploy notify-new-review
supabase functions deploy notify-suspension
supabase functions deploy renew-annual-plans
```

Depois, no painel do Mercado Pago, cadastre o webhook apontando para:
`https://SEUPROJETO.functions.supabase.co/mercadopago-webhook`

E agende a rotina diária (renovações e patrocínios vencidos) — o SQL do
`pg_cron` está na seção "Fontes de renda" do `README.md`.

---

## Se algo der errado

| Sintoma | Causa provável |
|---|---|
| Aviso "ambiente de demonstração" não some | `.env.local` com nome errado, ou o `npm run dev` não foi reiniciado |
| Login abre e volta sem entrar | Falta `http://localhost:5173` em **Authentication → URL Configuration** |
| "Bucket not found" ao salvar anúncio com foto | O bucket não foi criado, ou o nome saiu diferente de `professional-photos` |
| Item Admin não aparece | O `insert` na tabela `admins` não rodou, ou o UID foi colado errado |
| Projeto "pausado" | Plano gratuito pausa após 7 dias sem acesso — é só despausar no painel |

---

## Uma observação honesta

Nada disso foi testado contra um Supabase real por mim — eu não tenho acesso à
sua conta, e este guia foi escrito a partir do que o código exige. Os nomes de
botão do painel podem ter mudado desde então. Se travar em algum passo, me
diga em qual e com qual mensagem, que eu ajusto.
