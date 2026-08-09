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
