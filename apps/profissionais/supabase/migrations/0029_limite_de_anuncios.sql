-- Vários anúncios por pessoa, sem virar terra de ninguém.
--
-- Ter mais de um anúncio é legítimo: quem é fotógrafo e também dá aula de
-- violão tem duas vitrines diferentes, com fotos, textos e reputações
-- separadas — e amontoar isso num anúncio só piora para quem procura.
--
-- O que não pode é o mesmo serviço repetido. Cinco anúncios de "Eletricista"
-- na mesma cidade não informam nada a mais: só empurram os concorrentes para
-- baixo e transformam a busca numa disputa de quem cadastra mais vezes. Quem
-- perde é quem procura, que vê a mesma pessoa cinco vezes e desiste.
--
-- Duas travas, ambas no servidor:
--   1. Nenhum serviço repetido entre os anúncios da mesma pessoa na mesma
--      cidade.
--   2. Teto de anúncios por conta.

alter table public.professionals
  add column if not exists paused boolean not null default false;

create or replace function public.professionals_evita_repetidos()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  quantos int;
  conflito text;
begin
  -- 1. Serviço repetido na mesma cidade, entre anúncios do mesmo dono.
  select c into conflito
    from public.professionals p, unnest(p.categories) as c
   where p.owner_id = new.owner_id
     and p.id is distinct from new.id
     and lower(p.city) = lower(new.city)
     and c = any(new.categories)
   limit 1;

  if conflito is not null then
    raise exception 'Você já tem um anúncio de "%" em %. Edite o que existe em vez de criar outro igual.',
      conflito, new.city;
  end if;

  -- 2. Teto por conta. Cinco cobre com folga quem realmente faz coisas
  --    diferentes, e barra quem quer ocupar a busca.
  if tg_op = 'INSERT' then
    select count(*) into quantos from public.professionals where owner_id = new.owner_id;
    if quantos >= 5 then
      raise exception 'Você já tem 5 anúncios, que é o limite por conta.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists professionals_evita_repetidos_trigger on public.professionals;
create trigger professionals_evita_repetidos_trigger
  before insert or update on public.professionals
  for each row execute function public.professionals_evita_repetidos();
