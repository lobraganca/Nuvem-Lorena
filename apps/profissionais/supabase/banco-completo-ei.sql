-- Ei Itabirito — banco completo, para colar no SQL Editor do Supabase.
-- Cole UMA PARTE POR VEZ (elas estao marcadas abaixo). Um erro no meio
-- desfaz o bloco inteiro, entao parte por parte e mais seguro.


-- ═══════════════════════════════════════════════════════════
-- PARTE 1 de 13
-- ═══════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

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

create or replace view public.professional_ratings as
select
  professional_id,
  round(avg(rating)::numeric, 2) as average_rating,
  count(*) as review_count
from public.reviews
group by professional_id;

alter table public.profiles enable row level security;
alter table public.professionals enable row level security;
alter table public.reviews enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "profiles são públicos para leitura" on public.profiles;
create policy "profiles são públicos para leitura"
  on public.profiles for select
  using (true);

drop policy if exists "usuário edita o próprio profile" on public.profiles;
create policy "usuário edita o próprio profile"
  on public.profiles for update
  using (auth.uid() = id);

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

alter table public.profiles
  add column if not exists cpf text;

create unique index if not exists profiles_cpf_key
  on public.profiles (cpf)
  where cpf is not null;

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

alter table public.professionals
  add column if not exists entity_type text not null default 'pf' check (entity_type in ('pf', 'pj'));

alter table public.professionals
  add column if not exists document text;

alter table public.professionals
  add column if not exists company_name text;

alter table public.professionals
  add column if not exists photo_url text;

alter table public.professionals
  add column if not exists responsible_name text;

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

drop policy if exists "qualquer um pode denunciar um anúncio" on public.reports;
create policy "qualquer um pode denunciar um anúncio"
  on public.reports for insert
  with check (true);

create table if not exists public.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade
);

alter table public.admins enable row level security;

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

alter table public.professionals
  add column if not exists suspended boolean not null default false,
  add column if not exists suspended_reason text;

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

create table if not exists public.document_bans (
  document text primary key,
  reason text,
  banned_at timestamptz not null default now()
);

alter table public.document_bans enable row level security;

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

create or replace function public.check_document_banned(doc text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.document_bans where document = doc);
$$;

grant execute on function public.check_document_banned(text) to authenticated, anon;

alter table public.reviews
  add column if not exists reply text,
  add column if not exists replied_at timestamptz;

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
    if new.reply is distinct from old.reply or new.replied_at is distinct from old.replied_at then
      raise exception 'Autor da avaliação não pode alterar a resposta do profissional.';
    end if;
    new.professional_id := old.professional_id;
    new.user_id := old.user_id;
  elsif eh_dono then
    if new.rating is distinct from old.rating or new.comment is distinct from old.comment then
      raise exception 'Dono do anúncio não pode alterar nota ou comentário da avaliação.';
    end if;
    new.professional_id := old.professional_id;
    new.user_id := old.user_id;
    if new.reply is distinct from old.reply then
      new.replied_at := now();
    end if;
  else
    raise exception 'Sem permissão para atualizar esta avaliação.';
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_valida_campos_update_trigger on public.reviews;
create trigger reviews_valida_campos_update_trigger
  before update on public.reviews
  for each row execute function public.reviews_valida_campos_update();

-- ═══════════════════════════════════════════════════════════
-- PARTE 2 de 13
-- ═══════════════════════════════════════════════════════════

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, city, bio, phone, entity_type,
  company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, created_at
from public.professionals;

grant select on public.professionals_public to anon, authenticated;

create or replace view public.profiles_public as
select id, full_name, avatar_url, created_at
from public.profiles;

grant select on public.profiles_public to anon, authenticated;

drop policy if exists "profiles são públicos para leitura" on public.profiles;

drop policy if exists "usuário lê o próprio profile" on public.profiles;
create policy "usuário lê o próprio profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

alter table public.reports
  add column if not exists reporter_fingerprint text;

create unique index if not exists reports_reporter_professional_pending_uidx
  on public.reports (professional_id, reporter_id)
  where reporter_id is not null and status = 'pending';

alter table public.professionals
  add column if not exists contact_mode text not null default 'whatsapp_livre'
    check (contact_mode in ('whatsapp_livre', 'pay_per_lead'));

create table if not exists public.lead_credits (
  professional_id uuid primary key references public.professionals(id) on delete cascade,
  balance integer not null default 0,
  price_per_lead_cents integer not null default 290,
  updated_at timestamptz not null default now()
);

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

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, city, bio, phone, entity_type,
  company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode, created_at
from public.professionals;

grant select on public.professionals_public to anon, authenticated;

create or replace view public.lead_credits_public as
select professional_id, (balance > 0) as has_balance
from public.lead_credits;

grant select on public.lead_credits_public to anon, authenticated;

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

drop policy if exists "patrocínios ativos são públicos para leitura" on public.category_sponsorships;
create policy "patrocínios ativos são públicos para leitura"
  on public.category_sponsorships for select
  using (status = 'active' and ends_at > now());

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

alter table public.professionals
  add column if not exists plus_active boolean not null default false,
  add column if not exists plus_until timestamptz;

alter table public.subscriptions drop constraint if exists subscriptions_type_check;
alter table public.subscriptions add constraint subscriptions_type_check check (type in ('verification', 'boost', 'plus'));

create table if not exists public.profile_views (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists profile_views_professional_id_idx on public.profile_views (professional_id);

alter table public.profile_views enable row level security;

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

drop policy if exists "qualquer visita registra uma visualização" on public.profile_views;
create policy "qualquer visita registra uma visualização"
  on public.profile_views for insert
  with check (true);

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

alter table public.subscriptions
  add column if not exists billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'annual'));

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  message text not null,
  created_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'reviewed'))
);

alter table public.suggestions enable row level security;

drop policy if exists "qualquer um pode enviar uma sugestão" on public.suggestions;
create policy "qualquer um pode enviar uma sugestão"
  on public.suggestions for insert
  with check (true);

drop policy if exists "admin vê as sugestões" on public.suggestions;
create policy "admin vê as sugestões"
  on public.suggestions for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "admin atualiza o status da sugestão" on public.suggestions;
create policy "admin atualiza o status da sugestão"
  on public.suggestions for update
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

alter table public.subscriptions
  add column if not exists auto_renew boolean not null default true,
  add column if not exists renewal_notified_at timestamptz;

update public.subscriptions
  set auto_renew = false
  where billing_cycle = 'annual';

create index if not exists subscriptions_renovacao_idx
  on public.subscriptions (billing_cycle, auto_renew, status, current_period_end);

alter table public.reviews
  add column if not exists tags text[] not null default '{}';

alter table public.reviews
  drop constraint if exists reviews_tags_max;

alter table public.reviews
  add constraint reviews_tags_max
  check (coalesce(array_length(tags, 1), 0) <= 12);

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
    if new.reply is distinct from old.reply or new.replied_at is distinct from old.replied_at then
      raise exception 'Autor da avaliação não pode alterar a resposta do profissional.';
    end if;
    new.professional_id := old.professional_id;
    new.user_id := old.user_id;
  elsif eh_dono then
    if new.rating is distinct from old.rating
      or new.comment is distinct from old.comment
      or new.tags is distinct from old.tags then
      raise exception 'Dono do anúncio não pode alterar nota, comentário ou etiquetas da avaliação.';
    end if;
    new.professional_id := old.professional_id;
    new.user_id := old.user_id;
    if new.reply is distinct from old.reply then
      new.replied_at := now();
    end if;
  else
    raise exception 'Sem permissão para atualizar esta avaliação.';
  end if;

  return new;
end;
$$;

-- ═══════════════════════════════════════════════════════════
-- PARTE 3 de 13
-- ═══════════════════════════════════════════════════════════

create table if not exists public.processed_payments (
  payment_id text primary key,
  processed_at timestamptz not null default now()
);

alter table public.processed_payments enable row level security;

drop function if exists public.add_lead_credits(uuid, integer);
create function public.add_lead_credits(p_professional_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount deve ser positivo';
  end if;

  insert into public.lead_credits (professional_id, balance)
  values (p_professional_id, p_amount)
  on conflict (professional_id) do update
    set balance = public.lead_credits.balance + p_amount,
        updated_at = now();
end;
$$;

revoke execute on function public.add_lead_credits(uuid, integer) from anon, authenticated;

alter table public.professionals
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists instagram text,
  add column if not exists linkedin text;

update public.professionals
  set whatsapp = phone
  where whatsapp is null and coalesce(phone, '') <> '';

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  requester_id uuid references public.profiles (id) on delete set null,
  name text not null,
  phone text not null,
  message text not null default '',
  status text not null default 'new' check (status in ('new', 'contacted', 'archived')),
  created_at timestamptz not null default now(),
  contacted_at timestamptz
);

create index if not exists contact_requests_professional_idx
  on public.contact_requests (professional_id, status, created_at desc);

alter table public.contact_requests enable row level security;

drop policy if exists "qualquer pessoa pede contato" on public.contact_requests;
create policy "qualquer pessoa pede contato"
  on public.contact_requests for insert
  with check (true);

drop policy if exists "dono vê os pedidos do próprio anúncio" on public.contact_requests;
create policy "dono vê os pedidos do próprio anúncio"
  on public.contact_requests for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = contact_requests.professional_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "dono atualiza os pedidos do próprio anúncio" on public.contact_requests;
create policy "dono atualiza os pedidos do próprio anúncio"
  on public.contact_requests for update
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = contact_requests.professional_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = contact_requests.professional_id
        and p.owner_id = auth.uid()
    )
  );

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, created_at
from public.professionals
where suspended = false;

grant select on public.professionals_public to anon, authenticated;

alter table public.professionals
  add column if not exists categories text[] not null default '{}';

update public.professionals
  set categories = array[category]
  where categories = '{}' and coalesce(category, '') <> '';

create index if not exists professionals_categories_idx
  on public.professionals using gin (categories);

