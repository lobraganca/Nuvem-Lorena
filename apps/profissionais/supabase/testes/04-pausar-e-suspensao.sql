-- Testa o pausar do dono e a proteção da suspensão (migration 0027).
--
-- O que precisa ser verdade: o dono pausa e despausa à vontade; o dono NÃO
-- consegue mexer em `suspended`; a administração consegue; e o anúncio
-- pausado some da busca pública sem sumir do banco.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('dddddddd-0000-0000-0000-000000000001', 'dono2@teste.com'),
  ('dddddddd-0000-0000-0000-000000000002', 'admin2@teste.com');

/* `whatsapp_verified` entrou aqui em 04/09: desde a 0076 (e de novo pela
   0117) a lista pública só mostra quem confirmou o telefone. Sem isso o
   teste media outra coisa — o anúncio nunca aparecia, pausado ou não. */
insert into public.professionals (id, owner_id, name, category, city, uf, bio, phone, entity_type)
values (
  'dddddddd-0000-0000-0000-000000000003',
  'dddddddd-0000-0000-0000-000000000001',
  'Serralheiro do Bairro', 'Serralheiro', 'Itabirito', 'MG', 'Portões e grades',
  '(31) 98888-0000', 'pf'
);

/* O telefone precisa estar confirmado para o cadastro aparecer na lista
   pública (regra da 0076, devolvida à view pela 0117). O gatilho da 0052
   não deixa ligar o selo por `update` comum — quem liga é a confirmação
   por código, que se identifica por esta variável de sessão. Sem isto o
   teste media outra coisa: o anúncio nunca aparecia, pausado ou não. */
set local app.confirmando_whatsapp = 'sim';
update public.professionals set whatsapp_verified = true
 where id = 'dddddddd-0000-0000-0000-000000000003';
set local app.confirmando_whatsapp = '';

create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'dddddddd-0000-0000-0000-000000000001'::uuid $$;

-- 1. O dono pausa.
update public.professionals set paused = true
 where id = 'dddddddd-0000-0000-0000-000000000003';

do $$
begin
  if exists (select 1 from public.professionals_public where id = 'dddddddd-0000-0000-0000-000000000003') then
    raise exception 'FALHOU: anúncio pausado continua na busca';
  end if;
  if not exists (select 1 from public.professionals where id = 'dddddddd-0000-0000-0000-000000000003') then
    raise exception 'FALHOU: pausar apagou o anúncio';
  end if;
end $$;

-- 2. O dono despausa e volta à busca.
update public.professionals set paused = false
 where id = 'dddddddd-0000-0000-0000-000000000003';

do $$
begin
  if not exists (select 1 from public.professionals_public where id = 'dddddddd-0000-0000-0000-000000000003') then
    raise exception 'FALHOU: anúncio não voltou para a busca';
  end if;
end $$;

-- 3. O dono NÃO suspende nem reativa (o buraco que existia).
do $$
begin
  begin
    update public.professionals set suspended = true
     where id = 'dddddddd-0000-0000-0000-000000000003';
    raise exception 'FALHOU: dono conseguiu mexer em suspended';
  exception when others then
    if position('Só a administração' in sqlerrm) = 0 then raise; end if;
  end;
end $$;

-- 4. A administração suspende.
insert into public.admins (user_id) values ('dddddddd-0000-0000-0000-000000000002')
  on conflict do nothing;

create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'dddddddd-0000-0000-0000-000000000002'::uuid $$;

update public.professionals set suspended = true, suspended_reason = 'teste'
 where id = 'dddddddd-0000-0000-0000-000000000003';

-- 5. E o dono não desfaz a suspensão.
create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'dddddddd-0000-0000-0000-000000000001'::uuid $$;

do $$
begin
  begin
    update public.professionals set suspended = false
     where id = 'dddddddd-0000-0000-0000-000000000003';
    raise exception 'FALHOU: dono reativou anúncio suspenso';
  exception when others then
    if position('Só a administração' in sqlerrm) = 0 then raise; end if;
  end;
end $$;

-- 6. Pausar continua funcionando para o dono mesmo com o anúncio suspenso —
--    são campos independentes, e o trigger não pode bloquear o update
--    inteiro só porque a linha está suspensa.
update public.professionals set paused = true
 where id = 'dddddddd-0000-0000-0000-000000000003';

rollback;

\echo 'OK: pausar e proteção da suspensão'
