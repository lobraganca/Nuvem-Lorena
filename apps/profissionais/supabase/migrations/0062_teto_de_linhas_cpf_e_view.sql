-- 0062 — quatro pendências da auditoria, num arquivo só.

-- ── 1. Ninguém baixa a lista inteira de telefones ──────────────────────
-- A busca é pública de propósito, e isso está certo. O problema não é ver
-- UM telefone: é poder pedir TODOS de uma vez. A lista pública devolve
-- nome, telefone, WhatsApp e e-mail, e não havia teto — um único pedido
-- bem escrito baixava a base inteira de contatos, que é o ativo do app.
--
-- 200 é folgado para a tela (a busca pede 24 por vez) e curto para quem
-- quer levar tudo.
alter role anon set pgrst.db_max_rows = '200';
alter role authenticated set pgrst.db_max_rows = '200';

-- ── 2. A anotação da suspensão sai da lista pública ────────────────────
-- Hoje é inofensiva, porque a view só devolve quem NÃO está suspenso. Mas
-- é uma coluna que não tem por que estar ali, e já vazou uma vez: quando
-- o `where` se perdeu numa alteração, cadastros suspensos voltaram à busca
-- levando junto o motivo interno da suspensão.
--
-- ATENÇÃO ao recriar esta view: o `where` do fim é obrigatório.
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

-- ── 3. O CPF sai do banco ──────────────────────────────────────────────
-- Deixou de ser pedido na 0033 e a coluna ficou "para não apagar dado de
-- quem já preencheu". Guardar dado sem finalidade atual é o problema, não
-- a solução. A função que gravava nela já saiu do código.
alter table public.profiles drop column if exists cpf;

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema: aquele filtra por
-- privilégio do papel corrente e já respondeu "não existe" cinco vezes
-- para uma coluna que existia.
select
  case when (select count(*) from pg_attribute
              where attrelid = 'public.profiles'::regclass
                and attname = 'cpf' and not attisdropped) = 0
       and (select count(*) from pg_attribute
              where attrelid = 'public.professionals_public'::regclass
                and attname = 'suspended_reason' and not attisdropped) = 0
       and (select count(*) from pg_attribute
              where attrelid = 'public.professionals_public'::regclass
                and attname = 'uf' and not attisdropped) = 1
  then 'PRONTO — teto de linhas, cpf apagado, motivo da suspensao fora da lista'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;
