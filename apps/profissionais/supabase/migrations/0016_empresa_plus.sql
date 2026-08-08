-- Fonte de renda: plano "Empresa Plus" (assinatura recorrente adicional,
-- só disponível para entity_type = 'pj') que dá acesso a uma tela de
-- estatísticas do próprio anúncio (visualizações de perfil, leads,
-- avaliações). Mesmo padrão de expiração de verified/boosted.

alter table public.professionals
  add column if not exists plus_active boolean not null default false,
  add column if not exists plus_until timestamptz;

-- subscriptions.type só aceitava 'verification'/'boost' — amplia para o
-- novo tipo de assinatura recorrente do Plus.
alter table public.subscriptions drop constraint if exists subscriptions_type_check;
alter table public.subscriptions add constraint subscriptions_type_check check (type in ('verification', 'boost', 'plus'));

-- Contagem de visualizações de perfil, sem dados pessoais — só o registro
-- de "alguém abriu esta página" para alimentar o analytics do Plus.
create table if not exists public.profile_views (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists profile_views_professional_id_idx on public.profile_views (professional_id);

alter table public.profile_views enable row level security;

-- Só o dono do anúncio lê as próprias visualizações (é o dado que alimenta
-- a tela de analytics do Plus).
drop policy if exists "dono vê as visualizações do próprio anúncio" on public.profile_views;
create policy "dono vê as visualizações do próprio anúncio"
  on public.profile_views for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = profile_views.professional_id
        and p.owner_id = auth.uid()
    )
  );

-- Insert é público (qualquer visita à página do profissional gera o
-- registro, inclusive sem login) — é só uma contagem, sem vínculo com
-- usuário.
drop policy if exists "qualquer visita registra uma visualização" on public.profile_views;
create policy "qualquer visita registra uma visualização"
  on public.profile_views for insert
  with check (true);

-- Atualiza a view pública de professionals para incluir plus_active/
-- plus_until (o painel usa para decidir se mostra a tela de analytics).
-- Mesmo motivo da 0014: a lista de colunas muda no meio, então drop + create.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, city, bio, phone, entity_type,
  company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, created_at
from public.professionals;

grant select on public.professionals_public to anon, authenticated;
