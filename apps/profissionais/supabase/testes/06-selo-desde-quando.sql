-- Gatilho do "com selo desde…".
--
-- A coluna existe para acumular tempo, e o jeito mais fácil de estragar isso
-- é recarimbar a cada renovação: o selo é mensal, então o anúncio de dois
-- anos apareceria eternamente como "com selo desde o mês passado" — o
-- contrário exato do que a informação serve para dizer.
--
-- Rode depois de supabase/banco-completo.sql. Cada bloco imprime o esperado
-- ao lado do obtido.

insert into auth.users (id, email)
  values ('eeeeeeee-0000-0000-0000-000000000001', 'selo@teste.com')
  on conflict do nothing;
insert into public.profiles (id)
  values ('eeeeeeee-0000-0000-0000-000000000001')
  on conflict do nothing;

delete from public.professionals where id = 'eeeeeeee-0000-0000-0000-0000000000aa';
insert into public.professionals (id, owner_id, name, category, city, uf, phone)
values ('eeeeeeee-0000-0000-0000-0000000000aa', 'eeeeeeee-0000-0000-0000-000000000001',
        'Teste do selo', 'Pedreiro', 'Itabirito', 'MG', '31999990000');

\echo '1) sem selo: esperado t'
select verified_since is null as sem_data
  from public.professionals where id = 'eeeeeeee-0000-0000-0000-0000000000aa';

update public.professionals
   set verified = true, verified_until = now() + interval '30 days'
 where id = 'eeeeeeee-0000-0000-0000-0000000000aa';
\echo '2) ao ganhar o selo, carimba: esperado t'
select verified_since is not null as carimbou
  from public.professionals where id = 'eeeeeeee-0000-0000-0000-0000000000aa';

-- Finge que o selo foi ganho há 200 dias e renova a assinatura.
update public.professionals set verified_since = now() - interval '200 days'
 where id = 'eeeeeeee-0000-0000-0000-0000000000aa';
update public.professionals set verified_until = now() + interval '60 days'
 where id = 'eeeeeeee-0000-0000-0000-0000000000aa';
\echo '3) renovar NAO zera a contagem: esperado 200'
select round(extract(epoch from (now() - verified_since)) / 86400) as dias_de_selo
  from public.professionals where id = 'eeeeeeee-0000-0000-0000-0000000000aa';

update public.professionals set verified = false
 where id = 'eeeeeeee-0000-0000-0000-0000000000aa';
\echo '4) selo caiu, data some: esperado t'
select verified_since is null as limpou
  from public.professionals where id = 'eeeeeeee-0000-0000-0000-0000000000aa';

update public.professionals set verified = true
 where id = 'eeeeeeee-0000-0000-0000-0000000000aa';
\echo '5) voltou depois, contagem recomeca: esperado 0'
select round(extract(epoch from (now() - verified_since)) / 86400) as dias_de_selo
  from public.professionals where id = 'eeeeeeee-0000-0000-0000-0000000000aa';

delete from public.professionals where id = 'eeeeeeee-0000-0000-0000-0000000000aa';
