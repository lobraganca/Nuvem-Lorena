-- ═══════════════════════════════════════════════════════════════════════
-- 31 — 30 dias de 1 vaga grátis: quem pega, quem não pega, e uma vez só
-- ═══════════════════════════════════════════════════════════════════════
--
-- A 0133 deixa a EMPRESA se dar um plano — e é a primeira vez que isso
-- acontece neste banco. A 0123 tinha fechado essa porta de propósito:
-- quem tem empresa cadastrada e souber usar a chave pública do app se
-- daria o Ei Infinit sozinho.
--
-- Então o que este teste guarda não é a promoção; é o buraco que ela
-- abriria se estivesse mal feita. As sete perguntas:
--
--   1. a empresa consegue ativar, e ganha 30 dias do plano de 1 vaga?
--   2. ela consegue ativar DUAS vezes? (não pode)
--   3. e criando uma segunda loja, ela ganha de novo? (não pode)
--   4. quem já paga consegue pegar o teste? (não pode)
--   5. dá para ativar na empresa DE OUTRA PESSOA? (não pode)
--   6. com a promoção desligada, ainda ativa? (não pode)
--   7. a empresa continua sem conseguir escrever o plano no `update`
--      direto — ou seja, a 0123 continua de pé?
--
-- A 7 é a que importa mais. As outras seis protegem o bolso da dona; a
-- sétima protege o app inteiro.

\set ON_ERROR_STOP on
begin;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.usuario', true), '')::uuid
$$;

insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000f3101', '5531900003101', now()),
  ('00000000-0000-4000-8000-0000000f3102', '5531900003102', now()),
  ('00000000-0000-4000-8000-0000000f3103', '5531900003103', now())
on conflict (id) do nothing;

-- Três donos: um que vai pegar a promoção, um que já paga, e um curioso
-- que vai tentar pegar na empresa do primeiro.
insert into public.companies (id, owner_id, company_name, city, uf, phone, responsible_name)
values
  ('00000000-0000-4000-8000-0000000f3111', '00000000-0000-4000-8000-0000000f3101',
   'Padaria Nova', 'Itabirito', 'MG', '5531900003101', 'Dona A'),
  ('00000000-0000-4000-8000-0000000f3112', '00000000-0000-4000-8000-0000000f3102',
   'Mercado que Paga', 'Itabirito', 'MG', '5531900003102', 'Dona B'),
  ('00000000-0000-4000-8000-0000000f3113', '00000000-0000-4000-8000-0000000f3103',
   'Loja do Curioso', 'Itabirito', 'MG', '5531900003103', 'Dona C')
on conflict (id) do nothing;

-- A segunda já é cliente. Gravado aqui, fora do papel do app, porque o
-- gatilho da 0123 só devolve o plano para quem entra COMO app — e é
-- justamente isso que a pergunta 7 vai exercitar mais adiante.
update public.companies
   set plano = 'tres', plano_ate = now() + interval '20 days', plano_cortesia = false
 where id = '00000000-0000-4000-8000-0000000f3112';

-- ── A partir daqui, tudo acontece como se fosse pelo app ──────────────
-- `authenticated` é o papel de quem entrou. É o que o gatilho da 0123
-- olha para decidir se protege ou não as colunas de plano.
set local role authenticated;

-- ── 1. A dona A ativa ─────────────────────────────────────────────────
set local teste.usuario = '00000000-0000-4000-8000-0000000f3101';

select case when public.teste_gratis_disponivel()
            then 'ok 1a — a promoção está disponível para quem nunca teve plano'
            else 'FALHOU 1a — a empresa sem plano não consegue nem ver a promoção'
       end as resultado;

select case
         when public.ativar_teste_gratis('00000000-0000-4000-8000-0000000f3111') is not null
         then 'ok 1b — ativou'
         else 'FALHOU 1b — a ativação foi recusada para quem tinha direito'
       end as resultado;

-- 30 dias do plano de 1 vaga, marcado como cortesia. Os três juntos:
-- plano errado daria mais vagas do que ela liberou, prazo errado daria
-- mais tempo, e sem a marca de cortesia a empresa leria "Plano Ei
-- Conecta" igual a quem paga — e no dia 30 perderia a vaga sem entender.
select case
         when plano = 'pro'
          and plano_cortesia = true
          and plano_recorrente = false
          and plano_ate::date = (now() + interval '30 days')::date
         then 'ok 1c — 30 dias do plano de 1 vaga, como cortesia e sem renovar sozinho'
         else 'FALHOU 1c — ativou com plano, prazo ou marca errados: '
              || coalesce(plano, '(sem plano)') || ' / cortesia=' || plano_cortesia
              || ' / renova=' || plano_recorrente || ' / até ' || coalesce(plano_ate::text, '(nunca)')
       end as resultado
  from public.companies
 where id = '00000000-0000-4000-8000-0000000f3111';

