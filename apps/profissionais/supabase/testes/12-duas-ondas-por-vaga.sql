-- Duas ondas por vaga (migration 0072).
--
-- O teto por ANÚNCIO que este arquivo testava foi aposentado pela 0073: o
-- plano deixou de ser sobre anunciar e virou a porta da vaga, e quem testa
-- isso agora é o 13-plano-e-a-porta.sql. Aqui ficou o que continua sendo
-- desta migration — o direito de 2 ondas por vaga.

begin;

insert into auth.users (id, phone, phone_confirmed_at) values
  ('dddd0000-0000-0000-0000-00000000000a', '5531977770001', now())
on conflict do nothing;

insert into public.companies
  (id, owner_id, company_name, city, uf, phone, responsible_name, description)
values
  ('caaa0000-0000-0000-0000-000000000001', 'dddd0000-0000-0000-0000-00000000000a',
   'Loja do Bairro', 'Itabirito', 'MG', '(31) 97777-0001', 'Ana', 'x');

create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'dddd0000-0000-0000-0000-00000000000a'::uuid $$;
select public.confirmar_telefone_empresa('caaa0000-0000-0000-0000-000000000001');

-- Plano ilimitado para o teste não esbarrar no teto de vagas, que não é o
-- assunto daqui.
update public.companies
   set plano = 'ilimitado', plano_ate = now() + interval '30 days'
 where id = 'caaa0000-0000-0000-0000-000000000001';

insert into public.job_listings
  (id, company_id, title, profession, description, work_modality, city, uf)
values
  ('22220000-0000-0000-0000-000000000001', 'caaa0000-0000-0000-0000-000000000001',
   'Vaga 1', 'Vendedor', 'x', 'presencial', 'Itabirito', 'MG'),
  ('22220000-0000-0000-0000-000000000002', 'caaa0000-0000-0000-0000-000000000001',
   'Vaga 2', 'Vendedor', 'x', 'presencial', 'Itabirito', 'MG');

do $$
begin
  insert into public.job_dispatches (job_listing_id, wave, professionals_count, status)
  values ('22220000-0000-0000-0000-000000000001', 1, 4, 'sent');
  insert into public.job_dispatches (job_listing_id, wave, professionals_count, status)
  values ('22220000-0000-0000-0000-000000000001', 2, 11, 'sent');

  -- A terceira não abre: cada vaga tem direito a 2 ondas.
  begin
    insert into public.job_dispatches (job_listing_id, wave, professionals_count, status)
    values ('22220000-0000-0000-0000-000000000001', 3, 30, 'sent');
    raise exception 'FALHOU: abriu a terceira onda da mesma vaga';
  exception when others then
    if position('2 ondas' in sqlerrm) = 0 then raise; end if;
  end;

  -- O teto é por VAGA: outra vaga começa do zero. É o que garante que
  -- alargar a busca de uma vaga não roube a onda da vaga seguinte.
  insert into public.job_dispatches (job_listing_id, wave, professionals_count, status)
  values ('22220000-0000-0000-0000-000000000002', 1, 4, 'sent');

  raise notice 'PASSOU: duas ondas por vaga, e cada vaga tem as suas';
end $$;

rollback;
