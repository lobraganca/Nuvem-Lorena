-- Ei Itabirito — migrations 0068 a 0070, na ordem.
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
-- 0068_job_dispatches.sql
-- ══════════════════════════════════════════════════════════════════

-- 0068 — tabela de ondas de disparo (job_dispatches).
--
-- A vaga não vai para todo mundo de uma vez. Ela abre em três ondas, do
-- encaixe mais exato para o mais largo, e QUEM ABRE É A EMPRESA, num botão
-- na tela da vaga. Não há disparo automático, nem agendamento, nem cron:
-- enquanto a empresa não pedir, ninguém mais é avisado.
--
-- Onda 1 — quem é exatamente isso
--          `categories` contém a profissão E a especialidade bate.
-- Onda 2 — quem faz esse serviço
--          `categories` contém a profissão, qualquer especialidade.
-- Onda 3 — quem faz coisa do mesmo ramo
--          `categories` cruza com o grupo da profissão (ver
--          GRUPOS_DE_SERVICOS em src/types/domain.ts). Vaga de pedreiro
--          alcança "Casa e obra"; não alcança manicure.
--
-- Duas coisas que a versão anterior deste arquivo errava, e que estão aqui
-- para não voltarem:
--
-- 1. As ondas abriam por DISTÂNCIA. O cadastro de profissional não tem
--    latitude nem longitude — só bairro, CEP, cidade e estado —, então a
--    ordenação por quilômetro nunca poderia ser escrita. E Itabirito
--    inteira se atravessa em dez minutos: ordenar por proximidade aqui é
--    ordenar por ruído.
--
-- 2. A onda 3 era "todo mundo da cidade". Mandava vaga de pedreiro para
--    manicure — uma vez cada, e a pessoa silencia o app. Aí a vaga
--    seguinte, a que era mesmo dela, não chega mais. Alargar até o ramo é
--    o limite: passou disso, o aviso deixa de valer para todo mundo.
--
-- Cada onda aberta vira um registro aqui, com quantas pessoas alcançou e
-- quando. O `unique (job_listing_id, wave)` é o que garante que uma onda
-- abra uma vez só — dois toques no botão não avisam ninguém duas vezes.

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

-- RLS: usuário vê ondas de suas próprias vagas.
alter table public.job_dispatches enable row level security;

create policy "Lê ondas de suas vagas" on public.job_dispatches
  for select using (
    exists (
      select 1 from public.job_listings
      where id = job_listing_id
        and company_id = (select id from public.companies where owner_id = auth.uid())
    )
  );

create policy "Insere ondas em suas vagas" on public.job_dispatches
  for insert with check (
    exists (
      select 1 from public.job_listings
      where id = job_listing_id
        and company_id = (select id from public.companies where owner_id = auth.uid())
    )
  );

create policy "Atualiza ondas de suas vagas" on public.job_dispatches
  for update using (
    exists (
      select 1 from public.job_listings
      where id = job_listing_id
        and company_id = (select id from public.companies where owner_id = auth.uid())
    )
  );

-- Indexes para buscas.
create index if not exists idx_job_dispatches_job on public.job_dispatches(job_listing_id);
create index if not exists idx_job_dispatches_wave on public.job_dispatches(job_listing_id, wave);
create index if not exists idx_job_dispatches_sent on public.job_dispatches(sent_at desc);

-- Trigger para atualizar updated_at.
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

-- Confere a si mesma.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.job_dispatches'::regclass
           and attname in ('id', 'job_listing_id', 'wave', 'professionals_count',
                          'sent_at', 'status', 'created_at', 'updated_at')
           and not attisdropped) = 8
  then 'PRONTO — job_dispatches foi criada com todas as colunas'
  else 'AINDA FALTA — as colunas nao foram criadas'
  end as resultado;


-- ══════════════════════════════════════════════════════════════════
-- 0069_job_responses.sql
-- ══════════════════════════════════════════════════════════════════

-- 0069 — tabela de respostas a vagas (job_responses).
--
-- Quando um profissional vê uma vaga (notificação, busca, ou recomendação)
-- e se interessa, ele responde. Cada resposta é registrada aqui com o
-- profissional (professional_id), a vaga (job_listing_id), e o timestamp.
--
-- A resposta pode ter status: new (acabou de chegar), read (empresa leu),
-- accepted (empresa se interessou e marcou contato), rejected (empresa
-- descartou ou achou alguém melhor).

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

-- RLS: profissional vê suas próprias respostas; empresa vê respostas de suas vagas.
alter table public.job_responses enable row level security;

create policy "Profissional lê suas respostas" on public.job_responses
  for select using (auth.uid() = professional_id or
    exists (
      select 1 from public.job_listings
      where id = job_listing_id
        and company_id = (select id from public.companies where owner_id = auth.uid())
    )
  );

