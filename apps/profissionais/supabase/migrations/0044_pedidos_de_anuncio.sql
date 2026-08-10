-- --------------------------------------------------------------------
-- Pedidos de anúncio ("quero aparecer aqui").
--
-- Diferente de `suggestions`: uma sugestão é opinião sobre o app e não
-- precisa de resposta; isto é alguém querendo comprar, e sem o telefone
-- junto o pedido não vira venda nenhuma — a conversa de banner nesta
-- cidade acontece por WhatsApp, não por e-mail.
--
-- Mesmo padrão de segurança de `suggestions` e `reports`: qualquer um
-- envia (inclusive sem login), só admin lê.
-- --------------------------------------------------------------------
create table if not exists public.banner_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  nome text not null,
  contato text not null,
  -- Onde a pessoa quer aparecer. 'tanto_faz' é resposta legítima e comum:
  -- quem nunca anunciou não sabe a diferença entre os dois lugares, e
  -- obrigar a escolher só faria perder o pedido.
  local text not null default 'tanto_faz'
    check (local in ('busca', 'boas_vindas', 'tanto_faz')),
  cidade text,
  mensagem text,
  status text not null default 'novo'
    check (status in ('novo', 'em_conversa', 'fechado', 'sem_interesse')),
  created_at timestamptz not null default now()
);

alter table public.banner_leads enable row level security;

drop policy if exists "qualquer um pede para anunciar" on public.banner_leads;
create policy "qualquer um pede para anunciar"
  on public.banner_leads for insert
  with check (true);

-- Sem select público de propósito: são nome e telefone de comerciantes da
-- cidade. Uma lista dessas aberta na API é lista de contatos pronta para
-- quem quiser copiar.
drop policy if exists "admin vê os pedidos de anúncio" on public.banner_leads;
create policy "admin vê os pedidos de anúncio"
  on public.banner_leads for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "admin atualiza o pedido de anúncio" on public.banner_leads;
create policy "admin atualiza o pedido de anúncio"
  on public.banner_leads for update
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "admin apaga o pedido de anúncio" on public.banner_leads;
create policy "admin apaga o pedido de anúncio"
  on public.banner_leads for delete
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

create index if not exists banner_leads_status_idx
  on public.banner_leads (status, created_at desc);
