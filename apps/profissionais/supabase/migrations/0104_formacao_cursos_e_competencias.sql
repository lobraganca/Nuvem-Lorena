-- ═══════════════════════════════════════════════════════════════════════
-- 0104 — Formação, cursos e competências com nível
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona pediu três blocos no cadastro de quem procura trabalho:
--
--   Formação: última escolaridade (instituição / curso / situação:
--             cursando ou concluído / ano) — com opção de cadastrar mais
--   Cursos complementares: os mesmos campos, também com opção de mais
--   Competências: Excel, Informática, Atendimento — cada uma em Básico,
--             Intermediário ou Avançado — e um "+" para acrescentar outras
--
-- ── FORMAÇÃO E CURSO SÃO A MESMA TABELA ───────────────────────────────
--
-- `professional_courses` já existe desde a 0075, com nome, instituição,
-- ano e ordem. Os campos que a dona pede para a formação são EXATAMENTE
-- os mesmos que ela pede para o curso — o que muda é o rótulo na tela.
--
-- Duas tabelas iguais lado a lado seria o começo de duas telas que
-- divergem, duas policies que divergem, e um dia uma delas fica para trás.
-- Então entra uma coluna `tipo` e as duas listas saem da mesma tabela.
--
-- `nivel` só faz sentido na formação (fundamental, médio, técnico,
-- superior…) e fica nulo no curso complementar. Um curso de NR-35 não tem
-- "escolaridade".
--
-- `situacao` vale para as duas: "cursando" é informação, não é ausência de
-- informação — quem está terminando o técnico em dezembro é candidato hoje.
--
-- ── COMPETÊNCIA É TABELA NOVA ─────────────────────────────────────────
--
-- Aqui uma tabela nova se justifica, porque o dado é diferente: nome mais
-- NÍVEL. Não cabe num `text[]` (perderia o nível) nem em `professionals`
-- (a lista é aberta — a dona pediu o "+"). E `professional_courses` também
-- não serve: curso tem instituição e ano; competência não tem nem uma nem
-- outra, e as colunas ficariam sempre vazias, convidando alguém a
-- preenchê-las com outra coisa.
--
-- O nível é um `check` de três valores, e não texto livre: "avançado",
-- "Avancado" e "AVANÇADO" viram três níveis distintos na hora de filtrar.

-- ── Parte 1 de 3: formação e cursos na mesma tabela ────────────────────

alter table public.professional_courses
  add column if not exists tipo text not null default 'complementar',
  add column if not exists situacao text,
  add column if not exists nivel text;

alter table public.professional_courses drop constraint if exists professional_courses_tipo_check;
alter table public.professional_courses add constraint professional_courses_tipo_check
  check (tipo in ('formacao', 'complementar'));

alter table public.professional_courses drop constraint if exists professional_courses_situacao_check;
alter table public.professional_courses add constraint professional_courses_situacao_check
  check (situacao is null or situacao in ('cursando', 'concluido', 'trancado'));

alter table public.professional_courses drop constraint if exists professional_courses_nivel_check;
alter table public.professional_courses add constraint professional_courses_nivel_check
  check (nivel is null or nivel in (
    'fundamental', 'medio', 'tecnico', 'superior', 'pos', 'mestrado', 'doutorado'
  ));

comment on column public.professional_courses.tipo is
  'formacao = escolaridade (tem nivel); complementar = curso avulso.
   Mesma tabela de proposito: os campos sao os mesmos, so o rotulo muda.';

-- O índice da 0075 é por (professional_id, ordem). A tela lê as duas
-- listas separadas, então o tipo entra no meio: sem isso, cada abertura do
-- cadastro lê a tabela inteira da pessoa duas vezes e joga metade fora.
create index if not exists professional_courses_dono_tipo
  on public.professional_courses(professional_id, tipo, ordem);

-- ── Parte 2 de 3: competências ─────────────────────────────────────────

create table if not exists public.professional_skills (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null
    references public.professionals(id) on delete cascade,
  nome text not null,
  nivel text not null,
  -- A ordem que a pessoa escolheu. Sem ela a lista embaralha a cada
  -- leitura e a pessoa acha que o app perdeu o que ela escreveu — foi a
  -- razão de a 0075 pôr `ordem` nos cursos.
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.professional_skills drop constraint if exists professional_skills_nivel_check;
alter table public.professional_skills add constraint professional_skills_nivel_check
  check (nivel in ('basico', 'intermediario', 'avancado'));

-- A mesma competência duas vezes na mesma pessoa é sempre engano de
-- digitação, e na tela vira "Excel: básico" logo acima de "Excel:
-- avançado" — que não diz nada a quem contrata.
create unique index if not exists professional_skills_sem_repetir
  on public.professional_skills(professional_id, lower(nome));

create index if not exists professional_skills_dono
  on public.professional_skills(professional_id, ordem);

alter table public.professional_skills enable row level security;

-- Leitura pública: a competência existe para ser vista por quem contrata.
-- Quem está suspenso ou pausado não é ENCONTRADO (a view filtra), então a
-- leitura sempre parte de um cadastro que já apareceu — é o mesmo desenho
-- de `professional_courses` e `professional_experiences`.
drop policy if exists "Qualquer um lê competência" on public.professional_skills;
create policy "Qualquer um lê competência" on public.professional_skills
  for select using (true);

-- Escrita só do dono do cadastro, conferida contra `professionals` e não
-- por um `owner_id` repetido aqui: dois lugares com a mesma verdade
-- divergem no dia em que um cadastro trocar de dono.
drop policy if exists "Dono escreve sua competência" on public.professional_skills;
create policy "Dono escreve sua competência" on public.professional_skills
  for insert with check (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

drop policy if exists "Dono atualiza sua competência" on public.professional_skills;
create policy "Dono atualiza sua competência" on public.professional_skills
  for update using (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

drop policy if exists "Dono apaga sua competência" on public.professional_skills;
create policy "Dono apaga sua competência" on public.professional_skills
  for delete using (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

-- ── Parte 3 de 3: os cursos que já existem viram "complementar" ────────
--
-- O default só vale para linha nova. As que já estavam lá ficaram com o
-- valor do default também (o Postgres preenche na hora do `add column`),
-- mas escrever isso explicitamente deixa a migration correta mesmo se
-- alguém rodar as partes fora de ordem.
update public.professional_courses set tipo = 'complementar' where tipo is null;

-- ═══════════════════════════════════════════════════════════════════════
-- A CONFERÊNCIA. É a resposta desta janela que vale.
-- ═══════════════════════════════════════════════════════════════════════
-- Lê o pg_catalog, nunca o information_schema.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.professional_courses'::regclass
           and attname in ('tipo', 'situacao', 'nivel') and not attisdropped) = 3
   and (select count(*) from pg_class
         where relnamespace = 'public'::regnamespace
           and relname = 'professional_skills' and relkind = 'r') = 1
   and (select count(*) from pg_attribute
         where attrelid = 'public.professional_skills'::regclass
           and attname in ('professional_id', 'nome', 'nivel', 'ordem')
           and not attisdropped) = 4
   and (select relrowsecurity from pg_class
         where oid = 'public.professional_skills'::regclass)
   and (select count(*) from pg_policy
         where polrelid = 'public.professional_skills'::regclass) = 4
  then 'PRONTO — formacao, cursos e competencias com nivel'
  else 'AINDA FALTA — me mande o que apareceu'
  end as resultado;
