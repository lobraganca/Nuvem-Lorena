-- ═══════════════════════════════════════════════════════════════════════
-- 0103 — O cadastro de quem procura trabalho passa a dizer quem a pessoa é
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona, listando o que falta: "Data de Nascimento / Possui CNH? Qual
-- categoria? / Telefones / Trabalha em final de semana? / Disponibilidade
-- pra começar imediato? / Modo de trabalho (remoto / presencial /
-- híbrido)".
--
-- ── ANTES DE TUDO: UM CONSERTO ────────────────────────────────────────
--
-- A 0101 recriou a `professionals_public` coluna por coluna e ESQUECEU a
-- `disponivel`, que a 0075 tinha posto lá. A view é recriada por inteiro
-- justamente porque a lista de colunas é escrita à mão — e foi a lista à
-- mão que perdeu uma.
--
-- Isso não é cosmético: a tela do perfil público pede a coluna pelo nome
--
--     .select("... especialidade, disponivel, whatsapp_verified")
--
-- e o PostgREST responde `42703 column ... does not exist` para a consulta
-- INTEIRA. Ou seja: desde a 0101, abrir o perfil de qualquer profissional
-- dá erro. Ela volta aqui embaixo.
--
-- É o terceiro acidente do mesmo tipo (a 0049 perdeu o `where`, a 0101
-- perdeu esta coluna). Quem recriar esta view de novo: compare a lista
-- nova com a que está no banco ANTES de trocar.
--
-- ── AS COLUNAS NOVAS, E POR QUE CADA UMA ──────────────────────────────
--
-- `data_nascimento` — guarda a DATA, e a view devolve só a IDADE. A
--   empresa precisa saber se a pessoa tem 17 (jornada e aprendizagem
--   mudam) ou 58; não precisa do dia do aniversário de ninguém. O `check`
--   só barra data absurda: idade mínima não cabe aqui porque `current_date`
--   não é imutável e o Postgres recusa a restrição — quem confere isso é o
--   formulário.
--
-- `cnh` + `cnh_categorias` — separados de propósito. "Não tem CNH" e "tem,
--   mas não disse a categoria" são respostas diferentes, e num só campo
--   virariam o mesmo vazio. Metade das vagas de entrega da cidade começa
--   por essa pergunta.
--
-- `telefones_extra` — a dona: "ao confirmar o telefone ele não pode sair do
--   cadastro. A pessoa pode adicionar outros." O `phone` continua sendo o
--   número CONFIRMADO por SMS, trancado; estes são os outros, digitados à
--   mão e sem confirmação nenhuma. Guardar os dois no mesmo lugar apagaria
--   a diferença entre "número provado" e "número que alguém escreveu".
--
-- `fim_de_semana`, `inicio_imediato` — perguntas fechadas, resposta padrão
--   `false`: quem não respondeu não vira candidato a plantão de domingo.
--
-- `modo_trabalho` — presencial, remoto, híbrido, ou tanto faz. O "tanto
--   faz" existe e é a resposta mais comum aqui: numa cidade pequena quase
--   tudo é presencial, e obrigar a escolher faz a pessoa marcar qualquer
--   coisa para o formulário parar de reclamar.

-- ── Parte 1 de 2: as colunas ───────────────────────────────────────────

alter table public.professionals
  add column if not exists data_nascimento date,
  add column if not exists cnh boolean not null default false,
  add column if not exists cnh_categorias text[] not null default '{}',
  add column if not exists telefones_extra text[] not null default '{}',
  add column if not exists modo_trabalho text,
  add column if not exists fim_de_semana boolean not null default false,
  add column if not exists inicio_imediato boolean not null default false;

alter table public.professionals drop constraint if exists professionals_nascimento_check;
alter table public.professionals add constraint professionals_nascimento_check
  check (data_nascimento is null
         or (data_nascimento > date '1900-01-01' and data_nascimento < date '2100-01-01'));

-- As categorias que existem no Brasil, escritas aqui e não só na tela: uma
-- API direta gravaria "b " com espaço, e a busca por quem tem "B" deixaria
-- essa pessoa de fora sem nada avisando.
alter table public.professionals drop constraint if exists professionals_cnh_categorias_check;
alter table public.professionals add constraint professionals_cnh_categorias_check
  check (cnh_categorias <@ array['A','B','C','D','E','AB','AC','AD','AE']::text[]);

alter table public.professionals drop constraint if exists professionals_modo_trabalho_check;
alter table public.professionals add constraint professionals_modo_trabalho_check
  check (modo_trabalho is null
         or modo_trabalho in ('presencial', 'remoto', 'hibrido', 'tanto_faz'));

-- Três números além do confirmado já é mais do que qualquer pessoa usa, e
-- o teto impede que o campo vire depósito por API direta.
alter table public.professionals drop constraint if exists professionals_telefones_extra_limite;
alter table public.professionals add constraint professionals_telefones_extra_limite
  check (array_length(telefones_extra, 1) is null or array_length(telefones_extra, 1) <= 3);

comment on column public.professionals.phone is
  'O número CONFIRMADO por SMS. Trancado no formulário desde a 0076.
   Outros números de contato ficam em telefones_extra, sem confirmação.';

-- ── Parte 2 de 2: a view pública ───────────────────────────────────────
--
-- Recriada por inteiro, e a lista abaixo é a da 0101 MAIS `disponivel`
-- (que voltou), mais as colunas novas. `data_nascimento` NÃO entra —
-- entra a `idade`, calculada.
--
-- E, de novo, o `where` da última linha. View roda com os direitos de quem
-- a criou e não enxerga RLS nenhuma: sem ele, cadastro suspenso e pausado
-- volta para a busca.

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
  pretensao_centavos, pretensao_combinar, disponibilidade, aceita_viajar,
  -- A idade, e não o aniversário: é o que a empresa precisa e o mínimo que
  -- entrega sobre a pessoa.
  case when data_nascimento is not null
       then extract(year from age(data_nascimento))::int end as idade,
  cnh, cnh_categorias, telefones_extra,
  modo_trabalho, fim_de_semana, inicio_imediato,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- A CONFERÊNCIA. É a resposta desta janela que vale.
-- ═══════════════════════════════════════════════════════════════════════
-- Lê o pg_catalog, nunca o information_schema.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.professionals'::regclass
           and attname in ('data_nascimento', 'cnh', 'cnh_categorias',
                           'telefones_extra', 'modo_trabalho',
                           'fim_de_semana', 'inicio_imediato')
           and not attisdropped) = 7
   and (select count(*) from pg_attribute
         where attrelid = 'public.professionals_public'::regclass
           and attname in ('idade', 'cnh', 'cnh_categorias', 'telefones_extra',
                           'modo_trabalho', 'fim_de_semana', 'inicio_imediato',
                           'disponivel')
           and not attisdropped) = 8
   and (select count(*) from pg_attribute
         where attrelid = 'public.professionals_public'::regclass
           and attname = 'data_nascimento' and not attisdropped) = 0
   and (select pg_get_viewdef('public.professionals_public'::regclass)) like '%suspended%'
  then 'PRONTO — o cadastro ja tem nascimento, CNH, telefones e modo de trabalho, e o perfil publico voltou a abrir'
  else 'AINDA FALTA — me mande o que apareceu'
  end as resultado;
