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
