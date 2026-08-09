-- Mínimo do ambiente Supabase para as migrations rodarem: schema auth,
-- auth.users, auth.uid() e os papéis anon/authenticated.
create extension if not exists "pgcrypto";
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  -- Usadas pela confirmação do WhatsApp (migration 0024): o Auth de verdade
  -- guarda o número e a hora em que o código foi conferido.
  phone text,
  phone_confirmed_at timestamptz
);
alter table auth.users add column if not exists phone text;
alter table auth.users add column if not exists phone_confirmed_at timestamptz;
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;

-- Mínimo do Storage: as políticas das fotos (migration 0026) escrevem em
-- `storage.objects` e usam `storage.foldername`. Sem este armário, o schema
-- completo não roda fora do Supabase — e um teste que não roda inteiro deixa
-- de valer como teste.
create schema if not exists storage;
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid
);
-- `storage.buckets` existe no Supabase e é onde os buckets são criados. A
-- migration 0040 cria o bucket dos banners por SQL — sem este armário, ela
-- passaria aqui e falharia lá, que é o pior dos dois mundos.
create table if not exists storage.buckets (
  id text primary key,
  name text,
  public boolean default false
);

alter table storage.objects enable row level security;
create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select string_to_array(name, '/')
$$;
