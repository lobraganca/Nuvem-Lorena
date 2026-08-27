-- 0064 — o perfil ganha e-mail e telefone próprios.
--
-- Até aqui `profiles` guardava só nome e foto, e isso bastava porque a
-- única porta de entrada era o Google: ele entrega nome, foto e e-mail
-- junto com a conta, e o e-mail ficava em `auth.users`.
--
-- Com o login por telefone, duas coisas mudaram. Quem entra pelo número
-- não tem e-mail nenhum em `auth.users` — e quem entra pelo Google não tem
-- telefone. Cada porta traz metade do contato, e a outra metade não existe
-- em lugar nenhum.
--
-- Por que colunas próprias, e não mexer em `auth.users`: lá o e-mail é
-- CREDENCIAL, não contato. Trocá-lo dispara confirmação por link, que é um
-- fluxo inteiro — e um link de confirmação não volta para dentro do app
-- instalado, que é o mesmo problema que tirou o login do Google de lá.
-- Aqui são dados de contato, e nada mais.

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;

-- Preenche quem já existe, com o que a conta de login já sabe. Sem isto,
-- todo mundo que já usa o app apareceria com o perfil "incompleto" e seria
-- mandado preencher o que o sistema já tinha.
update public.profiles p
   set email = coalesce(p.email, u.email),
       phone = coalesce(p.phone, u.phone)
  from auth.users u
 where u.id = p.id
   and (p.email is null or p.phone is null);

-- E as contas novas passam a nascer com o que a porta de entrada trouxe.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    new.email,
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- --------------------------------------------------------------------
-- Confere a si mesma. Lê o pg_catalog, nunca o information_schema.
-- --------------------------------------------------------------------
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.profiles'::regclass
           and attname in ('email','phone') and not attisdropped) = 2
  then 'PRONTO — o perfil ja tem e-mail e telefone'
  else 'AINDA FALTA — as colunas nao foram criadas'
  end as resultado;
