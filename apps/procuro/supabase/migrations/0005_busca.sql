-- =====================================================================
-- 0005 — A busca, e o catálogo que ela procura
-- =====================================================================
--
-- Três coisas: o catálogo de ofícios, a ordenação que os planos compram, e
-- a ponte entre o que a pessoa PRECISA e o nome de quem FAZ.
--
-- A terceira é a que mais muda o resultado, e é a menos óbvia:
--
-- **Ninguém acorda pensando "preciso de um eletricista".** Pensa "o
-- chuveiro parou". Uma busca que só procura pelo nome do ofício exige que
-- a pessoa já saiba a resposta para poder fazer a pergunta. Quem não sabe
-- o nome tem três saídas: adivinhar, abrir a lista inteira, ou desistir —
-- e a terceira é a que acontece.
--
-- Por isso existe a tabela `necessidades`: expressões do dia a dia ligadas
-- aos ofícios que resolvem. É tabela e não lista no código porque a dona
-- do negócio precisa poder acrescentar "meu portão travou" no dia em que
-- perceber que alguém procurou por isso e não achou — sem publicar app.
--
-- =====================================================================

-- --- Necessidades: o que a pessoa diz -> quem resolve -----------------

create table if not exists public.necessidades (
  id           uuid primary key default gen_random_uuid(),
  -- O que a pessoa digita. Guardado já sem acento e em minúscula, porque
  -- é assim que vai ser comparado — normalizar na hora da busca, a cada
  -- consulta, é trabalho repetido para sempre.
  termo        text not null,
  categoria_id uuid not null references public.categorias (id) on delete cascade,
  criado_em    timestamptz not null default now(),
  unique (termo, categoria_id)
);

create index if not exists necessidades_termo_idx on public.necessidades (termo);

alter table public.necessidades enable row level security;

drop policy if exists necessidades_leitura on public.necessidades;
create policy necessidades_leitura on public.necessidades for select using (true);

-- --- Tirar acento sem depender de extensão ----------------------------
--
-- O `unaccent` é uma extensão, e extensão é mais uma coisa para instalar,
-- versionar e lembrar de ativar num banco novo. Para o alfabeto português
-- um `translate` resolve, é imediato, e funciona em qualquer Postgres.

create or replace function public.normalizar(texto text)
returns text
language sql
immutable
as $$
  select translate(
    lower(trim(coalesce(texto, ''))),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  )
$$;

-- --- A view pública ganha o destaque do plano -------------------------
--
-- `destaque` é o que o plano compra: quem paga mais aparece antes. Vem da
-- função `plano_vigente` e não de uma coluna porque plano vence sozinho —
-- uma coluna precisaria de alguém para atualizá-la, e no intervalo alguém
-- apareceria em destaque sem estar pagando por isso.
--
-- (`create or replace view` não consegue inserir coluna no MEIO da lista;
-- por isso a lista inteira é repetida na ordem, com a nova no fim.)

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
  case
    when perf.telefone_confirmado is not null
     and perf.telefone_confirmado = perf.telefone
    then perf.telefone
  end as telefone,
  c.nome as categoria_nome,
  c.grupo as categoria_grupo,
  cid.nome as cidade_nome,
  cid.uf   as cidade_uf,
  coalesce(pl.destaque_busca, 0) as destaque
from public.profissionais p
join public.perfis     perf on perf.id = p.perfil_id
join public.categorias c    on c.id    = p.categoria_id
join public.cidades    cid  on cid.id  = p.cidade_id
left join lateral public.plano_vigente(p.id) pl on true
where p.suspenso_em is null
  and p.situacao <> 'oculto'
  and c.ativa
  and cid.ativa;

grant select on public.profissionais_publicos to anon, authenticated;

-- =====================================================================
-- A busca
-- =====================================================================
--
-- Uma função e não uma consulta montada no app, por dois motivos:
--
-- 1. A regra de ordenação é decisão de NEGÓCIO (quem paga aparece antes) e
--    precisa valer igual em toda tela que lista gente. Espalhada pelo app,
--    ela diverge — e a tela que esquecer de aplicá-la vira a tela onde o
--    plano pago não vale nada.
-- 2. A tradução de necessidade para ofício exige duas passadas nos dados.
--    Fazer isso no app são duas viagens de rede em vez de uma.
--
-- O desempate gira todo dia. Sem isso, os mesmos nomes ficam eternamente
-- no topo dentro do mesmo plano, e quem entrou depois nunca aparece —
-- um sorteio diário mantém a ordem estável durante o dia (a lista não
-- dança embaixo do dedo) e justa ao longo da semana.

