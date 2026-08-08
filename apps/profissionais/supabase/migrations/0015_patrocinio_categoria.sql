-- Fonte de renda: banner de categoria patrocinada. Um profissional paga
-- para aparecer em destaque no topo da busca quando alguém filtra por uma
-- categoria (e cidade) específica, por um período determinado.

create table public.category_sponsorships (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  category text not null,
  city text not null default 'Itabirito',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  mercadopago_payment_id text,
  status text not null default 'pending' check (status in ('pending', 'active', 'expired')),
  created_at timestamptz not null default now()
);

create index category_sponsorships_lookup_idx
  on public.category_sponsorships (category, city, status, ends_at);

alter table public.category_sponsorships enable row level security;

-- Leitura pública só de patrocínios ativos e ainda dentro do período — é o
-- que a HomePage consulta para decidir se mostra o banner.
create policy "patrocínios ativos são públicos para leitura"
  on public.category_sponsorships for select
  using (status = 'active' and ends_at > now());

-- Dono do anúncio vê todos os próprios patrocínios (inclusive
-- pending/expired, para o painel mostrar o histórico).
create policy "dono vê os próprios patrocínios"
  on public.category_sponsorships for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = category_sponsorships.professional_id
        and p.owner_id = auth.uid()
    )
  );

-- Dono inicia o patrocínio do próprio anúncio (fica "pending" até a
-- confirmação de pagamento, seguindo o mesmo padrão esqueleto do webhook).
create policy "dono cria patrocínio para o próprio anúncio"
  on public.category_sponsorships for insert
  to authenticated
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = category_sponsorships.professional_id
        and p.owner_id = auth.uid()
    )
  );