create or replace function public.sincroniza_categorias()
returns trigger
language plpgsql
as $$
begin
  if new.category is not null and new.category <> '' and not (new.category = any(new.categories)) then
    new.categories := array_prepend(new.category, new.categories);
  end if;
  return new;
end;
$$;

drop trigger if exists professionals_sincroniza_categorias on public.professionals;
create trigger professionals_sincroniza_categorias
  before insert or update on public.professionals
  for each row execute function public.sincroniza_categorias();

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, created_at
from public.professionals
where suspended = false;

grant select on public.professionals_public to anon, authenticated;

alter table public.professionals
  add column if not exists whatsapp_verified boolean not null default false,
  add column if not exists whatsapp_verified_at timestamptz;

create or replace function public.professionals_protege_whatsapp_verificado()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.whatsapp_verified := false;
    new.whatsapp_verified_at := null;
    return new;
  end if;

  if new.whatsapp_verified is distinct from old.whatsapp_verified
     or new.whatsapp_verified_at is distinct from old.whatsapp_verified_at then
    if coalesce(current_setting('app.confirmando_whatsapp', true), '') <> 'sim' then
      raise exception 'O WhatsApp verificado só pode ser alterado pela confirmação por código.';
    end if;
  end if;

  if new.whatsapp is distinct from old.whatsapp
     and coalesce(current_setting('app.confirmando_whatsapp', true), '') <> 'sim' then
    new.whatsapp_verified := false;
    new.whatsapp_verified_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists professionals_protege_whatsapp_verificado_trigger on public.professionals;
create trigger professionals_protege_whatsapp_verificado_trigger
  before insert or update on public.professionals
  for each row execute function public.professionals_protege_whatsapp_verificado();

create or replace function public.confirmar_whatsapp(p_professional_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_dono uuid;
  v_whatsapp text;
  v_auth_phone text;
  v_confirmado timestamptz;
  v_digitos_anuncio text;
  v_digitos_auth text;
begin
  select owner_id, coalesce(nullif(whatsapp, ''), phone)
    into v_dono, v_whatsapp
    from public.professionals
   where id = p_professional_id;

  if v_dono is null then
    raise exception 'Anúncio não encontrado.';
  end if;
  if v_dono <> auth.uid() then
    raise exception 'Só o dono do anúncio pode confirmar o WhatsApp dele.';
  end if;

  select phone, phone_confirmed_at
    into v_auth_phone, v_confirmado
    from auth.users
   where id = auth.uid();

  if v_confirmado is null then
    raise exception 'O número ainda não foi confirmado por código.';
  end if;

  v_digitos_anuncio := regexp_replace(coalesce(v_whatsapp, ''), '\D', '', 'g');
  v_digitos_auth := regexp_replace(coalesce(v_auth_phone, ''), '\D', '', 'g');
  v_digitos_anuncio := regexp_replace(v_digitos_anuncio, '^55', '');
  v_digitos_auth := regexp_replace(v_digitos_auth, '^55', '');

  if v_digitos_anuncio = '' or v_digitos_anuncio <> v_digitos_auth then
    raise exception 'O número confirmado é diferente do que está no anúncio.';
  end if;

  perform set_config('app.confirmando_whatsapp', 'sim', true);
  update public.professionals
     set whatsapp_verified = true,
         whatsapp_verified_at = now()
   where id = p_professional_id;
  perform set_config('app.confirmando_whatsapp', '', true);

  return true;
end;
$$;

revoke all on function public.confirmar_whatsapp(uuid) from public;
grant execute on function public.confirmar_whatsapp(uuid) to authenticated;

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, created_at
from public.professionals
where suspended = false;

grant select on public.professionals_public to anon, authenticated;

alter table public.professionals
  add column if not exists cep text,
  add column if not exists street text,
  add column if not exists street_number text,
  add column if not exists neighborhood text;

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  cep, street, street_number, neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, created_at
from public.professionals
where suspended = false;

grant select on public.professionals_public to anon, authenticated;

drop policy if exists "fotos de anuncio: leitura publica" on storage.objects;
create policy "fotos de anuncio: leitura publica"
  on storage.objects for select
  using (bucket_id = 'professional-photos');

drop policy if exists "fotos de anuncio: envio do dono" on storage.objects;
create policy "fotos de anuncio: envio do dono"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'professional-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "fotos de anuncio: troca do dono" on storage.objects;
create policy "fotos de anuncio: troca do dono"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'professional-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'professional-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "fotos de anuncio: exclusao do dono" on storage.objects;
create policy "fotos de anuncio: exclusao do dono"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'professional-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

alter table public.professionals
  add column if not exists paused boolean not null default false;

create or replace function public.professionals_protege_suspensao()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.suspended is distinct from old.suspended
     or new.suspended_reason is distinct from old.suspended_reason then
    if not exists (select 1 from public.admins a where a.user_id = auth.uid()) then
      raise exception 'Só a administração pode suspender ou reativar um anúncio.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists professionals_protege_suspensao_trigger on public.professionals;
create trigger professionals_protege_suspensao_trigger
  before update on public.professionals
  for each row execute function public.professionals_protege_suspensao();

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  cep, street, street_number, neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════
-- PARTE 4 de 13
-- ═══════════════════════════════════════════════════════════

create or replace function public.contact_requests_freia_abuso()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recentes int;
begin
  select count(*) into recentes
    from public.contact_requests
   where phone = new.phone
     and created_at > now() - interval '10 minutes';

  if recentes >= 5 then
    raise exception 'Muitos pedidos seguidos deste telefone. Espere alguns minutos.';
  end if;

  if exists (
    select 1 from public.contact_requests
     where professional_id = new.professional_id
       and phone = new.phone
       and created_at > now() - interval '2 minutes'
  ) then
    raise exception 'Você já enviou um pedido para este profissional agora há pouco.';
  end if;

  return new;
end;
$$;

drop trigger if exists contact_requests_freia_abuso_trigger on public.contact_requests;
create trigger contact_requests_freia_abuso_trigger
  before insert on public.contact_requests
  for each row execute function public.contact_requests_freia_abuso();

create or replace function public.suggestions_freia_abuso()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recentes int;
begin
  if new.user_id is not null then
    select count(*) into recentes
      from public.suggestions
     where user_id = new.user_id
       and created_at > now() - interval '1 hour';
    if recentes >= 3 then
      raise exception 'Você já enviou várias sugestões agora há pouco. Tente mais tarde.';
    end if;
  else
    select count(*) into recentes
      from public.suggestions
     where user_id is null
       and created_at > now() - interval '1 hour';
    if recentes >= 20 then
      raise exception 'Muitas sugestões recebidas agora. Tente mais tarde.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists suggestions_freia_abuso_trigger on public.suggestions;
create trigger suggestions_freia_abuso_trigger
  before insert on public.suggestions
  for each row execute function public.suggestions_freia_abuso();

alter table public.profile_views
  add column if not exists viewer_id uuid references auth.users(id) on delete set null;

create or replace function public.profile_views_freia_abuso()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null then
    if exists (
      select 1 from public.profile_views
       where professional_id = new.professional_id
         and viewer_id = auth.uid()
         and viewed_at > now() - interval '30 minutes'
    ) then
      return null;
    end if;
    new.viewer_id := auth.uid();
  end if;
  return new;
end;
$$;

create index if not exists profile_views_dedupe_idx
  on public.profile_views (professional_id, viewer_id, viewed_at desc);

drop trigger if exists profile_views_freia_abuso_trigger on public.profile_views;
create trigger profile_views_freia_abuso_trigger
  before insert on public.profile_views
  for each row execute function public.profile_views_freia_abuso();

create or replace function public.expurgar_dados_antigos()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.contact_requests where created_at < now() - interval '12 months';
  delete from public.profile_views where viewed_at < now() - interval '6 months';
end;
$$;

revoke all on function public.expurgar_dados_antigos() from public;

alter table public.professionals
  add column if not exists paused boolean not null default false;

create or replace function public.professionals_evita_repetidos()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  quantos int;
  conflito text;
begin
  select c into conflito
    from public.professionals p, unnest(p.categories) as c
   where p.owner_id = new.owner_id
     and p.id is distinct from new.id
     and lower(p.city) = lower(new.city)
     and c = any(new.categories)
   limit 1;

  if conflito is not null then
    raise exception 'Você já tem um anúncio de "%" em %. Edite o que existe em vez de criar outro igual.',
      conflito, new.city;
  end if;

  if tg_op = 'INSERT' then
    select count(*) into quantos from public.professionals where owner_id = new.owner_id;
    if quantos >= 5 then
      raise exception 'Você já tem 5 anúncios, que é o limite por conta.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists professionals_evita_repetidos_trigger on public.professionals;
create trigger professionals_evita_repetidos_trigger
  before insert or update on public.professionals
  for each row execute function public.professionals_evita_repetidos();

alter table public.processed_payments
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null;

create index if not exists processed_payments_subscription_idx
  on public.processed_payments (subscription_id, processed_at desc);

create table if not exists public.destaque_espera (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  category text not null,
  city text not null,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (professional_id, category, city)
);

alter table public.destaque_espera enable row level security;

drop policy if exists "dono entra na fila do proprio anuncio" on public.destaque_espera;
create policy "dono entra na fila do proprio anuncio"
  on public.destaque_espera for insert
  to authenticated
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "dono ve a propria fila" on public.destaque_espera;
create policy "dono ve a propria fila"
  on public.destaque_espera for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "dono sai da fila" on public.destaque_espera;
create policy "dono sai da fila"
  on public.destaque_espera for delete
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "admin ve toda a fila" on public.destaque_espera;
create policy "admin ve toda a fila"
  on public.destaque_espera for select
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create or replace function public.vagas_de_destaque(p_category text, p_city text)
returns int
language sql
security definer set search_path = public
stable
as $$
  select greatest(
    0,
    5 - (
      select count(*)
        from public.professionals p
       where lower(p.city) = lower(p_city)
         and p_category = any(p.categories)
         and p.suspended = false
         and p.paused = false
         and p.boosted = true
         and (p.boosted_until is null or p.boosted_until > now())
    )
  )::int
$$;

grant execute on function public.vagas_de_destaque(text, text) to authenticated, anon;

create table if not exists public.indicacoes (
  id uuid primary key default gen_random_uuid(),
  
  servico_buscado text,
  cidade text,
  
  nome_indicado text,
  contato_indicado text,
  mensagem text,
  
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'nova' check (status in ('nova','contatada','descartada')),
  created_at timestamptz not null default now()
);

alter table public.indicacoes enable row level security;

drop policy if exists "qualquer pessoa indica" on public.indicacoes;
create policy "qualquer pessoa indica"
  on public.indicacoes for insert
  with check (true);

drop policy if exists "so admin le indicacoes" on public.indicacoes;
create policy "so admin le indicacoes"
  on public.indicacoes for select
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "so admin atualiza indicacoes" on public.indicacoes;
create policy "so admin atualiza indicacoes"
  on public.indicacoes for update
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create index if not exists indicacoes_status_idx on public.indicacoes (status, created_at desc);

create or replace function public.indicacoes_freia_abuso()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recentes int;
begin
  select count(*) into recentes
    from public.indicacoes
   where created_at > now() - interval '1 hour'
     and (user_id is not distinct from new.user_id);
  if recentes >= 10 then
    raise exception 'Muitas indicações seguidas. Tente novamente mais tarde.';
  end if;
  return new;
end;
$$;

drop trigger if exists indicacoes_freia_abuso_trigger on public.indicacoes;
create trigger indicacoes_freia_abuso_trigger
  before insert on public.indicacoes
  for each row execute function public.indicacoes_freia_abuso();

create table if not exists public.contatos_registrados (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  
  tipo text not null,
  created_at timestamptz not null default now()
);

create index if not exists contatos_registrados_par_idx
  on public.contatos_registrados (professional_id, user_id);

alter table public.contatos_registrados enable row level security;

drop policy if exists "qualquer pessoa registra contato" on public.contatos_registrados;
create policy "qualquer pessoa registra contato"
  on public.contatos_registrados for insert
  with check (true);

drop policy if exists "dono ve os contatos do proprio anuncio" on public.contatos_registrados;
create policy "dono ve os contatos do proprio anuncio"
  on public.contatos_registrados for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.owner_id = auth.uid()
    )
  );