create or replace function public.buscar_profissionais(
  p_termo       text default null,
  p_cidade_id   uuid default null,
  p_categoria_id uuid default null,
  p_limite      integer default 50
)
returns setof public.profissionais_publicos
language sql
stable
as $$
  with termo as (
    select nullif(public.normalizar(p_termo), '') as t
  ),
  -- Ofícios que a expressão digitada sugere, COM a força de cada
  -- casamento — o comprimento da expressão que casou.
  --
  -- Guardar a força é o ponto todo, e a primeira versão a jogava fora:
  -- ela descobria que "chuveiro vazando" casava com encanador (16 letras)
  -- e com chuveiro/eletricista (8), e então usava um `in (...)`, que é
  -- pertencimento e não tem ordem. Resultado: os dois ofícios entravam
  -- empatados e quem decidia era o plano — o eletricista Premium vinha na
  -- frente do encanador para alguém com vazamento. O teste pegou isso; a
  -- leitura do código não tinha pegado.
  por_necessidade as (
    select n.categoria_id, max(length(n.termo)) as forca
      from public.necessidades n, termo
     where termo.t is not null
       and termo.t like '%' || n.termo || '%'
     group by n.categoria_id
  )
  select pp.*
    from public.profissionais_publicos pp
    cross join termo
    left join por_necessidade pn on pn.categoria_id = pp.categoria_id
   where (p_cidade_id    is null or pp.cidade_id = p_cidade_id)
     and (p_categoria_id is null or pp.categoria_id = p_categoria_id)
     and (
       termo.t is null
       or public.normalizar(pp.nome)           like '%' || termo.t || '%'
       or public.normalizar(pp.categoria_nome) like '%' || termo.t || '%'
       or public.normalizar(pp.apresentacao)   like '%' || termo.t || '%'
       or pn.categoria_id is not null
     )
   order by
     -- 1. O ofício mais certo primeiro.
     --
     -- Vem ANTES da disponibilidade de propósito: um eletricista livre não
     -- resolve um vazamento. Ofício errado disponível não serve para nada,
     -- então relevância manda mais que agenda.
     coalesce(pn.forca, 0) desc,
     -- 2. Disponível antes de pausado e de férias.
     (pp.situacao = 'disponivel') desc,
     -- 3. O destaque que o plano compra.
     pp.destaque desc,
     -- 4. Verificado antes de não verificado, em igualdade de plano.
     pp.verificado desc,
     -- 5. Sorteio que gira todo dia, estável dentro do dia — senão os
     --    mesmos nomes ficam eternamente no topo e quem entrou depois
     --    nunca aparece.
     md5(pp.id::text || current_date::text)
   limit greatest(1, least(coalesce(p_limite, 50), 100))
$$;

-- =====================================================================
-- O catálogo
-- =====================================================================

insert into public.cidades (nome, uf, latitude, longitude, raio_padrao_km)
values ('Itabirito', 'MG', -20.2528, -43.8014, 15)
on conflict (nome, uf) do nothing;

insert into public.categorias (nome, grupo, ordem) values
  -- Casa e obra
  ('Eletricista',                'Casa e obra', 10),
  ('Encanador',                  'Casa e obra', 20),
  ('Pedreiro',                   'Casa e obra', 30),
  ('Pintor',                     'Casa e obra', 40),
  ('Marceneiro',                 'Casa e obra', 50),
  ('Serralheiro',                'Casa e obra', 60),
  ('Vidraceiro',                 'Casa e obra', 70),
  ('Gesseiro',                   'Casa e obra', 80),
  ('Chaveiro',                   'Casa e obra', 90),
  ('Montador de móveis',         'Casa e obra', 100),
  ('Marido de aluguel',          'Casa e obra', 110),
  ('Jardineiro',                 'Casa e obra', 120),
  ('Dedetizador',                'Casa e obra', 130),
  ('Diarista',                   'Casa e obra', 140),
  -- Técnica e conserto
  ('Refrigeração e ar-condicionado', 'Técnica e conserto', 10),
  ('Conserto de eletrodomésticos',   'Técnica e conserto', 20),
  ('Técnico em informática',         'Técnica e conserto', 30),
  ('Técnico em celulares',           'Técnica e conserto', 40),
  ('Mecânico',                       'Técnica e conserto', 50),
  ('Borracheiro',                    'Técnica e conserto', 60),
  ('Lavagem de carros',              'Técnica e conserto', 70),
  ('Costureira',                     'Técnica e conserto', 80),
  -- Beleza e bem-estar
  ('Cabeleireiro',               'Beleza e bem-estar', 10),
  ('Manicure e pedicure',        'Beleza e bem-estar', 20),
  ('Barbeiro',                   'Beleza e bem-estar', 30),
  ('Massagista',                 'Beleza e bem-estar', 40),
  ('Esteticista',                'Beleza e bem-estar', 50),
  ('Personal trainer',           'Beleza e bem-estar', 60),
  ('Nutricionista',              'Beleza e bem-estar', 70),
  ('Fisioterapeuta',             'Beleza e bem-estar', 80),
  -- Festa e alimentação
  ('Confeiteira',                'Festa e alimentação', 10),
  ('Salgadeira',                 'Festa e alimentação', 20),
  ('Cozinheira',                 'Festa e alimentação', 30),
  ('Buffet e festas',            'Festa e alimentação', 40),
  ('Fotógrafo',                  'Festa e alimentação', 50),
  ('DJ e som',                   'Festa e alimentação', 60),
  -- Aulas e serviços
  ('Professor particular',       'Aulas e serviços', 10),
  ('Motorista',                  'Aulas e serviços', 20),
  ('Frete e mudança',            'Aulas e serviços', 30),
  ('Contador',                   'Aulas e serviços', 40),
  ('Advogado',                   'Aulas e serviços', 50)
