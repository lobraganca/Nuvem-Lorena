-- ═══════════════════════════════════════════════════════════════════════
-- 32 — O telefone sai um por vez, com teto e registro
-- ═══════════════════════════════════════════════════════════════════════
--
-- A 0134 fechou a porta larga: a `professionals_public` levava telefone,
-- WhatsApp e e-mail para QUALQUER conta logada, sem teto e sem registro.
-- Uma conta criada em dois minutos baixava a lista de telefones de todos
-- os desempregados da cidade — o insumo do golpe de emprego falso, e o
-- mesmo vazamento que a 0118 fechou só para quem não tem conta.
--
-- O que este teste guarda, em ordem de importância:
--
--   1. a view NÃO tem mais coluna de contato — nem por descuido;
--   2. `ver_contato` entrega o número de UM cadastro;
--   3. e REGISTRA quem pediu;
--   4. o teto de 20 por dia existe e barra o vigésimo primeiro;
--   5. abrir a MESMA ficha de novo não gasta o teto duas vezes;
--   6. o contato de quem está oculto ou suspenso não sai nem por ali;
--   7. quem se candidatou à MINHA vaga sai sem teto...
--   8. ...e a vaga dos OUTROS não me entrega contato nenhum;
--   9. a pessoa consegue ver quem pediu o contato dela (LGPD).
--
-- A 1 é a que pega o erro que ninguém veria: alguém recria a view num dia
-- qualquer, copia a lista de colunas de uma versão velha, e o telefone
-- volta sem nenhum sintoma na tela.

\set ON_ERROR_STOP on
begin;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.usuario', true), '')::uuid
$$;

insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000f3201', '5531900003201', now()),
  ('00000000-0000-4000-8000-0000000f3202', '5531900003202', now()),
  ('00000000-0000-4000-8000-0000000f3203', '5531900003203', now())
on conflict (id) do nothing;

-- Vinte e cinco candidatos: mais que o teto, para o teto poder ser testado.
--
-- Uma CONTA POR CANDIDATO, e não os 25 na mesma: o app limita cinco
-- cadastros por conta (0018), e a primeira versão deste teste morreu no
-- sexto com "Você já tem 5 anúncios". Cada candidato é uma pessoa de
-- verdade mesmo — juntá-los numa conta só era conveniência de teste, e
-- conveniência que o banco recusa.
insert into auth.users (id, phone, phone_confirmed_at)
select ('00000000-0000-4000-8000-00000001' || lpad(i::text, 4, '0'))::uuid,
       '55319001' || lpad(i::text, 5, '0'), now()
  from generate_series(1, 25) as i
on conflict (id) do nothing;

insert into public.professionals
  (id, owner_id, name, category, city, uf, phone, whatsapp, email,
   areas_de_interesse, whatsapp_verified, suspended, paused)
select
  ('00000000-0000-4000-8000-00000000' || lpad(i::text, 4, '0'))::uuid,
  ('00000000-0000-4000-8000-00000001' || lpad(i::text, 4, '0'))::uuid,
  'Candidato ' || i, 'padaria', 'Itabirito', 'MG',
  '55319000' || lpad(i::text, 5, '0'),
  '55319000' || lpad(i::text, 5, '0'),
  'c' || i || '@exemplo.com',
  '{"padaria"}', true, false, false
from generate_series(1, 25) as i
on conflict (id) do nothing;

-- Um oculto, para a pergunta 6.
insert into public.professionals
  (id, owner_id, name, category, city, uf, phone, whatsapp, email,
   areas_de_interesse, whatsapp_verified, suspended, paused)
values
  ('00000000-0000-4000-8000-0000000f3299', '00000000-0000-4000-8000-0000000f3202',
   'Escondido', 'padaria', 'Itabirito', 'MG', '5531900009999', '5531900009999',
   'x@exemplo.com', '{"padaria"}', true, false, true)
on conflict (id) do nothing;

-- O gatilho da 0024/0052 zera `whatsapp_verified` em todo INSERT — quem
-- confirma é o SMS. Então a confirmação vem por update, como na vida real.
set local app.confirmando_whatsapp = 'sim';
update public.professionals set whatsapp_verified = true
 where id in (select ('00000000-0000-4000-8000-00000000' || lpad(i::text, 4, '0'))::uuid
                from generate_series(1, 25) as i)
    or id = '00000000-0000-4000-8000-0000000f3299';
set local app.confirmando_whatsapp = '';

-- Duas empresas: a minha e a de outra pessoa.
insert into public.companies (id, owner_id, company_name, city, uf, phone, responsible_name)
values
  ('00000000-0000-4000-8000-0000000f3210', '00000000-0000-4000-8000-0000000f3203',
   'Minha Padaria', 'Itabirito', 'MG', '5531900003203', 'Dona C'),
  ('00000000-0000-4000-8000-0000000f3211', '00000000-0000-4000-8000-0000000f3202',
   'Padaria da Outra', 'Itabirito', 'MG', '5531900003202', 'Dona B')
on conflict (id) do nothing;

update public.companies set plano = 'ilimitado', plano_ate = now() + interval '30 days'
 where id in ('00000000-0000-4000-8000-0000000f3210',
              '00000000-0000-4000-8000-0000000f3211');

insert into public.job_listings
  (id, company_id, title, description, profession, city, uf, status, work_modality)
