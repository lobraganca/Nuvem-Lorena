-- ═══════════════════════════════════════════════════════════════════════
-- 22 — A empresa consegue destacar a própria vaga de graça?
-- ═══════════════════════════════════════════════════════════════════════
--
-- O destaque de vaga (0116) é PAGO, e a empresa tem `update` na própria
-- vaga — a mesma permissão com que ela edita, pausa e encerra. Sem a
-- trava, bastaria uma requisição escrita à mão para pôr a própria vaga no
-- topo sem pagar, e não haveria como saber que aconteceu.
--
-- Este teste exercita as três situações que importam:
--
--   1. a empresa tenta destacar a própria vaga        → não muda nada
--   2. a empresa edita OUTRA coisa da mesma vaga      → grava normal
--   3. a administração destaca                        → grava

\set ON_ERROR_STOP on
begin;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.usuario', true), '')::uuid
$$;

insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000e2201', '5531900002201', now())
on conflict (id) do nothing;

insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000e2202', '5531900002202', now())
on conflict (id) do nothing;

-- A conta 2202 é a administração.
insert into public.admins (user_id) values ('00000000-0000-4000-8000-0000000e2202')
on conflict (user_id) do nothing;

insert into public.companies (id, owner_id, company_name, city, uf, phone, responsible_name)
values ('00000000-0000-4000-8000-0000000e2210', '00000000-0000-4000-8000-0000000e2201',
        'Padaria do Teste', 'Itabirito', 'MG', '5531900002201', 'Fulana')
on conflict (id) do nothing;

-- Plano ligado: sem ele o gatilho da 0073 recusa a publicação, e o teste
-- pararia antes de chegar no que ele quer medir.
update public.companies
   set plano = 'pro', plano_ate = now() + interval '30 days'
 where id = '00000000-0000-4000-8000-0000000e2210';

set local teste.usuario = '00000000-0000-4000-8000-0000000e2201';

insert into public.job_listings (id, company_id, title, description, profession, city, uf,
                                 work_modality, status, destaque_ate)
values ('00000000-0000-4000-8000-0000000e2220', '00000000-0000-4000-8000-0000000e2210',
        'Padeiro', 'Padaria no Centro.', 'Padeiro', 'Itabirito', 'MG',
        'presencial', 'active', now() + interval '7 days')
on conflict (id) do nothing;

-- 1. O destaque pedido no INSERT pela própria empresa não vale.
select case
  when (select destaque_ate from public.job_listings
         where id = '00000000-0000-4000-8000-0000000e2220') is null
  then 'ok 1 — a empresa não nasce destacada'
  else 'FALHOU 1 — a empresa se destacou sozinha ao criar a vaga'
  end as resultado;

-- 2. A empresa tenta destacar por update.
update public.job_listings
   set destaque_ate = now() + interval '30 days'
 where id = '00000000-0000-4000-8000-0000000e2220';

select case
  when (select destaque_ate from public.job_listings
         where id = '00000000-0000-4000-8000-0000000e2220') is null
  then 'ok 2 — a empresa não se destaca sozinha'
  else 'FALHOU 2 — a empresa se destacou de graça'
  end as resultado;

-- 3. Editar outra coisa continua funcionando (o gatilho não pode derrubar
--    a gravação inteira — é por isso que ele devolve o valor antigo em vez
--    de recusar).
update public.job_listings
   set title = 'Padeiro (manhã)'
 where id = '00000000-0000-4000-8000-0000000e2220';

select case
  when (select title from public.job_listings
         where id = '00000000-0000-4000-8000-0000000e2220') = 'Padeiro (manhã)'
  then 'ok 3 — a empresa continua editando a vaga'
  else 'FALHOU 3 — o gatilho derrubou a edição normal'
  end as resultado;

-- 4. A administração destaca.
set local teste.usuario = '00000000-0000-4000-8000-0000000e2202';

update public.job_listings
   set destaque_ate = now() + interval '7 days'
 where id = '00000000-0000-4000-8000-0000000e2220';

select case
  when (select destaque_ate from public.job_listings
         where id = '00000000-0000-4000-8000-0000000e2220') > now()
  then 'PRONTO — só a administração destaca a vaga, e a edição normal continua'
  else 'FALHOU 4 — a administração não conseguiu destacar'
  end as resultado;

rollback;
