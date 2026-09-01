-- Ei Itabirito — banco NOVO, PARTE 1 de 7
-- Projeto: ahigenhenzmsjxlmrzhz (o do Ei Itabirito)
-- Cole tudo, clique uma vez fora do texto (para não ficar nada selecionado) e toque em Run.
-- Migrations desta parte: 0001 a 0016

-- ───── 0001_esquema.sql ─────
-- procurô — esquema inicial do marketplace de profissionais.
-- Independente do banco do Avena: este projeto Supabase é próprio deste app.

create extension if not exists "pgcrypto";

-- Perfil público de cada usuário autenticado (espelha auth.users).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Cria/atualiza o profile automaticamente quando alguém faz login pela
-- primeira vez (inclusive via Google OAuth).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profissionais anunciados na plataforma.
create table if not exists public.professionals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  category text not null,
  city text not null default 'Itabirito',
  bio text not null default '',
  phone text not null default '',
  verified boolean not null default false,
  verified_until timestamptz,
  boosted boolean not null default false,
  boosted_until timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists professionals_city_idx on public.professionals (city);
create index if not exists professionals_category_idx on public.professionals (category);
create index if not exists professionals_owner_idx on public.professionals (owner_id);

-- Avaliações de usuários sobre profissionais.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  unique (professional_id, user_id)
);

create index if not exists reviews_professional_idx on public.reviews (professional_id);

-- Assinaturas pagas: selo de verificação (R$10,90/mês) ou anúncio turbinado.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  type text not null check (type in ('verification', 'boost')),
  mercadopago_subscription_id text,
  status text not null default 'pending'
    check (status in ('pending', 'authorized', 'active', 'paused', 'cancelled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_professional_idx on public.subscriptions (professional_id);
create index if not exists subscriptions_mp_idx on public.subscriptions (mercadopago_subscription_id);

-- View auxiliar: média e contagem de avaliações por profissional.
create or replace view public.professional_ratings as
select
  professional_id,
  round(avg(rating)::numeric, 2) as average_rating,
  count(*) as review_count
from public.reviews
group by professional_id;


-- ───── 0002_seguranca.sql ─────
-- Regras de RLS — leitura pública, escrita restrita ao dono/usuário autenticado.

alter table public.profiles enable row level security;
alter table public.professionals enable row level security;
alter table public.reviews enable row level security;
alter table public.subscriptions enable row level security;

-- profiles: qualquer um lê (nome/avatar são públicos), só o dono edita o seu.
drop policy if exists "profiles são públicos para leitura" on public.profiles;
create policy "profiles são públicos para leitura"
  on public.profiles for select
  using (true);

drop policy if exists "usuário edita o próprio profile" on public.profiles;
create policy "usuário edita o próprio profile"
  on public.profiles for update
  using (auth.uid() = id);

-- professionals: leitura pública (é um marketplace de busca); só o dono
-- autenticado cria/edita/apaga o seu próprio anúncio.
drop policy if exists "profissionais são públicos para leitura" on public.professionals;
create policy "profissionais são públicos para leitura"
  on public.professionals for select
  using (true);

drop policy if exists "usuário cria seu próprio anúncio" on public.professionals;
create policy "usuário cria seu próprio anúncio"
  on public.professionals for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "dono edita o próprio anúncio" on public.professionals;
create policy "dono edita o próprio anúncio"
  on public.professionals for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "dono apaga o próprio anúncio" on public.professionals;
create policy "dono apaga o próprio anúncio"
  on public.professionals for delete
  to authenticated
  using (auth.uid() = owner_id);

-- reviews: leitura pública; só usuário autenticado cria a sua própria
-- avaliação (um review por usuário por profissional, ver unique no schema);
-- só o autor edita/apaga a própria avaliação.
drop policy if exists "avaliações são públicas para leitura" on public.reviews;
create policy "avaliações são públicas para leitura"
  on public.reviews for select
  using (true);

drop policy if exists "usuário autenticado avalia" on public.reviews;
create policy "usuário autenticado avalia"
  on public.reviews for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "autor edita a própria avaliação" on public.reviews;
create policy "autor edita a própria avaliação"
  on public.reviews for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "autor apaga a própria avaliação" on public.reviews;
create policy "autor apaga a própria avaliação"
  on public.reviews for delete
  to authenticated
  using (auth.uid() = user_id);

-- subscriptions: só o dono do profissional enxerga/gerencia as assinaturas
-- dele. Escritas de confirmação de pagamento (marcar active/verified/boosted)
-- são feitas pela Edge Function do webhook usando a service_role key, que
-- ignora RLS — por isso não existe policy pública de update aqui.
drop policy if exists "dono vê as assinaturas do seu anúncio" on public.subscriptions;
create policy "dono vê as assinaturas do seu anúncio"
  on public.subscriptions for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = subscriptions.professional_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "dono inicia assinatura para o seu anúncio" on public.subscriptions;
create policy "dono inicia assinatura para o seu anúncio"
  on public.subscriptions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = subscriptions.professional_id
        and p.owner_id = auth.uid()
    )
  );


