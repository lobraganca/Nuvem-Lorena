-- =====================================================================
-- O mínimo do Supabase, para as migrations rodarem num Postgres comum
-- =====================================================================
--
-- As migrations do procurô dependem de quatro coisas que o Supabase dá de
-- graça e um Postgres cru não tem. Este arquivo constrói só essas quatro,
-- e nada além:
--
--   1. `gen_random_uuid()` — todas as chaves primárias usam
--   2. `auth.users`        — `perfis` aponta para lá
--   3. `auth.uid()`        — toda policy de RLS pergunta quem está falando
--   4. os papéis `anon` e `authenticated` — a view pública dá grant neles
--
-- O app tem o próprio arquivo em vez de usar o do app vizinho de propósito.
-- Aquele carrega o armário do Storage e colunas de confirmação por WhatsApp
-- que são das migrations DE LÁ — herdar isso amarraria os dois testes um no
-- outro, e no dia em que um mudasse o outro quebraria sem motivo aparente.

create extension if not exists "pgcrypto";

create schema if not exists auth;

-- As colunas são as que as migrations daqui realmente leem. `phone` e
-- `phone_confirmed_at` são escritas pelo Supabase Auth depois de conferir
-- o código do SMS — e é justamente por serem inalcançáveis pelo app que
-- elas servem de fonte da verdade para a confirmação (ver 0004).
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  phone              text,
  phone_confirmed_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb
);

-- No Supabase de verdade esta função devolve o dono do token da requisição.
-- Aqui ela devolve nulo, e isso basta: os testes rodam como dono do banco,
-- que passa por cima do RLS. O que se testa neste arquivo é o COMPORTAMENTO
-- do motor de ondas, não o RLS — RLS se testa com papel trocado, e é outro
-- teste.
create or replace function auth.uid() returns uuid
  language sql stable as $$ select null::uuid $$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

select 'PRONTO — ambiente mínimo do Supabase montado.' as resultado;
