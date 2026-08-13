-- --------------------------------------------------------------------
-- O bairro passa a seguir a mesma caixa do resto do endereço.
--
-- Desde a 0037 a view escondia cep, rua e número de quem não marcou
-- "mostrar endereço" — mas devolvia o bairro para todo mundo. A intenção
-- na época era boa: bairro é o recorte que as pessoas usam para escolher
-- perto de casa, e ele sozinho não leva ninguém até a porta.
--
-- Só que a caixa no cadastro diz "mostrar endereço", e bairro é endereço.
-- Quem desmarcou entendeu que nada de onde mora seria publicado, e via o
-- bairro aparecer assim mesmo. Quando o que a tela promete e o que ela faz
-- divergem, quem decide é a promessa — ainda mais tratando-se de onde a
-- pessoa mora.
--
-- Vale para metade de quem anuncia aqui: eletricista, diarista, montador
-- trabalham na casa do cliente, e o endereço que eles têm é o de casa.
--
-- A view é recriada inteira porque `create or replace view` não aceita
-- mudar o tipo/origem de uma coluna existente. Colunas idênticas às da
-- 0039, exceto `neighborhood`.
-- --------------------------------------------------------------------
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  case when mostrar_endereco then neighborhood end as neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  mostrar_endereco, created_at
from public.professionals;

grant select on public.professionals_public to anon, authenticated;
