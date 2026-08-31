-- Ei Itabirito — PARTE 1 de 3: as tabelas do app: contas, empresas, vagas, ondas e respostas.
-- Cole tudo, clique uma vez no editor e toque em Run.
-- Pode colar de novo sem medo: repetir não estraga nada.

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

select case when to_regclass('public.job_responses') is not null
   and to_regclass('public.job_listings') is not null
   and to_regclass('public.companies') is not null
   and to_regclass('public.job_dispatches') is not null
   and to_regclass('public.user_onboarding') is not null
  then 'PARTE 1 PRONTA — pode colar a Parte 2'
  else 'PARTE 1 FALHOU — me mande o erro' end as resultado;
