-- ═══════════════════════════════════════════════════════════════════════
-- 0106 — Quem viu você, por quanto tempo é o salário, e os favoritos
-- ═══════════════════════════════════════════════════════════════════════
--
-- Três pedidos da dona, e os três precisam de banco:
--
--   "criar opção do candidato ver que a empresa visualizou seu perfil"
--   "na opção de salário colocar opção da de mensal / hora / diária"
--   "ter opção de favoritar empresas e candidatos e ter onde ver os
--    favoritos"

-- ═══════════════════════════════════════════════════════════════════════
-- Parte 1 de 3 — QUEM VIU O SEU PERFIL
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── A TABELA JÁ EXISTE, E ISSO QUASE PASSOU DESPERCEBIDO ──────────────
--
-- `profile_views` nasceu na 0016, para o analytics do Empresa Plus do
-- procurô: uma contagem anônima de "alguém abriu esta página", com
-- `professional_id` e `viewed_at`, e insert liberado até para quem não
-- entrou. A 0028 acrescentou `viewer_id`.
--
-- A primeira versão desta migration criava uma tabela nova com o mesmo
-- nome. Um `create table if not exists` não teria feito NADA — sem erro
-- nenhum —, e as duas gravações seguintes falhariam com "column
-- company_id does not exist". No banco de verdade isso apareceria como
-- "a tela de quem viu meu perfil está sempre vazia", meses depois.
--
-- Então aqui a tabela é ESTENDIDA, não recriada.
--
-- ── POR QUE `company_id`, E NÃO SÓ O `viewer_id` QUE JÁ EXISTE ────────
--
-- `viewer_id` é a CONTA que abriu. Desde a 0102 uma conta pode ter várias
-- empresas, e o que a dona pediu é "a EMPRESA visualizou seu perfil" — o
-- nome que vai aparecer na tela. Resolver a empresa a partir da conta
-- daria a resposta errada para quem tem duas lojas, e nenhuma resposta
-- para quem viu antes de ter empresa.
--
-- As linhas antigas ficam com `company_id` nulo, e é o certo: elas são
-- visitas anônimas do outro produto, não "uma empresa te viu".

alter table public.profile_views
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists vezes integer not null default 1;

-- Único por PAR, e só quando há empresa.
-- ───────────────────────────────────────
-- Guardar toda abertura de tela transformaria a lista em "Padaria Pão de
-- Minas" repetido quarenta vezes — a mesma pessoa conferindo o cadastro
-- antes de ligar. O que a informação quer dizer é "esta empresa te
-- achou", e isso acontece uma vez; `vezes` conta as demais, porque três
-- visitas em dois dias é uma empresa decidindo.
--
-- O `where company_id is not null` é obrigatório: sem ele, as visitas
-- anônimas da 0016 (todas com nulo) colidiriam entre si.
create unique index if not exists profile_views_par_empresa
  on public.profile_views(professional_id, company_id)
  where company_id is not null;

-- A tela do candidato lê "as últimas empresas que me viram", nesta ordem.
create index if not exists profile_views_do_candidato
  on public.profile_views(professional_id, viewed_at desc)
  where company_id is not null;

