-- Fonte de renda: pagamento por contato (pay-per-lead), alternativa à
-- assinatura fixa do selo. O dono do anúncio escolhe, por profissional,
-- entre "whatsapp_livre" (grátis, ilimitado — comportamento atual) e
-- "pay_per_lead" (cada clique no WhatsApp consome 1 crédito pré-pago).

alter table public.professionals
  add column contact_mode text not null default 'whatsapp_livre'
    check (contact_mode in ('whatsapp_livre', 'pay_per_lead'));

-- Saldo de créditos pré-pagos por profissional. Preço por lead configurável
-- por linha para permitir promoções futuras sem migração nova; hoje sempre
-- criado com o preço padrão (R$2,90 = 290 centavos).
create table public.lead_credits (
  professional_id uuid primary key references public.professionals(id) on delete cascade,
  balance integer not null default 0,
  price_per_lead_cents integer not null default 290,
  updated_at timestamptz not null default now()
);

-- Um registro por clique no WhatsApp que consumiu (ou tentou consumir) um
-- crédito. `charged` fica true quando o crédito foi de fato debitado —
-- mantido para permitir, no futuro, registrar tentativas sem saldo.
create table public.lead_events (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  charged boolean not null default true
);

create index lead_events_professional_id_idx on public.lead_events (professional_id);

alter table public.lead_credits enable row level security;
alter table public.lead_events enable row level security;

-- lead_credits: só o dono do anúncio vê o próprio saldo. Não há insert/update
-- público — o saldo é criado/incrementado pela Edge Function de compra de
-- créditos (service_role) e decrementado pela função `consume_lead_credit`
-- abaixo (security definer, chamada via RPC pelo próprio dono do contato).
create policy "dono vê os créditos do seu anúncio"
  on public.lead_credits for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = lead_credits.professional_id
        and p.owner_id = auth.uid()
    )
  );

-- lead_events: só o dono do anúncio vê os próprios leads. Insert é feito
-- exclusivamente pela função `consume_lead_credit` (security definer), não
-- há policy pública de insert.
create policy "dono vê os leads do seu anúncio"
  on public.lead_events for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = lead_events.professional_id
        and p.owner_id = auth.uid()
    )
  );

-- Consome 1 crédito do profissional de forma atômica (evita condição de
-- corrida indo a saldo negativo com cliques concorrentes). Retorna true se
-- conseguiu debitar, false se não havia saldo (ou não existe registro de
-- créditos ainda). Chamada via RPC pelo client, autenticado ou anônimo,
-- antes de abrir o link do WhatsApp quando `contact_mode = 'pay_per_lead'`.
create or replace function public.consume_lead_credit(professional_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rows integer;
begin
  update public.lead_credits
    set balance = balance - 1, updated_at = now()
    where lead_credits.professional_id = consume_lead_credit.professional_id
      and balance > 0;

  get diagnostics updated_rows = row_count;

  if updated_rows > 0 then
    insert into public.lead_events (professional_id, user_id, charged)
    values (consume_lead_credit.professional_id, auth.uid(), true);
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.consume_lead_credit(uuid) to anon, authenticated;

-- Atualiza a view pública de professionals para incluir o novo contact_mode
-- (necessário para a ProfessionalPage decidir se mostra/esconde o botão de
-- WhatsApp sem precisar de outra query).
create or replace view public.professionals_public as
select
  id, owner_id, name, category, city, bio, phone, entity_type,
  company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode, created_at
from public.professionals;

grant select on public.professionals_public to anon, authenticated;

-- Saldo de créditos pré-pagos é público-legível de forma restrita: a
-- ProfessionalPage precisa saber se há saldo > 0 para habilitar o botão de
-- WhatsApp, sem expor o saldo exato nem o preço por lead a qualquer um.
create or replace view public.lead_credits_public as
select professional_id, (balance > 0) as has_balance
from public.lead_credits;

grant select on public.lead_credits_public to anon, authenticated;
