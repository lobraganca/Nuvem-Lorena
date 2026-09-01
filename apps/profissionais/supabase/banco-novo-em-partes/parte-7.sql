-- Ei Itabirito — banco NOVO, PARTE 7 de 7
-- Projeto: ahigenhenzmsjxlmrzhz (o do Ei Itabirito)
-- Cole tudo, clique uma vez fora do texto (para não ficar nada selecionado) e toque em Run.
-- Migrations desta parte: 0075 a 0080

-- ───── 0075_disponivel_e_cursos.sql ─────
-- ═══════════════════════════════════════════════════════════════════════
-- 0075 — "Estou disponível" e os cursos do profissional
-- ═══════════════════════════════════════════════════════════════════════
--
-- Duas coisas que a dona pediu por escrito e que não existiam no banco:
--
--   "ter um campo bem visível pra ele colocar se está disponível ou não"
--   "ter parte de incluir cursos e especializações"
--
-- A tela do perfil já mostrava as duas — mas era maquete: nada era lido
-- nem gravado, porque não havia onde. Quem marcasse "disponível" e
-- recarregasse a página perdia tudo.
--
-- ── Disponível e oculto são coisas DIFERENTES ─────────────────────────
--
-- `paused` (que já existe) tira o cadastro da busca pública. É o "ficar
-- oculto": quem está empregado e não quer ser encontrado pelo patrão some
-- da lista e continua recebendo vaga pelas ondas.
--
-- `disponivel` é outra pergunta: "estou aceitando trabalho agora?". Quem
-- está visível mas ocupado continua aparecendo — e a empresa precisa saber
-- disso ANTES de ligar, senão gasta o telefonema e a paciência dos dois.
--
-- Por isso são duas colunas, e não uma. Juntá-las obrigaria quem está
-- ocupado a sumir do app, e quem sumiu do app não volta.

alter table public.professionals
  add column if not exists disponivel boolean not null default true;

comment on column public.professionals.disponivel is
  'Aceitando trabalho agora. Diferente de `paused`, que tira da busca.';

