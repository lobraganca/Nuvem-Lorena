-- Um anúncio, vários serviços.
--
-- Até aqui cada anúncio tinha UMA categoria, então quem faz encanamento e
-- elétrica precisava criar dois anúncios — dois cadastros para manter, duas
-- reputações separadas, e a pessoa aparecendo duas vezes na busca. Agora o
-- anúncio carrega uma lista.
--
-- `category` continua existindo como a categoria principal: é o que aparece
-- em destaque no card e é o que o patrocínio de categoria usa. `categories`
-- é a lista completa, e é ela que a busca consulta.

alter table public.professionals
  add column if not exists categories text[] not null default '{}';

-- Backfill: sem isto, todo anúncio existente sairia da busca no instante em
-- que ela passasse a filtrar pela lista.
update public.professionals
  set categories = array[category]
  where categories = '{}' and coalesce(category, '') <> '';

-- Índice GIN é o que faz `categories @> array['Encanador']` usar índice em
-- vez de varrer a tabela inteira.
create index if not exists professionals_categories_idx
  on public.professionals using gin (categories);

-- Garante que a categoria principal está sempre dentro da lista — a busca
-- olha só para `categories`, então uma principal fora dela sumiria da busca
-- pela própria categoria.
create or replace function public.sincroniza_categorias()
returns trigger
language plpgsql
as $$
begin
  if new.category is not null and new.category <> '' and not (new.category = any(new.categories)) then
    new.categories := array_prepend(new.category, new.categories);
  end if;
  return new;
end;
$$;

drop trigger if exists professionals_sincroniza_categorias on public.professionals;
create trigger professionals_sincroniza_categorias
  before insert or update on public.professionals
  for each row execute function public.sincroniza_categorias();

-- A view pública lista colunas uma a uma (para nunca devolver `document`),
-- então precisa ser recriada para enxergar a coluna nova.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, created_at
from public.professionals
where suspended = false;

grant select on public.professionals_public to anon, authenticated;
