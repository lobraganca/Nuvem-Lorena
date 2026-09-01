-- 0065 — Tira do banco o que era só do Ei Itabirito.
--
-- ── O QUE ACONTECEU ──────────────────────────────────────────────────
--
-- Uma sessão diferente desta transformou o procurô num app de vagas de
-- emprego ("Ei Itabirito"), no MESMO banco (dfdinrimxqoqjedemjbw). O
-- código já foi revertido — a branch que publica voltou a ser só procurô
-- — mas o BANCO continuava com tudo o que as migrations 0065 a 0080 e a
-- 0100 da outra sessão criaram, porque migration não desaparece sozinha
-- quando o arquivo sai do repositório.
--
-- Antes de apagar, uma consulta só de leitura confirmou o que importava:
--
--     empresas ........................... 0
--     vagas publicadas ................... 0
--     avisos de vaga enviados ............ 0
--     respostas a vaga .................... 0
--     cadastros com experiência escrita .. 0
--     cadastros com curso escrito ......... 0
--
-- Ei Itabirito nunca teve uso real — nenhuma empresa se cadastrou, nenhuma
-- vaga foi publicada. Os 45 cadastros profissionais do banco são todos do
-- procurô; nenhum usou os campos que só o Ei lia. Por isso isto apaga sem
-- pedir confirmação de dado nenhum: não existe dado para perder.
--
-- Os números completos (76 contas, 45 profissionais, 26 favoritos, 7
-- assinaturas) foram conferidos por ela mesma antes desta migration ser
-- escrita, rodando um script que só contava — nenhuma tabela do procurô
-- aparece aqui embaixo.
--
-- ── O QUE FICA DE FORA, DE PROPÓSITO ─────────────────────────────────
--
-- `public.professionals`, `public.profiles` e as contas de login
-- (`auth.users`) são do procurô — o Ei só usava colunas extras dentro da
-- primeira. As colunas somem nesta migration; a tabela e as 45 linhas
-- continuam inteiras.

-- ── 1. As tabelas que o Ei criou do zero ─────────────────────────────
-- CASCADE porque cada uma tem gatilhos e índices próprios; nenhuma tem
-- ligação com tabela do procurô, então o CASCADE não alcança nada além
-- do que está listado aqui.
drop table if exists public.job_responses cascade;
drop table if exists public.job_dispatches cascade;
drop table if exists public.job_notifications cascade;
drop table if exists public.job_listings cascade;
drop table if exists public.companies cascade;
drop table if exists public.professional_experiences cascade;
drop table if exists public.professional_courses cascade;
drop table if exists public.push_devices cascade;
drop table if exists public.user_onboarding cascade;

-- ── 2. A view pública da empresa (0100) ──────────────────────────────
drop view if exists public.companies_public;

-- ── 2b. professionals_public volta a ser a do procurô ────────────────
-- A 0076 da Ei redefiniu esta view DUAS vezes: acrescentou as colunas
-- `areas_de_interesse` e `disponivel` (que saem no passo 4 abaixo — e por
-- isso a view precisa ser recriada ANTES, senão o DROP COLUMN recusa,
-- porque a view antiga depende delas), e trocou o `where` para exigir
-- `whatsapp_verified = true`.
--
-- Essa segunda parte é a que importa de verdade: ela muda quem aparece na
-- BUSCA DO PROCURÔ. Ninguém pediu essa regra para o procurô — ela existe
-- porque o Ei precisa de WhatsApp confirmado antes de repassar contato de
-- vaga. Enquanto ficar assim, profissional sem WhatsApp confirmado some
-- da busca sem aviso nenhum, e ninguém saberia por quê.
--
-- Esta é a definição de volta ao que era na 0062 — a última vez que esta
-- view foi só do procurô, antes de qualquer coisa da Ei.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, uf, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  case when mostrar_endereco then neighborhood end as neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

-- ── 3. As funções que sobrevivem a um DROP TABLE CASCADE ────────────
-- Gatilho cai junto com a tabela; função solta, chamada só pelo código
-- do app (não por gatilho), não cai. Ficaria lixo sem nome de tabela
-- nenhuma para lembrar de onde veio.
drop function if exists public.job_notifications_so_marca_visto() cascade;
drop function if exists public.quantos_recebem_push(uuid[]) cascade;
drop function if exists public.candidatos_da_onda(uuid) cascade;
drop function if exists public.vagas_disparadas_no_mes(uuid) cascade;
drop function if exists public.limite_de_vagas_do_plano(uuid) cascade;
drop function if exists public.vagas_anunciadas_agora(uuid) cascade;
drop function if exists public.vagas_ativas_agora(uuid) cascade;
drop function if exists public.confirmar_telefone_empresa(uuid) cascade;
drop function if exists public.companies_protege_telefone_confirmado() cascade;
drop function if exists public.job_listings_respeita_plano() cascade;
drop function if exists public.job_dispatches_teto_por_vaga() cascade;
drop function if exists public.job_listings_exige_plano() cascade;
drop function if exists public.job_notifications_exige_confirmacao() cascade;
drop function if exists public.job_responses_pessoa_so_mexe_no_interesse() cascade;
drop function if exists public.job_responses_so_em_vaga_ativa() cascade;
drop function if exists public.update_user_onboarding_timestamp() cascade;
drop function if exists public.update_companies_timestamp() cascade;
drop function if exists public.update_job_listings_timestamp() cascade;
drop function if exists public.update_job_dispatches_timestamp() cascade;
drop function if exists public.update_job_responses_timestamp() cascade;

-- ── 4. As duas colunas que o Ei acrescentou na tabela do procurô ────
-- A tabela e as 45 linhas continuam. Só as colunas que ninguém do
-- procurô preencheu (a conferência mostrou 0 usos) saem.
alter table public.professionals drop column if exists areas_de_interesse;
alter table public.professionals drop column if exists disponivel;

-- ── Confere a si mesma ────────────────────────────────────────────────
-- pg_catalog, nunca information_schema.
select case
  when (select count(*) from pg_class
         where relnamespace = 'public'::regnamespace
           and relname in ('companies','job_listings','job_dispatches',
                            'job_responses','job_notifications',
                            'professional_experiences','professional_courses',
                            'push_devices','user_onboarding','companies_public')) = 0
   and (select count(*) from pg_attribute
         where attrelid = 'public.professionals'::regclass
           and attname in ('areas_de_interesse','disponivel')
           and not attisdropped) = 0
   -- Não trava num número fixo: entre a contagem de antes e o momento em
   -- que isto roda, pode ter entrado gente nova. O que importa é que a
   -- tabela não ficou vazia — não que bateu com um número velho.
   and (select count(*) from public.professionals) > 0
   and (select pg_get_viewdef('public.professionals_public'::regclass)) not like '%whatsapp_verified = true%'
   and (select pg_get_viewdef('public.professionals_public'::regclass)) not like '%areas_de_interesse%'
  then 'PRONTO — o Ei Itabirito saiu do banco, os cadastros do procurô continuam intactos, e a busca voltou a mostrar todo mundo (sem exigir WhatsApp confirmado)'
  else 'AINDA FALTA — alguma parte acima não passou; me mande o erro que apareceu'
  end as resultado;