-- ── 2. Duas vezes, não ────────────────────────────────────────────────
select case when not public.teste_gratis_disponivel()
            then 'ok 2 — quem já ativou não aparece mais como disponível'
            else 'FALHOU 2 — a promoção continua disponível depois de ativada'
       end as resultado;

select case when public.ativar_teste_gratis('00000000-0000-4000-8000-0000000f3111') is null
            then 'ok 2b — ativar de novo é recusado'
            else 'FALHOU 2b — deu para ativar a promoção DUAS vezes'
       end as resultado;

-- ── 3. Nem abrindo uma segunda loja ───────────────────────────────────
-- Este é o furo óbvio de uma promoção por empresa: cadastrar "Padaria 2"
-- e ganhar mais 30 dias, e outra vez, e outra. Por isso a conta é da
-- CONTA e não da loja.
insert into public.companies (id, owner_id, company_name, city, uf, phone, responsible_name)
values ('00000000-0000-4000-8000-0000000f3114', '00000000-0000-4000-8000-0000000f3101',
        'Padaria Nova 2', 'Itabirito', 'MG', '5531900003101', 'Dona A')
on conflict (id) do nothing;

select case when public.ativar_teste_gratis('00000000-0000-4000-8000-0000000f3114') is null
            then 'ok 3 — abrir uma segunda loja não dá uma segunda promoção'
            else 'FALHOU 3 — cada loja nova rende mais 30 dias de graça'
       end as resultado;

-- ── 4. Quem já paga não pega ──────────────────────────────────────────
set local teste.usuario = '00000000-0000-4000-8000-0000000f3102';

select case when public.ativar_teste_gratis('00000000-0000-4000-8000-0000000f3112') is null
            then 'ok 4 — quem já é cliente não pega o teste'
            else 'FALHOU 4 — cliente pagante trocou a assinatura por cortesia'
       end as resultado;

-- E o plano dela não foi tocado na tentativa.
select case when plano = 'tres' and plano_cortesia = false
            then 'ok 4b — e o plano pago dela continuou intacto'
            else 'FALHOU 4b — a tentativa estragou o plano de quem paga'
       end as resultado
  from public.companies
 where id = '00000000-0000-4000-8000-0000000f3112';

-- ── 5. Na empresa dos outros, não ─────────────────────────────────────
-- Sem esta trava, uma pessoa gastaria a promoção da empresa alheia — e a
-- dona daquela empresa ficaria sem poder pegar a sua, sem nunca saber por
-- quê.
set local teste.usuario = '00000000-0000-4000-8000-0000000f3103';

select case when public.ativar_teste_gratis('00000000-0000-4000-8000-0000000f3112') is null
            then 'ok 5 — ninguém ativa a promoção na empresa de outra pessoa'
            else 'FALHOU 5 — deu para gastar a promoção da empresa alheia'
       end as resultado;

-- ── 6. Com a promoção desligada, ninguém pega ─────────────────────────
-- É o que faz "por tempo limitado" ser verdade: a frase na tela só vale
-- se houver um interruptor atrás dela.
reset role;
update public.ofertas set ligada = false where chave = 'teste_gratis_30_dias';
set local role authenticated;
set local teste.usuario = '00000000-0000-4000-8000-0000000f3103';

select case when not public.teste_gratis_disponivel()
            then 'ok 6a — desligada, a promoção some da tela'
            else 'FALHOU 6a — a promoção desligada continua aparecendo'
       end as resultado;

select case when public.ativar_teste_gratis('00000000-0000-4000-8000-0000000f3113') is null
            then 'ok 6b — e não dá para ativar por fora da tela'
            else 'FALHOU 6b — a promoção desligada ainda ativa'
       end as resultado;

reset role;
update public.ofertas set ligada = true where chave = 'teste_gratis_30_dias';
set local role authenticated;

-- ── 7. A 0123 continua de pé ──────────────────────────────────────────
-- A promoção abriu UMA porta estreita (uma função que confere tudo). A
-- porta larga — a empresa gravar o próprio plano num `update` comum —
-- tem de continuar fechada, senão a promoção não deu 30 dias de uma vaga:
-- deu o Ei Infinit para sempre a quem souber pedir.
set local teste.usuario = '00000000-0000-4000-8000-0000000f3103';
update public.companies
   set plano = 'ilimitado', plano_ate = now() + interval '999 days', plano_cortesia = false
 where id = '00000000-0000-4000-8000-0000000f3113';

select case when plano is null
            then 'PRONTO — a promoção existe e a empresa continua sem se dar plano sozinha'
            else 'FALHOU 7 — VAZOU: a empresa se deu o plano ' || plano || ' num update comum'
       end as resultado
  from public.companies
 where id = '00000000-0000-4000-8000-0000000f3113';

rollback;
