-- ═══════════════════════════════════════════════════════════════════════
-- 0075 — "Estou disponível" e os cursos do profissional
-- ═══════════════════════════════════════════════════════════════════════
--
-- Duas coisas que a dona pediu por escrito e que não existiam no banco:
--
--   "ter um campo bem visível pra ele colocar se está disponível ou não"
--   "ter parte de incluir cursos e especializações"
--
-- A tela do perfil já mostrava as duas — mas era maquete: nada era lido
-- nem gravado, porque não havia onde. Quem marcasse "disponível" e
-- recarregasse a página perdia tudo.
--
-- ── Disponível e oculto são coisas DIFERENTES ─────────────────────────
--
-- `paused` (que já existe) tira o cadastro da busca pública. É o "ficar
-- oculto": quem está empregado e não quer ser encontrado pelo patrão some
-- da lista e continua recebendo vaga pelas ondas.
--
-- `disponivel` é outra pergunta: "estou aceitando trabalho agora?". Quem
-- está visível mas ocupado continua aparecendo — e a empresa precisa saber
-- disso ANTES de ligar, senão gasta o telefonema e a paciência dos dois.
--
-- Por isso são duas colunas, e não uma. Juntá-las obrigaria quem está
-- ocupado a sumir do app, e quem sumiu do app não volta.

alter table public.professionals
  add column if not exists disponivel boolean not null default true;

comment on column public.professionals.disponivel is
  'Aceitando trabalho agora. Diferente de `paused`, que tira da busca.';

-- ── Cursos e especializações ───────────────────────────────────────────
-- Tabela própria, e não um `text[]`: um curso tem nome, instituição e ano,
-- e um array de texto perderia os dois últimos. NR-35 feito em 2019 no
-- SENAI vale mais que "NR-35" solto — é o que a empresa usa para decidir.
create table if not exists public.professional_courses (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null
    references public.professionals(id) on delete cascade,
  nome text not null,
  instituicao text,
  ano text,
  -- A ordem que a pessoa escolheu. Sem ela a lista embaralha a cada leitura
  -- e a pessoa acha que o app perdeu o que ela escreveu.
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists professional_courses_dono
  on public.professional_courses(professional_id, ordem);

alter table public.professional_courses enable row level security;

-- Leitura pública: o curso é parte do cadastro que a empresa consulta.
drop policy if exists "Qualquer um lê curso" on public.professional_courses;
create policy "Qualquer um lê curso" on public.professional_courses
  for select using (true);

-- Escrita só do dono do cadastro. O `exists` confere a posse pela tabela
-- de profissionais, e não por um `owner_id` repetido aqui: repetido, ele
-- sairia do lugar no dia em que um cadastro trocasse de dono.
drop policy if exists "Dono escreve seu curso" on public.professional_courses;
create policy "Dono escreve seu curso" on public.professional_courses
  for insert with check (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

drop policy if exists "Dono atualiza seu curso" on public.professional_courses;
create policy "Dono atualiza seu curso" on public.professional_courses
  for update using (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

drop policy if exists "Dono apaga seu curso" on public.professional_courses;
create policy "Dono apaga seu curso" on public.professional_courses
  for delete using (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

-- ── A view pública ganha `disponivel` ──────────────────────────────────
-- Recriada por inteiro, com o `where` escrito de novo. A 0049 já tirou
-- esse `where` sem querer numa recriação assim, e cadastros suspensos
-- voltaram a aparecer na busca — view roda com os direitos de quem a
-- criou e não vê RLS nenhuma.
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
  areas_de_interesse, disponivel,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema: aquele filtra por
-- privilégio do papel corrente e já respondeu "não existe" cinco vezes
-- para uma coluna que estava lá o tempo todo.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.professionals'::regclass
           and attname = 'disponivel' and not attisdropped) = 1
   and (select count(*) from pg_attribute
         where attrelid = 'public.professionals_public'::regclass
           and attname = 'disponivel' and not attisdropped) = 1
   and (select count(*) from pg_class
         where relname = 'professional_courses' and relkind = 'r') = 1
   and (select count(*) from pg_policies
         where tablename = 'professional_courses') = 4
   and (select pg_get_viewdef('public.professionals_public'::regclass)) like '%paused%'
  then 'PRONTO — disponivel, cursos, e a view com o filtro no lugar'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;
