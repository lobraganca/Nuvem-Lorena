-- ═══════════════════════════════════════════════════════════════════════
-- 26 — O reembolso encerra o plano sozinho?
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "quero que faça tudo automático. Se a pessoa pedir reembolso
-- antes dos 7 dias, [encerra]; depois dos 7 dias, o plano se encerra no
-- vencimento do mês."
--
-- São duas portas com consequências opostas, e o que decide é uma data —
-- exatamente o tipo de regra que passa a valer errado sem ninguém notar.
--
--   1. dentro dos 7 dias  → plano desligado AGORA, vagas fora do ar AGORA
--   2. depois dos 7 dias  → plano vale até o vencimento, e as vagas saem
--                           NO DIA do vencimento, nem um dia depois
--   3. sem plano nenhum   → o pedido é gravado do mesmo jeito
--
-- E duas coisas que não podem quebrar no caminho:
--
--   4. a empresa continua sem conseguir mexer no plano por fora (a 0123);
--   5. ninguém cancela o plano da empresa de OUTRA pessoa.

\set ON_ERROR_STOP on
begin;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.usuario', true), '')::uuid
$$;

insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000e2601', '5531900002601', now()),
  ('00000000-0000-4000-8000-0000000e2602', '5531900002602', now())
on conflict (id) do nothing;

-- Duas empresas de donos diferentes. A 2610 é de quem vai pedir.
insert into public.companies (id, owner_id, company_name, city, uf, phone, responsible_name)
values
  ('00000000-0000-4000-8000-0000000e2610', '00000000-0000-4000-8000-0000000e2601',
   'Padaria do Reembolso', 'Itabirito', 'MG', '5531900002601', 'Fulana'),
  ('00000000-0000-4000-8000-0000000e2620', '00000000-0000-4000-8000-0000000e2602',
   'Padaria de Outra Pessoa', 'Itabirito', 'MG', '5531900002602', 'Sicrana')
on conflict (id) do nothing;

-- O papel do app precisa das permissões de tabela para o passo 6 (a
-- tentativa de mexer no plano por fora) chegar até o gatilho. Sem elas o
-- banco recusaria antes, por falta de `grant`, e o teste "passaria" sem
-- nunca ter exercitado a proteção.
grant select, update on public.companies to authenticated;
grant select on public.job_listings to authenticated;

-- ── 1. DENTRO DOS 7 DIAS ──────────────────────────────────────────────
-- Comprou anteontem: é arrependimento.
update public.companies
   set plano = 'tres', plano_ate = now() + interval '28 days',
       plano_desde = now() - interval '2 days', plano_recorrente = true
 where id = '00000000-0000-4000-8000-0000000e2610';

insert into public.job_listings (id, company_id, title, description, profession, city, uf,
                                 work_modality, status, anunciada_ate)
values ('00000000-0000-4000-8000-0000000e2630', '00000000-0000-4000-8000-0000000e2610',
        'Padeiro', 'Padaria no Centro.', 'Padeiro', 'Itabirito', 'MG',
        'presencial', 'active', now() + interval '25 days')
on conflict (id) do nothing;

set local role authenticated;
set local teste.usuario = '00000000-0000-4000-8000-0000000e2601';

select case
  when public.pedir_reembolso('Achei que a vaga saía na hora.', '31999990000',
                              '00000000-0000-4000-8000-0000000e2610') = 'encerrado_agora'
  then 'ok 1 — dentro dos 7 dias, encerra agora'
  else 'FALHOU 1 — a porta escolhida não foi a do arrependimento'
  end as resultado;

reset role;

select case
  when (select plano from public.companies
         where id = '00000000-0000-4000-8000-0000000e2610') is null
   and (select status from public.job_listings
         where id = '00000000-0000-4000-8000-0000000e2630') = 'paused'
   and (select anunciada_ate from public.job_listings
         where id = '00000000-0000-4000-8000-0000000e2630') is null
  then 'ok 2 — plano desligado e vaga fora do ar'
  else 'FALHOU 2 — o plano ou a vaga continuaram de pé'
  end as resultado;