-- A leitura já é do dono do cadastro desde a 0016 ("dono vê as
-- visualizações do próprio anúncio"), e é exatamente o que esta tela
-- precisa. Nenhuma policy nova: uma segunda policy de SELECT dizendo o
-- mesmo só faria alguém, um dia, mudar uma e esquecer a outra.

/*
 * Registrar a visita.
 *
 * É uma FUNÇÃO, e não um insert direto do app, por três razões:
 *
 * 1. A policy de INSERT da 0016 é liberada — foi feita para uma contagem
 *    anônima. Deixar o app gravar `company_id` por ali seria deixar
 *    qualquer conta inventar visitas em nome de qualquer empresa.
 * 2. O `on conflict` que soma `vezes` precisa rodar como uma coisa só; do
 *    lado do app seriam duas viagens e uma corrida.
 * 3. A conferência de que a empresa é MESMO de quem está chamando não
 *    pode morar no navegador — é justamente ali que alguém mexeria.
 *
 * Ela não devolve nada e sai calada quando a empresa não é da pessoa: um
 * erro aqui derrubaria a tela do cadastro que a empresa está tentando
 * ver, e o registro da visita é o menos importante do que está
 * acontecendo ali.
 */
create or replace function public.registrar_visita_perfil(
  p_professional_id uuid,
  p_company_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- A empresa tem que ser de quem está chamando. Sem isto, a função
  -- viraria exatamente o buraco que ela existe para fechar.
  if not exists (
    select 1 from public.companies c
     where c.id = p_company_id and c.owner_id = auth.uid()
  ) then
    return;
  end if;

  insert into public.profile_views (professional_id, company_id, viewer_id)
  values (p_professional_id, p_company_id, auth.uid())
  on conflict (professional_id, company_id) where company_id is not null
  do update set viewed_at = now(), vezes = public.profile_views.vezes + 1;
end;
$$;

grant execute on function public.registrar_visita_perfil(uuid, uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- Parte 2 de 3 — POR QUANTO TEMPO É O SALÁRIO
-- ═══════════════════════════════════════════════════════════════════════
--
-- "R$ 180" numa vaga de pedreiro é diária; numa de balconista seria um
-- absurdo. Hoje o app escreve o número sem dizer por quanto tempo, e quem
-- lê tem de adivinhar pelo ofício — o que só funciona para quem já
-- conhece o ofício.
--
-- O padrão é `mes` porque é o caso da maioria das vagas com carteira, e
-- porque uma coluna sem padrão deixaria as vagas ANTIGAS sem período
-- nenhum — e aí a tela teria de escolher um por elas de qualquer jeito.
--
-- O mesmo vale para a pretensão de quem procura: comparar "R$ 2.000 por
-- mês" com "R$ 200 por dia" sem os períodos é comparar dois números que
-- não são a mesma coisa.

alter table public.job_listings
  add column if not exists salario_periodo text not null default 'mes';

alter table public.job_listings drop constraint if exists job_listings_salario_periodo_check;
alter table public.job_listings add constraint job_listings_salario_periodo_check
  check (salario_periodo in ('mes', 'hora', 'dia'));

alter table public.professionals
  add column if not exists pretensao_periodo text not null default 'mes';

alter table public.professionals drop constraint if exists professionals_pretensao_periodo_check;
alter table public.professionals add constraint professionals_pretensao_periodo_check
  check (pretensao_periodo in ('mes', 'hora', 'dia'));

-- A view pública lista coluna por coluna, então precisa ser recriada para
-- enxergar a nova. A lista abaixo é a da 0103 MAIS `pretensao_periodo` —
-- e o `where` da última linha vai junto, porque VIEW IGNORA RLS: foi
-- assim que a 0049 deixou cadastro suspenso voltar para a busca.
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
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- Parte 3 de 3 — FAVORITOS
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── UMA TABELA, DUAS COLUNAS, E UM `check` QUE OBRIGA A ESCOLHER ──────
--
-- O favorito aponta ou para uma EMPRESA ou para um CANDIDATO. Havia três
-- desenhos possíveis:
--
--   duas tabelas          duas policies, duas telas, e um dia uma fica
--                         para trás — é o mesmo argumento que juntou
--                         formação e curso na 0104;
--   `tipo` + `alvo_id`    sem chave estrangeira: o alvo apagado deixa
--                         favorito órfão apontando para o nada, e a tela
--                         mostra um cartão em branco;
--   duas colunas nulas    com `on delete cascade` nas duas e um `check`
--                         de que exatamente uma está preenchida.
--
-- A terceira ganha porque o banco passa a garantir as duas coisas que
-- importam: o alvo existe, e é um só.
--
-- O favorito é por CONTA (`user_id`), e não por empresa: quem tem duas
-- lojas não quer favoritar a mesma pessoa duas vezes.

create table if not exists public.favoritos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  professional_id uuid references public.professionals(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.favoritos drop constraint if exists favoritos_um_alvo_so;
alter table public.favoritos add constraint favoritos_um_alvo_so
  check (
    (company_id is not null and professional_id is null)
    or (company_id is null and professional_id is not null)
  );

-- Favoritar duas vezes é sempre um toque repetido, e na tela viraria o
-- mesmo cartão duas vezes na lista.
create unique index if not exists favoritos_empresa_uma_vez
  on public.favoritos(user_id, company_id) where company_id is not null;
create unique index if not exists favoritos_pessoa_uma_vez
  on public.favoritos(user_id, professional_id) where professional_id is not null;

create index if not exists favoritos_da_conta
  on public.favoritos(user_id, created_at desc);

alter table public.favoritos enable row level security;

-- Cada conta enxerga e mexe só nos próprios favoritos. Não há leitura
-- pública: saber quem te favoritou seria informação sobre outra pessoa, e
-- ninguém pediu isso.
drop policy if exists "Vejo meus favoritos" on public.favoritos;
create policy "Vejo meus favoritos" on public.favoritos
  for select using (auth.uid() = user_id);

drop policy if exists "Guardo meus favoritos" on public.favoritos;
create policy "Guardo meus favoritos" on public.favoritos
  for insert with check (auth.uid() = user_id);

drop policy if exists "Tiro meus favoritos" on public.favoritos;
create policy "Tiro meus favoritos" on public.favoritos
  for delete using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════
-- A CONFERÊNCIA. É a resposta desta janela que vale.
-- ═══════════════════════════════════════════════════════════════════════
-- Lê o pg_catalog, nunca o information_schema.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.profile_views'::regclass
           and attname in ('company_id', 'vezes') and not attisdropped) = 2
   and (select count(*) from pg_class
         where relnamespace = 'public'::regnamespace
           and relname = 'favoritos' and relkind = 'r') = 1
   and (select count(*) from pg_proc
         where pronamespace = 'public'::regnamespace
           and proname = 'registrar_visita_perfil') = 1
   and (select count(*) from pg_attribute
         where attrelid = 'public.job_listings'::regclass
           and attname = 'salario_periodo' and not attisdropped) = 1
   and (select count(*) from pg_attribute
         where attrelid = 'public.professionals_public'::regclass
           and attname = 'pretensao_periodo' and not attisdropped) = 1
   and (select count(*) from pg_policy
         where polrelid = 'public.favoritos'::regclass) = 3
  then 'PRONTO — quem viu voce, o periodo do salario e os favoritos'
  else 'AINDA FALTA — me mande o que apareceu'
  end as resultado;
