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
