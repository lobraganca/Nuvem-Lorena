-- ═══════════════════════════════════════════════════════════════════════
-- 0080 — A vaga passa a dizer o que uma pessoa precisa saber para responder
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "tem que ter todos os campos descritos."
--
-- ── O QUE A VAGA NÃO DIZIA ────────────────────────────────────────────
--
-- O cadastro tinha nove campos, e SETE eram opcionais. Dava para publicar
-- uma vaga com "Vendedor" e a categoria, e mais nada — sem descrição, sem
-- salário, sem horário, sem dizer se é registrado ou diária.
--
-- Faltavam as três perguntas que decidem se alguém responde, e nenhuma
-- delas existia em coluna nenhuma:
--
--   é registrado?   CLT, diária, temporário, freelance — muda tudo para
--                   quem está decidindo se larga o que tem
--   que horário?    integral, meio período, turno, fim de semana — quem
--                   tem filho na escola ou outro trabalho decide por aqui
--   tem benefício?  vale-transporte decide quem mora longe; refeição pesa
--                   num salário de piso
--
-- Sem elas, quem procura só descobre no telefonema — e o telefonema é o
-- que o app existe para não desperdiçar.
--
-- ── SALÁRIO: FALTAVA O "A COMBINAR" ───────────────────────────────────
--
-- Havia faixa mínima e máxima, as duas opcionais, e nada mais. Quem não
-- quer publicar valor deixava as duas em branco — e "em branco" some da
-- tela, virando indistinguível de quem esqueceu de preencher.
--
-- Com a marca, "a combinar" vira uma resposta escrita, que aparece. É
-- diferente de silêncio: a pessoa sabe que o assunto se conversa, em vez de
-- suspeitar que estão escondendo.
--
-- ── POR QUE AS COLUNAS ACEITAM NULO ───────────────────────────────────
--
-- Quem exige o preenchimento é o FORMULÁRIO, e não um `not null` aqui.
-- Duas razões, e a segunda é a que decide:
--
--   1. As vagas que já existem ficariam inválidas de um dia para o outro.
--   2. Um `not null` recusa a gravação com um erro do banco, que chega na
--      tela como texto técnico e sem dizer QUAL campo faltou. O formulário
--      recusa apontando o campo, antes de a empresa tocar em publicar.
--
-- O que o banco guarda é a FORMA do valor (os `check` abaixo), que é o que
-- ele sabe conferir melhor que qualquer tela.

alter table public.job_listings
  add column if not exists tipo_contrato text,
  add column if not exists jornada text,
  add column if not exists beneficios text[] not null default '{}',
  add column if not exists salario_a_combinar boolean not null default false;

-- Os valores possíveis, escritos aqui e não só na tela: uma tela nova, uma
-- importação, ou um toque na API podem gravar "CLT " com espaço, e aí a
-- lista de vagas passa a ter dois tipos de contrato que são o mesmo.
alter table public.job_listings drop constraint if exists job_listings_tipo_contrato_check;
alter table public.job_listings add constraint job_listings_tipo_contrato_check
  check (tipo_contrato is null or tipo_contrato in (
    'clt', 'temporario', 'diaria', 'freelance', 'estagio', 'aprendiz'
  ));

alter table public.job_listings drop constraint if exists job_listings_jornada_check;
alter table public.job_listings add constraint job_listings_jornada_check
  check (jornada is null or jornada in (
    'integral', 'meio_periodo', 'turnos', 'fins_de_semana', 'a_combinar'
  ));

-- Faixa invertida é erro de digitação, e ele é silencioso: "de R$ 3.000 a
-- R$ 1.800" fica na tela sem nada reclamando, e quem lê entende que a
-- empresa não sabe o que está pagando.
alter table public.job_listings drop constraint if exists job_listings_faixa_salarial_check;
alter table public.job_listings add constraint job_listings_faixa_salarial_check
  check (
    salary_range_min is null
    or salary_range_max is null
    or salary_range_max >= salary_range_min
  );

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.job_listings'::regclass
           and attname in ('tipo_contrato', 'jornada', 'beneficios', 'salario_a_combinar')
           and not attisdropped) = 4
   and (select count(*) from pg_constraint
         where conrelid = 'public.job_listings'::regclass
           and conname in ('job_listings_tipo_contrato_check',
                           'job_listings_jornada_check',
                           'job_listings_faixa_salarial_check')) = 3
  then 'PRONTO — a vaga passa a guardar tipo de contrato, jornada, benefícios e salário a combinar'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;
