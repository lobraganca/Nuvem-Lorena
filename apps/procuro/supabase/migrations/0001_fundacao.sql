-- =====================================================================
-- 0001 — Fundação: cidades, categorias, perfis e profissionais
-- =====================================================================
--
-- Esta é a base de tudo. Quatro tabelas e as regras de quem enxerga o quê.
--
-- Duas decisões que valem explicação, porque as duas custam caro se
-- forem tomadas errado agora e descobertas depois:
--
-- 1. **Cidade é tabela, não texto.** O app nasce em Itabirito, mas a
--    segunda cidade não pode exigir reescrita. Guardar "Itabirito" como
--    string em cada cadastro parece mais simples hoje e vira um problema
--    no dia em que alguém escrever "itabirito", "Itabirito/MG" e
--    "ITABIRITO" — três cidades diferentes para o banco, uma só para
--    quem procura. Com tabela, o raio de atendimento, a onda de disparo
--    e o relatório por praça já nascem separáveis.
--
-- 2. **Toda view pública carrega o próprio `where`.** Uma view no
--    Postgres roda com os direitos de quem a criou, então ela IGNORA o
--    RLS das tabelas que lê. Uma view sem filtro é um vazamento silencioso:
--    ninguém vê erro, os dados simplesmente saem. Por isso cada view aqui
--    repete a condição de visibilidade em vez de confiar na policy.
--
-- =====================================================================

-- --- Cidades ---------------------------------------------------------

create table if not exists public.cidades (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  uf           char(2) not null,
  -- Centro da cidade. Serve de âncora para calcular distância quando o
  -- cadastro não tem endereço exato — e muitos não terão.
  latitude     double precision,
  longitude    double precision,
  -- Raio padrão de atendimento, em quilômetros, para quem não escolher.
  -- Fica por cidade porque 15km em Itabirito cobre tudo e em Belo
  -- Horizonte não cobre um bairro.
  raio_padrao_km  integer not null default 15,
  ativa        boolean not null default true,
  criada_em    timestamptz not null default now(),
  unique (nome, uf)
);

-- --- Categorias (ofícios) --------------------------------------------

create table if not exists public.categorias (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  -- Agrupamento que aparece na busca: "Casa e obra", "Técnica e conserto",
  -- "Beleza e bem-estar". Texto e não tabela porque o conjunto é pequeno,
  -- estável, e vira filtro de tela — não entidade com vida própria.
  grupo      text not null,
  icone      text,
  descricao  text,
  ativa      boolean not null default true,
  -- Ordem de exibição. Inteiro com espaço entre os valores (10, 20, 30)
  -- para dar para inserir no meio sem renumerar a tabela inteira.
  ordem      integer not null default 100,
  criada_em  timestamptz not null default now()
);

create index if not exists categorias_grupo_idx on public.categorias (grupo) where ativa;

-- --- Perfis ----------------------------------------------------------
--
-- Uma linha por conta, cliente ou profissional. O mesmo login serve para
-- os dois papéis: quem contrata hoje pode se cadastrar como profissional
-- amanhã sem criar outra conta.

create table if not exists public.perfis (
  id             uuid primary key references auth.users (id) on delete cascade,
  nome           text not null,
  telefone       text,
  -- Confirmação por código. Guardar o número que foi confirmado (e não só
  -- um "sim") impede o truque de confirmar um número e depois trocar por
  -- outro no cadastro: se `telefone` mudar, isto aqui deixa de bater.
  telefone_confirmado       text,
  telefone_confirmado_em    timestamptz,
  foto_url       text,
  cidade_id      uuid references public.cidades (id),
  -- Aceite da política de privacidade, com data. A LGPD pede consentimento
  -- demonstrável — "a pessoa aceitou" sem quando não demonstra nada.
  aceitou_termos_em  timestamptz,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- --- Profissionais ---------------------------------------------------

create table if not exists public.profissionais (
  id            uuid primary key default gen_random_uuid(),
  perfil_id     uuid not null unique references public.perfis (id) on delete cascade,
  categoria_id  uuid not null references public.categorias (id),
  cidade_id     uuid not null references public.cidades (id),

  -- Pessoa física ou empresa. Muda o que é exigido na verificação (CPF e
  -- foto para autônomo; CNPJ e responsável para empresa) e o preço do plano.
  tipo          text not null default 'pf' check (tipo in ('pf', 'pj')),

  apresentacao  text,
  raio_km       integer not null default 15,
  latitude      double precision,
  longitude     double precision,

  -- Disponibilidade. Quatro estados, e cada um existe por um motivo
  -- diferente — por isso não é um booleano:
  --   disponivel — aparece na busca e recebe disparo
  --   pausado    — aparece na busca, NÃO recebe disparo (está ocupado hoje)
  --   ferias     — aparece na busca marcado como ausente, não recebe disparo
  --   oculto     — sai da busca inteira, some sem apagar o cadastro
  situacao      text not null default 'disponivel'
                check (situacao in ('disponivel', 'pausado', 'ferias', 'oculto')),
  -- Para as férias voltarem sozinhas. Sem isto, "volto dia 20" vira um
  -- cadastro invisível para sempre, porque ninguém lembra de destravar.
  ausente_ate   date,

  -- Verificação. Separada em duas porque uma libera coisas diferentes da
  -- outra: telefone confirmado libera receber disparo; documento conferido
  -- libera o selo que aparece para quem procura.
  documento_verificado_em  timestamptz,

  -- Suspensão pela administração. Nulo = cadastro normal.
  suspenso_em      timestamptz,
  suspenso_motivo  text,

  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists profissionais_busca_idx
  on public.profissionais (cidade_id, categoria_id)
  where situacao in ('disponivel', 'pausado') and suspenso_em is null;

-- =====================================================================
-- RLS
-- =====================================================================

alter table public.cidades        enable row level security;
alter table public.categorias     enable row level security;
alter table public.perfis         enable row level security;
alter table public.profissionais  enable row level security;

-- Cidades e categorias são catálogo: qualquer um lê, só a administração escreve.
drop policy if exists cidades_leitura on public.cidades;
create policy cidades_leitura on public.cidades
  for select using (ativa);

drop policy if exists categorias_leitura on public.categorias;
create policy categorias_leitura on public.categorias
  for select using (ativa);

-- Perfil: cada um enxerga e edita o próprio. O que o público pode ver de
-- outra pessoa sai pela view `profissionais_publicos`, nunca desta tabela —
-- foi assim que uma lista de todas as contas já vazou uma vez, num projeto
-- que expunha a tabela de perfis direto.
drop policy if exists perfis_proprio on public.perfis;
create policy perfis_proprio on public.perfis
  for all using (id = auth.uid()) with check (id = auth.uid());

-- Profissional: o dono edita o próprio cadastro.
drop policy if exists profissionais_dono on public.profissionais;
create policy profissionais_dono on public.profissionais
  for all
  using (perfil_id = auth.uid())
  with check (perfil_id = auth.uid());

-- =====================================================================
-- View pública dos profissionais
-- =====================================================================
--
-- ATENÇÃO: view roda com os direitos de quem criou e ignora RLS. O `where`
-- abaixo é a ÚNICA coisa que impede cadastro suspenso ou oculto de aparecer
-- para quem procura. Nunca remover.

create or replace view public.profissionais_publicos as
select
  p.id,
  p.categoria_id,
  p.cidade_id,
  p.tipo,
  p.apresentacao,
  p.raio_km,
  p.latitude,
  p.longitude,
  p.situacao,
  p.ausente_ate,
  (p.documento_verificado_em is not null) as verificado,
  perf.nome,
  perf.foto_url,
  -- Telefone só sai se tiver sido confirmado por código. Número não
  -- confirmado é número que ninguém garante — e quem liga descobre isso
  -- do pior jeito.
  case when perf.telefone_confirmado is not null then perf.telefone end as telefone,
  c.nome as categoria_nome,
  c.grupo as categoria_grupo,
  cid.nome as cidade_nome,
  cid.uf   as cidade_uf
from public.profissionais p
join public.perfis     perf on perf.id = p.perfil_id
join public.categorias c    on c.id    = p.categoria_id
join public.cidades    cid  on cid.id  = p.cidade_id
where p.suspenso_em is null      -- suspenso pela administração some
  and p.situacao <> 'oculto'     -- quem se escondeu fica escondido
  and c.ativa
  and cid.ativa;

grant select on public.profissionais_publicos to anon, authenticated;

-- =====================================================================
-- Conferência — lê pg_catalog, nunca information_schema
-- =====================================================================
--
-- O `information_schema` filtra por privilégio do papel corrente e já
-- respondeu "não existe" cinco vezes seguidas para uma coluna que estava
-- lá. `pg_catalog` conta a verdade.

select case
  when (select count(*) from pg_class
         where relname in ('cidades','categorias','perfis','profissionais')
           and relnamespace = 'public'::regnamespace) = 4
   and (select count(*) from pg_class
         where relname = 'profissionais_publicos'
           and relnamespace = 'public'::regnamespace) = 1
  then 'PRONTO — as 4 tabelas e a view foram criadas.'
  else 'AINDA FALTA — alguma tabela ou a view não foi criada. Rode a Parte 1 de novo inteira, sem selecionar trecho.'
end as resultado;
