-- ═══════════════════════════════════════════════════════════════════════
-- 30 — A vitrine abre sem conta, e sem telefone de ninguém
-- ═══════════════════════════════════════════════════════════════════════
--
-- A 0132 abriu a lista de candidatos para quem NÃO TEM CONTA. Isso é o que
-- a dona pediu ("ver as vagas e os candidatos sem fazer login") e é também
-- a coisa mais perigosa que se pode fazer neste banco: a 0118 fechou essa
-- mesma porta porque por ela saía o telefone de todos os desempregados da
-- cidade, que é o insumo do golpe de emprego falso.
--
-- Então este teste existe para uma coisa só: garantir que a porta que
-- abriu é a estreita, e não a larga. Ele responde cinco perguntas, e as
-- duas primeiras são as que importam.
--
--   1. quem não tem conta lê a vitrine?
--   2. quem não tem conta CONTINUA sem ler a view com telefone?
--   3. a vitrine tem alguma coluna de contato? (nem por descuido)
--   4. cadastro suspenso, pausado ou sem telefone confirmado some dela?
--   5. quem não tem conta lê as vagas abertas — e só as abertas?
--
-- A 3 é a que pega o erro que ninguém veria: alguém acrescenta uma coluna
-- na `professionals` e a repete aqui por hábito, e o vazamento volta sem
-- nenhum sintoma na tela.

\set ON_ERROR_STOP on
begin;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.usuario', true), '')::uuid
$$;

insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000f3001', '5531900003001', now()),
  ('00000000-0000-4000-8000-0000000f3002', '5531900003002', now()),
  ('00000000-0000-4000-8000-0000000f3003', '5531900003003', now()),
  ('00000000-0000-4000-8000-0000000f3004', '5531900003004', now())
on conflict (id) do nothing;

-- Quatro cadastros: um que DEVE aparecer e três que não devem, um por
-- motivo. Os três existem para a pergunta 4 — sem eles o teste diria "a
-- vitrine mostra gente" e não diria "mostra a gente certa".
insert into public.professionals
  (id, owner_id, name, category, city, uf, phone, whatsapp, email,
   areas_de_interesse, whatsapp_verified, suspended, paused)
values
  ('00000000-0000-4000-8000-0000000f3011', '00000000-0000-4000-8000-0000000f3001',
   'Aparece', 'padaria', 'Itabirito', 'MG', '5531900003001', '5531900003001', 'a@a.com',
   '{"padaria"}', true, false, false),
  ('00000000-0000-4000-8000-0000000f3012', '00000000-0000-4000-8000-0000000f3002',
   'Suspenso', 'padaria', 'Itabirito', 'MG', '5531900003002', '5531900003002', 'b@b.com',
   '{"padaria"}', true, true, false),
  ('00000000-0000-4000-8000-0000000f3013', '00000000-0000-4000-8000-0000000f3003',
   'Pausado', 'padaria', 'Itabirito', 'MG', '5531900003003', '5531900003003', 'c@c.com',
   '{"padaria"}', true, false, true),
  ('00000000-0000-4000-8000-0000000f3014', '00000000-0000-4000-8000-0000000f3004',
   'Sem confirmar', 'padaria', 'Itabirito', 'MG', '5531900003004', '5531900003004', 'd@d.com',
   '{"padaria"}', false, false, false)
on conflict (id) do nothing;

-- O gatilho da 0024/0052 zera `whatsapp_verified` em todo INSERT — quem
-- confirma é o SMS, não quem grava a linha. Então a confirmação vem por
-- update, depois, como acontece de verdade. (Foi isto que fez a primeira
-- versão deste teste dizer "a vitrine não abriu": ela abria, e não havia
-- ninguém confirmado dentro.)
set local app.confirmando_whatsapp = 'sim';
update public.professionals
   set whatsapp_verified = true, whatsapp_verified_at = now()
 where id in ('00000000-0000-4000-8000-0000000f3011',
              '00000000-0000-4000-8000-0000000f3012',
              '00000000-0000-4000-8000-0000000f3013');
