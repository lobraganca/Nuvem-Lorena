set role autenticado;
create or replace function pg_temp.tenta(sql text) returns text
  language plpgsql as $$
begin execute sql; return 'PERMITIU'; exception when others then return 'BARROU'; end; $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select 'viajante se promove a admin' as caso,
  pg_temp.tenta($$update public.profiles set role='admin' where id=auth.uid()$$) r, 'BARROU' esperado
union all select 'viajante troca o proprio nome',
  pg_temp.tenta($$update public.profiles set name='Nome Novo' where id=auth.uid()$$), 'PERMITIU'
union all select 'viajante le dados legais alheios',
  case (select count(*) from public.business_legal) when 0 then 'BARROU' else 'PERMITIU' end, 'BARROU'
union all select 'viajante avalia a propria reserva ja feita',
  pg_temp.tenta($$insert into public.reviews (booking_id,business_id,author_id,tour_title,rating)
    values ('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
            '11111111-1111-1111-1111-111111111111','Trilha',5)$$), 'PERMITIU'
union all select 'viajante grava pagamento',
  pg_temp.tenta($$insert into public.payments (booking_id,method,paid_at,reference,amount)
    values ('cccccccc-0000-0000-0000-000000000001','pix',now(),'X',252)$$), 'BARROU';

select 'nome ficou como' caso, name r, 'Nome Novo' esperado from public.profiles where id=auth.uid();

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select 'dono se da o selo de verificado' caso,
  pg_temp.tenta($$update public.businesses set verified=true where id='aaaaaaaa-0000-0000-0000-000000000001'$$) r, 'BARROU' esperado
union all select 'dono edita a descricao da empresa',
  pg_temp.tenta($$update public.businesses set description='Trilhas na serra' where id='aaaaaaaa-0000-0000-0000-000000000001'$$), 'PERMITIU'
union all select 'dono le os proprios dados legais',
  case (select count(*) from public.business_legal) when 1 then 'PERMITIU' else 'BARROU' end, 'PERMITIU'
union all select 'dono le a reserva que recebeu',
  case (select count(*) from public.bookings) when 1 then 'PERMITIU' else 'BARROU' end, 'PERMITIU';

set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select 'estranho le reserva alheia' caso,
  case (select count(*) from public.bookings) when 0 then 'BARROU' else 'PERMITIU' end r, 'BARROU' esperado
union all select 'estranho avalia sem ter ido',
  pg_temp.tenta($$insert into public.reviews (booking_id,business_id,author_id,tour_title,rating)
    values ('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
            '44444444-4444-4444-4444-444444444444','Trilha',5)$$), 'BARROU'
union all select 'estranho le a vitrine',
  case (select count(*) from public.businesses) when 1 then 'PERMITIU' else 'BARROU' end, 'PERMITIU';

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select 'admin suspende empresa' caso,
  pg_temp.tenta($$update public.businesses set status='suspensa' where id='aaaaaaaa-0000-0000-0000-000000000001'$$) r, 'PERMITIU' esperado
union all select 'admin le todas as reservas',
  case (select count(*) from public.bookings) when 1 then 'PERMITIU' else 'BARROU' end, 'PERMITIU'
union all select 'admin le memorias de viagem',
  case (select count(*) from public.experiences) when 0 then 'BARROU' else 'PERMITIU' end, 'BARROU';
