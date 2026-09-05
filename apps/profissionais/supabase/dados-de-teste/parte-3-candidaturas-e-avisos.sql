-- PARTE 3 de 3 — candidaturas, avisos, destaque e as duas fora do ar
-- Rode as Partes 1 e 2 antes desta.

-- Gente candidatada, para a tela de interessados da empresa ter conteúdo.
-- 3 pessoas por vaga, e uma delas dizendo "não é para mim".
insert into public.job_responses
  (id, job_listing_id, professional_id, interessado, status, created_at)
select ('eeee0000-0000-4000-8000-f00000000' || lpad((v * 10 + n)::text, 3, '0'))::uuid,
       ('eeee0000-0000-4000-8000-e000000000' || lpad(v::text, 2, '0'))::uuid,
       ('eeee0000-0000-4000-8000-a000000000' || lpad((((v * 3 + n * 7) % 24) + 1)::text, 2, '0'))::uuid,
       n <> 3,
       (array['new','read','accepted','rejected'])[1 + ((v + n) % 4)],
       now() - ((n + 1) || ' days')::interval
from generate_series(1, 12) v, generate_series(1, 3) n
on conflict do nothing;

-- Avisos que chegaram (as ondas). O de 40 dias NÃO deve aparecer na tela
-- de avisos: é a prova de que a regra dos 15 dias está valendo.
insert into public.job_notifications
  (id, job_listing_id, professional_id, wave, enviado_em, criado_em)
select ('eeee0000-0000-4000-8000-f00001000' || lpad((v * 10 + n)::text, 3, '0'))::uuid,
       ('eeee0000-0000-4000-8000-e000000000' || lpad(v::text, 2, '0'))::uuid,
       ('eeee0000-0000-4000-8000-a000000000' || lpad((((v + n * 5) % 24) + 1)::text, 2, '0'))::uuid,
       case when n = 1 then 1 else 2 end,
       now() - (dias || ' days')::interval,
       now() - (dias || ' days')::interval
from generate_series(1, 6) v,
     lateral (select n, case when v = 1 and n = 1 then 40 else n * 3 end as dias
                from generate_series(1, 3) n) x
on conflict do nothing;

-- Duas vagas em destaque e uma com o destaque já vencido. A coluna é
-- protegida por gatilho (só a administração escreve, e no editor do painel
-- `auth.uid()` é vazio) — por isso ele é desligado por um instante e
-- RELIGADO logo abaixo. Se algo falhar no meio, rode só a linha do enable.
alter table public.job_listings disable trigger job_listings_protege_destaque;

update public.job_listings set destaque_ate = now() + interval '10 days'
 where id in ('eeee0000-0000-4000-8000-e00000000001',
              'eeee0000-0000-4000-8000-e00000000012');
update public.job_listings set destaque_ate = now() - interval '3 days'
 where id = 'eeee0000-0000-4000-8000-e00000000006';

alter table public.job_listings enable trigger job_listings_protege_destaque;

-- Por último, uma pausada e uma encerrada — depois das candidaturas, para
-- as duas terem gente dentro.
update public.job_listings set status = 'paused'
 where id = 'eeee0000-0000-4000-8000-e00000000005';
update public.job_listings set status = 'closed', closed_at = now() - interval '2 days'
 where id = 'eeee0000-0000-4000-8000-e00000000011';

select 'PRONTO — ' ||
  (select count(*) from public.professionals where id::text like 'eeee0000%')::text || ' pessoas, ' ||
  (select count(*) from public.companies     where id::text like 'eeee0000%')::text || ' empresas, ' ||
  (select count(*) from public.job_listings  where id::text like 'eeee0000%')::text || ' vagas, ' ||
  (select count(*) from public.job_responses where id::text like 'eeee0000%')::text || ' candidaturas e ' ||
  (select count(*) from public.job_notifications where id::text like 'eeee0000%')::text || ' avisos'
  as resultado;
