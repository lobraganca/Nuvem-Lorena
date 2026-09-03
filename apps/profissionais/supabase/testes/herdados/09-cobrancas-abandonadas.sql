-- --------------------------------------------------------------------
-- O expurgo apaga cobrança abandonada — e só ela.
--
-- Esta função apaga linhas de cobrança. Um erro aqui não dá erro na tela:
-- ele some com o registro de alguém que pagou, e ninguém percebe até o
-- cliente reclamar que perdeu o benefício. Por isso os quatro casos estão
-- escritos, e não só o que a gente quer que aconteça.
--
-- Rode com:
--   psql "$SUPABASE_DB_URL" -f supabase/testes/09-cobrancas-abandonadas.sql
-- --------------------------------------------------------------------
begin;

create temporary table _antes on commit drop as
  select id, status from public.subscriptions;

insert into public.subscriptions (id, professional_id, type, status, created_at)
select
  '11111111-1111-1111-1111-111111111111',
  p.id, 'verification', 'pending', now() - interval '3 days'
from public.professionals p limit 1;

insert into public.subscriptions (id, professional_id, type, status, created_at)
select
  '22222222-2222-2222-2222-222222222222',
  p.id, 'verification', 'pending', now() - interval '3 days'
from public.professionals p limit 1;

insert into public.subscriptions (id, professional_id, type, status, created_at)
select
  '33333333-3333-3333-3333-333333333333',
  p.id, 'verification', 'pending', now() - interval '10 minutes'
from public.professionals p limit 1;

-- A do meio tem pagamento vinculado: não é abandono, é algo que deu errado
-- e precisa ser investigado — nunca varrido para debaixo do tapete.
insert into public.processed_payments (payment_id, subscription_id)
values ('teste-09-pagamento', '22222222-2222-2222-2222-222222222222');

select public.expurgar_dados_antigos();

do $$
declare
  sobrou_abandonada boolean;
  sumiu_com_pagamento boolean;
  sumiu_recente boolean;
begin
  select exists (select 1 from public.subscriptions
                  where id = '11111111-1111-1111-1111-111111111111')
    into sobrou_abandonada;
  select not exists (select 1 from public.subscriptions
                      where id = '22222222-2222-2222-2222-222222222222')
    into sumiu_com_pagamento;
  select not exists (select 1 from public.subscriptions
                      where id = '33333333-3333-3333-3333-333333333333')
    into sumiu_recente;

  if sobrou_abandonada then
    raise exception 'FALHOU: cobrança abandonada de 3 dias deveria ter sido apagada';
  end if;
  if sumiu_com_pagamento then
    raise exception 'FALHOU: cobrança COM pagamento vinculado foi apagada';
  end if;
  if sumiu_recente then
    raise exception 'FALHOU: cobrança de 10 minutos foi apagada — a pessoa ainda pode estar pagando';
  end if;

  raise notice 'OK: apagou só a abandonada';
end;
$$;

rollback;
