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
