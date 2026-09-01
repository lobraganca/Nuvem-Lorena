-- Ei Itabirito — banco NOVO, PARTE 6 de 7
-- Projeto: ahigenhenzmsjxlmrzhz (o do Ei Itabirito)
-- Cole tudo, clique uma vez fora do texto (para não ficar nada selecionado) e toque em Run.
-- Migrations desta parte: 0069 a 0074

-- ───── 0069_job_responses.sql ─────
-- 0069 — tabela de respostas a vagas (job_responses).
--
-- Quando um profissional vê uma vaga (notificação, busca, ou recomendação)
-- e se interessa, ele responde. Cada resposta é registrada aqui com o
-- profissional (professional_id), a vaga (job_listing_id), e o timestamp.
--
-- A resposta pode ter status: new (acabou de chegar), read (empresa leu),
-- accepted (empresa se interessou e marcou contato), rejected (empresa
-- descartou ou achou alguém melhor).

create table if not exists public.job_responses (
  id uuid primary key default gen_random_uuid(),
  job_listing_id uuid not null references public.job_listings on delete cascade,
  professional_id uuid not null references auth.users on delete cascade,
  responded_at timestamp with time zone default now(),
  status text not null default 'new' check (status in ('new', 'read', 'accepted', 'rejected')),
  company_notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (job_listing_id, professional_id)
);

-- RLS: profissional vê suas próprias respostas; empresa vê respostas de suas vagas.
alter table public.job_responses enable row level security;

create policy "Profissional lê suas respostas" on public.job_responses
  for select using (auth.uid() = professional_id or
    exists (
      select 1 from public.job_listings
      where id = job_listing_id
        and company_id = (select id from public.companies where owner_id = auth.uid())
    )
  );

create policy "Profissional insere resposta" on public.job_responses
  for insert with check (auth.uid() = professional_id);

create policy "Empresa atualiza status da resposta" on public.job_responses
  for update using (
    exists (
      select 1 from public.job_listings
      where id = job_listing_id
        and company_id = (select id from public.companies where owner_id = auth.uid())
    )
  );

-- Indexes para buscas.
create index if not exists idx_job_responses_job on public.job_responses(job_listing_id);
create index if not exists idx_job_responses_professional on public.job_responses(professional_id);
create index if not exists idx_job_responses_status on public.job_responses(status);
create index if not exists idx_job_responses_responded on public.job_responses(responded_at desc);

-- Trigger para atualizar updated_at.
create or replace function update_job_responses_timestamp()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger update_job_responses_timestamp_trigger
  before update on public.job_responses
  for each row
  execute function update_job_responses_timestamp();

-- Confere a si mesma.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.job_responses'::regclass
           and attname in ('id', 'job_listing_id', 'professional_id', 'responded_at',
                          'status', 'company_notes', 'created_at', 'updated_at')
           and not attisdropped) = 8
  then 'PRONTO — job_responses foi criada com todas as colunas'
  else 'AINDA FALTA — as colunas nao foram criadas'
  end as resultado;


-- ───── 0070_onde_quero_trabalhar_e_experiencias.sql ─────
-- 0070 — "onde quero trabalhar" e as experiências de quem se cadastra.
--
-- O cadastro sabia dizer o que a pessoa OFERECE ("sou encanador") e nada
-- sobre onde ela ACEITARIA trabalhar. São coisas diferentes, e a diferença
-- é o app inteiro: um eletricista que topa vaga de auxiliar de produção
-- nunca seria alcançado por ela, porque "auxiliar de produção" não é o que
-- ele faz — é o que ele aceitaria fazer.
--
-- Por isso é coluna nova, e não mais espaço na lista de serviços: misturar
-- as duas estragaria a busca de quem procura um encanador (apareceria gente
-- que só toparia ser encanador) e a das vagas (não daria para saber se a
-- pessoa faz aquilo ou só aceitaria).
--
-- Vai em 3 partes numeradas. O editor do painel desfaz o bloco inteiro
-- quando um comando falha no meio, então cada parte é rodada sozinha — e a
-- Parte 1 é a que destrava as pessoas.

-- ── Parte 1 ────────────────────────────────────────────────────────────
-- A coluna. Sozinha não quebra nada: o app antigo simplesmente a ignora.

alter table public.professionals
  add column if not exists areas_de_interesse text[] not null default '{}';

-- ── Parte 2 ────────────────────────────────────────────────────────────
-- As experiências. Três campos por item, de propósito.
--
-- "Ajudante de pedreiro / Construções Silva / 2 anos" é o que uma empresa
-- da cidade quer saber, e é o que se preenche num celular sem desistir no
-- meio. Currículo com mês e ano de início e fim é mais completo e fica
-- vazio — e experiência não preenchida não ajuda ninguém.
--
-- `periodo` é texto livre, e não duas datas: quem trabalhou "uns três anos"
-- não sabe o mês, e obrigá-lo a escolher um faz ele inventar ou desistir.

