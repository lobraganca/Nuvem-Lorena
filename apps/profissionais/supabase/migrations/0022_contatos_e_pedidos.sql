-- Mais formas de contato, e o caminho inverso: o cliente pedir que o
-- profissional ligue para ele.

-- 1) Canais de contato do anúncio. `phone` já existia (usado como WhatsApp);
--    agora ele volta a ser só telefone e o WhatsApp ganha campo próprio, para
--    quem atende num número e conversa em outro.
alter table public.professionals
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists instagram text,
  add column if not exists linkedin text;

-- Quem já tinha telefone cadastrado usava aquele número como WhatsApp — sem
-- este backfill, todo anúncio existente perderia o botão de WhatsApp.
update public.professionals
  set whatsapp = phone
  where whatsapp is null and coalesce(phone, '') <> '';

-- 2) Pedidos de contato: o cliente deixa o número e pede para ser chamado.
create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  -- Quem pediu, quando estava logado. Nulo para pedido feito sem conta.
  requester_id uuid references public.profiles (id) on delete set null,
  name text not null,
  phone text not null,
  message text not null default '',
  status text not null default 'new' check (status in ('new', 'contacted', 'archived')),
  created_at timestamptz not null default now(),
  contacted_at timestamptz
);

create index if not exists contact_requests_professional_idx
  on public.contact_requests (professional_id, status, created_at desc);

alter table public.contact_requests enable row level security;

-- Qualquer visitante pode pedir contato, com ou sem login: exigir conta aqui
-- só afastaria quem está com pressa de resolver um problema em casa.
drop policy if exists "qualquer pessoa pede contato" on public.contact_requests;
create policy "qualquer pessoa pede contato"
  on public.contact_requests for insert
  with check (true);

-- Só o dono do anúncio lê e atualiza os pedidos que recebeu. Não há policy de
-- leitura pública: são dados de contato de terceiros.
drop policy if exists "dono vê os pedidos do próprio anúncio" on public.contact_requests;
create policy "dono vê os pedidos do próprio anúncio"
  on public.contact_requests for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = contact_requests.professional_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "dono atualiza os pedidos do próprio anúncio" on public.contact_requests;
create policy "dono atualiza os pedidos do próprio anúncio"
  on public.contact_requests for update
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = contact_requests.professional_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = contact_requests.professional_id
        and p.owner_id = auth.uid()
    )
  );

-- 3) A view pública precisa enxergar os campos novos (ela lista colunas uma a
--    uma justamente para nunca devolver `document`).
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, created_at
from public.professionals
where suspended = false;

grant select on public.professionals_public to anon, authenticated;