-- ── 3. DEPOIS DOS 7 DIAS ──────────────────────────────────────────────
-- Comprou há vinte dias, e o mês pago acaba daqui a dez. A vaga estava
-- anunciada por MAIS tempo que o plano — é esse o caso que fazia a dona
-- devolver o dinheiro e continuar entregando.
--
-- Em DOIS comandos, e não num só: o gatilho da 0110 recarimba
-- `plano_desde` com `now()` sempre que o plano é religado (plano nulo
-- passando a ter valor), e isso engolia os vinte dias — a compra parecia
-- de hoje e o teste caía na porta errada. Ligar primeiro e corrigir a
-- data depois passa longe daquela regra, porque no segundo comando o
-- plano não muda e `plano_ate` não anda para a frente.
--
-- (E a regra da 0110 está certa: religar plano É uma compra nova, e
-- compra nova recomeça os 7 dias de arrependimento.)
update public.companies
   set plano = 'tres', plano_ate = now() + interval '10 days',
       plano_recorrente = true
 where id = '00000000-0000-4000-8000-0000000e2610';

update public.companies
   set plano_desde = now() - interval '20 days'
 where id = '00000000-0000-4000-8000-0000000e2610';

update public.job_listings
   set status = 'active', anunciada_ate = now() + interval '25 days'
 where id = '00000000-0000-4000-8000-0000000e2630';

set local role authenticated;
set local teste.usuario = '00000000-0000-4000-8000-0000000e2601';

select case
  when public.pedir_reembolso('Não deu certo, quero cancelar.', null,
                              '00000000-0000-4000-8000-0000000e2610') = 'ate_o_vencimento'
  then 'ok 3 — depois dos 7 dias, vale até o vencimento'
  else 'FALHOU 3 — a porta escolhida não foi a do cancelamento'
  end as resultado;

reset role;

select case
  when (select plano from public.companies
         where id = '00000000-0000-4000-8000-0000000e2610') = 'tres'
   and (select plano_recorrente from public.companies
         where id = '00000000-0000-4000-8000-0000000e2610') = false
   and (select status from public.job_listings
         where id = '00000000-0000-4000-8000-0000000e2630') = 'active'
   -- O ponto do teste: a vaga saía em 25 dias e passa a sair em 10, que é
   -- o dia do vencimento. Um segundo de folga para a comparação não
   -- depender do relógio entre um comando e outro.
   and (select anunciada_ate from public.job_listings
         where id = '00000000-0000-4000-8000-0000000e2630')
       between now() + interval '9 days' and now() + interval '11 days'
  then 'ok 4 — plano até o vencimento, e a vaga sai no mesmo dia'
  else 'FALHOU 4 — a vaga não foi encurtada para o vencimento'
  end as resultado;

-- ── 5. SEM PLANO NENHUM ───────────────────────────────────────────────
update public.companies
   set plano = null, plano_ate = null, plano_desde = null
 where id = '00000000-0000-4000-8000-0000000e2610';

set local role authenticated;
set local teste.usuario = '00000000-0000-4000-8000-0000000e2601';

select case
  when public.pedir_reembolso('Fui cobrada e não sei do quê.', null, null) = 'sem_plano'
  then 'ok 5 — sem plano, o pedido é gravado do mesmo jeito'
  else 'FALHOU 5 — o pedido sem plano não foi tratado'
  end as resultado;

-- ── 6. A EMPRESA CONTINUA SEM MEXER NO PLANO POR FORA ─────────────────
-- A porta que a 0124 abriu é para as funções do banco, não para o app.
update public.companies
   set plano = 'ilimitado', plano_ate = now() + interval '365 days'
 where id = '00000000-0000-4000-8000-0000000e2610';

select case
  when (select plano from public.companies
         where id = '00000000-0000-4000-8000-0000000e2610') is null
  then 'ok 6 — a empresa continua sem se dar plano'
  else 'FALHOU 6 — a 0124 abriu buraco na protecao da 0123'
  end as resultado;

-- ── 7. NINGUÉM CANCELA O PLANO DE OUTRA PESSOA ────────────────────────
reset role;
update public.companies
   set plano = 'tres', plano_ate = now() + interval '28 days',
       plano_desde = now() - interval '2 days'
 where id = '00000000-0000-4000-8000-0000000e2620';

set local role authenticated;
set local teste.usuario = '00000000-0000-4000-8000-0000000e2601';

-- Pedindo em nome da empresa da OUTRA pessoa: a função não acha a linha
-- (o `owner_id` não bate), então cai em "sem plano" e não toca em nada.
select public.pedir_reembolso('Tentando cancelar o plano alheio.', null,
                              '00000000-0000-4000-8000-0000000e2620');

reset role;

select case
  when (select plano from public.companies
         where id = '00000000-0000-4000-8000-0000000e2620') = 'tres'
  then 'PRONTO — as duas portas funcionam, e ninguém cancela o plano alheio'
  else 'FALHOU 7 — cancelou o plano da empresa de outra pessoa'
  end as resultado;

rollback;