alter table public.reviews
  add column if not exists contato_confirmado boolean not null default false;

create or replace function public.reviews_marca_contato()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.contato_confirmado := exists (
    select 1 from public.contatos_registrados c
     where c.professional_id = new.professional_id
       and c.user_id = new.user_id
  );
  return new;
end;
$$;

drop trigger if exists reviews_marca_contato_trigger on public.reviews;
create trigger reviews_marca_contato_trigger
  before insert on public.reviews
  for each row execute function public.reviews_marca_contato();

comment on column public.profiles.cpf is
  'Legado: não é mais pedido para avaliar (ver migration 0033).';

alter table public.professionals
  add column if not exists atributos text[] not null default '{}';

alter table public.professionals
  drop constraint if exists professionals_atributos_limite;
alter table public.professionals
  add constraint professionals_atributos_limite
  check (array_length(atributos, 1) is null or array_length(atributos, 1) <= 8);

create index if not exists professionals_atributos_idx
  on public.professionals using gin (atributos);

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  cep, street, street_number, neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════
-- PARTE 5 de 13
-- ═══════════════════════════════════════════════════════════

drop policy if exists "qualquer um pode denunciar um anúncio" on public.reports;
drop policy if exists "quem está logado pode denunciar um anúncio" on public.reports;

create policy "quem está logado pode denunciar um anúncio"
  on public.reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

alter table public.professionals
  add column if not exists verified_since timestamptz;

update public.professionals
  set verified_since = created_at
  where verified = true and verified_since is null;

create or replace function public.professionals_carimba_selo()
returns trigger
language plpgsql
as $$
begin
  if new.verified = true and coalesce(old.verified, false) = false then
    new.verified_since := now();
  elsif new.verified = false then
    new.verified_since := null;
  end if;
  return new;
end;
$$;

drop trigger if exists professionals_carimba_selo_trigger on public.professionals;
create trigger professionals_carimba_selo_trigger
  before update on public.professionals
  for each row execute function public.professionals_carimba_selo();

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  cep, street, street_number, neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

alter table public.reviews
  add column if not exists contratou boolean not null default false;

comment on column public.reviews.contratou is
  'Declarado por quem avaliou: contratou de fato o serviço. Diferente de contato_confirmado, que é observado pelo app.';

alter table public.professionals
  add column if not exists mostrar_endereco boolean not null default false;

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

drop view if exists public.reviews_public;
create view public.reviews_public as
select
  r.id, r.professional_id, r.user_id, r.rating, r.tags, r.comment,
  r.contato_confirmado, r.contratou, r.reply, r.replied_at, r.created_at,
  p.full_name as autor_nome,
  p.avatar_url as autor_foto
from public.reviews r
left join public.profiles_public p on p.id = r.user_id;

grant select on public.reviews_public to anon, authenticated;

alter table if exists public.servicos_oferecidos
  drop column if exists preco_centavos;
alter table if exists public.servicos_oferecidos
  drop column if exists unidade;

create table if not exists public.servicos_oferecidos (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  nome text not null,
  descricao text not null default '',
  
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists servicos_oferecidos_anuncio_idx
  on public.servicos_oferecidos (professional_id, ordem);

alter table public.servicos_oferecidos enable row level security;

drop policy if exists "catalogo é público para leitura" on public.servicos_oferecidos;
create policy "catalogo é público para leitura"
  on public.servicos_oferecidos for select
  using (true);

drop policy if exists "dono edita o catálogo do próprio anúncio" on public.servicos_oferecidos;
create policy "dono edita o catálogo do próprio anúncio"
  on public.servicos_oferecidos for all
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.owner_id = auth.uid()
    )
  );

create or replace function public.limita_catalogo()
returns trigger
language plpgsql
as $$
declare
  quantos integer;
begin
  select count(*) into quantos
    from public.servicos_oferecidos
   where professional_id = new.professional_id;
  if quantos >= 40 then
    raise exception 'Cada anúncio pode ter até 40 serviços no catálogo.';
  end if;
  return new;
end;
$$;

drop trigger if exists limita_catalogo_trigger on public.servicos_oferecidos;
create trigger limita_catalogo_trigger
  before insert on public.servicos_oferecidos
  for each row execute function public.limita_catalogo();

alter table public.servicos_oferecidos
  drop constraint if exists servicos_oferecidos_nome_nao_vazio;
alter table public.servicos_oferecidos
  add constraint servicos_oferecidos_nome_nao_vazio
  check (length(btrim(nome)) between 2 and 80);

alter table public.professionals
  add column if not exists especialidade text;

alter table public.professionals
  drop constraint if exists professionals_especialidade_tamanho;
alter table public.professionals
  add constraint professionals_especialidade_tamanho
  check (especialidade is null or length(btrim(especialidade)) <= 60);

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════
-- PARTE 6 de 13
-- ═══════════════════════════════════════════════════════════

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),

  
  anunciante text not null,
  
  titulo text not null default '',
  imagem_url text not null,

  
  link text,

  
  cidade text,
  categoria text,

  inicio date not null default current_date,
  fim date not null,

  
  contato_anunciante text,
  valor_centavos integer check (valor_centavos is null or valor_centavos >= 0),
  pago boolean not null default false,
  observacao text,

  
  ativo boolean not null default true,

  
  exibicoes integer not null default 0,
  cliques integer not null default 0,

  created_at timestamptz not null default now()
);

alter table public.banners
  drop constraint if exists banners_periodo_valido;
alter table public.banners
  add constraint banners_periodo_valido check (fim >= inicio);

create index if not exists banners_ativos_idx
  on public.banners (ativo, inicio, fim);

alter table public.banners enable row level security;

drop policy if exists "banners no ar são públicos" on public.banners;
create policy "banners no ar são públicos"
  on public.banners for select
  using (ativo = true and current_date between inicio and fim);

drop policy if exists "admin vê todos os banners" on public.banners;
create policy "admin vê todos os banners"
  on public.banners for select
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "admin cria banner" on public.banners;
create policy "admin cria banner"
  on public.banners for insert
  to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "admin edita banner" on public.banners;
