-- Ei Itabirito — migrations 0065 a 0067, na ordem.
--
-- GERADO por scripts/gerar-sql-pendente.mjs. Não edite à mão.
--
-- Para um banco que JÁ EXISTE. Cole tudo no SQL Editor do Supabase e rode
-- uma vez só. São 3 migrations; a ordem importa, porque
-- várias recriam a mesma view acrescentando uma coluna de cada vez.
--
-- Rodar de novo é seguro: tudo aqui usa "if not exists" / "or replace" /
-- "drop ... if exists". O que não é seguro é rodar fora de ordem.

-- ══════════════════════════════════════════════════════════════════
-- 0065_user_onboarding.sql
-- ══════════════════════════════════════════════════════════════════

-- 0065 — rastreamento de tipo de usuário e conclusão do onboarding.
--
-- O procurô serve dois tipos de usuário: profissionais (prestadores de
-- serviço) e empresas (contratantes). Ao entrar, a pessoa escolhe qual é,
-- e o app marca essa escolha e o status de conclusão do onboarding.
--
-- Este registro permite ao app saber: foi ou não foi escolhido tipo?
-- Já preencheu o formulário de cadastro? E quando.

create table if not exists public.user_onboarding (
  user_id uuid primary key references auth.users on delete cascade,
  user_type text not null check (user_type in ('professional', 'company')),
  completed boolean default false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Permite que o usuário logado leia e escreva apenas seu próprio registro.
alter table public.user_onboarding enable row level security;

create policy "Usuário lê seu próprio onboarding" on public.user_onboarding
  for select using (auth.uid() = user_id);

create policy "Usuário escreve seu próprio onboarding" on public.user_onboarding
  for insert with check (auth.uid() = user_id);

create policy "Usuário atualiza seu próprio onboarding" on public.user_onboarding
  for update using (auth.uid() = user_id);

-- Index para buscar tipo de usuário rapidamente.
create index if not exists idx_user_onboarding_type on public.user_onboarding(user_id, user_type);

-- Trigger para atualizar updated_at automaticamente.
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

-- Confere a si mesma.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.user_onboarding'::regclass
           and attname in ('user_id', 'user_type', 'completed', 'completed_at')
           and not attisdropped) = 4
  then 'PRONTO — user_onboarding foi criada com todas as colunas'
  else 'AINDA FALTA — as colunas nao foram criadas'
  end as resultado;


-- ══════════════════════════════════════════════════════════════════
-- 0066_companies.sql
-- ══════════════════════════════════════════════════════════════════

-- 0066 — tabela de empresas (contratantes).
--
-- Empresas são os usuários que publicam vagas de trabalho. Cada empresa
-- pertence a um usuário (owner_id) e guarda informações de razão social,
-- CNPJ, contato, localização e descrição.
--
-- Usa upsert com onConflict em owner_id porque cada usuário/empresa tem
-- apenas um cadastro — você não cria uma empresa nova, você atualiza a sua.

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

-- Permite que o dono da empresa leia e escreva seu próprio cadastro.
alter table public.companies enable row level security;

create policy "Empresa lê seu próprio cadastro" on public.companies
  for select using (auth.uid() = owner_id);

create policy "Empresa escreve seu próprio cadastro" on public.companies
  for insert with check (auth.uid() = owner_id);

create policy "Empresa atualiza seu próprio cadastro" on public.companies
  for update using (auth.uid() = owner_id);

-- Index para buscar empresa por dono.
create index if not exists idx_companies_owner on public.companies(owner_id);

-- Index para buscar empresa por cidade (usado nas buscas).
create index if not exists idx_companies_city on public.companies(city);

-- Trigger para atualizar updated_at.
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

-- Confere a si mesma.
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


-- ══════════════════════════════════════════════════════════════════
-- 0067_job_listings.sql
-- ══════════════════════════════════════════════════════════════════

-- 0067 — tabela de vagas de trabalho.
--
-- Cada vaga pertence a uma empresa (company_id) e tem informações de
-- título, profissão, descrição, salário, modalidade de trabalho (presencial/
-- remoto/híbrido), requisitos de experiência, se está disponível para contratar
-- imediatamente, e localização.
--
-- A vaga passa pelos estados: active (aberta) e closed (fechada). Uma vaga
-- fechada pode ser reaberta — closed_at registra quando foi fechada.

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
  -- Sem raio em quilômetros, de propósito: o cadastro de profissional não
  -- guarda latitude nem longitude (só bairro, CEP, cidade e estado), então
  -- distância não é conta que este banco saiba fazer. A coluna existiu numa
  -- versão anterior deste arquivo e nenhuma consulta poderia usá-la.
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamp with time zone default now(),
  closed_at timestamp with time zone,
  updated_at timestamp with time zone default now()
);

-- RLS: qualquer um vê a vaga ativa; o dono vê sua própria vaga em qualquer estado.
alter table public.job_listings enable row level security;

create policy "Qualquer um lê vaga ativa" on public.job_listings
  for select using (status = 'active' or auth.uid() = (select owner_id from public.companies where id = company_id));

create policy "Empresa escreve vaga própria" on public.job_listings
  for insert with check (auth.uid() = (select owner_id from public.companies where id = company_id));

create policy "Empresa atualiza vaga própria" on public.job_listings
  for update using (auth.uid() = (select owner_id from public.companies where id = company_id));

-- Indexes para buscas comuns.
create index if not exists idx_job_listings_company on public.job_listings(company_id);
create index if not exists idx_job_listings_status on public.job_listings(status);
create index if not exists idx_job_listings_city on public.job_listings(city);
create index if not exists idx_job_listings_profession on public.job_listings(profession);
create index if not exists idx_job_listings_created on public.job_listings(created_at desc);

-- Trigger para atualizar updated_at.
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

-- Confere a si mesma.
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
