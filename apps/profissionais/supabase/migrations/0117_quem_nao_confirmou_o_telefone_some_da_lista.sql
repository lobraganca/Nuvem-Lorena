-- ═══════════════════════════════════════════════════════════════════════
-- 0117 — Quem não confirmou o telefone volta a sumir da lista pública
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── O defeito, e como ele apareceu ────────────────────────────────────
--
-- A 0076 pôs uma regra na view pública dos cadastros: quem não confirmou
-- o telefone não aparece. Ela existe para uma coisa só — a empresa que
-- abre a lista tem de conseguir LIGAR para quem está nela, e um número
-- não confirmado é um número que pode ser de qualquer pessoa.
--
-- A view foi recriada seis vezes depois disso (0101, 0103, 0106, e as
-- 0114 e 0115 desta semana). Cada recriação copiou o `where` da versão
-- anterior, e em algum ponto o `and whatsapp_verified = true` ficou para
-- trás. Ninguém viu: a view continuou funcionando, a lista continuou
-- cheia — só que com gente a mais.
--
-- Encontrado rodando a bateria de testes de banco inteira (algo que não
-- se fazia havia semanas): o teste 15, escrito em 02/09 justamente para
-- isso, falhava com "quem NÃO confirmou aparece na lista pública".
--
-- ── O que estava acontecendo em produção ──────────────────────────────
--
--   · o banco de talentos mostrava cadastros sem telefone confirmado;
--   · a lista de "quem mais combina" de cada vaga também;
--   · a empresa ligava para um número que ninguém provou ser da pessoa.
--
-- As ONDAS nunca tiveram esse furo: a função que escolhe quem avisar
-- (0113/0114) filtra `whatsapp_verified` por conta própria. O buraco era
-- só na lista — que é justamente por onde a empresa procura sozinha.
--
-- ── Por que a view repete o `where` em vez de confiar no RLS ──────────
--
-- View roda com os direitos de quem a criou e IGNORA o RLS da tabela
-- (é o defeito da 0049, registrado no CLAUDE.md). Toda regra de quem
-- aparece precisa estar escrita aqui dentro, por extenso.

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
  plus_active, plus_until, whatsapp_verified, paused, disponivel, atributos,
  areas_de_interesse,
  pretensao_centavos, pretensao_combinar, pretensao_periodo,
  disponibilidade, aceita_viajar,
  case when data_nascimento is not null
       then extract(year from age(data_nascimento))::int end as idade,
  cnh, cnh_categorias, telefones_extra,
  modo_trabalho, fim_de_semana, inicio_imediato,
  primeiro_emprego, aceita_freela, pcd,
  mostrar_endereco, created_at
from public.professionals
where suspended = false
  and paused = false
  -- A regra que voltou. Ver o cabeçalho.
  and whatsapp_verified = true;

grant select on public.professionals_public to anon, authenticated;

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Além de conferir que a view existe, confere o TEXTO dela: é justamente
-- o `where` que já se perdeu duas vezes sem ninguém ver.
select case
  when (select count(*) from pg_class
         where relname = 'professionals_public'
           and relnamespace = 'public'::regnamespace
           and relkind = 'v') = 1
   and (select pg_get_viewdef('public.professionals_public'::regclass))
         like '%whatsapp_verified%'
   and (select pg_get_viewdef('public.professionals_public'::regclass))
         like '%paused%'
  then 'PRONTO — quem não confirmou o telefone sumiu da lista pública'
  else 'AINDA FALTA — a regra do telefone confirmado não está na view'
  end as resultado;
