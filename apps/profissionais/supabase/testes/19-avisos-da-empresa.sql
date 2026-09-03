-- ═══════════════════════════════════════════════════════════════════════
-- 19 — A empresa com DUAS empresas enxerga quem se candidatou?
-- ═══════════════════════════════════════════════════════════════════════
--
-- A policy de leitura de `job_responses` nasceu na 0069, quando cada conta
-- tinha no máximo uma empresa, e comparava assim:
--
--     company_id = (select id from public.companies where owner_id = auth.uid())
--
-- A 0102 passou a permitir várias empresas por conta. A subconsulta virou
-- então uma que devolve VÁRIAS linhas — e o Postgres, dentro de uma policy,
-- não estoura o erro na cara da pessoa: a linha simplesmente não passa no
-- filtro. O resultado é uma lista vazia, sem nenhum erro, que é a mentira
-- calma de sempre: "ninguém se candidatou" quando havia gente.
--
-- Este teste prova o defeito e a correção da 0109.

\set ON_ERROR_STOP on
begin;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.usuario', true), '')::uuid
$$;

insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000c0001', '5531900001111', now()),  -- a dona das duas empresas
       ('00000000-0000-4000-8000-0000000c0002', '5531900002222', now())   -- quem se candidata
on conflict (id) do nothing;

insert into public.companies (id, owner_id, company_name, city, uf, phone, responsible_name)
values ('00000000-0000-4000-8000-0000000d0001', '00000000-0000-4000-8000-0000000c0001',
        'Padaria do Centro', 'Itabirito', 'MG', '5531900001111', 'Ana'),
       ('00000000-0000-4000-8000-0000000d0002', '00000000-0000-4000-8000-0000000c0001',
        'Padaria do Bairro', 'Itabirito', 'MG', '5531900001111', 'Ana');

update public.companies set plano = 'tres', plano_ate = now() + interval '30 days'
 where owner_id = '00000000-0000-4000-8000-0000000c0001';

insert into public.job_listings
  (id, company_id, title, description, profession, city, status, work_modality)
values ('00000000-0000-4000-8000-0000000e0001', '00000000-0000-4000-8000-0000000d0001',
        'Padeiro', 'Turno da manhã', 'Padeiro', 'Itabirito', 'active', 'presencial');

insert into public.job_responses (job_listing_id, professional_id, status, interessado)
values ('00000000-0000-4000-8000-0000000e0001', '00000000-0000-4000-8000-0000000c0002', 'new', true);

grant select on public.job_responses, public.job_listings, public.companies to authenticated;

set local role authenticated;
set local teste.usuario = '00000000-0000-4000-8000-0000000c0001';

select case when count(*) = 1
            then 'PRONTO — a dona das duas empresas vê a candidatura'
            else 'AINDA FALTA — a candidatura sumiu da lista da empresa'
       end as resultado
  from public.job_responses;

reset role;
rollback;
