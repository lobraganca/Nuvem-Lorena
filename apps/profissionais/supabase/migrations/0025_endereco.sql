-- Endereço de atendimento do anúncio.
--
-- É opcional de propósito. Metade de quem anuncia aqui trabalha na casa do
-- cliente — eletricista, diarista, montador — e para essa gente o endereço
-- que existe é o de casa. Obrigar a preencher seria obrigar a publicar onde
-- se mora, em troca de nada.
--
-- Para quem tem ponto fixo (salão, oficina, loja), é o contrário: sem o
-- endereço, o anúncio não serve. Daí os campos existirem, e aparecerem no
-- perfil só quando preenchidos.
--
-- Guardado em partes, e não numa linha de texto só, porque bairro é o
-- recorte que as pessoas usam de verdade para escolher perto de casa — e um
-- campo separado permite filtrar por ele depois sem migração nova.

alter table public.professionals
  add column if not exists cep text,
  add column if not exists street text,
  add column if not exists street_number text,
  add column if not exists neighborhood text;

-- A view pública lista colunas uma a uma, então precisa ser recriada para
-- enxergar as novas. O endereço é público por natureza: é para ser
-- encontrado que ele foi preenchido.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  cep, street, street_number, neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, created_at
from public.professionals
where suspended = false;

grant select on public.professionals_public to anon, authenticated;