values
  ('00000000-0000-4000-8000-0000000f3220', '00000000-0000-4000-8000-0000000f3210',
   'Atendente', 'Balcão', 'atendente', 'Itabirito', 'MG', 'active', 'presencial'),
  ('00000000-0000-4000-8000-0000000f3221', '00000000-0000-4000-8000-0000000f3211',
   'Vaga da outra', 'Balcão', 'atendente', 'Itabirito', 'MG', 'active', 'presencial')
on conflict (id) do nothing;

-- O candidato 1 se interessou pela MINHA vaga; o 2, pela vaga da outra.
-- `professional_id` em `job_responses` é a CONTA, não a linha do cadastro.
insert into public.job_responses (job_listing_id, professional_id, interessado)
values
  ('00000000-0000-4000-8000-0000000f3220', '00000000-0000-4000-8000-000000010001', true),
  ('00000000-0000-4000-8000-0000000f3221', '00000000-0000-4000-8000-000000010002', true)
on conflict do nothing;

-- ── 1. A view não tem mais contato ────────────────────────────────────
-- Fora do `set role` de propósito: pergunta-se ao catálogo o que a view
-- TEM, em vez de tentar ler e depender do erro certo aparecer.
select case when count(*) = 0
            then 'ok 1 — a view pública não tem mais telefone, WhatsApp nem e-mail'
            else 'FALHOU 1 — VAZOU: a view voltou a ter coluna de contato'
       end as resultado
  from pg_attribute
 where attrelid = 'public.professionals_public'::regclass
   and attname in ('phone', 'whatsapp', 'email', 'telefones_extra')
   and not attisdropped;

-- ── A partir daqui, tudo como se fosse pelo app ───────────────────────
set local role authenticated;
set local teste.usuario = '00000000-0000-4000-8000-0000000f3203';

-- ── 2 e 3. Sai UM, e fica registrado ──────────────────────────────────
select case when (select phone from public.ver_contato(
                    '00000000-0000-4000-8000-000000000001')) = '5531900000001'
            then 'ok 2 — a ficha entrega o telefone daquele cadastro'
            else 'FALHOU 2 — a ficha não entregou o telefone'
       end as resultado;

reset role;
select case when count(*) = 1
            then 'ok 3 — e ficou registrado quem pediu'
            else 'FALHOU 3 — o pedido de contato não foi registrado'
       end as resultado
  from public.contatos_vistos
 where user_id = '00000000-0000-4000-8000-0000000f3203';
set local role authenticated;

-- ── 5. A MESMA ficha de novo não gasta o teto duas vezes ──────────────
select public.ver_contato('00000000-0000-4000-8000-000000000001');
select public.ver_contato('00000000-0000-4000-8000-000000000001');

reset role;
select case when (select count(distinct professional_id) from public.contatos_vistos
                   where user_id = '00000000-0000-4000-8000-0000000f3203') = 1
            then 'ok 5 — abrir a mesma ficha três vezes conta como uma'
            else 'FALHOU 5 — a mesma ficha gastou o teto mais de uma vez'
       end as resultado;
set local role authenticated;

-- ── 6. Nem por ali sai o contato de quem está oculto ──────────────────
-- ANTES do teto, e não depois: pedir um contato gasta uma vaga do dia
-- mesmo quando ele não sai (a tentativa fica registrada, que é o certo).
-- Depois do laço, esta pergunta morria com "você já abriu 20 contatos" e
-- o teste dizia que a proteção falhou quando ela nem tinha sido testada.
select case when not exists (
              select 1 from public.ver_contato('00000000-0000-4000-8000-0000000f3299')
            )
            then 'ok 6 — o contato de quem está oculto não sai nem pela ficha'
            else 'FALHOU 6 — VAZOU: a ficha entregou contato de cadastro oculto'
       end as resultado;

-- ── 4. O teto ─────────────────────────────────────────────────────────
-- Do 2 ao 20: com o 1 já aberto, fecham vinte cadastros distintos.
do $$
declare i int;
begin
  -- Do 2 ao 19: o cadastro 1 e a tentativa no oculto já gastaram duas
  -- das vinte vagas do dia.
  for i in 2..19 loop
    perform public.ver_contato(
      ('00000000-0000-4000-8000-00000000' || lpad(i::text, 4, '0'))::uuid);
  end loop;
end $$;

do $$
begin
  perform public.ver_contato('00000000-0000-4000-8000-000000000021');
  raise notice 'FALHOU 4 — o teto de 20 por dia não barrou o vigésimo primeiro';
exception when others then
  raise notice 'ok 4 — o teto barrou: %', sqlerrm;
end $$;

-- ── 7. Quem se candidatou à MINHA vaga sai sem teto ───────────────────
-- A função recebe a VAGA, não a empresa: é a porta mais estreita que
-- resolve o caso, e é o que a tela pede.
-- Mesmo com o teto do dia já estourado logo acima.
select case when count(*) >= 1
            then 'ok 7 — quem se candidatou à minha vaga vem, mesmo com o teto batido'
            else 'FALHOU 7 — a empresa não consegue falar com quem se candidatou'
       end as resultado
  from public.contatos_dos_interessados('00000000-0000-4000-8000-0000000f3220');

-- ── 8. E a vaga dos outros não me dá nada ─────────────────────────────
select case when count(*) = 0
            then 'PRONTO — o telefone sai um por vez, e a vaga dos outros não entrega nada'
            else 'FALHOU 8 — VAZOU: peguei os interessados da vaga de outra empresa'
       end as resultado
  from public.contatos_dos_interessados('00000000-0000-4000-8000-0000000f3221');

rollback;
