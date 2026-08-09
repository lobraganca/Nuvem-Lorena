-- Catálogo de serviços do anúncio.
--
-- O que importa aqui é o preço nulo ser aceito: "sob orçamento" é resposta
-- legítima em quase todo serviço desta cidade, e um NOT NULL faria a pessoa
-- inventar um número — que vira discussão na hora de cobrar.
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

insert into public.professionals (id, owner_id, name, category, city, phone, entity_type)
values ('aaaa1111-0000-0000-0000-0000000000aa', 'aaaa1111-0000-0000-0000-000000000001',
        'Hotel Serra', 'Hotel', 'Itabirito', '31999990000', 'pj');

\echo '1) preco nulo (sob orcamento) e aceito: esperado 1'
insert into public.servicos_oferecidos (professional_id, nome, unidade)
values ('aaaa1111-0000-0000-0000-0000000000aa', 'Diária de casal', 'a diária');
select count(*) from public.servicos_oferecidos
 where professional_id = 'aaaa1111-0000-0000-0000-0000000000aa';

\echo '2) nome de uma letra e recusado (espera-se ERROR de check)'
insert into public.servicos_oferecidos (professional_id, nome)
values ('aaaa1111-0000-0000-0000-0000000000aa', 'x');

\echo '3) preco negativo e recusado (espera-se ERROR de check)'
insert into public.servicos_oferecidos (professional_id, nome, preco_centavos)
values ('aaaa1111-0000-0000-0000-0000000000aa', 'Diária simples', -100);

\echo '4) apagar o anuncio leva o catalogo junto: esperado 0'
delete from public.professionals where id = 'aaaa1111-0000-0000-0000-0000000000aa';
select count(*) from public.servicos_oferecidos
 where professional_id = 'aaaa1111-0000-0000-0000-0000000000aa';

insert into public.professionals (id, owner_id, name, category, city, phone, entity_type)
values ('aaaa1111-0000-0000-0000-0000000000bb', 'aaaa1111-0000-0000-0000-000000000001',
        'Laboratório Teste', 'Laboratório de análises', 'Itabirito', '31999990001', 'pj');
insert into public.servicos_oferecidos (professional_id, nome)
select 'aaaa1111-0000-0000-0000-0000000000bb', 'Exame ' || g from generate_series(1, 40) g;

\echo '5) 40 itens cabem: esperado 40'
select count(*) from public.servicos_oferecidos
 where professional_id = 'aaaa1111-0000-0000-0000-0000000000bb';

\echo '6) o de numero 41 e recusado (espera-se ERROR do gatilho)'
insert into public.servicos_oferecidos (professional_id, nome)
values ('aaaa1111-0000-0000-0000-0000000000bb', 'Exame 41');

delete from public.professionals where id = 'aaaa1111-0000-0000-0000-0000000000bb';
