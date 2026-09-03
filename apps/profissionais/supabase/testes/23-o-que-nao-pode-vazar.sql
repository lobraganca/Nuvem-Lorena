-- ═══════════════════════════════════════════════════════════════════════
-- 23 — O que NÃO pode vazar
-- ═══════════════════════════════════════════════════════════════════════
--
-- Os testes desta pasta sempre perguntaram "a pessoa certa consegue ver?".
-- Este pergunta o contrário, que é o que ninguém percebe quando quebra:
-- a pessoa ERRADA consegue ver?
--
-- São quatro perguntas, e as quatro têm consequência fora do app:
--
--   1. uma empresa enxerga os candidatos de OUTRA empresa?
--   2. quem procura trabalho enxerga a candidatura de outra pessoa?
--   3. o gênero, que é da 0116, sai na lista pública?
--      (art. 373-A da CLT: sexo não pode ser critério de admissão. A
--       garantia não é a tela pedir por favor — é o dado não chegar lá.)
--   4. o pedido de reembolso de uma pessoa aparece para outra?

\set ON_ERROR_STOP on
begin;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.usuario', true), '')::uuid
$$;

-- Duas contas de empresa, sem relação nenhuma entre elas.
insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000f2301', '5531900002301', now()),
  ('00000000-0000-4000-8000-0000000f2302', '5531900002302', now()),
  ('00000000-0000-4000-8000-0000000f2303', '5531900002303', now())
on conflict (id) do nothing;

insert into public.companies (id, owner_id, company_name, city, uf, phone, responsible_name) values
  ('00000000-0000-4000-8000-0000000f2310', '00000000-0000-4000-8000-0000000f2301',
   'Padaria A', 'Itabirito', 'MG', '5531900002301', 'Dona A'),
  ('00000000-0000-4000-8000-0000000f2311', '00000000-0000-4000-8000-0000000f2302',
   'Padaria B', 'Itabirito', 'MG', '5531900002302', 'Dona B')
on conflict (id) do nothing;

update public.companies
   set plano = 'pro', plano_ate = now() + interval '30 days'
 where id in ('00000000-0000-4000-8000-0000000f2310', '00000000-0000-4000-8000-0000000f2311');

insert into public.job_listings
  (id, company_id, title, description, profession, city, uf, status, work_modality)
values
  ('00000000-0000-4000-8000-0000000f2320', '00000000-0000-4000-8000-0000000f2310',
   'Padeiro', 'Turno da manhã.', 'Padeiro', 'Itabirito', 'MG', 'active', 'presencial')
on conflict (id) do nothing;

-- Alguém se candidatou à vaga da empresa A.
insert into public.job_responses (job_listing_id, professional_id, status, interessado)
values ('00000000-0000-4000-8000-0000000f2320', '00000000-0000-4000-8000-0000000f2303', 'new', true)
on conflict do nothing;

-- Um cadastro com gênero declarado.
insert into public.professionals (id, owner_id, name, category, city, uf, genero, whatsapp_verified)
values ('00000000-0000-4000-8000-0000000f2330', '00000000-0000-4000-8000-0000000f2303',
        'Quem procura', 'Padeiro', 'Itabirito', 'MG', 'feminino', true)
on conflict (id) do nothing;

-- Um pedido de reembolso da conta 2303.
insert into public.pedidos_reembolso (user_id, motivo)
values ('00000000-0000-4000-8000-0000000f2303', 'Não consegui usar o plano.')
on conflict do nothing;

grant select on public.job_responses, public.job_listings, public.companies,
                public.professionals_public, public.pedidos_reembolso to authenticated;

set local role authenticated;

-- 1. A empresa B não pode ver o candidato da empresa A.
set local teste.usuario = '00000000-0000-4000-8000-0000000f2302';
select case when count(*) = 0
            then 'ok 1 — a empresa B não vê o candidato da empresa A'
            else 'FALHOU 1 — VAZOU: a empresa B está vendo candidato de outra'
       end as resultado
  from public.job_responses;

-- 2. Quem procura trabalho vê a PRÓPRIA candidatura, e só ela.
set local teste.usuario = '00000000-0000-4000-8000-0000000f2303';
select case when count(*) = 1
            then 'ok 2 — a pessoa vê a própria candidatura'
            else 'FALHOU 2 — a pessoa não vê a própria candidatura'
       end as resultado
  from public.job_responses;

-- 3. O gênero não existe na lista pública.
select case when count(*) = 0
            then 'ok 3 — o gênero não sai na lista pública'
            else 'FALHOU 3 — VAZOU: o gênero está na view pública (art. 373-A da CLT)'
       end as resultado
  from pg_attribute
 where attrelid = 'public.professionals_public'::regclass
   and attname = 'genero'
   and not attisdropped;

-- 4. O pedido de reembolso de uma pessoa não aparece para outra.
set local teste.usuario = '00000000-0000-4000-8000-0000000f2301';
select case when count(*) = 0
            then 'ok 4 — ninguém vê o pedido de reembolso alheio'
            else 'FALHOU 4 — VAZOU: pedido de reembolso de outra pessoa'
       end as resultado
  from public.pedidos_reembolso;

-- 5. E a própria pessoa vê o dela.
set local teste.usuario = '00000000-0000-4000-8000-0000000f2303';
select case when count(*) = 1
            then 'PRONTO — cada um vê só o que é seu'
            else 'FALHOU 5 — a pessoa não vê o próprio pedido de reembolso'
       end as resultado
  from public.pedidos_reembolso;

reset role;
rollback;
