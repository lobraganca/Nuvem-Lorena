-- ═══════════════════════════════════════════════════════════════════════
-- 0105 — A vaga passa a caber inteira, e a empresa escolhe o que pesa
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona listou a vaga em seis blocos (sobre, horário e local, salário e
-- benefícios, formação e experiência, requisitos adicionais, informações
-- complementares) e fechou com:
--
--   "Depois de cadastrar, ter opção de marcar os campos que terão a
--    compatibilidade."
--
-- ── O QUE JÁ EXISTIA ──────────────────────────────────────────────────
--
-- Boa parte: `title`, `profession`, `specialty`, `description`, `city`,
-- `uf`, `neighborhood`, `work_modality`, `required_experience`, `skills`,
-- `salary_range_min/max`, `salario_a_combinar`, `tipo_contrato`,
-- `jornada` e `beneficios` (0067 e 0080). Nada disso é recriado aqui.
--
-- ── O QUE FALTAVA, E POR QUE CADA UM ──────────────────────────────────
--
-- `quantidade_vagas` — "2 vagas" muda quem responde: numa vaga só, quem se
--   acha segundo colocado nem tenta.
--
-- `data_inicio` / `prazo_candidatura` — as duas datas que a pessoa pergunta
--   no telefonema. E o prazo tem um segundo uso: vaga sem prazo fica no ar
--   para sempre e o banco de vagas vira cemitério.
--
-- `horario` e `escala` — texto livre, de propósito. `jornada` (0080) já
--   classifica em integral/meio período/turnos; aqui é o "8h às 18h, de
--   segunda a sexta" e o "12x36" que ninguém consegue escolher numa lista.
--   Uma lista fechada faria a empresa marcar a opção mais parecida e o
--   candidato descobrir a verdade depois.
--
-- `aceita_outras_cidades` — default `true`, e este default é uma decisão:
--   Itabirito faz par com Ouro Preto, Moeda e Rio Acima todo dia. Fechar
--   por omissão cortaria metade de quem serviria, sem ninguém ter marcado
--   nada.
--
-- `comissao` — texto: "5% sobre a venda" e "R$ 50 por entrega" não cabem
--   no mesmo número, e é assim que se fala de comissão aqui.
--
-- `outros_beneficios` — o "Outros" que a dona pediu ao lado de VT, VA,
--   plano de saúde e odontológico. Os quatro primeiros são marcações e
--   moram no `beneficios text[]` que já existe; este é a linha escrita.
--
-- `escolaridade_minima` / `curso_especifico` — a formação exigida, no
--   mesmo vocabulário que a 0104 deu ao candidato: sem os dois lados
--   falando a mesma língua, comparar formação é impossível.
--
-- `cnh_exigida` / `cnh_categorias` / `exige_viagem` / `idiomas` — o bloco
--   de requisitos adicionais, espelhando as colunas que o candidato ganhou
--   na 0103. Espelhar não é enfeite: é o que permite a comparação sair de
--   uma conta e não de leitura humana.
--
-- `observacoes` — as informações complementares, campo aberto.
--
-- ── A COMPATIBILIDADE, E POR QUE ELA É UMA LISTA ───────────────────────
--
-- `campos_compatibilidade` guarda os NOMES dos campos que a empresa marcou
-- como o que importa nesta vaga. Não é um peso por campo, e não é por
-- acaso: pedir "quanto pesa cada um, de 0 a 10" é um formulário que
-- ninguém termina, e a resposta seria inventada de qualquer jeito.
-- Marcado/não marcado é uma pergunta que se responde em dois toques.
--
-- Vazio tem significado próprio: NENHUM campo marcado = a empresa não quis
-- escolher, e aí vale a comparação padrão (função e cidade). É diferente
-- de uma lista com um item só.
--
-- E `aceita_sem_compatibilidade` responde à pergunta que a dona deixou em
-- aberto ("verificar se poderão se candidatar sem ter compatibilidade /
-- perguntar isso pra empresa ao cadastrar a vaga?"): pergunta-se à
-- empresa, e o padrão é SIM. Barrar por conta própria é o erro mais caro
-- possível aqui — a conta de compatibilidade é um palpite sobre o que está
-- escrito, e quem seria contratado costuma ser exatamente quem não se
-- descreveu direito. Quando a empresa marcar que não aceita, a tela avisa
-- antes, em vez de deixar a pessoa responder e nunca receber retorno.

-- ── Parte 1 de 2: as colunas da vaga ───────────────────────────────────

alter table public.job_listings
  add column if not exists quantidade_vagas integer not null default 1,
  add column if not exists data_inicio date,
  add column if not exists prazo_candidatura date,
  add column if not exists horario text,
  add column if not exists escala text,
  add column if not exists aceita_outras_cidades boolean not null default true,
  add column if not exists comissao text,
  add column if not exists outros_beneficios text,
  add column if not exists escolaridade_minima text,
  add column if not exists curso_especifico text,
  add column if not exists cnh_exigida boolean not null default false,
  add column if not exists cnh_categorias text[] not null default '{}',
  add column if not exists exige_viagem boolean not null default false,
  add column if not exists idiomas text[] not null default '{}',
  add column if not exists observacoes text;

alter table public.job_listings drop constraint if exists job_listings_quantidade_check;
alter table public.job_listings add constraint job_listings_quantidade_check
  check (quantidade_vagas >= 1 and quantidade_vagas <= 999);

-- Prazo antes da data de início é erro de digitação, e é silencioso: a
-- vaga some do banco de vagas antes de a empresa entender por quê.
alter table public.job_listings drop constraint if exists job_listings_datas_check;
alter table public.job_listings add constraint job_listings_datas_check
  check (prazo_candidatura is null or data_inicio is null
         or prazo_candidatura <= data_inicio);

-- O mesmo vocabulário da 0104, para os dois lados poderem ser comparados.
alter table public.job_listings drop constraint if exists job_listings_escolaridade_check;
alter table public.job_listings add constraint job_listings_escolaridade_check
  check (escolaridade_minima is null or escolaridade_minima in (
    'fundamental', 'medio', 'tecnico', 'superior', 'pos', 'mestrado', 'doutorado'
  ));

alter table public.job_listings drop constraint if exists job_listings_cnh_categorias_check;
alter table public.job_listings add constraint job_listings_cnh_categorias_check
  check (cnh_categorias <@ array['A','B','C','D','E','AB','AC','AD','AE']::text[]);

-- ── Parte 2 de 2: o que conta na compatibilidade ───────────────────────

alter table public.job_listings
  add column if not exists campos_compatibilidade text[] not null default '{}',
  add column if not exists aceita_sem_compatibilidade boolean not null default true;

-- A lista fechada de campos que PODEM ser marcados. Escrita aqui e não só
-- na tela porque um nome de campo com erro de digitação nunca casa com
-- nada — e o defeito seria "a compatibilidade não considera a CNH", que
-- ninguém consegue enxergar olhando a tela.
alter table public.job_listings drop constraint if exists job_listings_campos_compatibilidade_check;
alter table public.job_listings add constraint job_listings_campos_compatibilidade_check
  check (campos_compatibilidade <@ array[
    'profissao', 'especialidade', 'cidade', 'modo_trabalho', 'jornada',
    'escolaridade', 'curso', 'experiencia', 'competencias',
    'cnh', 'viagem', 'idiomas', 'disponibilidade', 'pretensao',
    'inicio_imediato', 'fim_de_semana'
  ]::text[]);

comment on column public.job_listings.campos_compatibilidade is
  'Os campos que a empresa marcou como o que importa NESTA vaga. Lista
   vazia = nao escolheu, e vale a comparacao padrao (funcao e cidade) —
   que e diferente de uma lista com um item so.';

comment on column public.job_listings.aceita_sem_compatibilidade is
  'A empresa aceita candidatura de quem nao bate com os campos marcados.
   Padrao SIM: a compatibilidade e um palpite sobre texto, e barrar por
   conta propria descarta justamente quem nao se descreveu direito.';

-- O banco de vagas ordena por prazo e filtra por status. Sem o índice, a
-- tela lê a tabela inteira a cada abertura — barato hoje, com dez vagas, e
-- caro exatamente no dia em que o app der certo.
create index if not exists idx_job_listings_prazo
  on public.job_listings(status, prazo_candidatura);

-- ═══════════════════════════════════════════════════════════════════════
-- A CONFERÊNCIA. É a resposta desta janela que vale.
-- ═══════════════════════════════════════════════════════════════════════
-- Lê o pg_catalog, nunca o information_schema.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.job_listings'::regclass
           and attname in ('quantidade_vagas', 'data_inicio', 'prazo_candidatura',
                           'horario', 'escala', 'aceita_outras_cidades', 'comissao',
                           'outros_beneficios', 'escolaridade_minima',
                           'curso_especifico', 'cnh_exigida', 'cnh_categorias',
                           'exige_viagem', 'idiomas', 'observacoes',
                           'campos_compatibilidade', 'aceita_sem_compatibilidade')
           and not attisdropped) = 17
   and (select count(*) from pg_constraint
         where conrelid = 'public.job_listings'::regclass
           and conname in ('job_listings_quantidade_check',
                           'job_listings_datas_check',
                           'job_listings_escolaridade_check',
                           'job_listings_cnh_categorias_check',
                           'job_listings_campos_compatibilidade_check')) = 5
  then 'PRONTO — a vaga cabe inteira, e a empresa ja escolhe o que pesa na compatibilidade'
  else 'AINDA FALTA — me mande o que apareceu'
  end as resultado;
