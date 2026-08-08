-- Canal de denúncias de anúncios (perfil falso, golpe, conteúdo ofensivo etc).
-- Leitura fica restrita (sem policy de select pública) — só service_role ou
-- acesso direto ao banco enxerga as denúncias por enquanto; um painel admin
-- para revisão é um próximo passo, não implementado nesta versão (ver README).

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  reporter_id uuid references public.profiles (id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

-- Qualquer um pode denunciar, inclusive sem estar logado (o golpe pode
-- atingir alguém que nem conseguiu logar ainda). Sem policy de select
-- pública de propósito — denúncias não são um dado público.
drop policy if exists "qualquer um pode denunciar um anúncio" on public.reports;
create policy "qualquer um pode denunciar um anúncio"
  on public.reports for insert
  with check (true);