set local app.confirmando_whatsapp = '';

insert into public.companies (id, owner_id, company_name, city, uf, phone, responsible_name)
values ('00000000-0000-4000-8000-0000000f3020', '00000000-0000-4000-8000-0000000f3001',
        'Padaria da Esquina', 'Itabirito', 'MG', '5531900003001', 'Dona')
on conflict (id) do nothing;

-- Sem plano ativo o banco recusa a vaga (0073), e o plano também limita
-- quantas ficam abertas ao mesmo tempo. Aqui a vaga é só o cenário, não o
-- assunto do teste — daí o plano sem limite.
update public.companies
   set plano = 'ilimitado', plano_ate = now() + interval '30 days'
 where id = '00000000-0000-4000-8000-0000000f3020';

insert into public.job_listings
  (id, company_id, title, description, profession, city, uf, status, work_modality)
values
  ('00000000-0000-4000-8000-0000000f3030', '00000000-0000-4000-8000-0000000f3020',
   'Atendente', 'Balcão', 'atendente', 'Itabirito', 'MG', 'active', 'presencial'),
  ('00000000-0000-4000-8000-0000000f3031', '00000000-0000-4000-8000-0000000f3020',
   'Vaga encerrada', 'Já foi', 'atendente', 'Itabirito', 'MG', 'active', 'presencial')
on conflict (id) do nothing;

-- A segunda nasce aberta e é encerrada logo em seguida: o plano limita
-- quantas ficam ABERTAS ao mesmo tempo (0073), e não quantas existem.
update public.job_listings set status = 'closed'
 where id = '00000000-0000-4000-8000-0000000f3031';

-- ── A partir daqui, ninguém está logado ────────────────────────────────
-- `anon` é o papel de quem abre o site sem conta. A chave dele vai dentro
-- do JavaScript da página: tudo o que este papel lê é público de verdade.
set local role anon;
set local teste.usuario = '';

-- 1. A vitrine abre.
select case when count(*) = 1
            then 'ok 1 — quem não tem conta vê o candidato'
            else 'FALHOU 1 — a vitrine não abriu para quem não tem conta'
       end as resultado
  from public.professionals_vitrine;

-- 4. E mostra só quem deve aparecer. (Vem junto da 1: é a mesma consulta.)
select case when count(*) = 0
            then 'ok 4 — suspenso, pausado e sem telefone confirmado não aparecem'
            else 'FALHOU 4 — VAZOU: cadastro que não devia aparecer está na vitrine'
       end as resultado
  from public.professionals_vitrine
 where name in ('Suspenso', 'Pausado', 'Sem confirmar');

-- 5. As vagas abertas abrem, e as encerradas não.
select case when count(*) = 1
            then 'ok 5 — quem não tem conta vê a vaga aberta, e só ela'
            else 'FALHOU 5 — a lista de vagas sem conta veio errada'
       end as resultado
  from public.job_listings;

reset role;

-- 2. A view COM telefone continua fechada para quem não tem conta.
--    Fora do `set role` de propósito: aqui se pergunta ao catálogo quem
--    TEM permissão, em vez de tentar ler e depender de o erro certo
--    aparecer.
select case when not has_table_privilege('anon', 'public.professionals_public', 'SELECT')
            then 'ok 2 — quem não tem conta continua sem ler telefone'
            else 'FALHOU 2 — VAZOU: o anon voltou a ler a professionals_public'
       end as resultado;

-- 3. A vitrine não tem coluna de contato nenhuma.
select case when count(*) = 0
            then 'PRONTO — a vitrine abre sem conta, e sem contato de ninguém'
            else 'FALHOU 3 — VAZOU: a vitrine ganhou coluna de contato'
       end as resultado
  from pg_attribute
 where attrelid = 'public.professionals_vitrine'::regclass
   and not attisdropped and attnum > 0
   and attname in ('phone', 'whatsapp', 'email', 'telefones_extra',
                   'instagram', 'linkedin', 'bio', 'cep', 'street',
                   'street_number');

rollback;