create table if not exists public.professional_experiences (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals on delete cascade,
  cargo text not null,
  onde text,
  periodo text,
  ordem integer not null default 0,
  created_at timestamp with time zone default now()
);

create index if not exists idx_experiences_professional
  on public.professional_experiences(professional_id, ordem);

alter table public.professional_experiences enable row level security;

-- Qualquer um lê: a experiência existe para ser vista por quem contrata.
-- A view não filtra suspenso/pausado porque a leitura sempre parte de um
-- cadastro já encontrado — e cadastro fora do ar não é encontrado.
create policy "Qualquer um lê experiência" on public.professional_experiences
  for select using (true);

-- Escreve só o dono do cadastro. `exists` contra `professionals` em vez de
-- guardar owner_id aqui: dois lugares com a mesma verdade divergem, e o que
-- manda é de quem é o cadastro.
create policy "Dono escreve sua experiência" on public.professional_experiences
  for insert with check (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

create policy "Dono atualiza sua experiência" on public.professional_experiences
  for update using (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

create policy "Dono apaga sua experiência" on public.professional_experiences
  for delete using (
    exists (select 1 from public.professionals p
             where p.id = professional_id and p.owner_id = auth.uid())
  );

-- ── Parte 3 ────────────────────────────────────────────────────────────
-- A view pública ganha a coluna nova.
--
-- ATENÇÃO ao `where` da última linha. View roda com os direitos de quem a
-- criou, então ela NÃO obedece RLS: o filtro precisa estar escrito aqui.
-- A migration 0049 recriou esta view sem ele e cadastros suspensos e
-- pausados voltaram a aparecer na busca — sem erro, sem aviso, só de volta.
-- Toda vez que esta view for recriada, confira que esta linha veio junto.

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
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema: aquele filtra por privilégio
-- do papel corrente e já respondeu "não existe" cinco vezes para uma coluna
-- que existia o tempo todo.
--
-- Confere também o `where` da view, que é o erro que já aconteceu: sem ele
-- a consulta abaixo devolveria a contagem errada e ninguém notaria.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.professionals'::regclass
           and attname = 'areas_de_interesse' and not attisdropped) = 1
   and (select count(*) from pg_attribute
         where attrelid = 'public.professionals_public'::regclass
           and attname = 'areas_de_interesse' and not attisdropped) = 1
   and (select count(*) from pg_class
         where relname = 'professional_experiences' and relkind = 'r') = 1
   and (select pg_get_viewdef('public.professionals_public'::regclass)) like '%paused%'
  then 'PRONTO — onde quero trabalhar, experiencias, e a view com o filtro no lugar'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;


-- ───── 0071_empresa_confirma_telefone_e_vaga_anunciada.sql ─────
-- 0071 — a empresa também confirma o telefone, e a vaga pode ser anunciada.
--
-- Três coisas, todas do lado de quem contrata:
--
-- 1. Empresa confirma o telefone, igual ao profissional. A regra passou a
--    valer para todo mundo: quem publica vaga é procurado de volta, e um
--    número não confirmado do lado de quem contrata é o mesmo problema do
--    outro lado — com o agravante de que aqui há dinheiro envolvido.
--
-- 2. A vaga pode ficar anunciada na área de anúncios, por 30 dias.
--
-- 3. Um teto de vagas com disparo por mês, para o aviso não virar enxurrada.
--
-- Vai em 3 partes numeradas. O editor do painel desfaz o bloco inteiro
-- quando um comando falha no meio, então cada parte é rodada sozinha.

-- ── Parte 1 ────────────────────────────────────────────────────────────
-- O telefone confirmado da empresa.
--
-- Colunas próprias em vez de reaproveitar `professionals`: uma empresa
-- contratante não tem cadastro de profissional, e criar um só para guardar
-- um booleano faria ela aparecer na busca de quem procura encanador.

alter table public.companies
  add column if not exists phone_verified boolean not null default false;
alter table public.companies
  add column if not exists phone_verified_at timestamp with time zone;

-- Ninguém se declara confirmado — o mesmo gatilho da 0024, aplicado à
-- empresa. Sem ele, um `update` direto do navegador ligaria o selo, e o
-- selo é justamente o que diz que o número foi provado.
--
-- Um gatilho só cuida das duas regras (não ligar por fora, e perder o selo
-- ao trocar de número): separados, a ordem entre eles passa a importar, e
-- ordem de gatilho no Postgres é o nome em ordem alfabética — uma armadilha
-- que só aparece quando alguém renomeia um deles.
create or replace function public.companies_protege_telefone_confirmado()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    -- Nenhuma empresa nasce confirmada.
    new.phone_verified := false;
    new.phone_verified_at := null;
    return new;
  end if;

  if new.phone_verified is distinct from old.phone_verified
     or new.phone_verified_at is distinct from old.phone_verified_at then
    /* `current_setting` com o segundo argumento true devolve null em vez de
       estourar quando a variável não existe — é assim que a função de
       confirmação se identifica, igual à 0024. */
    if coalesce(current_setting('app.confirmando_telefone_empresa', true), '') <> 'sim' then
      raise exception 'O telefone confirmado só pode ser alterado pela confirmação por código.';
    end if;
  end if;

  /* Trocar o número derruba a confirmação: o selo vale para o número que
     foi confirmado, não para a empresa em geral. Sem isto bastaria
     confirmar o próprio celular e depois trocar pelo número do golpe.

     Compara só os dígitos, senão "(31) 99999-0001" e "31999990001" — o
     mesmo número — derrubariam o selo a cada vez que alguém salvasse o
     cadastro sem mexer no telefone. */
  if regexp_replace(coalesce(new.phone, ''), '\D', '', 'g')
     is distinct from regexp_replace(coalesce(old.phone, ''), '\D', '', 'g') then
    new.phone_verified := false;
    new.phone_verified_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists companies_protege_telefone_confirmado_trigger on public.companies;
create trigger companies_protege_telefone_confirmado_trigger
  before insert or update on public.companies
  for each row execute function public.companies_protege_telefone_confirmado();

-- A função que confirma de verdade. Mesma lógica da `confirmar_whatsapp`
-- da 0024: só o dono, e só se o Auth já confirmou AQUELE número.
-- O `security definer` é o que permite gravar a coluna protegida.
create or replace function public.confirmar_telefone_empresa(p_company_id uuid)
returns boolean
language plpgsql
security definer set search_path = public, pg_catalog
as $$
declare
  v_dono uuid;
  v_phone text;
  v_auth_phone text;
  v_confirmado timestamptz;
  v_digitos_empresa text;
  v_digitos_auth text;
begin
  select owner_id, phone into v_dono, v_phone
    from public.companies where id = p_company_id;

  if v_dono is null then
    raise exception 'Empresa não encontrada.';
  end if;
  if v_dono <> auth.uid() then
    raise exception 'Só o dono da empresa pode confirmar o telefone dela.';
  end if;

  select phone, phone_confirmed_at into v_auth_phone, v_confirmado
    from auth.users where id = auth.uid();

  if v_confirmado is null then
    raise exception 'O número ainda não foi confirmado por código.';
  end if;

  -- O "55" do começo sai dos dois lados: o Auth guarda em formato
  -- internacional e o cadastro guarda como a pessoa digitou.
  v_digitos_empresa := regexp_replace(regexp_replace(coalesce(v_phone, ''), '\D', '', 'g'), '^55', '');
  v_digitos_auth := regexp_replace(regexp_replace(coalesce(v_auth_phone, ''), '\D', '', 'g'), '^55', '');

  if v_digitos_empresa = '' or v_digitos_empresa <> v_digitos_auth then
    raise exception 'O número confirmado é diferente do que está no cadastro da empresa.';
  end if;

  /* A senha que o gatilho reconhece. `set local` vale só até o fim desta
     transação, então ela não fica valendo para nada depois. */
  perform set_config('app.confirmando_telefone_empresa', 'sim', true);

  update public.companies
     set phone_verified = true, phone_verified_at = now()
   where id = p_company_id;

  perform set_config('app.confirmando_telefone_empresa', '', true);

  return true;
end;
$$;

-- ── Parte 2 ────────────────────────────────────────────────────────────
-- A vaga anunciada na área de anúncios.
--
-- `anunciada_ate` guarda até quando, e não "está anunciada agora": data
-- vence sozinha, booleano precisa de alguém para desligar — e esse alguém
-- é sempre uma rotina que um dia falha em silêncio.

alter table public.job_listings
  add column if not exists anunciada_ate timestamp with time zone;

-- Sem telefone confirmado, a empresa NÃO publica vaga.
--
-- A tela já avisa e já trava, mas trava de tela é trava que se contorna:
-- basta uma chamada feita por fora do app. Aqui a recusa é do banco, que é
-- o único lugar onde ela vale para todo mundo.
--
-- Substitui a policy de INSERT criada na 0067, acrescentando a condição.
drop policy if exists "Empresa escreve vaga própria" on public.job_listings;
create policy "Empresa escreve vaga própria" on public.job_listings
  for insert with check (
    exists (
      select 1 from public.companies c
       where c.id = company_id
         and c.owner_id = auth.uid()
         and c.phone_verified
    )
  );

create index if not exists idx_job_listings_anunciadas
  on public.job_listings (anunciada_ate)
  where anunciada_ate is not null;

-- ── Parte 3 ────────────────────────────────────────────────────────────
-- Quantas vagas cada empresa já disparou no mês.
--
-- É uma função, e não uma coluna de contador: contador precisa ser zerado
-- todo dia 1º por alguém, e "alguém" é uma rotina agendada que, quando
-- falha, deixa a empresa sem disparar sem que nada explique por quê.
-- Contar as vagas do mês responde sozinho, sempre certo, e não tem o que
-- desligar.
--
-- Conta VAGAS com onda aberta, não ondas abertas. Alargar a busca de uma
-- vaga que não deu resposta é a mesma vaga procurando gente — cobrar por
-- isso faria a empresa hesitar justamente quando precisa alargar.
create or replace function public.vagas_disparadas_no_mes(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select count(distinct v.id)::integer
    from public.job_listings v
    join public.job_dispatches d on d.job_listing_id = v.id
   where v.company_id = p_company_id
     and d.sent_at >= date_trunc('month', now());
$$;

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.companies'::regclass
           and attname in ('phone_verified','phone_verified_at') and not attisdropped) = 2
   and (select count(*) from pg_attribute
         where attrelid = 'public.job_listings'::regclass
           and attname = 'anunciada_ate' and not attisdropped) = 1
   and (select count(*) from pg_proc
         where proname = 'confirmar_telefone_empresa') = 1
   and (select count(*) from pg_proc
         where proname = 'vagas_disparadas_no_mes') = 1
  then 'PRONTO — empresa confirma telefone, vaga pode ser anunciada, cota do mes conta sozinha'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;


-- ───── 0072_planos_da_empresa.sql ─────
-- 0072 — os planos de quem contrata, e o teto de ondas por vaga.
--
-- Substitui o modelo da 0071, que cobrava R$ 10,90 por vaga anunciada e
-- dava 2 disparos por mês à empresa. Agora quem manda é o plano:
--
--   Pro          R$ 29,90/mês   1 vaga anunciada por vez
--   Três         R$ 59,90/mês   3 vagas
--   Ilimitado    R$ 89,90/mês   sem teto
--
-- E o disparo deixa de ter cota mensal: **cada vaga tem direito a 2 ondas**.
-- A onda 1 sai na criação; a segunda é a empresa que abre, quando a
-- primeira não deu resposta. A terceira onda continua existindo no código —
-- é a empresa que escolhe qual das duas seguintes usar como a sua segunda.
--
-- Por que o teto é por VAGA e não por mês: uma vaga que não encheu precisa
-- alargar a busca, e uma cota mensal faria a empresa escolher entre alargar
-- esta vaga e abrir a próxima. São necessidades diferentes e não deviam
-- disputar o mesmo saldo.
--
-- Vai em 4 partes numeradas. O editor do painel desfaz o bloco inteiro
-- quando um comando falha no meio, então cada parte é rodada sozinha.

-- ── Parte 1 ────────────────────────────────────────────────────────────
-- O plano da empresa.
--
-- `plano_ate` guarda até quando vale, e não um "está ativo": data vence
-- sozinha, booleano precisa de alguém para desligar — e esse alguém é
-- sempre uma rotina agendada que um dia falha calada, deixando plano
-- vencido valendo de graça.

alter table public.companies
  add column if not exists plano text
    check (plano is null or plano in ('pro', 'tres', 'ilimitado'));
alter table public.companies
  add column if not exists plano_ate timestamp with time zone;
-- Avulso paga uma vez e vence; recorrente se renova sozinho até alguém
-- cancelar. É a escolha de quem contrata, não uma configuração nossa.
alter table public.companies
  add column if not exists plano_recorrente boolean not null default false;

-- ── Parte 2 ────────────────────────────────────────────────────────────
-- Quantas vagas o plano deixa anunciar, e quantas já estão anunciadas.
--
-- Ler o teto de uma função, e não de uma coluna, é o que garante que mudar
-- de plano valha na hora — sem rotina para "recalcular" nada. E o `-1` do
-- ilimitado é lido em um lugar só, aqui embaixo.

create or replace function public.limite_de_vagas_do_plano(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select case
           when c.plano_ate is null or c.plano_ate < now() then 0
           when c.plano = 'pro' then 1
           when c.plano = 'tres' then 3
           when c.plano = 'ilimitado' then -1   -- -1 = sem teto
           else 0
         end
    from public.companies c
   where c.id = p_company_id;
$$;

-- Conta as que estão anunciadas AGORA, não as que já foram: o plano limita
-- quantas ficam no ar ao mesmo tempo. Anúncio vencido libera a vaga do
-- teto sozinho, porque a conta é feita sobre a data.
create or replace function public.vagas_anunciadas_agora(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select count(*)::integer
    from public.job_listings v
   where v.company_id = p_company_id
     and v.anunciada_ate is not null
     and v.anunciada_ate > now();
$$;

-- ── Parte 3 ────────────────────────────────────────────────────────────
-- O banco recusa anunciar além do plano.
--
-- A tela também vai avisar, mas trava de tela se contorna com uma chamada
-- feita por fora do app — e aqui há dinheiro do outro lado, que é
-- exatamente onde alguém tenta.

create or replace function public.job_listings_respeita_plano()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_limite integer;
  v_agora integer;
begin
  -- Só interessa quando a vaga PASSA a ser anunciada. Salvar qualquer outro
  -- campo de uma vaga já anunciada não pode esbarrar no teto.
  if new.anunciada_ate is null or new.anunciada_ate <= now() then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.anunciada_ate is not distinct from new.anunciada_ate then
    return new;
  end if;

  v_limite := public.limite_de_vagas_do_plano(new.company_id);

  if v_limite = 0 then
    raise exception 'Esta empresa não tem plano ativo para anunciar vagas.';
  end if;

  if v_limite > 0 then
    select public.vagas_anunciadas_agora(new.company_id) into v_agora;
    -- No UPDATE a própria vaga pode já estar contada; descontá-la evita
    -- recusar uma renovação de anúncio por causa dela mesma.
    if tg_op = 'UPDATE' and old.anunciada_ate is not null and old.anunciada_ate > now() then
      v_agora := v_agora - 1;
    end if;

    if v_agora >= v_limite then
      raise exception 'O plano desta empresa permite % vaga(s) anunciada(s) por vez.', v_limite;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists job_listings_respeita_plano_trigger on public.job_listings;
create trigger job_listings_respeita_plano_trigger
  before insert or update on public.job_listings
  for each row execute function public.job_listings_respeita_plano();

-- ── Parte 4 ────────────────────────────────────────────────────────────
-- Duas ondas por vaga, e o fim da cota mensal.

create or replace function public.job_dispatches_teto_por_vaga()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_abertas integer;
begin
  select count(*) into v_abertas
    from public.job_dispatches
   where job_listing_id = new.job_listing_id;

  if v_abertas >= 2 then
    raise exception 'Cada vaga tem direito a 2 ondas de disparo.';
  end if;

  return new;
end;
$$;

drop trigger if exists job_dispatches_teto_por_vaga_trigger on public.job_dispatches;
create trigger job_dispatches_teto_por_vaga_trigger
  before insert on public.job_dispatches
  for each row execute function public.job_dispatches_teto_por_vaga();

-- A cota mensal da 0071 sai de cena. A função fica, sem uso, porque
-- apagá-la derrubaria qualquer tela que ainda a chame enquanto o código
-- novo não estiver no ar — e uma função sem uso não faz mal nenhum.
comment on function public.vagas_disparadas_no_mes(uuid) is
  'Sem uso desde a 0072: o teto passou a ser de 2 ondas POR VAGA, não por mês.';

-- ── Confere a si mesma ─────────────────────────────────────────────────
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.companies'::regclass
           and attname in ('plano','plano_ate','plano_recorrente') and not attisdropped) = 3
   and (select count(*) from pg_proc where proname = 'limite_de_vagas_do_plano') = 1
   and (select count(*) from pg_proc where proname = 'vagas_anunciadas_agora') = 1
   and (select count(*) from pg_trigger
         where tgname = 'job_listings_respeita_plano_trigger') = 1
   and (select count(*) from pg_trigger
         where tgname = 'job_dispatches_teto_por_vaga_trigger') = 1
  then 'PRONTO — planos da empresa, teto de anuncios e 2 ondas por vaga'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;


-- ───── 0073_plano_e_a_porta_da_vaga.sql ─────
-- 0073 — o plano deixa de ser sobre anunciar e passa a ser a porta.
--
-- O modelo anterior (0071/0072) cobrava pelo ANÚNCIO — a vaga parada na
-- tela onde as pessoas procuram — e deixava de graça publicar a vaga e
-- disparar as ondas. Estava ao contrário: a onda é a parte valiosa, porque
-- vai atrás de quem encaixa e chega no telefone de quem nem estava
-- procurando. Anunciar é passivo. Cobrar pelo passivo e dar o ativo de
-- graça deixava o plano sem motivo para existir — bastava publicar,
-- disparar as duas ondas e nunca assinar nada.
--
-- Como fica:
--
--   SEM plano   vê e procura todos os profissionais, e fala com cada um
--               por conta própria. É o app inteiro que já existia, aberto,
--               sem conta — e continua assim para todo mundo.
--
--   COM plano   publica vaga, dispara as ondas, e recebe quem se
--               interessou. O anúncio na área de anúncios vem junto.
--
-- O teto do plano passa a contar VAGAS ATIVAS, não vagas anunciadas: agora
-- a vaga é o produto, e o anúncio é parte dela.
--
--   Pro          R$ 29,90/mês   1 vaga por vez
--   Três         R$ 59,90/mês   3 vagas
--   Ilimitado    R$ 89,90/mês   sem teto
--
-- Vai em 3 partes numeradas. O editor do painel desfaz o bloco inteiro
-- quando um comando falha no meio, então cada parte é rodada sozinha.

-- ── Parte 1 ────────────────────────────────────────────────────────────
-- Quantas vagas ATIVAS a empresa tem agora.
--
-- Substitui `vagas_anunciadas_agora` como a conta que importa. Vaga fechada
-- libera o lugar sozinha — a empresa do plano Pro fecha a que encheu e abre
-- a próxima, sem falar com ninguém.

create or replace function public.vagas_ativas_agora(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select count(*)::integer
    from public.job_listings v
   where v.company_id = p_company_id
     and v.status = 'active';
$$;

-- ── Parte 2 ────────────────────────────────────────────────────────────
-- Sem plano, não publica vaga.
--
-- O gatilho vem ANTES da policy e é ele que fala com gente: policy recusada
-- devolve "permission denied", que não diz o que fazer. Aqui a empresa lê o
-- motivo. A policy da Parte 3 é a rede embaixo, para quem chamar por fora
-- do app.

create or replace function public.job_listings_exige_plano()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_limite integer;
  v_ativas integer;
begin
  -- Fechar ou reabrir vaga não passa por aqui como criação. E vaga que está
  -- sendo fechada nunca deve esbarrar no teto — senão a empresa do plano
  -- cheio não conseguiria nem fechar as que tem.
  if tg_op = 'UPDATE' and new.status is distinct from 'active' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' and new.status = 'active' then
    return new;  -- edição comum de uma vaga que já estava no ar
  end if;

  v_limite := public.limite_de_vagas_do_plano(new.company_id);

  if v_limite = 0 then
    raise exception 'Para publicar vaga é preciso ter um plano ativo.';
  end if;

  if v_limite > 0 then
    v_ativas := public.vagas_ativas_agora(new.company_id);
    -- No UPDATE que reabre, a própria vaga ainda não está contada como
    -- ativa (o estado antigo era outro), então não há o que descontar.
    if v_ativas >= v_limite then
      raise exception 'Seu plano permite % vaga(s) aberta(s) por vez. Feche uma para abrir outra.', v_limite;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists job_listings_exige_plano_trigger on public.job_listings;
create trigger job_listings_exige_plano_trigger
  before insert or update on public.job_listings
  for each row execute function public.job_listings_exige_plano();

-- O gatilho da 0072 sai: ele contava vagas ANUNCIADAS, e o anúncio deixou
-- de ser o que se compra. Dois gatilhos com tetos diferentes sobre a mesma
-- tabela é o tipo de coisa que recusa uma gravação por um motivo que
-- ninguém consegue explicar depois.
drop trigger if exists job_listings_respeita_plano_trigger on public.job_listings;

-- ── Parte 3 ────────────────────────────────────────────────────────────
-- A rede embaixo: a policy também exige plano.
--
-- Substitui a da 0071, que exigia só o telefone confirmado. As duas
-- condições continuam valendo — o telefone é como as pessoas procuram a
-- empresa de volta, e sem ele a vaga não sai.

drop policy if exists "Empresa escreve vaga própria" on public.job_listings;
create policy "Empresa escreve vaga própria" on public.job_listings
  for insert with check (
    exists (
      select 1 from public.companies c
       where c.id = company_id
         and c.owner_id = auth.uid()
         and c.phone_verified
         and c.plano_ate is not null
         and c.plano_ate > now()
    )
  );

-- ── Confere a si mesma ─────────────────────────────────────────────────
select case
  when (select count(*) from pg_proc where proname = 'vagas_ativas_agora') = 1
   and (select count(*) from pg_trigger
         where tgname = 'job_listings_exige_plano_trigger') = 1
   and (select count(*) from pg_trigger
         where tgname = 'job_listings_respeita_plano_trigger') = 0
   and (select count(*) from pg_policies
         where tablename = 'job_listings'
           and policyname = 'Empresa escreve vaga própria'
           and with_check like '%plano_ate%') = 1
  then 'PRONTO — sem plano nao publica vaga; o teto conta vagas abertas'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;


-- ───── 0074_aviso_por_push.sql ─────
-- 0074 — o aviso da vaga, por notificação push.
--
-- Até aqui a onda guardava só um NÚMERO: "a onda 1 alcançou 12 pessoas".
-- Com isso não dá para avisar ninguém — não se sabe quem são — nem para
-- responder depois "esta vaga chegou em mim?". Aqui entram as duas tabelas
-- que faltavam: os aparelhos que podem receber aviso, e o registro de quem
-- foi avisado de qual vaga.
--
-- POR QUE PUSH, E O QUE ELE CUSTA
--
-- SMS chega em qualquer celular e é cobrado por mensagem, da dona do app.
-- Push é de graça e ilimitado — mas só alcança quem INSTALOU o app e
-- ACEITOU receber aviso. Quem usa pelo navegador sem instalar não recebe; no
-- iPhone, só recebe quem adicionou o app à tela de início.
--
-- Isso não é detalhe técnico, é o produto: uma empresa paga acreditando que
-- a vaga chega nas pessoas. Se metade da onda não tem como receber, ela
-- comprou um número que não existe. Por isso a coluna
-- `podiam_receber` existe em `job_dispatches` — a tela mostra os dois
-- números, e a diferença entre eles é a verdade.
--
-- Vai em 4 partes numeradas. O editor do painel desfaz o bloco inteiro
-- quando um comando falha no meio, então cada parte é rodada sozinha.

-- ── Parte 1 ────────────────────────────────────────────────────────────
-- Os aparelhos que podem receber aviso.
--
-- Uma pessoa tem vários: o celular, o tablet, o computador. Todos recebem,
-- porque não dá para saber qual está na mão dela agora.
--
-- Duas plataformas, dois formatos de endereço, e é por isso que as colunas
-- são frouxas: no app da loja o Firebase entrega um `token`; no navegador o
-- Web Push entrega um `endpoint` mais duas chaves. Uma tabela para os dois
-- evita duplicar toda a lógica de "quem avisar" só porque o transporte
-- muda.

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  -- 'android' = token do Firebase; 'web' = inscrição do navegador.
  plataforma text not null check (plataforma in ('android', 'ios', 'web')),
  -- Firebase: o token vai aqui e os três de baixo ficam nulos.
  token text,
  -- Web Push: endereço e as duas chaves da inscrição do navegador.
  endpoint text,
  p256dh text,
  auth text,
  criado_em timestamp with time zone default now(),
  -- Atualizado a cada vez que o app abre. Aparelho que não aparece há
  -- meses provavelmente foi trocado, e mandar aviso para ele é gastar
  -- tentativa à toa.
  visto_em timestamp with time zone default now()
);

-- Um aparelho é o mesmo aparelho: reinstalar o app devolve o mesmo token, e
-- sem isto a pessoa acumularia uma linha por instalação e receberia o mesmo
-- aviso cinco vezes.
create unique index if not exists idx_push_devices_token
  on public.push_devices (token) where token is not null;
create unique index if not exists idx_push_devices_endpoint
  on public.push_devices (endpoint) where endpoint is not null;
create index if not exists idx_push_devices_user on public.push_devices (user_id);

alter table public.push_devices enable row level security;

-- Cada um cuida dos próprios aparelhos, e só. A lista de aparelhos de
-- alguém diz em quantos lugares a pessoa usa o app — não é da conta de
-- ninguém.
create policy "Dono lê seus aparelhos" on public.push_devices
  for select using (auth.uid() = user_id);
create policy "Dono cadastra seu aparelho" on public.push_devices
  for insert with check (auth.uid() = user_id);
create policy "Dono atualiza seu aparelho" on public.push_devices
  for update using (auth.uid() = user_id);
create policy "Dono apaga seu aparelho" on public.push_devices
  for delete using (auth.uid() = user_id);

-- ── Parte 2 ────────────────────────────────────────────────────────────
-- Quem foi avisado de qual vaga.
--
-- É o que faltava para o aviso existir, e também o que permite ao
-- profissional abrir o app e ver "vagas para você" — que é o caminho de
-- quem NÃO tem push ligado. O push é o empurrão; esta tabela é o recado, e
-- o recado fica aqui mesmo que o empurrão não chegue.

create table if not exists public.job_notifications (
  id uuid primary key default gen_random_uuid(),
  job_listing_id uuid not null references public.job_listings on delete cascade,
  professional_id uuid not null references auth.users on delete cascade,
  wave integer not null check (wave in (1, 2, 3)),
  criado_em timestamp with time zone default now(),
  -- Quando o push saiu de fato. Nulo = ainda não saiu, ou a pessoa não tem
  -- aparelho que receba. São coisas diferentes e as duas importam: a
  -- primeira é fila, a segunda é alcance.
  enviado_em timestamp with time zone,
  -- Quando a pessoa ABRIU. É o número que diz se o aviso serve para alguma
  -- coisa — "enviado" só prova que saiu daqui.
  visto_em timestamp with time zone,
  -- A mesma vaga não avisa a mesma pessoa duas vezes, nem quando a onda 2
  -- alcança quem a onda 1 já tinha alcançado.
  unique (job_listing_id, professional_id)
);

create index if not exists idx_job_notifications_prof
  on public.job_notifications (professional_id, criado_em desc);
create index if not exists idx_job_notifications_vaga
  on public.job_notifications (job_listing_id);
create index if not exists idx_job_notifications_fila
  on public.job_notifications (enviado_em) where enviado_em is null;

alter table public.job_notifications enable row level security;

-- O profissional vê os avisos dele; a empresa vê os da vaga dela.
create policy "Vê os avisos que lhe dizem respeito" on public.job_notifications
  for select using (
    auth.uid() = professional_id
    or exists (
      select 1 from public.job_listings v
       join public.companies c on c.id = v.company_id
      where v.id = job_listing_id and c.owner_id = auth.uid()
    )
  );

-- Quem grava é a empresa dona da vaga, ao abrir a onda.
create policy "Empresa registra o aviso da sua vaga" on public.job_notifications
  for insert with check (
    exists (
      select 1 from public.job_listings v
       join public.companies c on c.id = v.company_id
      where v.id = job_listing_id and c.owner_id = auth.uid()
    )
  );

-- E o profissional marca como visto — só a própria linha, e só esse campo.
-- A garantia de que ele não mexe no resto é o gatilho da Parte 3.
create policy "Profissional marca o aviso como visto" on public.job_notifications
  for update using (auth.uid() = professional_id);

-- ── Parte 3 ────────────────────────────────────────────────────────────
-- O profissional só pode marcar "vi", nada mais.
--
-- Sem isto, a policy de UPDATE acima deixaria ele reescrever a vaga do
-- aviso ou apagar a data de envio — a policy diz QUAIS LINHAS, nunca quais
-- colunas.

create or replace function public.job_notifications_so_marca_visto()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() = old.professional_id then
    if new.job_listing_id is distinct from old.job_listing_id
       or new.professional_id is distinct from old.professional_id
       or new.wave is distinct from old.wave
       or new.enviado_em is distinct from old.enviado_em then
      raise exception 'Só a data de visualização pode ser alterada aqui.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists job_notifications_so_marca_visto_trigger on public.job_notifications;
create trigger job_notifications_so_marca_visto_trigger
  before update on public.job_notifications
  for each row execute function public.job_notifications_so_marca_visto();

-- ── Parte 4 ────────────────────────────────────────────────────────────
-- Quantos, da onda, TÊM como receber o aviso.
--
-- É a diferença entre "alcançou 12" e "12, e 3 recebem aviso no celular".
-- Sem este número a tela venderia um alcance que não existe — e a empresa
-- só descobriria pelo silêncio, que é a forma mais cara de descobrir.

alter table public.job_dispatches
  add column if not exists podiam_receber integer;

-- Quem, entre estas pessoas, tem aparelho cadastrado.
create or replace function public.quantos_recebem_push(p_users uuid[])
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select count(distinct d.user_id)::integer
    from public.push_devices d
   where d.user_id = any(p_users);
$$;

-- ── Confere a si mesma ─────────────────────────────────────────────────
select case
  when (select count(*) from pg_class
         where relname = 'push_devices' and relkind = 'r') = 1
   and (select count(*) from pg_class
         where relname = 'job_notifications' and relkind = 'r') = 1
   and (select count(*) from pg_attribute
         where attrelid = 'public.job_dispatches'::regclass
           and attname = 'podiam_receber' and not attisdropped) = 1
   and (select count(*) from pg_proc where proname = 'quantos_recebem_push') = 1
   and (select count(*) from pg_trigger
         where tgname = 'job_notifications_so_marca_visto_trigger') = 1
  then 'PRONTO — aparelhos, avisos por vaga, e a conta de quem recebe push'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;


select 'PARTE 6 de 7 PRONTA' as resultado;
