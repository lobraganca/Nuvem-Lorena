-- Suspensão de anúncios pelo painel admin (tirar do ar por denúncia
-- procedente ou violação das regras) e bloqueio de documento (CPF/CNPJ)
-- para impedir novo cadastro com o mesmo documento.

alter table public.professionals
  add column if not exists suspended boolean not null default false,
  add column if not exists suspended_reason text;

-- A policy pública de select de professionals passa a excluir suspensos:
-- um anúncio suspenso some da busca e do perfil público. O dono e admins
-- continuam vendo (o dono via policy própria, para entender o que houve;
-- admin via policy própria).
drop policy if exists "profissionais são públicos para leitura" on public.professionals;

create policy "profissionais não suspensos são públicos para leitura"
  on public.professionals for select
  using (suspended = false);

create policy "dono vê o próprio anúncio mesmo suspenso"
  on public.professionals for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "admin vê qualquer anúncio, inclusive suspenso"
  on public.professionals for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

-- admin também precisa poder suspender/reativar (mudar suspended/suspended_reason).
create policy "admin suspende/reativa anúncios"
  on public.professionals for update
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

-- Bloqueio de documento (CPF/CNPJ, só dígitos) para impedir novo cadastro.
create table if not exists public.document_bans (
  document text primary key,
  reason text,
  banned_at timestamptz not null default now()
);

alter table public.document_bans enable row level security;

-- Sem select/insert público de propósito — só quem está em `admins` mexe
-- diretamente na tabela (mesmo padrão de `admins`). A checagem no cadastro
-- é feita via função security definer abaixo, não por select direto.
create policy "admin vê a lista de documentos bloqueados"
  on public.document_bans for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

create policy "admin bloqueia um documento"
  on public.document_bans for insert
  to authenticated
  with check (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

create policy "admin desbloqueia um documento"
  on public.document_bans for delete
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

-- Função security definer: qualquer usuário autenticado pode checar se um
-- documento está bloqueado, sem enxergar a lista inteira de bloqueados
-- (RLS de document_bans continua restrita a admins).
create or replace function public.check_document_banned(doc text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.document_bans where document = doc);
$$;

grant execute on function public.check_document_banned(text) to authenticated, anon;