create policy "Profissional insere resposta" on public.job_responses
  for insert with check (auth.uid() = professional_id);

create policy "Empresa atualiza status da resposta" on public.job_responses
  for update using (
    exists (
      select 1 from public.job_listings
      where id = job_listing_id
        and company_id = (select id from public.companies where owner_id = auth.uid())
    )
  );

-- Indexes para buscas.
create index if not exists idx_job_responses_job on public.job_responses(job_listing_id);
create index if not exists idx_job_responses_professional on public.job_responses(professional_id);
create index if not exists idx_job_responses_status on public.job_responses(status);
create index if not exists idx_job_responses_responded on public.job_responses(responded_at desc);

-- Trigger para atualizar updated_at.
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

-- Confere a si mesma.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.job_responses'::regclass
           and attname in ('id', 'job_listing_id', 'professional_id', 'responded_at',
                          'status', 'company_notes', 'created_at', 'updated_at')
           and not attisdropped) = 8
  then 'PRONTO — job_responses foi criada com todas as colunas'
  else 'AINDA FALTA — as colunas nao foram criadas'
  end as resultado;


-- ══════════════════════════════════════════════════════════════════
-- 0070_onde_quero_trabalhar_e_experiencias.sql
-- ══════════════════════════════════════════════════════════════════

-- 0070 — "onde quero trabalhar" e as experiências de quem se cadastra.
--
-- O cadastro sabia dizer o que a pessoa OFERECE ("sou encanador") e nada
-- sobre onde ela ACEITARIA trabalhar. São coisas diferentes, e a diferença
-- é o app inteiro: um eletricista que topa vaga de auxiliar de produção
-- nunca seria alcançado por ela, porque "auxiliar de produção" não é o que
-- ele faz — é o que ele aceitaria fazer.
--
-- Por isso é coluna nova, e não mais espaço na lista de serviços: misturar
-- as duas estragaria a busca de quem procura um encanador (apareceria gente
-- que só toparia ser encanador) e a das vagas (não daria para saber se a
-- pessoa faz aquilo ou só aceitaria).
--
-- Vai em 3 partes numeradas. O editor do painel desfaz o bloco inteiro
-- quando um comando falha no meio, então cada parte é rodada sozinha — e a
-- Parte 1 é a que destrava as pessoas.

-- ── Parte 1 ────────────────────────────────────────────────────────────
-- A coluna. Sozinha não quebra nada: o app antigo simplesmente a ignora.

alter table public.professionals
  add column if not exists areas_de_interesse text[] not null default '{}';

-- ── Parte 2 ────────────────────────────────────────────────────────────
-- As experiências. Três campos por item, de propósito.
--
-- "Ajudante de pedreiro / Construções Silva / 2 anos" é o que uma empresa
-- da cidade quer saber, e é o que se preenche num celular sem desistir no
-- meio. Currículo com mês e ano de início e fim é mais completo e fica
-- vazio — e experiência não preenchida não ajuda ninguém.
--
-- `periodo` é texto livre, e não duas datas: quem trabalhou "uns três anos"
-- não sabe o mês, e obrigá-lo a escolher um faz ele inventar ou desistir.

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

-- Qualquer um lê: a experiência existe para ser vista por quem contrata.
-- A view não filtra suspenso/pausado porque a leitura sempre parte de um
-- cadastro já encontrado — e cadastro fora do ar não é encontrado.
create policy "Qualquer um lê experiência" on public.professional_experiences
  for select using (true);

-- Escreve só o dono do cadastro. `exists` contra `professionals` em vez de
-- guardar owner_id aqui: dois lugares com a mesma verdade divergem, e o que
-- manda é de quem é o cadastro.
create policy "Dono escreve sua experiência" on public.professional_experiences
  for insert with check (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

create policy "Dono atualiza sua experiência" on public.professional_experiences
  for update using (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

create policy "Dono apaga sua experiência" on public.professional_experiences
  for delete using (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

-- ── Parte 3 ────────────────────────────────────────────────────────────
-- A view pública ganha a coluna nova.
--
-- ATENÇÃO ao `where` da última linha. View roda com os direitos de quem a
-- criou, então ela NÃO obedece RLS: o filtro precisa estar escrito aqui.
-- A migration 0049 recriou esta view sem ele e cadastros suspensos e
-- pausados voltaram a aparecer na busca — sem erro, sem aviso, só de volta.
-- Toda vez que esta view for recriada, confira que esta linha veio junto.

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

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema: aquele filtra por privilégio
-- do papel corrente e já respondeu "não existe" cinco vezes para uma coluna
-- que existia o tempo todo.
--
-- Confere também o `where` da view, que é o erro que já aconteceu: sem ele
-- a consulta abaixo devolveria a contagem errada e ninguém notaria.
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