create policy "admin edita banner"
  on public.banners for update
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "admin apaga banner" on public.banners;
create policy "admin apaga banner"
  on public.banners for delete
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create or replace function public.banner_contar_exibicao(p_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.banners
     set exibicoes = exibicoes + 1
   where id = p_id and ativo = true and current_date between inicio and fim;
$$;

create or replace function public.banner_contar_clique(p_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.banners
     set cliques = cliques + 1
   where id = p_id and ativo = true and current_date between inicio and fim;
$$;

grant execute on function public.banner_contar_exibicao(uuid) to anon, authenticated;
grant execute on function public.banner_contar_clique(uuid) to anon, authenticated;

insert into storage.buckets (id, name, public)
  values ('banners', 'banners', true)
  on conflict (id) do nothing;

drop policy if exists "banners: leitura publica" on storage.objects;
create policy "banners: leitura publica"
  on storage.objects for select
  using (bucket_id = 'banners');

drop policy if exists "banners: envio do admin" on storage.objects;
create policy "banners: envio do admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'banners'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "banners: troca do admin" on storage.objects;
create policy "banners: troca do admin"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'banners'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "banners: remocao do admin" on storage.objects;
create policy "banners: remocao do admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'banners'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

create or replace function public.expurgar_dados_antigos()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.contact_requests where created_at < now() - interval '12 months';
  delete from public.profile_views where viewed_at < now() - interval '6 months';

  delete from public.subscriptions s
   where s.status = 'pending'
     and s.created_at < now() - interval '1 day'
     and not exists (
       select 1 from public.processed_payments p where p.subscription_id = s.id
     );
end;
$$;

revoke all on function public.expurgar_dados_antigos() from public;

create or replace function public.contagem_de_visitas()
returns bigint
language sql
security definer set search_path = public
as $$
  select count(*) from public.profile_views;
$$;

grant execute on function public.contagem_de_visitas() to anon, authenticated;

alter table public.banners
  add column if not exists local text not null default 'busca'
    check (local in ('busca', 'boas_vindas'));

create index if not exists banners_local_idx on public.banners (local, ativo, inicio, fim);

create table if not exists public.banner_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  nome text not null,
  contato text not null,
  local text not null default 'tanto_faz'
    check (local in ('busca', 'boas_vindas', 'tanto_faz')),
  cidade text,
  mensagem text,
  status text not null default 'novo'
    check (status in ('novo', 'em_conversa', 'fechado', 'sem_interesse')),
  created_at timestamptz not null default now()
);

alter table public.banner_leads enable row level security;

drop policy if exists "qualquer um pede para anunciar" on public.banner_leads;
create policy "qualquer um pede para anunciar"
  on public.banner_leads for insert
  with check (true);

drop policy if exists "admin vê os pedidos de anúncio" on public.banner_leads;
create policy "admin vê os pedidos de anúncio"
  on public.banner_leads for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "admin atualiza o pedido de anúncio" on public.banner_leads;
create policy "admin atualiza o pedido de anúncio"
  on public.banner_leads for update
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "admin apaga o pedido de anúncio" on public.banner_leads;
create policy "admin apaga o pedido de anúncio"
  on public.banner_leads for delete
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

create index if not exists banner_leads_status_idx
  on public.banner_leads (status, created_at desc);

create or replace function public.tem_telefone_confirmado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and u.phone_confirmed_at is not null
  );
$$;

revoke all on function public.tem_telefone_confirmado() from public;
grant execute on function public.tem_telefone_confirmado() to authenticated;

drop policy if exists "quem está logado pode denunciar um anúncio" on public.reports;
drop policy if exists "só quem confirmou o número pode denunciar" on public.reports;
drop policy if exists so_quem_confirmou_o_numero_pode_denunciar on public.reports;

create policy so_quem_confirmou_o_numero_pode_denunciar
  on public.reports for insert
  to authenticated
  with check (
    reporter_id = auth.uid()
    and public.tem_telefone_confirmado()
  );

drop policy if exists "cada um enxerga se é admin" on public.admins;
drop policy if exists cada_um_enxerga_se_e_admin on public.admins;
create policy cada_um_enxerga_se_e_admin
  on public.admins for select
  to authenticated
  using (user_id = auth.uid());

grant select on public.admins to authenticated;

alter table public.processed_payments
  add column if not exists valor_centavos integer,
  add column if not exists tipo text;

create index if not exists processed_payments_data_idx
  on public.processed_payments (processed_at desc);

drop policy if exists "admin vê os pagamentos" on public.processed_payments;
drop policy if exists admin_ve_os_pagamentos on public.processed_payments;
create policy admin_ve_os_pagamentos
  on public.processed_payments for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

grant select on public.processed_payments to authenticated;

drop policy if exists "admin vê todas as assinaturas" on public.subscriptions;
drop policy if exists admin_ve_todas_as_assinaturas on public.subscriptions;
create policy admin_ve_todas_as_assinaturas
  on public.subscriptions for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════
-- PARTE 7 de 13
-- ═══════════════════════════════════════════════════════════

create table if not exists public.visitas_app (
  id bigint generated always as identity primary key,
  criada_em timestamptz not null default now()
);

create index if not exists visitas_app_data_idx on public.visitas_app (criada_em desc);

alter table public.visitas_app enable row level security;

drop policy if exists "qualquer um registra a visita" on public.visitas_app;
drop policy if exists qualquer_um_registra_a_visita on public.visitas_app;
create policy qualquer_um_registra_a_visita
  on public.visitas_app for insert
  with check (true);

create or replace function public.contagem_de_visitas_no_app()
returns bigint
language sql
security definer set search_path = public
as $$
  select count(*) from public.visitas_app;
$$;

grant execute on function public.contagem_de_visitas_no_app() to anon, authenticated;
grant insert on public.visitas_app to anon, authenticated;
grant usage, select on sequence public.visitas_app_id_seq to anon, authenticated;

drop policy if exists "admin vê as visitas" on public.visitas_app;
drop policy if exists admin_ve_as_visitas on public.visitas_app;
create policy admin_ve_as_visitas
  on public.visitas_app for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

grant select on public.visitas_app to authenticated;

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  case when mostrar_endereco then neighborhood end as neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  mostrar_endereco, created_at
from public.professionals;

grant select on public.professionals_public to anon, authenticated;

create or replace function public.contagem_de_visitas_no_app_hoje()
returns bigint
language sql
security definer set search_path = public
as $$
  select count(*) from public.visitas_app
  where criada_em >= (date_trunc('day', now() at time zone 'America/Sao_Paulo')
                      at time zone 'America/Sao_Paulo');
$$;

grant execute on function public.contagem_de_visitas_no_app_hoje() to anon, authenticated;

create or replace function public.professionals_protege_whatsapp_verificado()
returns trigger
language plpgsql
as $$
declare
  v_numero_antes text;
  v_numero_depois text;
begin
  if tg_op = 'INSERT' then
    new.whatsapp_verified := false;
    new.whatsapp_verified_at := null;
    return new;
  end if;

  if new.whatsapp_verified is distinct from old.whatsapp_verified
     or new.whatsapp_verified_at is distinct from old.whatsapp_verified_at then
    if coalesce(current_setting('app.confirmando_whatsapp', true), '') <> 'sim' then
      raise exception 'O WhatsApp verificado só pode ser alterado pela confirmação por código.';
    end if;
  end if;

  v_numero_antes := regexp_replace(
    coalesce(nullif(old.whatsapp, ''), old.phone, ''), '\D', '', 'g');
  v_numero_depois := regexp_replace(
    coalesce(nullif(new.whatsapp, ''), new.phone, ''), '\D', '', 'g');

  if v_numero_depois is distinct from v_numero_antes
     and coalesce(current_setting('app.confirmando_whatsapp', true), '') <> 'sim' then
    new.whatsapp_verified := false;
    new.whatsapp_verified_at := null;
  end if;

  return new;
end;
$$;

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  case when mostrar_endereco then neighborhood end as neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

drop policy if exists "usuário autenticado com CPF avalia" on public.reviews;
drop policy if exists "usuário autenticado avalia" on public.reviews;

create policy "usuário autenticado avalia"
  on public.reviews for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "qualquer pessoa registra contato" on public.contatos_registrados;
create policy "qualquer pessoa registra contato"
  on public.contatos_registrados for insert
  with check (user_id is null or auth.uid() = user_id);

drop trigger if exists reviews_marca_contato_trigger on public.reviews;
create trigger reviews_marca_contato_trigger
  before insert or update on public.reviews
  for each row execute function public.reviews_marca_contato();

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
    if new.reply is distinct from old.reply or new.replied_at is distinct from old.replied_at then
      raise exception 'Autor da avaliação não pode alterar a resposta do profissional.';
    end if;
    new.professional_id := old.professional_id;
    new.user_id := old.user_id;
  elsif eh_dono then
    if new.rating is distinct from old.rating
      or new.comment is distinct from old.comment
      or new.tags is distinct from old.tags
      or new.contratou is distinct from old.contratou then
      raise exception 'Dono do anúncio não pode alterar nota, comentário, etiquetas ou a declaração de contratação.';
    end if;
    new.professional_id := old.professional_id;
    new.user_id := old.user_id;
    if new.reply is distinct from old.reply then
      new.replied_at := now();
    end if;
  else
    raise exception 'Sem permissão para atualizar esta avaliação.';
  end if;

  return new;
end;
$$;

revoke select on public.profiles_public from anon, authenticated;

comment on view public.profiles_public is
  'Uso interno: alimenta reviews_public (que roda com direitos da dona). Não conceder select a anon/authenticated — sem where, a view devolve todas as contas.';

-- ═══════════════════════════════════════════════════════════
-- PARTE 8 de 13
-- ═══════════════════════════════════════════════════════════

