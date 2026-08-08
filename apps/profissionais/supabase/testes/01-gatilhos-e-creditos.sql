\set ON_ERROR_STOP off
insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222','b@b.com');
insert into public.professionals (owner_id, name, category, phone)
values ('22222222-2222-2222-2222-222222222222','Ana Eletricista','Eletricista','31988887777');

\echo '--- gatilho de categorias (deve mostrar {Eletricista}) ---'
select name, categories from public.professionals where name='Ana Eletricista';

\echo '--- varios servicos: categories com 2, category fora da lista ---'
update public.professionals set categories = array['Pintor'] where name='Ana Eletricista';
select category, categories from public.professionals where name='Ana Eletricista';

\echo '--- add_lead_credits: 10 + 5 deve dar 15 ---'
select public.add_lead_credits((select id from public.professionals where name='Ana Eletricista'), 10);
select public.add_lead_credits((select id from public.professionals where name='Ana Eletricista'), 5);
select balance from public.lead_credits where professional_id=(select id from public.professionals where name='Ana Eletricista');

\echo '--- add_lead_credits com valor invalido deve dar erro ---'
select public.add_lead_credits((select id from public.professionals where name='Ana Eletricista'), 0);

\echo '--- consume_lead_credit: deve devolver true e baixar para 14 ---'
select public.consume_lead_credit((select id from public.professionals where name='Ana Eletricista'));
select balance from public.lead_credits where professional_id=(select id from public.professionals where name='Ana Eletricista');
