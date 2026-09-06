-- ═══════════════════════════════════════════════════════════════════════
-- 25 — A empresa consegue se dar um plano de graça?
-- ═══════════════════════════════════════════════════════════════════════
--
-- Até a 0123 a resposta era SIM, e nada no banco impedia.
--
-- A política "Empresa atualiza seu próprio cadastro" (0066) deixa a dona
-- da empresa gravar qualquer coluna da própria linha — e `plano`,
-- `plano_ate` e `plano_cortesia` moram nessa linha. Quem tivesse uma
-- empresa cadastrada e a chave pública do app (que está no navegador de
-- todo mundo) podia se dar o Ei Infinit. O app nunca faz isso, e é
-- justamente por isso que passou despercebido: o buraco não é do app, e
-- quem entra por ele não usa o app.
--
-- Este teste exercita as quatro situações que importam:
--
--   1. a empresa tenta se dar um plano                → não muda nada
--   2. a empresa tenta se marcar como teste grátis    → não muda nada
--   3. a empresa edita OUTRA coisa do cadastro        → grava normal
--   4. a administração liga o plano e o teste         → grava
--
-- O 3 é o que impede o remédio de virar doença: o gatilho DEVOLVE o valor
-- antigo em vez de recusar a gravação, senão a empresa não conseguiria
-- mais corrigir o próprio telefone.

\set ON_ERROR_STOP on
begin;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.usuario', true), '')::uuid
$$;

insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000e2501', '5531900002501', now())
on conflict (id) do nothing;

insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000e2502', '5531900002502', now())
on conflict (id) do nothing;

-- A conta 2502 é a administração.
insert into public.admins (user_id) values ('00000000-0000-4000-8000-0000000e2502')
on conflict (user_id) do nothing;

insert into public.companies (id, owner_id, company_name, city, uf, phone, responsible_name)
values ('00000000-0000-4000-8000-0000000e2510', '00000000-0000-4000-8000-0000000e2501',
        'Serralheria do Teste', 'Itabirito', 'MG', '5531900002501', 'Fulana')
on conflict (id) do nothing;

grant select, update on public.companies to authenticated;

-- ── Daqui para baixo, é o app falando ─────────────────────────────────
-- `set role authenticated` é o que o PostgREST faz ao atender uma chamada
-- de quem entrou no app. Sem ele o gatilho sai da frente de propósito (o
-- editor SQL e as migrations precisam poder mexer no plano), e o teste
-- passaria sem nunca ter exercitado a trava.
set local role authenticated;
set local teste.usuario = '00000000-0000-4000-8000-0000000e2501';

-- 1. A empresa tenta se dar o plano sem teto.
update public.companies
   set plano = 'ilimitado', plano_ate = now() + interval '365 days'
 where id = '00000000-0000-4000-8000-0000000e2510';

select case
  when (select plano from public.companies
         where id = '00000000-0000-4000-8000-0000000e2510') is null
  then 'ok 1 — a empresa não se dá plano'
  else 'FALHOU 1 — a empresa se deu o Ei Infinit de graça'
  end as resultado;

-- 2. E tenta se marcar como teste grátis (que renovaria sozinho na conta
--    de quem lê o painel, e sujaria a contagem de quem paga).
update public.companies
   set plano_cortesia = true
 where id = '00000000-0000-4000-8000-0000000e2510';

select case
  when (select plano_cortesia from public.companies
         where id = '00000000-0000-4000-8000-0000000e2510') = false
  then 'ok 2 — a empresa não se marca como teste'
  else 'FALHOU 2 — a empresa se marcou como teste grátis'
  end as resultado;

-- 3. Editar o cadastro continua funcionando.
update public.companies
   set responsible_name = 'Fulana de Tal'
 where id = '00000000-0000-4000-8000-0000000e2510';

select case
  when (select responsible_name from public.companies
         where id = '00000000-0000-4000-8000-0000000e2510') = 'Fulana de Tal'
  then 'ok 3 — a empresa continua editando o próprio cadastro'
  else 'FALHOU 3 — o gatilho derrubou a edição normal'
  end as resultado;

-- 4. A administração liga o teste grátis de 5 dias no plano de 1 vaga.
set local teste.usuario = '00000000-0000-4000-8000-0000000e2502';

update public.companies
   set plano = 'pro', plano_ate = now() + interval '5 days', plano_cortesia = true
 where id = '00000000-0000-4000-8000-0000000e2510';

select case
  when (select plano from public.companies
         where id = '00000000-0000-4000-8000-0000000e2510') = 'pro'
   and (select plano_cortesia from public.companies
         where id = '00000000-0000-4000-8000-0000000e2510') = true
   and (select plano_ate from public.companies
         where id = '00000000-0000-4000-8000-0000000e2510') > now()
  then 'PRONTO — só a administração muda plano, e a empresa continua editando o resto'
  else 'FALHOU 4 — a administração não conseguiu ligar o teste grátis'
  end as resultado;

rollback;