on conflict (nome) do nothing;

-- --- A ponte: o que a pessoa diz -> quem faz --------------------------
--
-- Escrito sem acento de propósito: é como o termo é comparado. Quem digita
-- rápido no celular escreve "cafe da manha", e recusar isso seria recusar
-- a maioria.

insert into public.necessidades (termo, categoria_id)
select v.termo, c.id
  from (values
    -- Casa: água e luz
    ('chuveiro nao esquenta',   'Eletricista'),
    ('chuveiro queimou',        'Eletricista'),
    ('tomada nao funciona',     'Eletricista'),
    ('curto circuito',          'Eletricista'),
    ('disjuntor',               'Eletricista'),
    ('falta luz em casa',       'Eletricista'),
    ('cheiro de queimado',      'Eletricista'),
    ('instalar ventilador',     'Eletricista'),
    ('instalar lustre',         'Eletricista'),
    ('fiacao',                  'Eletricista'),
    -- "chuveiro" sozinho leva aos DOIS ofícios, e é o exemplo que explica
    -- por que a tabela existe: chuveiro que não esquenta é eletricista,
    -- chuveiro que vaza é encanador. Quem digita só "chuveiro" ainda não
    -- disse qual dos dois é o seu, e merece ver os dois. Quem digita
    -- "chuveiro vazando" já disse, e aí a expressão mais longa manda.
    ('chuveiro',                'Eletricista'),
    ('chuveiro',                'Encanador'),
    ('chuveiro vazando',        'Encanador'),
    ('cano estourado',          'Encanador'),
    ('vazamento',               'Encanador'),
    ('torneira pingando',       'Encanador'),
    ('vaso entupido',           'Encanador'),
    ('pia entupida',            'Encanador'),
    ('ralo entupido',           'Encanador'),
    ('desentupir',              'Encanador'),
    ('caixa d agua',            'Encanador'),
    -- Casa: obra
    ('levantar parede',         'Pedreiro'),
    ('assentar piso',           'Pedreiro'),
    ('colocar piso',            'Pedreiro'),
    ('reforma',                 'Pedreiro'),
    ('telhado',                 'Pedreiro'),
    ('goteira',                 'Pedreiro'),
    ('infiltracao',             'Pedreiro'),
    ('pintar a casa',           'Pintor'),
    ('pintar parede',           'Pintor'),
    ('pintura',                 'Pintor'),
    ('forro de gesso',          'Gesseiro'),
    ('gesso',                   'Gesseiro'),
    ('portao',                  'Serralheiro'),
    ('grade',                   'Serralheiro'),
    ('solda',                   'Serralheiro'),
    ('vidro quebrado',          'Vidraceiro'),
    ('box do banheiro',         'Vidraceiro'),
    ('armario planejado',       'Marceneiro'),
    ('movel sob medida',        'Marceneiro'),
    ('montar movel',            'Montador de móveis'),
    ('montar guarda roupa',     'Montador de móveis'),
    ('perdi a chave',           'Chaveiro'),
    ('chave trancada',          'Chaveiro'),
    ('fechadura',               'Chaveiro'),
    ('furar parede',            'Marido de aluguel'),
    ('instalar suporte de tv',  'Marido de aluguel'),
    ('pequenos reparos',        'Marido de aluguel'),
    ('cortar grama',            'Jardineiro'),
    ('podar',                   'Jardineiro'),
    ('jardim',                  'Jardineiro'),
    ('barata',                  'Dedetizador'),
    ('cupim',                   'Dedetizador'),
    ('rato',                    'Dedetizador'),
    ('dedetizar',               'Dedetizador'),
    ('limpar a casa',           'Diarista'),
    ('faxina',                  'Diarista'),
    ('limpeza',                 'Diarista'),
    -- Conserto
    ('geladeira nao gela',      'Refrigeração e ar-condicionado'),
    ('ar condicionado',         'Refrigeração e ar-condicionado'),
    ('limpeza de ar condicionado','Refrigeração e ar-condicionado'),
    ('maquina de lavar',        'Conserto de eletrodomésticos'),
    ('fogao nao acende',        'Conserto de eletrodomésticos'),
    ('microondas',              'Conserto de eletrodomésticos'),
    ('computador lento',        'Técnico em informática'),
    ('formatar computador',     'Técnico em informática'),
    ('notebook nao liga',       'Técnico em informática'),
    ('wifi',                    'Técnico em informática'),
    ('tela quebrada',           'Técnico em celulares'),
    ('trocar tela do celular',  'Técnico em celulares'),
    ('celular nao carrega',     'Técnico em celulares'),
    ('carro nao liga',          'Mecânico'),
    ('barulho no motor',        'Mecânico'),
    ('revisao do carro',        'Mecânico'),
    ('troca de oleo',           'Mecânico'),
    ('pneu furado',             'Borracheiro'),
    ('trocar pneu',             'Borracheiro'),
    ('lavar o carro',           'Lavagem de carros'),
    ('ajustar roupa',           'Costureira'),
    ('bainha',                  'Costureira'),
    ('costurar',                'Costureira'),
    -- Beleza
    ('cortar cabelo',           'Cabeleireiro'),
    ('pintar o cabelo',         'Cabeleireiro'),
    ('escova',                  'Cabeleireiro'),
    ('fazer as unhas',          'Manicure e pedicure'),
    ('unha',                    'Manicure e pedicure'),
    ('barba',                   'Barbeiro'),
    ('massagem',                'Massagista'),
    ('dor nas costas',          'Fisioterapeuta'),
    ('emagrecer',               'Nutricionista'),
    ('dieta',                   'Nutricionista'),
    -- Festa
    ('bolo de aniversario',     'Confeiteira'),
    ('bolo',                    'Confeiteira'),
    ('doces para festa',        'Confeiteira'),
    ('brigadeiro',              'Confeiteira'),
    ('cesta de cafe da manha',  'Confeiteira'),
    ('salgados para festa',     'Salgadeira'),
    ('coxinha',                 'Salgadeira'),
    ('salgados',                'Salgadeira'),
    ('marmita',                 'Cozinheira'),
    ('comida caseira',          'Cozinheira'),
    ('festa de aniversario',    'Buffet e festas'),
    ('casamento',               'Buffet e festas'),
    ('fotos',                   'Fotógrafo'),
    ('ensaio fotografico',      'Fotógrafo'),
    ('som para festa',          'DJ e som'),
    -- Aulas e serviços
    ('aula particular',         'Professor particular'),
    ('reforco escolar',         'Professor particular'),
    ('mudanca',                 'Frete e mudança'),
    ('frete',                   'Frete e mudança'),
    ('carreto',                 'Frete e mudança'),
    ('imposto de renda',        'Contador'),
    ('abrir empresa',           'Contador')
  ) as v(termo, categoria)
  join public.categorias c on c.nome = v.categoria
on conflict (termo, categoria_id) do nothing;

-- =====================================================================
-- Conferência
-- =====================================================================

select case
  when (select count(*) from public.categorias) >= 40
   and (select count(*) from public.necessidades) >= 100
   and (select count(*) from pg_proc
         where proname in ('buscar_profissionais','normalizar')
           and pronamespace = 'public'::regnamespace) = 2
  then 'PRONTO — catálogo, necessidades e a busca estão no ar. '
       || (select count(*)::text from public.categorias) || ' ofícios, '
       || (select count(*)::text from public.necessidades) || ' expressões do dia a dia.'
  else 'AINDA FALTA — o catálogo ou a busca não ficaram completos. Rode esta parte inteira de novo, sem selecionar trecho.'
end as resultado;
