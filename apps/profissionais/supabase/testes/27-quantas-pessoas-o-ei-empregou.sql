-- ═══════════════════════════════════════════════════════════════════════
-- 27 — O número de contratados sai certo, e não entrega mais que isso?
-- ═══════════════════════════════════════════════════════════════════════
--
-- Este número vai para a TELA INICIAL, antes do login. Ele é lido por
-- quem ainda está decidindo se confia no app — então errar aqui custa
-- mais caro do que errar numa tela interna.
--
-- Cinco coisas:
--
--   1. soma o que foi declarado (2 + 3 = 5)
--   2. "contratei sim, não disse quantos" conta como 1 — a mesma regra do
--      painel da administração
--   3. vaga encerrada SEM contratação pelo app não entra
--   4. quem não entrou (anon) consegue chamar, porque é onde ela aparece
--   5. e continua sem conseguir LER a vaga encerrada por fora — a função
--      é uma janela para dois números, não uma porta para a tabela

\set ON_ERROR_STOP on
begin;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.usuario', true), '')::uuid
$$;

insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000e2701', '5531900002701', now())
on conflict (id) do nothing;

insert into public.companies (id, owner_id, company_name, city, uf, phone, responsible_name)
values ('00000000-0000-4000-8000-0000000e2710', '00000000-0000-4000-8000-0000000e2701',
        'Padaria do Contador', 'Itabirito', 'MG', '5531900002701', 'Fulana')
on conflict (id) do nothing;

-- A regra da 0072 exige plano para a vaga existir, mesmo já encerrada.
-- Ligado aqui como o editor SQL (papel `postgres`), que é quem monta o
-- cenário — o gatilho da 0123 sai da frente de propósito para ele.
update public.companies
   set plano = 'dez', plano_ate = now() + interval '30 days'
 where id = '00000000-0000-4000-8000-0000000e2710';

-- Quatro vagas encerradas, cada uma num caso diferente.
insert into public.job_listings (id, company_id, title, description, profession, city, uf,
                                 work_modality, status, contratou_por_aqui, quantos_contratados)
values
  -- contratou 2 pela plataforma
  ('00000000-0000-4000-8000-0000000e2721', '00000000-0000-4000-8000-0000000e2710',
   'Padeiro', 'Padaria no Centro.', 'Padeiro', 'Itabirito', 'MG', 'presencial',
   'closed', true, 2),
  -- contratou 3
  ('00000000-0000-4000-8000-0000000e2722', '00000000-0000-4000-8000-0000000e2710',
   'Atendente', 'Balcao.', 'Atendente', 'Itabirito', 'MG', 'presencial',
   'closed', true, 3),
  -- disse que sim e não disse quantos → vale 1
  ('00000000-0000-4000-8000-0000000e2723', '00000000-0000-4000-8000-0000000e2710',
   'Entregador', 'Moto propria.', 'Entregador', 'Itabirito', 'MG', 'presencial',
   'closed', true, null),
  -- contratou por fora → não entra na conta
  ('00000000-0000-4000-8000-0000000e2724', '00000000-0000-4000-8000-0000000e2710',
   'Faxineira', 'Duas vezes por semana.', 'Faxineira', 'Itabirito', 'MG', 'presencial',
   'closed', false, null)
on conflict (id) do nothing;

-- ── 1 e 2. A SOMA, COM O "SEM NÚMERO" VALENDO 1 ───────────────────────
select case
  when (select contratados from public.numeros_do_ei()) = 6
  then 'ok 1 — 2 + 3 + 1 (sem numero) = 6'
  else 'FALHOU 1 — a soma deu '
       || coalesce((select contratados from public.numeros_do_ei())::text, 'nada')
  end as resultado;

-- ── 3. A VAGA QUE CONTRATOU POR FORA NÃO ENTRA ────────────────────────
select case
  when (select vagas_que_contrataram from public.numeros_do_ei()) = 3
  then 'ok 2 — sao 3 vagas, e a que contratou por fora ficou de fora'
  else 'FALHOU 2 — contou '
       || coalesce((select vagas_que_contrataram from public.numeros_do_ei())::text, 'nada')
       || ' vagas'
  end as resultado;

-- ── 4. QUEM NÃO ENTROU CONSEGUE CHAMAR ────────────────────────────────
-- É o ponto todo: o número aparece na tela inicial, antes do login. Sem
-- o `grant` para `anon` ele sumiria justamente para quem ainda não
-- confia no app.
set local role anon;

select case
  when (select contratados from public.numeros_do_ei()) = 6
  then 'ok 3 — quem nao entrou tambem ve o numero'
  else 'FALHOU 3 — anon nao conseguiu chamar a funcao'
  end as resultado;

-- ── 5. O NÚMERO É CONTADO NA HORA, E NÃO GUARDADO ─────────────────────
-- Uma contratação nova entra na conta sem ninguém recalcular nada. Este
-- passo existe contra uma "otimização" futura: no dia em que alguém
-- trocar a função por uma coluna guardada, o número congela — e um
-- número congelado na tela inicial é pior que número nenhum, porque
-- parece certo.
--
-- (A tabela em si continua fechada como sempre esteve: esta migration não
-- cria política nenhuma em `job_listings`. O que sai daqui são dois
-- inteiros, e a assinatura da função não deixa sair mais que isso.)
reset role;

update public.job_listings
   set contratou_por_aqui = true, quantos_contratados = 2
 where id = '00000000-0000-4000-8000-0000000e2724';

select case
  when (select contratados from public.numeros_do_ei()) = 8
   and (select vagas_que_contrataram from public.numeros_do_ei()) = 4
  then 'PRONTO — o numero sai certo e acompanha contratacao nova'
  else 'FALHOU 4 — a contratacao nova nao entrou na conta (deu '
       || (select contratados from public.numeros_do_ei())::text || ')'
  end as resultado;

rollback;