-- ───── 0003_cpf_avaliacao.sql ─────
-- Exige CPF do usuário logado antes de avaliar, para reduzir avaliações
-- falsas/anônimas. O CPF fica salvo uma vez no profile (ligado à conta
-- Google usada no login) e é reaproveitado nas próximas avaliações.

alter table public.profiles
  add column if not exists cpf text;

-- Um CPF só pode estar associado a uma conta.
create unique index if not exists profiles_cpf_key
  on public.profiles (cpf)
  where cpf is not null;


-- ───── 0004_exige_cpf_para_avaliar.sql ─────
-- Reforça no banco (não só na UI) que só usuário com CPF confirmado no
-- profile pode inserir avaliação.

drop policy if exists "usuário autenticado avalia" on public.reviews;

drop policy if exists "usuário autenticado com CPF avalia" on public.reviews;
create policy "usuário autenticado com CPF avalia"
  on public.reviews for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.cpf is not null
    )
  );


-- ───── 0005_pessoa_fisica_juridica.sql ─────
-- Permite que empresas (pessoa jurídica) anunciem, além de profissionais
-- autônomos (pessoa física), no mesmo cadastro/busca. `document` guarda o
-- CPF ou CNPJ do anunciante — dado diferente do CPF de avaliação, que fica
-- em profiles.cpf. `company_name` é a razão social/nome fantasia, só
-- relevante quando entity_type = 'pj'.

alter table public.professionals
  add column if not exists entity_type text not null default 'pf' check (entity_type in ('pf', 'pj'));

alter table public.professionals
  add column if not exists document text;

alter table public.professionals
  add column if not exists company_name text;


-- ───── 0006_foto_e_responsavel.sql ─────
-- Foto do anúncio (foto de rosto para pessoa física, logo para empresa) e
-- nome do responsável pela empresa (obrigatório só quando entity_type = 'pj').
-- `photo_url` guarda a URL pública do arquivo enviado ao bucket de Storage
-- "professional-photos" (ver README.md — bucket criado no painel do
-- Supabase, não dá para criar bucket via migration SQL).

alter table public.professionals
  add column if not exists photo_url text;

alter table public.professionals
  add column if not exists responsible_name text;


-- ───── 0007_denuncias.sql ─────
-- Canal de denúncias de anúncios (perfil falso, golpe, conteúdo ofensivo etc).
-- Leitura fica restrita (sem policy de select pública) — só service_role ou
-- acesso direto ao banco enxerga as denúncias por enquanto; um painel admin
-- para revisão é um próximo passo, não implementado nesta versão (ver README).

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  reporter_id uuid references public.profiles (id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

-- Qualquer um pode denunciar, inclusive sem estar logado (o golpe pode
-- atingir alguém que nem conseguiu logar ainda). Sem policy de select
-- pública de propósito — denúncias não são um dado público.
drop policy if exists "qualquer um pode denunciar um anúncio" on public.reports;
create policy "qualquer um pode denunciar um anúncio"
  on public.reports for insert
  with check (true);


-- ───── 0008_admins.sql ─────
-- Painel administrativo simples: tabela `admins` marca quem pode ver/tratar
-- denúncias (`reports`). O projeto não tem sistema de roles — quem for
-- admin precisa ser inserido manualmente nesta tabela (ver README, seção
-- "Painel administrativo") direto no Supabase, depois do primeiro login.

create table if not exists public.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade
);

alter table public.admins enable row level security;

-- Sem NENHUMA policy pública de select/insert/update/delete de propósito:
-- só service_role ou acesso direto via Supabase Studio mexem nesta tabela.
-- Isso evita que qualquer usuário autenticado se auto-promova a admin.

-- reports: admin pode ler e mudar o status (pending -> reviewed/dismissed).
drop policy if exists "admin vê as denúncias" on public.reports;
create policy "admin vê as denúncias"
  on public.reports for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "admin atualiza o status da denúncia" on public.reports;