create or replace function public.telefone_digitos(bruto text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when length(so_numeros) in (12, 13) and left(so_numeros, 2) = '55'
      then substr(so_numeros, 3)
    else so_numeros
  end
  from (select regexp_replace(coalesce(bruto, ''), '\D', '', 'g') as so_numeros) t;
$$;

create index if not exists contact_requests_telefone_idx
  on public.contact_requests ((public.telefone_digitos(phone)), created_at desc);

create index if not exists contact_requests_recentes_idx
  on public.contact_requests (professional_id, created_at desc);

create or replace function public.contact_requests_freia_abuso()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  digitos text;
  recentes int;
  no_anuncio int;
begin
  digitos := public.telefone_digitos(new.phone);

  if digitos <> '' then
    select count(*) into recentes
      from public.contact_requests
     where public.telefone_digitos(phone) = digitos
       and created_at > now() - interval '10 minutes';

    if recentes >= 5 then
      raise exception 'Muitos pedidos seguidos deste telefone. Espere alguns minutos.';
    end if;

    if exists (
      select 1 from public.contact_requests
       where professional_id = new.professional_id
         and public.telefone_digitos(phone) = digitos
         and created_at > now() - interval '2 minutes'
    ) then
      raise exception 'Você já enviou um pedido para este profissional agora há pouco.';
    end if;
  end if;

  select count(*) into no_anuncio
    from public.contact_requests
   where professional_id = new.professional_id
     and created_at > now() - interval '1 hour';

  if no_anuncio >= 40 then
    raise exception 'Este profissional recebeu muitos pedidos agora há pouco. Tente de novo em alguns minutos ou chame direto no WhatsApp.';
  end if;

  return new;
end;
$$;

drop policy if exists "fotos de anuncio: envio do admin" on storage.objects;
create policy "fotos de anuncio: envio do admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'professional-photos'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "fotos de anuncio: troca do admin" on storage.objects;
create policy "fotos de anuncio: troca do admin"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'professional-photos'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  )
  with check (
    bucket_id = 'professional-photos'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

create or replace function public.mais_vistos(dias int default 7, quantos int default 12)
returns table (professional_id uuid)
language sql
stable
security definer set search_path = public
as $$
  select v.professional_id
    from public.profile_views v
    join public.professionals_public p on p.id = v.professional_id
   where v.viewed_at > now() - make_interval(days => dias)
   group by v.professional_id
  having count(*) >= 3
   order by count(*) desc, v.professional_id
   limit quantos;
$$;

grant execute on function public.mais_vistos(int, int) to anon, authenticated;

create index if not exists profile_views_recentes_idx
  on public.profile_views (viewed_at desc, professional_id);

alter table public.professionals
  add column if not exists uf text not null default 'MG';

alter table public.professionals
  alter column uf drop default;

alter table public.professionals
  drop constraint if exists professionals_uf_valida;
alter table public.professionals
  add constraint professionals_uf_valida check (uf in (
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
    'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
  ));

create index if not exists professionals_cidade_estado_idx
  on public.professionals (uf, city);

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, uf, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  case when mostrar_endereco then neighborhood end as neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

comment on column public.professionals.uf is
  'Sigla do estado, sempre em maiúsculas. Vem junto com a cidade — separá-las faz "Bom Jesus" de estados diferentes virarem a mesma busca.';

alter role anon set pgrst.db_max_rows = '200';
alter role authenticated set pgrst.db_max_rows = '200';

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, uf, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  case when mostrar_endereco then neighborhood end as neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

alter table public.profiles drop column if exists cpf;

select
  case when (select count(*) from pg_attribute
              where attrelid = 'public.profiles'::regclass
                and attname = 'cpf' and not attisdropped) = 0
       and (select count(*) from pg_attribute
              where attrelid = 'public.professionals_public'::regclass
                and attname = 'suspended_reason' and not attisdropped) = 0
       and (select count(*) from pg_attribute
              where attrelid = 'public.professionals_public'::regclass
                and attname = 'uf' and not attisdropped) = 1
  then 'PRONTO — teto de linhas, cpf apagado, motivo da suspensao fora da lista'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;

update public.profiles p
   set email = coalesce(p.email, u.email),
       phone = coalesce(p.phone, u.phone)
  from auth.users u
 where u.id = p.id
   and (p.email is null or p.phone is null);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    new.email,
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.profiles'::regclass
           and attname in ('email','phone') and not attisdropped) = 2
  then 'PRONTO — o perfil ja tem e-mail e telefone'
  else 'AINDA FALTA — as colunas nao foram criadas'
  end as resultado;

create table if not exists public.user_onboarding (
  user_id uuid primary key references auth.users on delete cascade,
  user_type text not null check (user_type in ('professional', 'company')),
  completed boolean default false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.user_onboarding enable row level security;

drop policy if exists "Usuário lê seu próprio onboarding" on public.user_onboarding;
create policy "Usuário lê seu próprio onboarding" on public.user_onboarding
  for select using (auth.uid() = user_id);

drop policy if exists "Usuário escreve seu próprio onboarding" on public.user_onboarding;
create policy "Usuário escreve seu próprio onboarding" on public.user_onboarding
  for insert with check (auth.uid() = user_id);

drop policy if exists "Usuário atualiza seu próprio onboarding" on public.user_onboarding;
create policy "Usuário atualiza seu próprio onboarding" on public.user_onboarding
  for update using (auth.uid() = user_id);

create index if not exists idx_user_onboarding_type on public.user_onboarding(user_id, user_type);

create or replace function update_user_onboarding_timestamp()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger update_user_onboarding_timestamp_trigger
  before update on public.user_onboarding
  for each row
  execute function update_user_onboarding_timestamp();

select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.user_onboarding'::regclass
           and attname in ('user_id', 'user_type', 'completed', 'completed_at')
           and not attisdropped) = 4
  then 'PRONTO — user_onboarding foi criada com todas as colunas'
  else 'AINDA FALTA — as colunas nao foram criadas'
  end as resultado;

-- ═══════════════════════════════════════════════════════════
-- PARTE 9 de 13
-- ═══════════════════════════════════════════════════════════

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users on delete cascade,
  company_name text not null,
  cnpj text,
  city text not null,
  uf text,
  neighborhood text,
  address text,
  phone text not null,
  email text,
  website text,
  photo_url text,
  responsible_name text not null,
  description text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.companies enable row level security;

drop policy if exists "Empresa lê seu próprio cadastro" on public.companies;
create policy "Empresa lê seu próprio cadastro" on public.companies
  for select using (auth.uid() = owner_id);

drop policy if exists "Empresa escreve seu próprio cadastro" on public.companies;
create policy "Empresa escreve seu próprio cadastro" on public.companies
  for insert with check (auth.uid() = owner_id);

drop policy if exists "Empresa atualiza seu próprio cadastro" on public.companies;
create policy "Empresa atualiza seu próprio cadastro" on public.companies
  for update using (auth.uid() = owner_id);

create index if not exists idx_companies_owner on public.companies(owner_id);

create index if not exists idx_companies_city on public.companies(city);

create or replace function update_companies_timestamp()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger update_companies_timestamp_trigger
  before update on public.companies
  for each row
  execute function update_companies_timestamp();

select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.companies'::regclass
           and attname in ('id', 'owner_id', 'company_name', 'cnpj', 'city', 'uf',
                          'neighborhood', 'address', 'phone', 'email', 'website',
                          'photo_url', 'responsible_name', 'description', 'created_at', 'updated_at')
           and not attisdropped) = 16
  then 'PRONTO — companies foi criada com todas as colunas'
  else 'AINDA FALTA — as colunas nao foram criadas'
  end as resultado;

create table if not exists public.job_listings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  title text not null,
  profession text not null,
  specialty text,
  description text not null,
  required_experience text,
  skills text[],
  work_modality text not null check (work_modality in ('presencial', 'remoto', 'hibrido')),
  available_immediately boolean default false,
  salary_range_min numeric,
  salary_range_max numeric,
  city text not null,
  uf text,
  neighborhood text,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamp with time zone default now(),
  closed_at timestamp with time zone,
  updated_at timestamp with time zone default now()
);

alter table public.job_listings enable row level security;

drop policy if exists "Qualquer um lê vaga ativa" on public.job_listings;
create policy "Qualquer um lê vaga ativa" on public.job_listings
  for select using (status = 'active' or auth.uid() = (select owner_id from public.companies where id = company_id));

drop policy if exists "Empresa escreve vaga própria" on public.job_listings;
create policy "Empresa escreve vaga própria" on public.job_listings
  for insert with check (auth.uid() = (select owner_id from public.companies where id = company_id));

drop policy if exists "Empresa atualiza vaga própria" on public.job_listings;
create policy "Empresa atualiza vaga própria" on public.job_listings
  for update using (auth.uid() = (select owner_id from public.companies where id = company_id));

create index if not exists idx_job_listings_company on public.job_listings(company_id);
create index if not exists idx_job_listings_status on public.job_listings(status);
create index if not exists idx_job_listings_city on public.job_listings(city);
create index if not exists idx_job_listings_profession on public.job_listings(profession);
create index if not exists idx_job_listings_created on public.job_listings(created_at desc);

create or replace function update_job_listings_timestamp()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger update_job_listings_timestamp_trigger
  before update on public.job_listings
  for each row
  execute function update_job_listings_timestamp();

select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.job_listings'::regclass
           and attname in ('id', 'company_id', 'title', 'profession', 'specialty',
                          'description', 'required_experience', 'skills', 'work_modality',
                          'available_immediately', 'salary_range_min', 'salary_range_max',
                          'city', 'uf', 'neighborhood', 'status',
                          'created_at', 'closed_at', 'updated_at')
           and not attisdropped) = 19
  then 'PRONTO — job_listings foi criada com todas as colunas'
  else 'AINDA FALTA — as colunas nao foram criadas'
  end as resultado;

create table if not exists public.job_dispatches (
  id uuid primary key default gen_random_uuid(),
  job_listing_id uuid not null references public.job_listings on delete cascade,
  wave integer not null check (wave in (1, 2, 3)),
  professionals_count integer default 0,
  sent_at timestamp with time zone default now(),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (job_listing_id, wave)
);

alter table public.job_dispatches enable row level security;

drop policy if exists "Lê ondas de suas vagas" on public.job_dispatches;
create policy "Lê ondas de suas vagas" on public.job_dispatches
  for select using (
    exists (
      select 1 from public.job_listings
      where id = job_listing_id
        and company_id = (select id from public.companies where owner_id = auth.uid())
    )
  );

drop policy if exists "Insere ondas em suas vagas" on public.job_dispatches;
create policy "Insere ondas em suas vagas" on public.job_dispatches
  for insert with check (
    exists (
      select 1 from public.job_listings
      where id = job_listing_id
        and company_id = (select id from public.companies where owner_id = auth.uid())
    )
  );

drop policy if exists "Atualiza ondas de suas vagas" on public.job_dispatches;
create policy "Atualiza ondas de suas vagas" on public.job_dispatches
  for update using (
    exists (
      select 1 from public.job_listings
      where id = job_listing_id
        and company_id = (select id from public.companies where owner_id = auth.uid())
    )
  );

create index if not exists idx_job_dispatches_job on public.job_dispatches(job_listing_id);
create index if not exists idx_job_dispatches_wave on public.job_dispatches(job_listing_id, wave);
create index if not exists idx_job_dispatches_sent on public.job_dispatches(sent_at desc);

create or replace function update_job_dispatches_timestamp()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger update_job_dispatches_timestamp_trigger
  before update on public.job_dispatches
  for each row
  execute function update_job_dispatches_timestamp();

