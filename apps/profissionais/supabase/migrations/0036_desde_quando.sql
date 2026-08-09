-- "Está no app desde…" e "tem selo desde…".
--
-- Tempo é a prova social que ninguém consegue comprar num dia. Um anúncio de
-- dois anos com selo mantido há um ano e meio diz algo que nota nenhuma diz:
-- essa pessoa continua aqui, continua pagando para ser conferida, e ninguém
-- a tirou do ar nesse tempo todo. É o sinal que mais protege quem procura
-- contra o anúncio criado ontem para aplicar um golpe amanhã.
--
-- `created_at` já existia e serve para o primeiro. Faltava o segundo:
-- `verified_until` só diz até quando vale, e é reescrito a cada renovação —
-- ele nunca soube dizer desde quando.
alter table public.professionals
  add column if not exists verified_since timestamptz;

-- Quem já tem selo hoje não pode aparecer sem data: sem isto, o app diria
-- "com selo desde —" para toda a base atual. A aproximação usa a data do
-- cadastro, que é o mais próximo da verdade que este banco consegue provar.
update public.professionals
  set verified_since = created_at
  where verified = true and verified_since is null;

-- Carimba na virada de "sem selo" para "com selo", e só nela: a renovação
-- mensal reescreve `verified_until` toda vez, e recarimbar aqui zeraria
-- justamente o tempo que a coluna existe para acumular. Quem deixa o selo
-- cair e volta meses depois recomeça a contagem — porque foi isso mesmo que
-- aconteceu, e a data precisa dizer a verdade.
create or replace function public.professionals_carimba_selo()
returns trigger
language plpgsql
as $$
begin
  if new.verified = true and coalesce(old.verified, false) = false then
    new.verified_since := now();
  elsif new.verified = false then
    new.verified_since := null;
  end if;
  return new;
end;
$$;

drop trigger if exists professionals_carimba_selo_trigger on public.professionals;
create trigger professionals_carimba_selo_trigger
  before update on public.professionals
  for each row execute function public.professionals_carimba_selo();

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  cep, street, street_number, neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;