create policy "admin atualiza o status da denúncia"
  on public.reports for update
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );


-- ───── 0009_suspensao_e_bloqueio.sql ─────
-- Suspensão de anúncios pelo painel admin (tirar do ar por denúncia
-- procedente ou violação das regras) e bloqueio de documento (CPF/CNPJ)
-- para impedir novo cadastro com o mesmo documento.

alter table public.professionals
  add column if not exists suspended boolean not null default false,
  add column if not exists suspended_reason text;

-- A policy pública de select de professionals passa a excluir suspensos:
-- um anúncio suspenso some da busca e do perfil público. O dono e admins
-- continuam vendo (o dono via policy própria, para entender o que houve;
-- admin via policy própria).
drop policy if exists "profissionais são públicos para leitura" on public.professionals;

drop policy if exists "profissionais não suspensos são públicos para leitura" on public.professionals;
create policy "profissionais não suspensos são públicos para leitura"
  on public.professionals for select
  using (suspended = false);

drop policy if exists "dono vê o próprio anúncio mesmo suspenso" on public.professionals;
create policy "dono vê o próprio anúncio mesmo suspenso"
  on public.professionals for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "admin vê qualquer anúncio, inclusive suspenso" on public.professionals;
create policy "admin vê qualquer anúncio, inclusive suspenso"
  on public.professionals for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

-- admin também precisa poder suspender/reativar (mudar suspended/suspended_reason).
drop policy if exists "admin suspende/reativa anúncios" on public.professionals;
create policy "admin suspende/reativa anúncios"
  on public.professionals for update
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

-- Bloqueio de documento (CPF/CNPJ, só dígitos) para impedir novo cadastro.
create table if not exists public.document_bans (
  document text primary key,
  reason text,
  banned_at timestamptz not null default now()
);

alter table public.document_bans enable row level security;

-- Sem select/insert público de propósito — só quem está em `admins` mexe
-- diretamente na tabela (mesmo padrão de `admins`). A checagem no cadastro
-- é feita via função security definer abaixo, não por select direto.
drop policy if exists "admin vê a lista de documentos bloqueados" on public.document_bans;
create policy "admin vê a lista de documentos bloqueados"
  on public.document_bans for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "admin bloqueia um documento" on public.document_bans;
create policy "admin bloqueia um documento"
  on public.document_bans for insert
  to authenticated
  with check (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "admin desbloqueia um documento" on public.document_bans;
create policy "admin desbloqueia um documento"
  on public.document_bans for delete
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

-- Função security definer: qualquer usuário autenticado pode checar se um
-- documento está bloqueado, sem enxergar a lista inteira de bloqueados
-- (RLS de document_bans continua restrita a admins).
create or replace function public.check_document_banned(doc text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.document_bans where document = doc);
$$;

grant execute on function public.check_document_banned(text) to authenticated, anon;


-- ───── 0010_resposta_favoritos.sql ─────
-- Resposta do profissional à avaliação + favoritos do usuário.

-- Resposta do dono do anúncio a uma avaliação recebida.
alter table public.reviews
  add column if not exists reply text,
  add column if not exists replied_at timestamptz;

-- O dono do anúncio pode atualizar (só) o campo de resposta de reviews do
-- seu profissional. A policy de update já existente ("autor edita a própria
-- avaliação") continua valendo para o autor editar rating/comment; esta é
-- adicional, para o dono responder.
drop policy if exists "dono do anúncio responde a avaliação" on public.reviews;
create policy "dono do anúncio responde a avaliação"
  on public.reviews for update
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = reviews.professional_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = reviews.professional_id
        and p.owner_id = auth.uid()
    )
  );

-- Favoritos: usuário autenticado favorita profissionais para achar depois.
create table if not exists public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, professional_id)
);

create index if not exists favorites_professional_idx on public.favorites (professional_id);

alter table public.favorites enable row level security;

drop policy if exists "usuário vê os próprios favoritos" on public.favorites;
create policy "usuário vê os próprios favoritos"
  on public.favorites for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "usuário favorita um profissional" on public.favorites;
create policy "usuário favorita um profissional"
  on public.favorites for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "usuário remove o próprio favorito" on public.favorites;
create policy "usuário remove o próprio favorito"
  on public.favorites for delete
  to authenticated
  using (auth.uid() = user_id);


