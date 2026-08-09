-- Etiquetas de atendimento no anúncio.
--
-- Hoje o anúncio diz o que a pessoa faz e onde. Não diz *quando* nem *como* —
-- e é justamente isso que quem procura pergunta primeiro no WhatsApp:
-- "atende sábado?", "vai até o Praia?", "é urgente, dá pra hoje?". Cada uma
-- dessas perguntas é uma conversa que só existe porque o anúncio não
-- respondeu antes, e boa parte delas termina sem contratação.
--
-- Texto livre em vez de uma tabela de opções porque a lista vai mudar
-- (bairro, forma de pagamento, atendimento a idosos), e uma lista que muda
-- não merece uma migração por item. O que a tela oferece é fechado; a coluna
-- só guarda.
alter table public.professionals
  add column if not exists atributos text[] not null default '{}';

-- Teto por anúncio: quem marca tudo não está informando nada, e a etiqueta
-- perde exatamente o valor que a torna útil — ser um recorte.
alter table public.professionals
  drop constraint if exists professionals_atributos_limite;
alter table public.professionals
  add constraint professionals_atributos_limite
  check (array_length(atributos, 1) is null or array_length(atributos, 1) <= 8);

-- Índice GIN pelo mesmo motivo de `categories`: a busca por etiqueta é
-- "contém", e sem ele vira varredura da tabela inteira a cada filtro.
create index if not exists professionals_atributos_idx
  on public.professionals using gin (atributos);

-- A view precisa ser recriada para a coluna aparecer para quem procura: sem
-- isto a etiqueta existe no banco, é salva pelo painel e não chega à busca.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  cep, street, street_number, neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;
