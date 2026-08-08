-- Painel administrativo simples: tabela `admins` marca quem pode ver/tratar
-- denúncias (`reports`). O projeto não tem sistema de roles — quem for
-- admin precisa ser inserido manualmente nesta tabela (ver README, seção
-- "Painel administrativo") direto no Supabase, depois do primeiro login.

create table if not exists public.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade
);

alter table public.admins enable row level security;

-- Sem NENHUMA policy pública de select/insert/update/delete de propósito:
-- só service_role ou acesso direto via Supabase Studio mexem nesta tabela.
-- Isso evita que qualquer usuário autenticado se auto-promova a admin.

-- reports: admin pode ler e mudar o status (pending -> reviewed/dismissed).
drop policy if exists "admin vê as denúncias" on public.reports;
create policy "admin vê as denúncias"
  on public.reports for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "admin atualiza o status da denúncia" on public.reports;
create policy "admin atualiza o status da denúncia"
  on public.reports for update
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );
