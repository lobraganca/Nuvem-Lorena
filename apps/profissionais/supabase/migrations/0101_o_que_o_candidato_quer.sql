-- 0101 — O cadastro de quem procura trabalho passa a dizer o que a pessoa
--        QUER, e não só o que ela sabe fazer.
--
-- ── POR QUE ───────────────────────────────────────────────────────────
--
-- A dona: "o cadastro do candidato está muito simples. tem que ter
-- pretensão salarial, horário melhor, se aceita viajar…"
--
-- Hoje o cadastro guarda quem a pessoa é (nome, telefone, bairro) e o que
-- ela faz (as funções). Falta a parte que decide se o encontro acontece:
-- por quanto ela topa, em que horário pode, e se sai da cidade.
--
-- Sem isso, os dois lados perdem tempo. A empresa liga para dez pessoas
-- para descobrir que oito não podem no horário dela; e quem procura
-- trabalho atende dez ligações de vagas que nunca serviriam. Numa cidade
-- pequena, onde todo mundo se conhece, esse desencontro custa reputação
-- dos dois lados.
--
-- ── AS QUATRO COLUNAS, E POR QUE CADA UMA É ASSIM ─────────────────────
--
-- `pretensao_centavos` — em CENTAVOS, inteiro. Valor com vírgula em ponto
--   flutuante rende diferença de um centavo, e é a diferença que a pessoa
--   percebe. É o mesmo que já se faz em `banners.valor_centavos`.
--   Nulo = não quis dizer, e isso é diferente de zero.
--
-- `pretensao_combinar` — "a combinar" é uma resposta legítima e muito
--   comum aqui, e não é a mesma coisa que campo vazio: uma diz "prefiro
--   conversar", a outra diz "não respondi". Guardar as duas no mesmo nulo
--   apagaria a diferença.
--
-- `disponibilidade` — lista de texto, não um único valor: quem pode de
--   manhã E aos sábados é o caso comum, não a exceção. Os valores ficam no
--   app (`DISPONIBILIDADE` em types/domain.ts) para mudar a lista sem
--   migration nova; o `check` daqui limita só a QUANTIDADE, para o campo
--   não virar depósito de lixo por API direta.
--
-- `aceita_viajar` — booleano com default `false`, e não nulo: a pergunta é
--   fechada e a resposta padrão é a mais segura para quem procura (não sai
--   da cidade a menos que diga que sai).
--
-- Nenhuma delas é obrigatória. Cadastro que exige tudo é cadastro que não
-- se termina — e o que trava o cadastro hoje é só o telefone confirmado.

alter table public.professionals
  add column if not exists pretensao_centavos integer,
  add column if not exists pretensao_combinar boolean not null default false,
  add column if not exists disponibilidade text[] not null default '{}',
  add column if not exists aceita_viajar boolean not null default false;

alter table public.professionals
  drop constraint if exists professionals_pretensao_positiva;
alter table public.professionals
  add constraint professionals_pretensao_positiva
  check (pretensao_centavos is null or pretensao_centavos >= 0);

alter table public.professionals
  drop constraint if exists professionals_disponibilidade_limite;
alter table public.professionals
  add constraint professionals_disponibilidade_limite
  check (array_length(disponibilidade, 1) is null or array_length(disponibilidade, 1) <= 8);

-- A view pública lista coluna por coluna (para nunca devolver `document`),
-- então precisa ser recriada para enxergar as novas. As quatro são
-- públicas de propósito: é justamente o que a empresa precisa ver ANTES de
-- ligar — esconder isso devolveria o desencontro que a migration existe
-- para acabar.
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
  areas_de_interesse,
  pretensao_centavos, pretensao_combinar, disponibilidade, aceita_viajar,
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
           and attname in ('pretensao_centavos', 'pretensao_combinar',
                           'disponibilidade', 'aceita_viajar')
           and not attisdropped) = 4
   and (select count(*) from pg_attribute
         where attrelid = 'public.professionals_public'::regclass
           and attname in ('pretensao_centavos', 'pretensao_combinar',
                           'disponibilidade', 'aceita_viajar')
           and not attisdropped) = 4
  then 'PRONTO — o cadastro ja aceita pretensao, horario e viagem'
  else 'AINDA FALTA — me mande o que apareceu'
  end as resultado;