select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.job_dispatches'::regclass
           and attname in ('id', 'job_listing_id', 'wave', 'professionals_count',
                          'sent_at', 'status', 'created_at', 'updated_at')
           and not attisdropped) = 8
  then 'PRONTO — job_dispatches foi criada com todas as colunas'
  else 'AINDA FALTA — as colunas nao foram criadas'
  end as resultado;

create table if not exists public.job_responses (
  id uuid primary key default gen_random_uuid(),
  job_listing_id uuid not null references public.job_listings on delete cascade,
  professional_id uuid not null references auth.users on delete cascade,
  responded_at timestamp with time zone default now(),
  status text not null default 'new' check (status in ('new', 'read', 'accepted', 'rejected')),
  company_notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (job_listing_id, professional_id)
);

alter table public.job_responses enable row level security;

drop policy if exists "Profissional lê suas respostas" on public.job_responses;
create policy "Profissional lê suas respostas" on public.job_responses
  for select using (auth.uid() = professional_id or
    exists (
      select 1 from public.job_listings
      where id = job_listing_id
        and company_id = (select id from public.companies where owner_id = auth.uid())
    )
  );

drop policy if exists "Profissional insere resposta" on public.job_responses;
create policy "Profissional insere resposta" on public.job_responses
  for insert with check (auth.uid() = professional_id);

drop policy if exists "Empresa atualiza status da resposta" on public.job_responses;
create policy "Empresa atualiza status da resposta" on public.job_responses
  for update using (
    exists (
      select 1 from public.job_listings
      where id = job_listing_id
        and company_id = (select id from public.companies where owner_id = auth.uid())
    )
  );

create index if not exists idx_job_responses_job on public.job_responses(job_listing_id);
create index if not exists idx_job_responses_professional on public.job_responses(professional_id);
create index if not exists idx_job_responses_status on public.job_responses(status);
create index if not exists idx_job_responses_responded on public.job_responses(responded_at desc);

create or replace function update_job_responses_timestamp()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger update_job_responses_timestamp_trigger
  before update on public.job_responses
  for each row
  execute function update_job_responses_timestamp();

select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.job_responses'::regclass
           and attname in ('id', 'job_listing_id', 'professional_id', 'responded_at',
                          'status', 'company_notes', 'created_at', 'updated_at')
           and not attisdropped) = 8
  then 'PRONTO — job_responses foi criada com todas as colunas'
  else 'AINDA FALTA — as colunas nao foram criadas'
  end as resultado;

alter table public.professionals
  add column if not exists areas_de_interesse text[] not null default '{}';

create table if not exists public.professional_experiences (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals on delete cascade,
  cargo text not null,
  onde text,
  periodo text,
  ordem integer not null default 0,
  created_at timestamp with time zone default now()
);

create index if not exists idx_experiences_professional
  on public.professional_experiences(professional_id, ordem);

alter table public.professional_experiences enable row level security;

drop policy if exists "Qualquer um lê experiência" on public.professional_experiences;
create policy "Qualquer um lê experiência" on public.professional_experiences
  for select using (true);