-- ───── 0011_trigger_reviews_campo_restrito.sql ─────
-- Corrige uma brecha de integridade: a policy de update do dono do anúncio
-- (0010_resposta_favoritos.sql) permite, no papel, atualizar a linha inteira
-- de `reviews` — então hoje nada impede o dono de reescrever `rating`/
-- `comment` de uma avaliação recebida via API direta (só via `reply`, não
-- via UI, mas RLS não protegia isso). E o autor da review, via a policy dele,
-- também poderia em tese setar `reply`/`replied_at` direto.
--
-- RLS decide QUEM pode dar update (policies existentes, mantidas como
-- estão); este trigger decide O QUE cada um pode mudar nessa mesma
-- operação, validando campo a campo.

create or replace function public.reviews_valida_campos_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  eh_autor boolean;
  eh_dono boolean;
begin
  eh_autor := auth.uid() = old.user_id;
  eh_dono := exists (
    select 1 from public.professionals p
    where p.id = old.professional_id
      and p.owner_id = auth.uid()
  );

  if eh_autor then
    -- Autor pode mudar rating/comment, mas não a resposta do dono.
    if new.reply is distinct from old.reply or new.replied_at is distinct from old.replied_at then
      raise exception 'Autor da avaliação não pode alterar a resposta do profissional.';
    end if;
    -- Autor não deve conseguir se auto-declarar dono via update; mantém os
    -- demais campos imutáveis por segurança extra.
    new.professional_id := old.professional_id;
    new.user_id := old.user_id;
  elsif eh_dono then
    -- Dono do anúncio só pode mudar a resposta, nunca a nota/comentário do
    -- autor.
    if new.rating is distinct from old.rating or new.comment is distinct from old.comment then
      raise exception 'Dono do anúncio não pode alterar nota ou comentário da avaliação.';
    end if;
    new.professional_id := old.professional_id;
    new.user_id := old.user_id;
    if new.reply is distinct from old.reply then
      new.replied_at := now();
    end if;
  else
    -- Nem autor nem dono: não deveria nem passar pelas policies de RLS,
    -- mas por segurança em profundidade, barra qualquer mudança.
    raise exception 'Sem permissão para atualizar esta avaliação.';
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_valida_campos_update_trigger on public.reviews;
create trigger reviews_valida_campos_update_trigger
  before update on public.reviews
  for each row execute function public.reviews_valida_campos_update();


-- ───── 0012_views_publicas_sem_documento.sql ─────
-- Fecha exposição de dados sensíveis (LGPD): CPF/CNPJ do anunciante
-- (`professionals.document`) e CPF do avaliador (`profiles.cpf`) hoje vazam
-- para qualquer leitura pública via `select("*")`, porque a policy de select
-- é `using (true)`/`using (suspended = false)` na tabela inteira.
--
-- A partir daqui: leitura pública passa a usar views que omitem essas
-- colunas; a tabela crua só é lida diretamente por quem tem o próprio dado
-- (RLS `auth.uid() = id`/`owner_id`) ou é admin.

-- professionals_public: todas as colunas exceto `document`.
--
-- drop + create, e não `create or replace`: migrations posteriores acrescentam
-- colunas a esta view, e ao re-executar o script do zero o `create or replace`
-- tentaria REMOVER essas colunas — o Postgres recusa. Vale a mesma regra
-- sempre que uma view muda de formato mais adiante.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, city, bio, phone, entity_type,
  company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, created_at
from public.professionals;

grant select on public.professionals_public to anon, authenticated;

-- profiles_public: id, full_name, avatar_url, created_at — sem `cpf`.
create or replace view public.profiles_public as
select id, full_name, avatar_url, created_at
from public.profiles;

grant select on public.profiles_public to anon, authenticated;

-- profiles: a policy pública antiga (`using (true)`) devolvia a linha
-- inteira, inclusive `cpf`. Troca por uma policy que só permite ao próprio
-- dono ler a própria linha via select direto na tabela; leitura de
-- nome/avatar de outros usuários passa a ser feita via `profiles_public`.
drop policy if exists "profiles são públicos para leitura" on public.profiles;

drop policy if exists "usuário lê o próprio profile" on public.profiles;
create policy "usuário lê o próprio profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);


-- ───── 0013_rate_limit_denuncias.sql ─────
-- Rate limit / anti-abuso simples em denúncias (reports).

-- Fingerprint opcional do denunciante anônimo (best-effort, não é segurança
-- forte — ver README). Usado só como sinal auxiliar, nunca como chave única
-- (fácil de forjar/trocar).
alter table public.reports
  add column if not exists reporter_fingerprint text;

