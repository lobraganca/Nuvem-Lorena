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
