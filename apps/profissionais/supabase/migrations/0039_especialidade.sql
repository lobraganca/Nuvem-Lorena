-- Especialidade do profissional.
--
-- A categoria diz o ofício ("Dentista", "Pintor", "Advogado"); ela é fechada
-- de propósito, porque é o que a busca filtra e o que faz dois anúncios
-- serem comparáveis. Mas o ofício sozinho esconde a diferença que faz a
-- pessoa escolher: quem procura aparelho não quer qualquer dentista, quer
-- ortodontista; quem vai pintar a casa não quer o pintor de portão; quem
-- precisa de inventário não quer o advogado trabalhista.
--
-- Texto livre, e não uma segunda lista fechada, por um motivo prático: cada
-- ofício tem as suas especialidades, e manter uma lista por ofício — as da
-- medicina sozinhas passam de cinquenta — seria uma lista que nunca está
-- certa e que envelhece sem ninguém perceber. Aqui quem sabe o nome certo é
-- quem exerce.
--
-- Curto de propósito (60 caracteres): é uma especialidade, não a segunda
-- descrição do anúncio. Sem o limite, este campo viraria o lugar onde se
-- escreve "o melhor da região, atendemos 24h, faça seu orçamento" — que é
-- exatamente o que a descrição já é.
alter table public.professionals
  add column if not exists especialidade text;

alter table public.professionals
  drop constraint if exists professionals_especialidade_tamanho;
alter table public.professionals
  add constraint professionals_especialidade_tamanho
  check (especialidade is null or length(btrim(especialidade)) <= 60);

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;