-- ── Cursos e especializações ───────────────────────────────────────────
-- Tabela própria, e não um `text[]`: um curso tem nome, instituição e ano,
-- e um array de texto perderia os dois últimos. NR-35 feito em 2019 no
-- SENAI vale mais que "NR-35" solto — é o que a empresa usa para decidir.
create table if not exists public.professional_courses (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null
    references public.professionals(id) on delete cascade,
  nome text not null,
  instituicao text,
  ano text,
  -- A ordem que a pessoa escolheu. Sem ela a lista embaralha a cada leitura
  -- e a pessoa acha que o app perdeu o que ela escreveu.
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists professional_courses_dono
  on public.professional_courses(professional_id, ordem);

alter table public.professional_courses enable row level security;

-- Leitura pública: o curso é parte do cadastro que a empresa consulta.
drop policy if exists "Qualquer um lê curso" on public.professional_courses;
create policy "Qualquer um lê curso" on public.professional_courses
  for select using (true);

-- Escrita só do dono do cadastro. O `exists` confere a posse pela tabela
-- de profissionais, e não por um `owner_id` repetido aqui: repetido, ele
-- sairia do lugar no dia em que um cadastro trocasse de dono.
drop policy if exists "Dono escreve seu curso" on public.professional_courses;
create policy "Dono escreve seu curso" on public.professional_courses
  for insert with check (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

drop policy if exists "Dono atualiza seu curso" on public.professional_courses;
create policy "Dono atualiza seu curso" on public.professional_courses
  for update using (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

drop policy if exists "Dono apaga seu curso" on public.professional_courses;
create policy "Dono apaga seu curso" on public.professional_courses
  for delete using (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

-- ── A view pública ganha `disponivel` ──────────────────────────────────
-- Recriada por inteiro, com o `where` escrito de novo. A 0049 já tirou
-- esse `where` sem querer numa recriação assim, e cadastros suspensos
-- voltaram a aparecer na busca — view roda com os direitos de quem a
-- criou e não vê RLS nenhuma.
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
  areas_de_interesse, disponivel,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema: aquele filtra por
-- privilégio do papel corrente e já respondeu "não existe" cinco vezes
-- para uma coluna que estava lá o tempo todo.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.professionals'::regclass
           and attname = 'disponivel' and not attisdropped) = 1
   and (select count(*) from pg_attribute
         where attrelid = 'public.professionals_public'::regclass
           and attname = 'disponivel' and not attisdropped) = 1
   and (select count(*) from pg_class
         where relname = 'professional_courses' and relkind = 'r') = 1
   and (select count(*) from pg_policies
         where tablename = 'professional_courses') = 4
   and (select pg_get_viewdef('public.professionals_public'::regclass)) like '%paused%'
  then 'PRONTO — disponivel, cursos, e a view com o filtro no lugar'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;


-- ───── 0076_telefone_confirmado_e_obrigatorio.sql ─────
-- ═══════════════════════════════════════════════════════════════════════
-- 0076 — Sem telefone confirmado, o cadastro não vai para o ar
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "A confirmação do telefone é item obrigatório no cadastro."
--
-- Já era exigido para ENTRAR NA ONDA (a consulta filtra por
-- `whatsapp_verified`) e para a EMPRESA publicar vaga (0071). Faltava o
-- terceiro lugar, que é o que mais importa: a lista pública. Sem isto, um
-- cadastro com número inventado aparecia na busca, a empresa ligava e caía
-- em número errado — ou em ninguém.
--
-- ── Por que na VIEW, e não numa policy de escrita ─────────────────────
--
-- Barrar a gravação obrigaria a pessoa a confirmar antes de escrever
-- qualquer coisa, e ela ainda nem sabe o que o app faz. Pior: o
-- `confirmar_whatsapp` PRECISA de uma linha existente para conferir se o
-- número do cadastro bate com o número do Auth — barrar a escrita cria um
-- nó em que não dá para confirmar porque não dá para salvar, e não dá para
-- salvar porque não confirmou.
--
-- Na view, a regra é a que a dona quis, sem o nó: dá para preencher e
-- guardar; o cadastro só EXISTE para os outros depois de confirmado. É a
-- mesma forma que `suspended` e `paused` já usam.
--
-- ── Isto ESCONDE cadastros que hoje aparecem ──────────────────────────
--
-- Todo cadastro com `whatsapp_verified = false` some da busca no instante
-- em que esta migration roda. No Ei Itabirito isso é zero — nenhum
-- cadastro foi criado ainda. Dito assim, por escrito, porque uma view que
-- some com linhas é o tipo de mudança que ninguém lembra de ter feito
-- quando alguém reclama que "sumiu da busca".

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
  areas_de_interesse, disponivel,
  mostrar_endereco, created_at
from public.professionals
-- As três condições, escritas juntas de propósito: a 0049 já perdeu o
-- `where` inteiro numa recriação de view como esta, e cadastros suspensos
-- voltaram a aparecer. View roda com os direitos de quem a criou e não
-- enxerga RLS nenhuma — aqui não há segunda linha de defesa.
where suspended = false
  and paused = false
  and whatsapp_verified = true;

grant select on public.professionals_public to anon, authenticated;

-- ── O aviso de vaga também exige ───────────────────────────────────────
-- A consulta da onda já filtra por `whatsapp_verified` no app. Aqui a
-- regra fica no banco, que é onde ela não depende de ninguém lembrar: um
-- aviso só pode ser gravado para quem confirmou.
create or replace function public.job_notifications_exige_confirmacao()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- `professional_id` aponta para a CONTA (`auth.users`), e não para a
  -- linha de `professionals` — a chave estrangeira da tabela diz isso.
  -- Comparar com `professionals.id` não casaria com ninguém, e a regra
  -- recusaria todo mundo, inclusive quem confirmou. O teste 15 pegou isto
  -- na primeira execução; lendo o código, passava.
  if not exists (
    select 1 from public.professionals
     where owner_id = new.professional_id
       and whatsapp_verified = true
  ) then
    raise exception
      'Só quem confirmou o telefone recebe aviso de vaga.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists job_notifications_exige_confirmacao on public.job_notifications;
create trigger job_notifications_exige_confirmacao
  before insert on public.job_notifications
  for each row execute function public.job_notifications_exige_confirmacao();

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema. E confere o TEXTO da view,
-- porque é justamente o `where` que já se perdeu uma vez sem ninguém ver.
select case
  when (select pg_get_viewdef('public.professionals_public'::regclass))
         like '%whatsapp_verified = true%'
   and (select pg_get_viewdef('public.professionals_public'::regclass)) like '%paused%'
   and (select pg_get_viewdef('public.professionals_public'::regclass)) like '%suspended%'
   and (select count(*) from pg_trigger
         where tgrelid = 'public.job_notifications'::regclass
           and tgname = 'job_notifications_exige_confirmacao') = 1
  then 'PRONTO — sem telefone confirmado o cadastro não aparece nem recebe vaga'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;


-- ───── 0077_oculto_continua_recebendo_onda.sql ─────
-- ═══════════════════════════════════════════════════════════════════════
-- 0077 — Quem está oculto CONTINUA recebendo vaga pelas ondas
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "a pessoa que cadastra deve ter opção de ter o perfil público ou
--          oculto. Público ele pode ser buscado pelas empresas, oculto ele
--          recebe oportunidades pelas ondas de disparos."
--
-- ── O QUE ESTAVA ACONTECENDO ──────────────────────────────────────────
--
-- A chave existe na tela ("Não aparecer na lista") e grava direito na
-- coluna `paused`. O que não funcionava era a segunda metade da regra: quem
-- se escondia parava de receber TUDO.
--
-- A consulta da onda lê `professionals_public`, e essa view filtra
-- `paused = false`. Então esconder-se da busca escondia a pessoa também das
-- ondas — o oposto do que a chave promete.
--
-- E a tela promete por escrito, com estas palavras:
--
--   "Quem está empregado e não quer ser encontrado pelo patrão pode se
--    esconder da lista e CONTINUAR RECEBENDO VAGA."
--
-- É o pior tipo de defeito deste projeto: silencioso e do lado de quem tem
-- menos como perceber. A pessoa se esconde para o patrão não ver, acha que
-- continua na fila das oportunidades, e some do app sem nunca receber uma.
-- Ninguém reclama de vaga que não chegou — não dá para sentir falta do que
-- você não sabe que existiu.
--
-- ── POR QUE UMA FUNÇÃO, E NÃO OUTRA VIEW ──────────────────────────────
--
-- A saída óbvia — uma view que inclua os pausados — é justamente a errada:
-- view precisa de `grant`, e quem recebesse o `grant` poderia LISTAR quem
-- está escondido. Seria desfazer o esconderijo para consertar o esconderijo.
--
-- Aqui a função devolve `id` e `owner_id` e MAIS NADA. Sem nome, sem
-- telefone, sem bairro. A empresa recebe códigos que ela já teria de usar
-- para gravar os avisos, e que não abrem em lugar nenhum: a página de perfil
-- lê a view pública, e lá o pausado não está. Contar quantas pessoas a onda
-- alcança nunca precisou saber quem elas são.
--
-- ── AS TRÊS CONDIÇÕES QUE CONTINUAM VALENDO ───────────────────────────
--
--   suspended = false          quem foi suspenso não recebe nada
--   whatsapp_verified = true   sem telefone confirmado não entra em onda
--   paused                     NÃO filtra — é exatamente a mudança
--
-- ── ESTA MIGRATION NÃO MEXE NA BUSCA ──────────────────────────────────
--
-- `professionals_public` fica exatamente como está, com o `paused = false`.
-- Quem se escondeu continua fora da lista que as empresas procuram. As duas
-- metades da regra passam a existir de verdade, cada uma no seu lugar.

create or replace function public.candidatos_da_onda(
  p_cidade text,
  p_uf text,
  p_oficios text[],
  -- Onde procurar o ofício: `categories` é o que a pessoa FAZ,
  -- `areas_de_interesse` é onde ela ACEITARIA trabalhar. A onda alcança
  -- pelas duas, e quem chama pede uma de cada vez, como já fazia.
  p_coluna text,
  -- Só a onda 1 usa, e só quando a vaga pediu especialidade.
  p_especialidade text default null
)
returns table (id uuid, owner_id uuid)
language plpgsql
security definer set search_path = public
as $$
begin
  -- Só empresa cadastrada conta onda. Sem esta porta, qualquer conta
  -- poderia varrer a cidade inteira perguntando "quantos pedreiros existem"
  -- — e, repetindo por ofício, montar um retrato do banco.
  if not exists (select 1 from public.companies c where c.owner_id = auth.uid()) then
    raise exception 'Só empresa cadastrada pode contar a onda.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Nome de coluna não entra por texto em consulta montada: são duas
  -- consultas escritas por extenso, e qualquer outro valor é recusado.
  if p_coluna not in ('categories', 'areas_de_interesse') then
    raise exception 'Coluna inválida: %', p_coluna using errcode = 'invalid_parameter_value';
  end if;

  return query
  select p.id, p.owner_id
    from public.professionals p
   where p.city = p_cidade
     and (p_uf is null or p.uf = p_uf)
     and p.suspended = false
     and p.whatsapp_verified = true
     -- `paused` de fora de propósito. É a migration inteira.
     and (
       (p_coluna = 'categories' and p.categories && p_oficios)
       or (p_coluna = 'areas_de_interesse' and p.areas_de_interesse && p_oficios)
     )
     and (
       p_especialidade is null
       or p_especialidade = ''
       or p.especialidade ilike '%' || p_especialidade || '%'
     );
end;
$$;

revoke all on function public.candidatos_da_onda(text, text, text[], text, text) from public;
grant execute on function public.candidatos_da_onda(text, text, text[], text, text) to authenticated;

-- O índice que faz isto não varrer a tabela quando a cidade crescer.
create index if not exists idx_professionals_onda
  on public.professionals (city, uf)
  where suspended = false and whatsapp_verified = true;

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema. E confere o que importa: que
-- a função existe, que ela roda com os direitos de quem a criou (sem isso
-- ela não enxerga o pausado), e que a view da busca continua escondendo
-- quem se escondeu — as duas metades da regra, cada uma no seu lugar.
select case
  when (select count(*) from pg_proc
         where pronamespace = 'public'::regnamespace
           and proname = 'candidatos_da_onda'
           and prosecdef) = 1
   and (select pg_get_viewdef('public.professionals_public'::regclass)) like '%paused%'
  then 'PRONTO — quem está oculto volta a receber vaga pelas ondas, e continua fora da busca'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;


-- ───── 0078_interesse_ou_nao.sql ─────
-- ═══════════════════════════════════════════════════════════════════════
-- 0078 — A pessoa responde SIM ou NÃO ao aviso de compatibilidade
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "ao disparar uma onda, o aviso de compatibilidade será enviado aos
--          perfis compatíveis. A pessoa escolhe se quer estar disponível ou
--          se não tem interesse. A lista de interessados aparece em um
--          painel para o anunciante."
--
-- ── O QUE FALTAVA ─────────────────────────────────────────────────────
--
-- Só existia o SIM. A tela tinha um botão, "Tenho interesse", e mais nada:
-- quem não queria aquela vaga não tinha o que tocar. E, sem o não, o app
-- não conseguia distinguir três situações completamente diferentes:
--
--   ainda não abriu  ·  abriu e não quis  ·  abriu e ainda está pensando
--
-- As três apareciam iguais. A vaga recusada continuava na lista da pessoa
-- para sempre, com o mesmo botão pedindo resposta — e "Novas" contava como
-- pendente uma decisão que já tinha sido tomada.
--
-- ── POR QUE UMA COLUNA NOVA, E NÃO MAIS UM VALOR EM `status` ──────────
--
-- `status` é a triagem da EMPRESA: new (chegou), read (li), accepted
-- (chamei), rejected (descartei). São os passos de quem contrata.
--
-- Enfiar o "não quero" da pessoa nessa mesma coluna misturaria duas
-- decisões de donos diferentes num campo só, e `rejected` (a empresa
-- descartou) viraria vizinho de `declined` (a pessoa recusou) — duas
-- palavras parecidas para coisas opostas, no mesmo lugar. Quem lesse o
-- painel um ano depois não teria como saber qual foi qual.
--
-- Aqui são dois campos, um para cada lado da mesa. `interessado` é da
-- pessoa; `status` continua sendo da empresa.
--
-- ── `default true` de propósito ───────────────────────────────────────
--
-- Toda linha que já existe foi criada por alguém tocando em "Tenho
-- interesse" — não havia outro caminho. `true` é a verdade histórica delas,
-- não um chute.

alter table public.job_responses
  add column if not exists interessado boolean not null default true;

-- O painel do anunciante filtra por esta coluna, e é a consulta mais quente
-- da tela dele.
create index if not exists idx_job_responses_interessados
  on public.job_responses (job_listing_id)
  where interessado = true;

-- ── A pessoa pode mudar de ideia ───────────────────────────────────────
--
-- Faltava: havia policy de INSERT para a pessoa e de UPDATE só para a
-- empresa. Quem recusasse ficava preso na recusa, sem nenhum caminho de
-- volta — e mudar de ideia sobre uma vaga é a coisa mais normal do mundo
-- ("não quero" na segunda-feira, desempregado na sexta).
--
-- O `with check` é o que impede a pessoa de mexer no que não é dela: sem
-- ele, ela poderia se marcar como `accepted` na triagem da empresa e
-- aparecer no painel como alguém que a empresa já escolheu.
drop policy if exists "Pessoa muda a própria resposta" on public.job_responses;
create policy "Pessoa muda a própria resposta" on public.job_responses
  for update
  using (auth.uid() = professional_id)
  with check (auth.uid() = professional_id);

create or replace function public.job_responses_pessoa_so_mexe_no_interesse()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  /* Quando quem edita é a própria pessoa, só `interessado` pode mudar.
     A triagem (`status`, `company_notes`) é da empresa, e uma policy de
     UPDATE sozinha não sabe distinguir QUAL coluna mudou. */
  if auth.uid() = new.professional_id
     and not exists (
       select 1 from public.job_listings jl
        join public.companies c on c.id = jl.company_id
       where jl.id = new.job_listing_id and c.owner_id = auth.uid()
     )
  then
    if new.status is distinct from old.status
       or new.company_notes is distinct from old.company_notes then
      raise exception 'A triagem da vaga é de quem anunciou.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists job_responses_pessoa_so_mexe_no_interesse on public.job_responses;
create trigger job_responses_pessoa_so_mexe_no_interesse
  before update on public.job_responses
  for each row execute function public.job_responses_pessoa_so_mexe_no_interesse();

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.job_responses'::regclass
           and attname = 'interessado' and not attisdropped) = 1
   and (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'job_responses'
           and policyname = 'Pessoa muda a própria resposta') = 1
   and (select count(*) from pg_trigger
         where tgrelid = 'public.job_responses'::regclass
           and tgname = 'job_responses_pessoa_so_mexe_no_interesse') = 1
  then 'PRONTO — a pessoa pode dizer que tem interesse ou que não tem, e mudar de ideia'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;


-- ───── 0079_pausar_arquivar_excluir_vaga.sql ─────
-- ═══════════════════════════════════════════════════════════════════════
-- 0079 — A empresa pode pausar, arquivar e excluir a própria vaga
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona perguntou: "o app tem como pausar o anúncio, arquivá-lo ou
-- excluir?" A resposta era: pausar não, arquivar pela metade, excluir não.
--
-- ── O QUE FALTAVA ────────────────────────────────────────────────────
--
--   1. O ESTADO "pausada" NÃO EXISTIA NO BANCO. O tipo do app listava os
--      três (`"active" | "paused" | "closed"`) e o gatilho da 0073 já
--      tratava o caso com cuidado — mas a coluna aceitava só dois:
--
--        check (status in ('active', 'closed'))
--
--      Eu quase dei esta migration por escrita dizendo "pausar já funciona,
--      falta só a tela". Funcionava em três lugares e era recusado no
--      quarto. Quem confirmou foi o teste 18, na primeira execução; lendo o
--      código, passava — o tipo do TypeScript afirma o que ele gostaria que
--      o banco tivesse, e o banco não devia nada a ele.
--
--   2. EXCLUIR não era possível: não existe policy de DELETE em
--      `job_listings`, e sem policy o Postgres recusa tudo. Nem a dona da
--      vaga conseguia apagar a própria vaga.
--
--   3. Vaga PAUSADA ou ARQUIVADA ainda aceitava resposta nova. A tela de
--      quem procura já filtra por vaga ativa, mas tela é lembrete, não
--      tranca: uma aba aberta desde ontem, um toque numa página antiga, e a
--      pessoa manda interesse para uma vaga que a empresa já tirou do ar —
--      e fica esperando uma ligação que ninguém vai fazer.
--
-- ── O QUE JÁ ESTAVA CERTO ─────────────────────────────────────────────
--
-- O gatilho da 0073 trata os dois sentidos como deve: tirar do ar passa
-- direto (senão a empresa de plano cheio não conseguiria nem despublicar a
-- vaga que tem) e voltar ao ar passa pelo teto do plano.
--
-- E a policy de leitura da 0067 já deixa a dona ler a vaga em qualquer
-- estado ("status = 'active' OR sou a dona"), então a lista de interessados
-- de uma vaga arquivada nunca esteve perdida — estava inalcançável, porque
-- o painel só pedia as ativas. Isso é conserto de tela, não de banco.

-- ── Parte 0 — o estado que faltava ─────────────────────────────────────
--
-- `paused` não é `closed` com outro nome, e a diferença é de produto: a
-- empresa que recebeu gente demais e quer parar por uns dias não encerrou o
-- processo — encerrar é o que ela faz depois de contratar. Sem os dois
-- estados, a única saída para "chega de currículo por ora" era fechar de
-- vez e recriar tudo depois.
alter table public.job_listings drop constraint if exists job_listings_status_check;
alter table public.job_listings add constraint job_listings_status_check
  check (status in ('active', 'paused', 'closed'));

-- ── Parte 1 — excluir ──────────────────────────────────────────────────
--
-- Só a dona da vaga, e por decisão dela. O `on delete cascade` de
-- `job_responses` e `job_notifications` leva junto as respostas e os avisos
-- daquela vaga — é o certo: a vaga deixou de existir, e guardar "fulano se
-- interessou por uma vaga que não existe" não serve a ninguém.
--
-- Quem avisa do tamanho da coisa é a tela, dizendo quantas pessoas
-- interessadas somem junto. Aqui embaixo não dá para pedir confirmação.
drop policy if exists "Empresa apaga vaga própria" on public.job_listings;
create policy "Empresa apaga vaga própria" on public.job_listings
  for delete using (
    auth.uid() = (select owner_id from public.companies where id = company_id)
  );

-- ── Parte 2 — vaga fora do ar não recebe resposta nova ─────────────────
--
-- Vale para INSERT e para UPDATE: sem o UPDATE, quem tivesse respondido
-- "não é para mim" poderia mudar para "tenho interesse" depois de a vaga
-- sair do ar — pela mesma aba velha, com o mesmo resultado ruim.
--
-- Mudar de NÃO para NÃO, ou qualquer mexida que não acenda o interesse,
-- continua passando: a pessoa não está entrando numa fila que não existe.
create or replace function public.job_responses_so_em_vaga_ativa()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_status text;
begin
  -- A empresa continua podendo triar (`status`, `company_notes`) numa vaga
  -- arquivada — é exatamente o que ela faz depois de encerrar: olhar quem
  -- respondeu e marcar quem chamou. Só o INTERESSE novo é que trava.
  if tg_op = 'UPDATE'
     and (new.interessado is not true or old.interessado is true) then
    return new;
  end if;

  select status into v_status
    from public.job_listings where id = new.job_listing_id;

  if v_status is distinct from 'active' then
    raise exception 'Esta vaga não está mais recebendo interessados.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists job_responses_so_em_vaga_ativa on public.job_responses;
create trigger job_responses_so_em_vaga_ativa
  before insert or update on public.job_responses
  for each row execute function public.job_responses_so_em_vaga_ativa();

-- O índice do painel: ele passa a pedir as vagas da empresa em TODOS os
-- estados, e não só as ativas.
create index if not exists idx_job_listings_empresa_estado
  on public.job_listings (company_id, status, created_at desc);

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema.
select case
  when (select pg_get_constraintdef(oid) from pg_constraint
         where conrelid = 'public.job_listings'::regclass
           and conname = 'job_listings_status_check') like '%paused%'
   and (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'job_listings'
           and policyname = 'Empresa apaga vaga própria') = 1
   and (select count(*) from pg_trigger
         where tgrelid = 'public.job_responses'::regclass
           and tgname = 'job_responses_so_em_vaga_ativa') = 1
  then 'PRONTO — dá para pausar, arquivar e excluir vaga, e vaga fora do ar não recebe mais ninguém'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;


-- ───── 0080_vaga_completa.sql ─────
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


select 'PARTE 7 de 7 PRONTA' as resultado;
