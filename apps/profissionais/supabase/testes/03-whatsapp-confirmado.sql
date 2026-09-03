-- Testa a confirmação do WhatsApp (migration 0024).
--
-- O que precisa ser verdade: o selo não pode ser escrito pelo navegador, só
-- pela função que confere o Auth; a função recusa quando o Auth não confirmou
-- ou quando o número confirmado é outro; e trocar o número derruba o selo.

\set ON_ERROR_STOP on

begin;

-- Duas contas: a dona do anúncio e uma estranha.
insert into auth.users (id, email, phone, phone_confirmed_at)
values
  ('cccccccc-0000-0000-0000-000000000001', 'dona@teste.com', null, null),
  ('cccccccc-0000-0000-0000-000000000002', 'outra@teste.com', null, null);

-- `profiles` não é inserido aqui: o trigger de criação de perfil já cria uma
-- linha para cada usuário novo do Auth.

insert into public.professionals (id, owner_id, name, category, city, uf, bio, phone, whatsapp, entity_type)
values (
  'cccccccc-0000-0000-0000-000000000003',
  'cccccccc-0000-0000-0000-000000000001',
  'Costureira da Serra', 'Costureira', 'Itabirito', 'MG', 'Conserto e ajuste',
  '(31) 99999-1111', '(31) 99999-1111', 'pf'
);

-- 1. Nasce sem selo, mesmo se o insert tentar mandar true.
do $$
begin
  if (select whatsapp_verified from public.professionals where id = 'cccccccc-0000-0000-0000-000000000003') then
    raise exception 'FALHOU: anúncio nasceu verificado';
  end if;
end $$;

-- 2. Update direto (o que o navegador faria) tem que ser recusado.
do $$
begin
  begin
    update public.professionals set whatsapp_verified = true
     where id = 'cccccccc-0000-0000-0000-000000000003';
    raise exception 'FALHOU: update direto marcou o selo';
  exception when others then
    if position('confirmação por código' in sqlerrm) = 0 then raise; end if;
  end;
end $$;

-- 3. Sem confirmação no Auth, a função recusa.
create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'cccccccc-0000-0000-0000-000000000001'::uuid $$;

do $$
begin
  begin
    perform public.confirmar_whatsapp('cccccccc-0000-0000-0000-000000000003');
    raise exception 'FALHOU: confirmou sem o Auth ter confirmado';
  exception when others then
    if position('ainda não foi confirmado' in sqlerrm) = 0 then raise; end if;
  end;
end $$;

-- 4. Auth confirmou, mas outro número: continua recusando.
update auth.users set phone = '5531988882222', phone_confirmed_at = now()
 where id = 'cccccccc-0000-0000-0000-000000000001';

do $$
begin
  begin
    perform public.confirmar_whatsapp('cccccccc-0000-0000-0000-000000000003');
    raise exception 'FALHOU: confirmou com número diferente do anúncio';
  exception when others then
    if position('diferente do que está no anúncio' in sqlerrm) = 0 then raise; end if;
  end;
end $$;

-- 5. Número certo (em formato internacional, como o Auth guarda): confirma.
update auth.users set phone = '5531999991111'
 where id = 'cccccccc-0000-0000-0000-000000000001';

do $$
begin
  perform public.confirmar_whatsapp('cccccccc-0000-0000-0000-000000000003');
  if not (select whatsapp_verified from public.professionals where id = 'cccccccc-0000-0000-0000-000000000003') then
    raise exception 'FALHOU: não marcou o selo com tudo certo';
  end if;
end $$;

-- 6. Estranha não confirma anúncio alheio.
create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'cccccccc-0000-0000-0000-000000000002'::uuid $$;

do $$
begin
  begin
    perform public.confirmar_whatsapp('cccccccc-0000-0000-0000-000000000003');
    raise exception 'FALHOU: outra pessoa confirmou anúncio alheio';
  exception when others then
    if position('Só o dono' in sqlerrm) = 0 then raise; end if;
  end;
end $$;

-- 7. Trocar o número derruba o selo — senão bastaria confirmar o próprio
--    celular e depois trocar pelo número do golpe.
create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'cccccccc-0000-0000-0000-000000000001'::uuid $$;

update public.professionals set whatsapp = '(31) 97777-3333'
 where id = 'cccccccc-0000-0000-0000-000000000003';

do $$
begin
  if (select whatsapp_verified from public.professionals where id = 'cccccccc-0000-0000-0000-000000000003') then
    raise exception 'FALHOU: selo sobreviveu à troca do número';
  end if;
end $$;

rollback;

\echo 'OK: confirmação do WhatsApp'
