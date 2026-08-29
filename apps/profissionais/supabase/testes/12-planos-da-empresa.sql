-- Os planos de quem contrata (migration 0072).
--
-- Aqui há dinheiro do outro lado, que é exatamente onde alguém tenta passar
-- por fora. Este teste fixa que o teto do plano e o teto de ondas são do
-- BANCO, não da tela.

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

insert into public.job_listings
  (id, company_id, title, profession, description, work_modality, city, uf)
values
  ('22220000-0000-0000-0000-000000000001', 'caaa0000-0000-0000-0000-000000000001',
   'Vaga 1', 'Vendedor', 'x', 'presencial', 'Itabirito', 'MG'),
  ('22220000-0000-0000-0000-000000000002', 'caaa0000-0000-0000-0000-000000000001',
   'Vaga 2', 'Vendedor', 'x', 'presencial', 'Itabirito', 'MG'),
  ('22220000-0000-0000-0000-000000000003', 'caaa0000-0000-0000-0000-000000000001',
   'Vaga 3', 'Vendedor', 'x', 'presencial', 'Itabirito', 'MG');

do $$
begin
  -- 1. Sem plano, não anuncia.
  begin
    update public.job_listings set anunciada_ate = now() + interval '30 days'
     where id = '22220000-0000-0000-0000-000000000001';
    raise exception 'FALHOU: anunciou sem plano nenhum';
  exception when others then
    if position('não tem plano ativo' in sqlerrm) = 0 then raise; end if;
  end;

  -- 2. Plano vencido é o mesmo que plano nenhum. É o caso que a data
  --    resolve sozinha, e o que um booleano deixaria passar para sempre.
  update public.companies
     set plano = 'pro', plano_ate = now() - interval '1 day'
   where id = 'caaa0000-0000-0000-0000-000000000001';
  begin
    update public.job_listings set anunciada_ate = now() + interval '30 days'
     where id = '22220000-0000-0000-0000-000000000001';
    raise exception 'FALHOU: plano vencido continuou anunciando';
  exception when others then
    if position('não tem plano ativo' in sqlerrm) = 0 then raise; end if;
  end;

  -- 3. Pro: uma vaga anunciada, e só.
  update public.companies
     set plano = 'pro', plano_ate = now() + interval '30 days'
   where id = 'caaa0000-0000-0000-0000-000000000001';

  update public.job_listings set anunciada_ate = now() + interval '30 days'
   where id = '22220000-0000-0000-0000-000000000001';

  if public.vagas_anunciadas_agora('caaa0000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'FALHOU: a primeira vaga anunciada nao contou';
  end if;

  begin
    update public.job_listings set anunciada_ate = now() + interval '30 days'
     where id = '22220000-0000-0000-0000-000000000002';
    raise exception 'FALHOU: plano pro anunciou a segunda vaga';
  exception when others then
    if position('permite 1 vaga' in sqlerrm) = 0 then raise; end if;
  end;

  -- 4. Renovar o anúncio da MESMA vaga não esbarra nela mesma. Sem o
  --    desconto do gatilho, a empresa do plano Pro nunca conseguiria
  --    renovar — o teto seria batido pela própria vaga que ela renova.
  update public.job_listings set anunciada_ate = now() + interval '60 days'
   where id = '22220000-0000-0000-0000-000000000001';

  -- 5. Subindo de plano, as outras entram.
  update public.companies set plano = 'tres'
   where id = 'caaa0000-0000-0000-0000-000000000001';

  update public.job_listings set anunciada_ate = now() + interval '30 days'
   where id = '22220000-0000-0000-0000-000000000002';
  update public.job_listings set anunciada_ate = now() + interval '30 days'
   where id = '22220000-0000-0000-0000-000000000003';

  if public.vagas_anunciadas_agora('caaa0000-0000-0000-0000-000000000001') <> 3 then
    raise exception 'FALHOU: o plano de tres nao deixou as tres';
  end if;

  raise notice 'PASSOU: o teto do plano vale, e o anuncio vencido libera sozinho';
end $$;

-- ── Duas ondas por vaga ────────────────────────────────────────────────
do $$
begin
  insert into public.job_dispatches (job_listing_id, wave, professionals_count, status)
  values ('22220000-0000-0000-0000-000000000001', 1, 4, 'sent');
  insert into public.job_dispatches (job_listing_id, wave, professionals_count, status)
  values ('22220000-0000-0000-0000-000000000001', 2, 11, 'sent');

  begin
    insert into public.job_dispatches (job_listing_id, wave, professionals_count, status)
    values ('22220000-0000-0000-0000-000000000001', 3, 30, 'sent');
    raise exception 'FALHOU: abriu a terceira onda da mesma vaga';
  exception when others then
    if position('2 ondas' in sqlerrm) = 0 then raise; end if;
  end;

  -- O teto é por VAGA: outra vaga começa do zero.
  insert into public.job_dispatches (job_listing_id, wave, professionals_count, status)
  values ('22220000-0000-0000-0000-000000000002', 1, 4, 'sent');

  raise notice 'PASSOU: duas ondas por vaga, e cada vaga tem as suas';
end $$;

rollback;