drop policy if exists "Dono escreve sua experiência" on public.professional_experiences;
create policy "Dono escreve sua experiência" on public.professional_experiences
  for insert with check (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

drop policy if exists "Dono atualiza sua experiência" on public.professional_experiences;
create policy "Dono atualiza sua experiência" on public.professional_experiences
  for update using (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

drop policy if exists "Dono apaga sua experiência" on public.professional_experiences;
create policy "Dono apaga sua experiência" on public.professional_experiences
  for delete using (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, uf, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  case when mostrar_endereco then neighborhood end as neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  areas_de_interesse,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.professionals'::regclass
           and attname = 'areas_de_interesse' and not attisdropped) = 1
   and (select count(*) from pg_attribute
         where attrelid = 'public.professionals_public'::regclass
           and attname = 'areas_de_interesse' and not attisdropped) = 1
   and (select count(*) from pg_class
         where relname = 'professional_experiences' and relkind = 'r') = 1
   and (select pg_get_viewdef('public.professionals_public'::regclass)) like '%paused%'
  then 'PRONTO — onde quero trabalhar, experiencias, e a view com o filtro no lugar'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;

-- ═══════════════════════════════════════════════════════════
-- PARTE 10 de 13
-- ═══════════════════════════════════════════════════════════

alter table public.companies
  add column if not exists phone_verified boolean not null default false;
alter table public.companies
  add column if not exists phone_verified_at timestamp with time zone;

create or replace function public.companies_protege_telefone_confirmado()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.phone_verified := false;
    new.phone_verified_at := null;
    return new;
  end if;

  if new.phone_verified is distinct from old.phone_verified
     or new.phone_verified_at is distinct from old.phone_verified_at then
    
    if coalesce(current_setting('app.confirmando_telefone_empresa', true), '') <> 'sim' then
      raise exception 'O telefone confirmado só pode ser alterado pela confirmação por código.';
    end if;
  end if;

  
  if regexp_replace(coalesce(new.phone, ''), '\D', '', 'g')
     is distinct from regexp_replace(coalesce(old.phone, ''), '\D', '', 'g') then
    new.phone_verified := false;
    new.phone_verified_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists companies_protege_telefone_confirmado_trigger on public.companies;
create trigger companies_protege_telefone_confirmado_trigger
  before insert or update on public.companies
  for each row execute function public.companies_protege_telefone_confirmado();

create or replace function public.confirmar_telefone_empresa(p_company_id uuid)
returns boolean
language plpgsql
security definer set search_path = public, pg_catalog
as $$
declare
  v_dono uuid;
  v_phone text;
  v_auth_phone text;
  v_confirmado timestamptz;
  v_digitos_empresa text;
  v_digitos_auth text;
begin
  select owner_id, phone into v_dono, v_phone
    from public.companies where id = p_company_id;

  if v_dono is null then
    raise exception 'Empresa não encontrada.';
  end if;
  if v_dono <> auth.uid() then
    raise exception 'Só o dono da empresa pode confirmar o telefone dela.';
  end if;

  select phone, phone_confirmed_at into v_auth_phone, v_confirmado
    from auth.users where id = auth.uid();

  if v_confirmado is null then
    raise exception 'O número ainda não foi confirmado por código.';
  end if;

  v_digitos_empresa := regexp_replace(regexp_replace(coalesce(v_phone, ''), '\D', '', 'g'), '^55', '');
  v_digitos_auth := regexp_replace(regexp_replace(coalesce(v_auth_phone, ''), '\D', '', 'g'), '^55', '');

  if v_digitos_empresa = '' or v_digitos_empresa <> v_digitos_auth then
    raise exception 'O número confirmado é diferente do que está no cadastro da empresa.';
  end if;

  
  perform set_config('app.confirmando_telefone_empresa', 'sim', true);

  update public.companies
     set phone_verified = true, phone_verified_at = now()
   where id = p_company_id;

  perform set_config('app.confirmando_telefone_empresa', '', true);

  return true;
end;
$$;

alter table public.job_listings
  add column if not exists anunciada_ate timestamp with time zone;

drop policy if exists "Empresa escreve vaga própria" on public.job_listings;
drop policy if exists "Empresa escreve vaga própria" on public.job_listings;
create policy "Empresa escreve vaga própria" on public.job_listings
  for insert with check (
    exists (
      select 1 from public.companies c
       where c.id = company_id
         and c.owner_id = auth.uid()
         and c.phone_verified
    )
  );

create index if not exists idx_job_listings_anunciadas
  on public.job_listings (anunciada_ate)
  where anunciada_ate is not null;

create or replace function public.vagas_disparadas_no_mes(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select count(distinct v.id)::integer
    from public.job_listings v
    join public.job_dispatches d on d.job_listing_id = v.id
   where v.company_id = p_company_id
     and d.sent_at >= date_trunc('month', now());
$$;

select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.companies'::regclass
           and attname in ('phone_verified','phone_verified_at') and not attisdropped) = 2
   and (select count(*) from pg_attribute
         where attrelid = 'public.job_listings'::regclass
           and attname = 'anunciada_ate' and not attisdropped) = 1
   and (select count(*) from pg_proc
         where proname = 'confirmar_telefone_empresa') = 1
   and (select count(*) from pg_proc
         where proname = 'vagas_disparadas_no_mes') = 1
  then 'PRONTO — empresa confirma telefone, vaga pode ser anunciada, cota do mes conta sozinha'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;

alter table public.companies
  add column if not exists plano text
    check (plano is null or plano in ('pro', 'tres', 'ilimitado'));
alter table public.companies
  add column if not exists plano_ate timestamp with time zone;
alter table public.companies
  add column if not exists plano_recorrente boolean not null default false;

create or replace function public.limite_de_vagas_do_plano(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select case
           when c.plano_ate is null or c.plano_ate < now() then 0
           when c.plano = 'pro' then 1
           when c.plano = 'tres' then 3
           when c.plano = 'ilimitado' then -1   -- -1 = sem teto
           else 0
         end
    from public.companies c
   where c.id = p_company_id;
$$;

create or replace function public.vagas_anunciadas_agora(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select count(*)::integer
    from public.job_listings v
   where v.company_id = p_company_id
     and v.anunciada_ate is not null
     and v.anunciada_ate > now();
$$;

create or replace function public.job_listings_respeita_plano()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_limite integer;
  v_agora integer;
begin
  if new.anunciada_ate is null or new.anunciada_ate <= now() then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.anunciada_ate is not distinct from new.anunciada_ate then
    return new;
  end if;

  v_limite := public.limite_de_vagas_do_plano(new.company_id);

  if v_limite = 0 then
    raise exception 'Esta empresa não tem plano ativo para anunciar vagas.';
  end if;

  if v_limite > 0 then
    select public.vagas_anunciadas_agora(new.company_id) into v_agora;
    if tg_op = 'UPDATE' and old.anunciada_ate is not null and old.anunciada_ate > now() then
      v_agora := v_agora - 1;
    end if;

    if v_agora >= v_limite then
      raise exception 'O plano desta empresa permite % vaga(s) anunciada(s) por vez.', v_limite;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists job_listings_respeita_plano_trigger on public.job_listings;
create trigger job_listings_respeita_plano_trigger
  before insert or update on public.job_listings
  for each row execute function public.job_listings_respeita_plano();

create or replace function public.job_dispatches_teto_por_vaga()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_abertas integer;
begin
  select count(*) into v_abertas
    from public.job_dispatches
   where job_listing_id = new.job_listing_id;

  if v_abertas >= 2 then
    raise exception 'Cada vaga tem direito a 2 ondas de disparo.';
  end if;

  return new;
end;
$$;

drop trigger if exists job_dispatches_teto_por_vaga_trigger on public.job_dispatches;
create trigger job_dispatches_teto_por_vaga_trigger
  before insert on public.job_dispatches
  for each row execute function public.job_dispatches_teto_por_vaga();

comment on function public.vagas_disparadas_no_mes(uuid) is
  'Sem uso desde a 0072: o teto passou a ser de 2 ondas POR VAGA, não por mês.';

select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.companies'::regclass
           and attname in ('plano','plano_ate','plano_recorrente') and not attisdropped) = 3
   and (select count(*) from pg_proc where proname = 'limite_de_vagas_do_plano') = 1
   and (select count(*) from pg_proc where proname = 'vagas_anunciadas_agora') = 1
   and (select count(*) from pg_trigger
         where tgname = 'job_listings_respeita_plano_trigger') = 1
   and (select count(*) from pg_trigger
         where tgname = 'job_dispatches_teto_por_vaga_trigger') = 1
  then 'PRONTO — planos da empresa, teto de anuncios e 2 ondas por vaga'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;

create or replace function public.vagas_ativas_agora(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select count(*)::integer
    from public.job_listings v
   where v.company_id = p_company_id
     and v.status = 'active';
$$;

create or replace function public.job_listings_exige_plano()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_limite integer;
  v_ativas integer;
begin
  if tg_op = 'UPDATE' and new.status is distinct from 'active' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' and new.status = 'active' then
    return new;  -- edição comum de uma vaga que já estava no ar
  end if;

  v_limite := public.limite_de_vagas_do_plano(new.company_id);

  if v_limite = 0 then
    raise exception 'Para publicar vaga é preciso ter um plano ativo.';
  end if;

  if v_limite > 0 then
    v_ativas := public.vagas_ativas_agora(new.company_id);
    if v_ativas >= v_limite then
      raise exception 'Seu plano permite % vaga(s) aberta(s) por vez. Feche uma para abrir outra.', v_limite;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists job_listings_exige_plano_trigger on public.job_listings;
create trigger job_listings_exige_plano_trigger
  before insert or update on public.job_listings
  for each row execute function public.job_listings_exige_plano();

drop trigger if exists job_listings_respeita_plano_trigger on public.job_listings;

drop policy if exists "Empresa escreve vaga própria" on public.job_listings;
drop policy if exists "Empresa escreve vaga própria" on public.job_listings;
create policy "Empresa escreve vaga própria" on public.job_listings
  for insert with check (
    exists (
      select 1 from public.companies c
       where c.id = company_id
         and c.owner_id = auth.uid()
         and c.phone_verified
         and c.plano_ate is not null
         and c.plano_ate > now()
    )
  );

select case
  when (select count(*) from pg_proc where proname = 'vagas_ativas_agora') = 1
   and (select count(*) from pg_trigger
         where tgname = 'job_listings_exige_plano_trigger') = 1
   and (select count(*) from pg_trigger
         where tgname = 'job_listings_respeita_plano_trigger') = 0
   and (select count(*) from pg_policies
         where tablename = 'job_listings'
           and policyname = 'Empresa escreve vaga própria'
           and with_check like '%plano_ate%') = 1
  then 'PRONTO — sem plano nao publica vaga; o teto conta vagas abertas'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;

-- ═══════════════════════════════════════════════════════════
-- PARTE 11 de 13
-- ═══════════════════════════════════════════════════════════

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  plataforma text not null check (plataforma in ('android', 'ios', 'web')),
  token text,
  endpoint text,
  p256dh text,
  auth text,
  criado_em timestamp with time zone default now(),
  visto_em timestamp with time zone default now()
);

create unique index if not exists idx_push_devices_token
  on public.push_devices (token) where token is not null;
create unique index if not exists idx_push_devices_endpoint
  on public.push_devices (endpoint) where endpoint is not null;
create index if not exists idx_push_devices_user on public.push_devices (user_id);

alter table public.push_devices enable row level security;

drop policy if exists "Dono lê seus aparelhos" on public.push_devices;
create policy "Dono lê seus aparelhos" on public.push_devices
  for select using (auth.uid() = user_id);
drop policy if exists "Dono cadastra seu aparelho" on public.push_devices;
create policy "Dono cadastra seu aparelho" on public.push_devices
  for insert with check (auth.uid() = user_id);
drop policy if exists "Dono atualiza seu aparelho" on public.push_devices;
create policy "Dono atualiza seu aparelho" on public.push_devices
  for update using (auth.uid() = user_id);
drop policy if exists "Dono apaga seu aparelho" on public.push_devices;
create policy "Dono apaga seu aparelho" on public.push_devices
  for delete using (auth.uid() = user_id);

create table if not exists public.job_notifications (
  id uuid primary key default gen_random_uuid(),
  job_listing_id uuid not null references public.job_listings on delete cascade,
  professional_id uuid not null references auth.users on delete cascade,
  wave integer not null check (wave in (1, 2, 3)),
  criado_em timestamp with time zone default now(),
  enviado_em timestamp with time zone,
  visto_em timestamp with time zone,
  unique (job_listing_id, professional_id)
);

create index if not exists idx_job_notifications_prof
  on public.job_notifications (professional_id, criado_em desc);
create index if not exists idx_job_notifications_vaga
  on public.job_notifications (job_listing_id);
create index if not exists idx_job_notifications_fila
  on public.job_notifications (enviado_em) where enviado_em is null;

alter table public.job_notifications enable row level security;

drop policy if exists "Vê os avisos que lhe dizem respeito" on public.job_notifications;
create policy "Vê os avisos que lhe dizem respeito" on public.job_notifications
  for select using (
    auth.uid() = professional_id
    or exists (
      select 1 from public.job_listings v
       join public.companies c on c.id = v.company_id
      where v.id = job_listing_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "Empresa registra o aviso da sua vaga" on public.job_notifications;
create policy "Empresa registra o aviso da sua vaga" on public.job_notifications
  for insert with check (
    exists (
      select 1 from public.job_listings v
       join public.companies c on c.id = v.company_id
      where v.id = job_listing_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "Profissional marca o aviso como visto" on public.job_notifications;
create policy "Profissional marca o aviso como visto" on public.job_notifications
  for update using (auth.uid() = professional_id);

create or replace function public.job_notifications_so_marca_visto()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() = old.professional_id then
    if new.job_listing_id is distinct from old.job_listing_id
       or new.professional_id is distinct from old.professional_id
       or new.wave is distinct from old.wave
       or new.enviado_em is distinct from old.enviado_em then
      raise exception 'Só a data de visualização pode ser alterada aqui.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists job_notifications_so_marca_visto_trigger on public.job_notifications;
create trigger job_notifications_so_marca_visto_trigger
  before update on public.job_notifications
  for each row execute function public.job_notifications_so_marca_visto();

alter table public.job_dispatches
  add column if not exists podiam_receber integer;

create or replace function public.quantos_recebem_push(p_users uuid[])
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select count(distinct d.user_id)::integer
    from public.push_devices d
   where d.user_id = any(p_users);
$$;

select case
  when (select count(*) from pg_class
         where relname = 'push_devices' and relkind = 'r') = 1
   and (select count(*) from pg_class
         where relname = 'job_notifications' and relkind = 'r') = 1
   and (select count(*) from pg_attribute
         where attrelid = 'public.job_dispatches'::regclass
           and attname = 'podiam_receber' and not attisdropped) = 1
   and (select count(*) from pg_proc where proname = 'quantos_recebem_push') = 1
   and (select count(*) from pg_trigger
         where tgname = 'job_notifications_so_marca_visto_trigger') = 1
  then 'PRONTO — aparelhos, avisos por vaga, e a conta de quem recebe push'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;

alter table public.professionals
  add column if not exists disponivel boolean not null default true;

comment on column public.professionals.disponivel is
  'Aceitando trabalho agora. Diferente de `paused`, que tira da busca.';

create table if not exists public.professional_courses (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null
    references public.professionals(id) on delete cascade,
  nome text not null,
  instituicao text,
  ano text,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists professional_courses_dono
  on public.professional_courses(professional_id, ordem);

alter table public.professional_courses enable row level security;

drop policy if exists "Qualquer um lê curso" on public.professional_courses;
drop policy if exists "Qualquer um lê curso" on public.professional_courses;
create policy "Qualquer um lê curso" on public.professional_courses
  for select using (true);

drop policy if exists "Dono escreve seu curso" on public.professional_courses;
drop policy if exists "Dono escreve seu curso" on public.professional_courses;
create policy "Dono escreve seu curso" on public.professional_courses
  for insert with check (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

drop policy if exists "Dono atualiza seu curso" on public.professional_courses;
drop policy if exists "Dono atualiza seu curso" on public.professional_courses;
create policy "Dono atualiza seu curso" on public.professional_courses
  for update using (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

drop policy if exists "Dono apaga seu curso" on public.professional_courses;
drop policy if exists "Dono apaga seu curso" on public.professional_courses;
create policy "Dono apaga seu curso" on public.professional_courses
  for delete using (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, uf, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  case when mostrar_endereco then neighborhood end as neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  areas_de_interesse, disponivel,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.professionals'::regclass
           and attname = 'disponivel' and not attisdropped) = 1
   and (select count(*) from pg_attribute
         where attrelid = 'public.professionals_public'::regclass
           and attname = 'disponivel' and not attisdropped) = 1
   and (select count(*) from pg_class
         where relname = 'professional_courses' and relkind = 'r') = 1
   and (select count(*) from pg_policies
         where tablename = 'professional_courses') = 4
   and (select pg_get_viewdef('public.professionals_public'::regclass)) like '%paused%'
  then 'PRONTO — disponivel, cursos, e a view com o filtro no lugar'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, uf, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  case when mostrar_endereco then neighborhood end as neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  areas_de_interesse, disponivel,
  mostrar_endereco, created_at
from public.professionals
where suspended = false
  and paused = false
  and whatsapp_verified = true;

grant select on public.professionals_public to anon, authenticated;

create or replace function public.job_notifications_exige_confirmacao()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.professionals
     where owner_id = new.professional_id
       and whatsapp_verified = true
  ) then
    raise exception
      'Só quem confirmou o telefone recebe aviso de vaga.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists job_notifications_exige_confirmacao on public.job_notifications;
create trigger job_notifications_exige_confirmacao
  before insert on public.job_notifications
  for each row execute function public.job_notifications_exige_confirmacao();

select case
  when (select pg_get_viewdef('public.professionals_public'::regclass))
         like '%whatsapp_verified = true%'
   and (select pg_get_viewdef('public.professionals_public'::regclass)) like '%paused%'
   and (select pg_get_viewdef('public.professionals_public'::regclass)) like '%suspended%'
   and (select count(*) from pg_trigger
         where tgrelid = 'public.job_notifications'::regclass
           and tgname = 'job_notifications_exige_confirmacao') = 1
  then 'PRONTO — sem telefone confirmado o cadastro não aparece nem recebe vaga'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;

-- ═══════════════════════════════════════════════════════════
-- PARTE 12 de 13
-- ═══════════════════════════════════════════════════════════

create or replace function public.candidatos_da_onda(
  p_cidade text,
  p_uf text,
  p_oficios text[],
  p_coluna text,
  p_especialidade text default null
)
returns table (id uuid, owner_id uuid)
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.companies c where c.owner_id = auth.uid()) then
    raise exception 'Só empresa cadastrada pode contar a onda.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_coluna not in ('categories', 'areas_de_interesse') then
    raise exception 'Coluna inválida: %', p_coluna using errcode = 'invalid_parameter_value';
  end if;

  return query
  select p.id, p.owner_id
    from public.professionals p
   where p.city = p_cidade
     and (p_uf is null or p.uf = p_uf)
     and p.suspended = false
     and p.whatsapp_verified = true
     and (
       (p_coluna = 'categories' and p.categories && p_oficios)
       or (p_coluna = 'areas_de_interesse' and p.areas_de_interesse && p_oficios)
     )
     and (
       p_especialidade is null
       or p_especialidade = ''
       or p.especialidade ilike '%' || p_especialidade || '%'
     );
end;
$$;

revoke all on function public.candidatos_da_onda(text, text, text[], text, text) from public;
grant execute on function public.candidatos_da_onda(text, text, text[], text, text) to authenticated;

create index if not exists idx_professionals_onda
  on public.professionals (city, uf)
  where suspended = false and whatsapp_verified = true;

select case
  when (select count(*) from pg_proc
         where pronamespace = 'public'::regnamespace
           and proname = 'candidatos_da_onda'
           and prosecdef) = 1
   and (select pg_get_viewdef('public.professionals_public'::regclass)) like '%paused%'
  then 'PRONTO — quem está oculto volta a receber vaga pelas ondas, e continua fora da busca'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;

alter table public.job_responses
  add column if not exists interessado boolean not null default true;

create index if not exists idx_job_responses_interessados
  on public.job_responses (job_listing_id)
  where interessado = true;

drop policy if exists "Pessoa muda a própria resposta" on public.job_responses;
drop policy if exists "Pessoa muda a própria resposta" on public.job_responses;
create policy "Pessoa muda a própria resposta" on public.job_responses
  for update
  using (auth.uid() = professional_id)
  with check (auth.uid() = professional_id);

create or replace function public.job_responses_pessoa_so_mexe_no_interesse()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  
  if auth.uid() = new.professional_id
     and not exists (
       select 1 from public.job_listings jl
        join public.companies c on c.id = jl.company_id
       where jl.id = new.job_listing_id and c.owner_id = auth.uid()
     )
  then
    if new.status is distinct from old.status
       or new.company_notes is distinct from old.company_notes then
      raise exception 'A triagem da vaga é de quem anunciou.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists job_responses_pessoa_so_mexe_no_interesse on public.job_responses;
create trigger job_responses_pessoa_so_mexe_no_interesse
  before update on public.job_responses
  for each row execute function public.job_responses_pessoa_so_mexe_no_interesse();

select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.job_responses'::regclass
           and attname = 'interessado' and not attisdropped) = 1
   and (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'job_responses'
           and policyname = 'Pessoa muda a própria resposta') = 1
   and (select count(*) from pg_trigger
         where tgrelid = 'public.job_responses'::regclass
           and tgname = 'job_responses_pessoa_so_mexe_no_interesse') = 1
  then 'PRONTO — a pessoa pode dizer que tem interesse ou que não tem, e mudar de ideia'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;

alter table public.job_listings drop constraint if exists job_listings_status_check;
alter table public.job_listings add constraint job_listings_status_check
  check (status in ('active', 'paused', 'closed'));

drop policy if exists "Empresa apaga vaga própria" on public.job_listings;
drop policy if exists "Empresa apaga vaga própria" on public.job_listings;
create policy "Empresa apaga vaga própria" on public.job_listings
  for delete using (
    auth.uid() = (select owner_id from public.companies where id = company_id)
  );

create or replace function public.job_responses_so_em_vaga_ativa()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_status text;
begin
  if tg_op = 'UPDATE'
     and (new.interessado is not true or old.interessado is true) then
    return new;
  end if;

  select status into v_status
    from public.job_listings where id = new.job_listing_id;

  if v_status is distinct from 'active' then
    raise exception 'Esta vaga não está mais recebendo interessados.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists job_responses_so_em_vaga_ativa on public.job_responses;
create trigger job_responses_so_em_vaga_ativa
  before insert or update on public.job_responses
  for each row execute function public.job_responses_so_em_vaga_ativa();

create index if not exists idx_job_listings_empresa_estado
  on public.job_listings (company_id, status, created_at desc);

select case
  when (select pg_get_constraintdef(oid) from pg_constraint
         where conrelid = 'public.job_listings'::regclass
           and conname = 'job_listings_status_check') like '%paused%'
   and (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'job_listings'
           and policyname = 'Empresa apaga vaga própria') = 1
   and (select count(*) from pg_trigger
         where tgrelid = 'public.job_responses'::regclass
           and tgname = 'job_responses_so_em_vaga_ativa') = 1
  then 'PRONTO — dá para pausar, arquivar e excluir vaga, e vaga fora do ar não recebe mais ninguém'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;

alter table public.job_listings
  add column if not exists tipo_contrato text,
  add column if not exists jornada text,
  add column if not exists beneficios text[] not null default '{}',
  add column if not exists salario_a_combinar boolean not null default false;

alter table public.job_listings drop constraint if exists job_listings_tipo_contrato_check;
alter table public.job_listings add constraint job_listings_tipo_contrato_check
  check (tipo_contrato is null or tipo_contrato in (
    'clt', 'temporario', 'diaria', 'freelance', 'estagio', 'aprendiz'
  ));

alter table public.job_listings drop constraint if exists job_listings_jornada_check;
alter table public.job_listings add constraint job_listings_jornada_check
  check (jornada is null or jornada in (
    'integral', 'meio_periodo', 'turnos', 'fins_de_semana', 'a_combinar'
  ));

alter table public.job_listings drop constraint if exists job_listings_faixa_salarial_check;
alter table public.job_listings add constraint job_listings_faixa_salarial_check
  check (
    salary_range_min is null
    or salary_range_max is null
    or salary_range_max >= salary_range_min
  );

select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.job_listings'::regclass
           and attname in ('tipo_contrato', 'jornada', 'beneficios', 'salario_a_combinar')
           and not attisdropped) = 4
   and (select count(*) from pg_constraint
         where conrelid = 'public.job_listings'::regclass
           and conname in ('job_listings_tipo_contrato_check',
                           'job_listings_jornada_check',
                           'job_listings_faixa_salarial_check')) = 3
  then 'PRONTO — a vaga passa a guardar tipo de contrato, jornada, benefícios e salário a combinar'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;

-- ═══════════════════════════════════════════════════════════
-- PARTE 13 de 13
-- ═══════════════════════════════════════════════════════════

drop view if exists public.companies_public;

create view public.companies_public as
  select
    c.id,
    c.company_name,
    c.photo_url,
    c.city,
    c.uf,
    c.neighborhood
  from public.companies c
  where exists (
    select 1 from public.job_listings v
     where v.company_id = c.id
       and v.status = 'active'
  );

comment on view public.companies_public is
  'A face pública da empresa: nome, foto e onde fica. Sem CNPJ, sem
   telefone, sem responsável, sem plano. Só empresas com vaga no ar.
   O `where` mora na view de propósito — view não obedece RLS.';

grant select on public.companies_public to anon, authenticated;

select case
  when (select count(*) from pg_class
         where relnamespace = 'public'::regnamespace
           and relname = 'companies_public' and relkind = 'v') = 1
   and (select pg_get_viewdef('public.companies_public'::regclass)) like '%active%'
   and (select count(*) from pg_attribute
         where attrelid = 'public.companies_public'::regclass
           and attname in ('cnpj_cpf', 'phone', 'responsible_name', 'plano')
           and not attisdropped) = 0
   and has_table_privilege('anon', 'public.companies_public', 'select')
  then 'PRONTO — a empresa tem face pública, sem CNPJ nem telefone, e só com vaga no ar'
  else 'AINDA FALTA — alguma parte acima não passou; me mande o erro que apareceu'
  end as resultado;