-- Para denunciantes logados: no máximo uma denúncia em aberto (pending) por
-- profissional. Índice único parcial em vez de constraint simples porque só
-- queremos travar enquanto a denúncia está pendente — se for revisada/
-- descartada, o mesmo usuário pode denunciar de novo depois (ex: reincidência).
create unique index if not exists reports_reporter_professional_pending_uidx
  on public.reports (professional_id, reporter_id)
  where reporter_id is not null and status = 'pending';


-- ───── 0014_pay_per_lead.sql ─────
-- Fonte de renda: pagamento por contato (pay-per-lead), alternativa à
-- assinatura fixa do selo. O dono do anúncio escolhe, por profissional,
-- entre "whatsapp_livre" (grátis, ilimitado — comportamento atual) e
-- "pay_per_lead" (cada clique no WhatsApp consome 1 crédito pré-pago).

alter table public.professionals
  add column if not exists contact_mode text not null default 'whatsapp_livre'
    check (contact_mode in ('whatsapp_livre', 'pay_per_lead'));

-- Saldo de créditos pré-pagos por profissional. Preço por lead configurável
-- por linha para permitir promoções futuras sem migração nova; hoje sempre
-- criado com o preço padrão (R$2,90 = 290 centavos).
create table if not exists public.lead_credits (
  professional_id uuid primary key references public.professionals(id) on delete cascade,
  balance integer not null default 0,
  price_per_lead_cents integer not null default 290,
  updated_at timestamptz not null default now()
);

-- Um registro por clique no WhatsApp que consumiu (ou tentou consumir) um
-- crédito. `charged` fica true quando o crédito foi de fato debitado —
-- mantido para permitir, no futuro, registrar tentativas sem saldo.
create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  charged boolean not null default true
);

create index if not exists lead_events_professional_id_idx on public.lead_events (professional_id);

alter table public.lead_credits enable row level security;
alter table public.lead_events enable row level security;

-- lead_credits: só o dono do anúncio vê o próprio saldo. Não há insert/update
-- público — o saldo é criado/incrementado pela Edge Function de compra de
-- créditos (service_role) e decrementado pela função `consume_lead_credit`
-- abaixo (security definer, chamada via RPC pelo próprio dono do contato).
drop policy if exists "dono vê os créditos do seu anúncio" on public.lead_credits;
create policy "dono vê os créditos do seu anúncio"
  on public.lead_credits for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = lead_credits.professional_id
        and p.owner_id = auth.uid()
    )
  );

-- lead_events: só o dono do anúncio vê os próprios leads. Insert é feito
-- exclusivamente pela função `consume_lead_credit` (security definer), não
-- há policy pública de insert.
drop policy if exists "dono vê os leads do seu anúncio" on public.lead_events;
create policy "dono vê os leads do seu anúncio"
  on public.lead_events for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = lead_events.professional_id
        and p.owner_id = auth.uid()
    )
  );

