-- Papel sem privilégio, como o do visitante autenticado no Supabase.
-- Papéis do Postgres pertencem ao servidor inteiro, não ao banco: recriar o
-- banco de teste não apaga o papel, e rodar o teste duas vezes dava erro.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'autenticado') then
    create role autenticado nologin;
  end if;
end $$;
grant usage on schema public to autenticado;
grant all on all tables in schema public to autenticado;
grant execute on all functions in schema public to autenticado;

-- Três pessoas: uma viajante, um dono de agência, e a administradora.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'viajante@x.com'),
  ('22222222-2222-2222-2222-222222222222', 'dono@x.com'),
  ('33333333-3333-3333-3333-333333333333', 'lorena@x.com'),
  ('44444444-4444-4444-4444-444444444444', 'estranho@x.com');

update public.profiles set role = 'admin'
  where id = '33333333-3333-3333-3333-333333333333';

insert into public.businesses (id, owner_id, name, type, city, email)
values ('aaaaaaaa-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222',
        'Serra Viva', 'Agência', 'Petrópolis', 'c@serra.com');

insert into public.business_legal
  (business_id, kind, legal_name, document, cep, address, district, city, state,
   representative, representative_cpf, business_email, business_phone)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'juridica', 'Serra Viva LTDA',
        '11.222.333/0001-81', '25680-000', 'Rua X', 'Centro', 'Petrópolis', 'RJ',
        'Ana', '111.444.777-35', 'c@serra.com', '(24) 99999-8888');

insert into public.tours (id, business_id, title, price_from)
values ('bbbbbbbb-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001', 'Trilha', 120);

insert into public.bookings
  (id, traveler_id, business_id, tour_id, business_name, tour_title, unit_price,
   travel_date, travelers, subtotal, service_fee_rate, service_fee, total_price,
   business_payout, cancellation_policy, status)
values ('cccccccc-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000001', 'Serra Viva', 'Trilha', 120,
        current_date - 1, 2, 240, 0.05, 12, 252, 240, 'moderada', 'confirmada');

set role autenticado;

\echo '--- 1. viajante tenta virar administradora ---'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
