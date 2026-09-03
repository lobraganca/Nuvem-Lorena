-- Catálogo de serviços do anúncio.
--
-- O catálogo não guarda preço: o app direciona para a pessoa certa e entrega
-- o contato; valor é conversa entre quem contrata e quem faz. O que se testa
-- aqui são os limites que protegem a lista de virar lixo.
--
-- Rode depois de supabase/banco-completo.sql.

insert into auth.users (id, email)
  values ('aaaa1111-0000-0000-0000-000000000001', 'catalogo@teste.com')
  on conflict do nothing;
insert into public.profiles (id)
  values ('aaaa1111-0000-0000-0000-000000000001')
  on conflict do nothing;

delete from public.professionals where id in
  ('aaaa1111-0000-0000-0000-0000000000aa', 'aaaa1111-0000-0000-0000-0000000000bb');

insert into public.professionals (id, owner_id, name, category, city, uf, phone, entity_type)
values ('aaaa1111-0000-0000-0000-0000000000aa', 'aaaa1111-0000-0000-0000-000000000001',
        'Hotel Serra', 'Hotel', 'Itabirito', 'MG', '31999990000', 'pj');

\echo '1) item simples e aceito: esperado 1'
insert into public.servicos_oferecidos (professional_id, nome)
values ('aaaa1111-0000-0000-0000-0000000000aa', 'Hospedagem');
select count(*) from public.servicos_oferecidos
 where professional_id = 'aaaa1111-0000-0000-0000-0000000000aa';

\echo '2) nome de uma letra e recusado (espera-se ERROR de check)'
insert into public.servicos_oferecidos (professional_id, nome)
values ('aaaa1111-0000-0000-0000-0000000000aa', 'x');

\echo '4) apagar o anuncio leva o catalogo junto: esperado 0'
delete from public.professionals where id = 'aaaa1111-0000-0000-0000-0000000000aa';
select count(*) from public.servicos_oferecidos
 where professional_id = 'aaaa1111-0000-0000-0000-0000000000aa';

insert into public.professionals (id, owner_id, name, category, city, uf, phone, entity_type)
values ('aaaa1111-0000-0000-0000-0000000000bb', 'aaaa1111-0000-0000-0000-000000000001',
        'Laboratório Teste', 'Laboratório de análises', 'Itabirito', 'MG', '31999990001', 'pj');
insert into public.servicos_oferecidos (professional_id, nome)
select 'aaaa1111-0000-0000-0000-0000000000bb', 'Exame ' || g from generate_series(1, 40) g;

\echo '5) 40 itens cabem: esperado 40'
select count(*) from public.servicos_oferecidos
 where professional_id = 'aaaa1111-0000-0000-0000-0000000000bb';

\echo '6) o de numero 41 e recusado (espera-se ERROR do gatilho)'
insert into public.servicos_oferecidos (professional_id, nome)
values ('aaaa1111-0000-0000-0000-0000000000bb', 'Exame 41');

delete from public.professionals where id = 'aaaa1111-0000-0000-0000-0000000000bb';