-- Consome 1 crédito do profissional de forma atômica (evita condição de
-- corrida indo a saldo negativo com cliques concorrentes). Retorna true se
-- conseguiu debitar, false se não havia saldo (ou não existe registro de
-- créditos ainda). Chamada via RPC pelo client, autenticado ou anônimo,
-- antes de abrir o link do WhatsApp quando `contact_mode = 'pay_per_lead'`.
create or replace function public.consume_lead_credit(professional_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rows integer;
begin
  update public.lead_credits
    set balance = balance - 1, updated_at = now()
    where lead_credits.professional_id = consume_lead_credit.professional_id
      and balance > 0;

  get diagnostics updated_rows = row_count;

  if updated_rows > 0 then
    insert into public.lead_events (professional_id, user_id, charged)
    values (consume_lead_credit.professional_id, auth.uid(), true);
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.consume_lead_credit(uuid) to anon, authenticated;

-- Atualiza a view pública de professionals para incluir o novo contact_mode
-- (necessário para a ProfessionalPage decidir se mostra/esconde o botão de
-- WhatsApp sem precisar de outra query).
-- `create or replace view` só consegue ACRESCENTAR coluna no fim: inserir
-- `contact_mode` antes de `created_at` faria o Postgres tentar renomear a
-- coluna existente, e ele recusa. Por isso drop + create.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, city, bio, phone, entity_type,
  company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode, created_at
from public.professionals;

grant select on public.professionals_public to anon, authenticated;

-- Saldo de créditos pré-pagos é público-legível de forma restrita: a
-- ProfessionalPage precisa saber se há saldo > 0 para habilitar o botão de
-- WhatsApp, sem expor o saldo exato nem o preço por lead a qualquer um.
create or replace view public.lead_credits_public as
select professional_id, (balance > 0) as has_balance
from public.lead_credits;

grant select on public.lead_credits_public to anon, authenticated;


-- ───── 0015_patrocinio_categoria.sql ─────
-- Fonte de renda: banner de categoria patrocinada. Um profissional paga
-- para aparecer em destaque no topo da busca quando alguém filtra por uma
-- categoria (e cidade) específica, por um período determinado.

create table if not exists public.category_sponsorships (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  category text not null,
  city text not null default 'Itabirito',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  mercadopago_payment_id text,
  status text not null default 'pending' check (status in ('pending', 'active', 'expired')),
  created_at timestamptz not null default now()
);

create index if not exists category_sponsorships_lookup_idx
  on public.category_sponsorships (category, city, status, ends_at);

alter table public.category_sponsorships enable row level security;

-- Leitura pública só de patrocínios ativos e ainda dentro do período — é o
-- que a HomePage consulta para decidir se mostra o banner.
drop policy if exists "patrocínios ativos são públicos para leitura" on public.category_sponsorships;
create policy "patrocínios ativos são públicos para leitura"
  on public.category_sponsorships for select
  using (status = 'active' and ends_at > now());

-- Dono do anúncio vê todos os próprios patrocínios (inclusive
-- pending/expired, para o painel mostrar o histórico).
drop policy if exists "dono vê os próprios patrocínios" on public.category_sponsorships;
create policy "dono vê os próprios patrocínios"
  on public.category_sponsorships for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = category_sponsorships.professional_id
        and p.owner_id = auth.uid()
    )
  );

-- Dono inicia o patrocínio do próprio anúncio (fica "pending" até a
-- confirmação de pagamento, seguindo o mesmo padrão esqueleto do webhook).
drop policy if exists "dono cria patrocínio para o próprio anúncio" on public.category_sponsorships;
create policy "dono cria patrocínio para o próprio anúncio"
  on public.category_sponsorships for insert
  to authenticated
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = category_sponsorships.professional_id
        and p.owner_id = auth.uid()
    )
  );


-- ───── 0016_empresa_plus.sql ─────
-- Fonte de renda: plano "Empresa Plus" (assinatura recorrente adicional,
-- só disponível para entity_type = 'pj') que dá acesso a uma tela de
-- estatísticas do próprio anúncio (visualizações de perfil, leads,
-- avaliações). Mesmo padrão de expiração de verified/boosted.

alter table public.professionals
  add column if not exists plus_active boolean not null default false,
  add column if not exists plus_until timestamptz;

-- subscriptions.type só aceitava 'verification'/'boost' — amplia para o
-- novo tipo de assinatura recorrente do Plus.
alter table public.subscriptions drop constraint if exists subscriptions_type_check;
alter table public.subscriptions add constraint subscriptions_type_check check (type in ('verification', 'boost', 'plus'));

-- Contagem de visualizações de perfil, sem dados pessoais — só o registro
-- de "alguém abriu esta página" para alimentar o analytics do Plus.
create table if not exists public.profile_views (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists profile_views_professional_id_idx on public.profile_views (professional_id);

alter table public.profile_views enable row level security;

-- Só o dono do anúncio lê as próprias visualizações (é o dado que alimenta
-- a tela de analytics do Plus).
drop policy if exists "dono vê as visualizações do próprio anúncio" on public.profile_views;
create policy "dono vê as visualizações do próprio anúncio"
  on public.profile_views for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = profile_views.professional_id
        and p.owner_id = auth.uid()
    )
  );

-- Insert é público (qualquer visita à página do profissional gera o
-- registro, inclusive sem login) — é só uma contagem, sem vínculo com
-- usuário.
drop policy if exists "qualquer visita registra uma visualização" on public.profile_views;
create policy "qualquer visita registra uma visualização"
  on public.profile_views for insert
  with check (true);

-- Atualiza a view pública de professionals para incluir plus_active/
-- plus_until (o painel usa para decidir se mostra a tela de analytics).
-- Mesmo motivo da 0014: a lista de colunas muda no meio, então drop + create.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, city, bio, phone, entity_type,
  company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, created_at
from public.professionals;

grant select on public.professionals_public to anon, authenticated;


select 'PARTE 1 de 7 PRONTA' as resultado;
