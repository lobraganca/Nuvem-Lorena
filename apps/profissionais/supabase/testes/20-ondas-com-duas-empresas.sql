-- ═══════════════════════════════════════════════════════════════════════
-- 20 — A conta com DUAS empresas consegue disparar a onda?
-- ═══════════════════════════════════════════════════════════════════════
--
-- Mesmo defeito do teste 19, na tabela das ondas (`job_dispatches`, 0068).
-- Corrigido pela 0111.

\set ON_ERROR_STOP on
begin;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.usuario', true), '')::uuid
$$;

insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000c1001', '5531900003333', now())
on conflict (id) do nothing;

insert into public.companies (id, owner_id, company_name, city, uf, phone, responsible_name)
values ('00000000-0000-4000-8000-0000000d1001', '00000000-0000-4000-8000-0000000c1001',
        'Oficina A', 'Itabirito', 'MG', '5531900003333', 'Ana'),
       ('00000000-0000-4000-8000-0000000d1002', '00000000-0000-4000-8000-0000000c1001',
        'Oficina B', 'Itabirito', 'MG', '5531900003333', 'Ana');

update public.companies set plano = 'tres', plano_ate = now() + interval '30 days'
 where owner_id = '00000000-0000-4000-8000-0000000c1001';

insert into public.job_listings
  (id, company_id, title, description, profession, city, status, work_modality)
values ('00000000-0000-4000-8000-0000000e1001', '00000000-0000-4000-8000-0000000d1001',
        'Mecânico', 'Segunda a sexta', 'Mecânico', 'Itabirito', 'active', 'presencial');

grant select, insert on public.job_dispatches to authenticated;
grant select on public.job_listings, public.companies to authenticated;

set local role authenticated;
set local teste.usuario = '00000000-0000-4000-8000-0000000c1001';

insert into public.job_dispatches (job_listing_id, wave, professionals_count)
values ('00000000-0000-4000-8000-0000000e1001', 1, 0);

select case when count(*) = 1
            then 'PRONTO — a conta com duas empresas dispara e lê a onda'
            else 'AINDA FALTA — a onda não saiu'
       end as resultado
  from public.job_dispatches
 where job_listing_id = '00000000-0000-4000-8000-0000000e1001';

reset role;
rollback;
