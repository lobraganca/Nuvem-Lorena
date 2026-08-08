-- Canal de sugestões gerais sobre a plataforma (feedback de produto, ideias
-- como "poderia ter tal categoria" etc) — diferente de `reports`, que é
-- denúncia sobre um anúncio específico. Mesmo padrão de leitura restrita a
-- admin (reaproveita a tabela `admins` de 0008_admins.sql).

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  message text not null,
  created_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'reviewed'))
);

alter table public.suggestions enable row level security;

-- Qualquer um pode enviar uma sugestão, inclusive sem estar logado. Quando
-- logado, o client captura o user_id automaticamente (não é obrigatório).
drop policy if exists "qualquer um pode enviar uma sugestão" on public.suggestions;
create policy "qualquer um pode enviar uma sugestão"
  on public.suggestions for insert
  with check (true);

-- Sem policy de select pública de propósito — só admin lê (mesmo padrão de
-- `reports`).
drop policy if exists "admin vê as sugestões" on public.suggestions;
create policy "admin vê as sugestões"
  on public.suggestions for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "admin atualiza o status da sugestão" on public.suggestions;
create policy "admin atualiza o status da sugestão"
  on public.suggestions for update
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );
