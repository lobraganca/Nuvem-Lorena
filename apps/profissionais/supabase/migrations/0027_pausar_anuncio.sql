-- Pausar o próprio anúncio — e proteger a suspensão da administração.
--
-- São duas coisas que pareciam uma só e não são:
--
-- `suspended` é castigo: a administração tira o anúncio do ar por denúncia
-- procedente. `paused` é escolha: quem viajou, está sem agenda ou parou de
-- atender por um tempo tira o anúncio da busca e o traz de volta quando
-- quiser, sem perder avaliações nem ter que cadastrar tudo de novo.
--
-- Guardar as duas no mesmo campo seria dar ao anunciante suspenso o botão de
-- se reativar. E é exatamente isso que acontecia até aqui: a policy de update
-- deixa o dono mudar qualquer coluna do próprio anúncio, e `suspended` é uma
-- coluna. Quem fosse tirado do ar por golpe podia voltar sozinho chamando a
-- API — não pela tela, que não oferece o botão, mas RLS não protege o que a
-- tela esconde.

alter table public.professionals
  add column if not exists paused boolean not null default false;

-- Impede que o dono mexa no que é da administração.
--
-- Admin continua podendo tudo: a checagem só exige que quem alterou
-- `suspended` esteja em `public.admins`.
create or replace function public.professionals_protege_suspensao()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.suspended is distinct from old.suspended
     or new.suspended_reason is distinct from old.suspended_reason then
    if not exists (select 1 from public.admins a where a.user_id = auth.uid()) then
      raise exception 'Só a administração pode suspender ou reativar um anúncio.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists professionals_protege_suspensao_trigger on public.professionals;
create trigger professionals_protege_suspensao_trigger
  before update on public.professionals
  for each row execute function public.professionals_protege_suspensao();

-- A busca pública ignora tanto o suspenso quanto o pausado. Para quem
-- procura, os dois são a mesma coisa: não está atendendo agora.
--
-- O anúncio pausado continua existindo para o dono (a tela do painel lê a
-- tabela, não a view), com avaliações e histórico intactos.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  cep, street, street_number, neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;
