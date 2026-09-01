-- Ei Itabirito — banco NOVO, PARTE 5 de 7
-- Projeto: ahigenhenzmsjxlmrzhz (o do Ei Itabirito)
-- Cole tudo, clique uma vez fora do texto (para não ficar nada selecionado) e toque em Run.
-- Migrations desta parte: 0056 a 0068

-- ───── 0056_lista_de_usuarios_deixa_de_ser_publica.sql ─────
-- --------------------------------------------------------------------
-- `profiles_public` entregava a lista de todo mundo que tem conta.
--
-- A 0012 criou esta view para um fim estreito: mostrar o nome e a foto de
-- quem escreveu uma avaliação, sem expor o CPF que a tabela `profiles`
-- guardava. Ela resolveu o vazamento do CPF e deixou outro no lugar, menor
-- e mais silencioso:
--
--   create or replace view public.profiles_public as
--     select id, full_name, avatar_url, created_at from public.profiles;
--   grant select on public.profiles_public to anon, authenticated;
--
-- Sem `where`, com grant para `anon`. View não obedece RLS — roda com os
-- direitos de quem a criou. Então qualquer pessoa com a chave pública do
-- app baixava, numa consulta, o nome completo e a foto de **todas** as
-- contas: inclusive de quem só entrou para procurar um eletricista e nunca
-- se cadastrou como profissional. Numa cidade onde as pessoas se conhecem,
-- essa lista é mais sensível do que parece — ela diz quem usa o app.
--
-- Ninguém precisava desse acesso direto. O único consumidor é a view
-- `reviews_public` (0037), que junta perfil com avaliação. E ela também
-- roda com os direitos da dona, de propósito e documentado lá: é isso que
-- faz o nome do autor chegar a quem lê a página de um profissional. Ou
-- seja, tirar o grant não muda nada na tela — as avaliações continuam
-- aparecendo com nome e foto, porque nunca foi por aqui que elas passavam.
--
-- O que deixa de ser possível é pedir a lista inteira.
-- --------------------------------------------------------------------
revoke select on public.profiles_public from anon, authenticated;

comment on view public.profiles_public is
  'Uso interno: alimenta reviews_public (que roda com direitos da dona). Não conceder select a anon/authenticated — sem where, a view devolve todas as contas.';


-- ───── 0057_limite_de_pedidos_de_contato.sql ─────
-- --------------------------------------------------------------------
-- O limite de pedidos de contato existia e dava para passar por cima dele
-- mudando a pontuação do telefone.
--
-- A 0028 já freia o abuso: 5 pedidos por telefone a cada 10 minutos, e
-- nenhum repetido para o mesmo profissional dentro de 2 minutos. O
-- raciocínio dela continua certo. O que não funciona é a comparação:
--
--   where phone = new.phone
--
-- `phone` é texto livre, digitado por quem pede. "31999998888",
-- "(31) 99999-8888" e "31 99999 8888" são o mesmo telefone e três textos
-- diferentes — então quem quisesse mandar cinquenta pedidos não precisava
-- de cinquenta números, precisava de cinquenta jeitos de escrever o mesmo.
-- O limite pegava exatamente quem ele não precisava pegar: a pessoa de
-- boa-fé que apertou o botão duas vezes, sempre com o campo preenchido
-- igual.
--
-- Duas mudanças, então.
--
-- 1) A comparação passa a ser por dígitos, dos dois lados. É o mesmo
--    critério que o app já usa para casar o número confirmado com o do
--    anúncio (migration 0052) — a regra fica igual no banco inteiro.
--
-- 2) Entra um teto por anúncio, que não existia. Todos os limites da 0028
--    são por telefone; quem gira números falsos passa por todos eles e
--    ainda enche o painel de um profissional. 40 pedidos numa hora para o
--    mesmo anúncio é muito acima de qualquer dia real em Itabirito e bem
--    abaixo do que um envio automatizado faz em um minuto.
--
-- As frases de recusa são escritas para quem levar a recusa sem merecer.
-- --------------------------------------------------------------------

-- --------------------------------------------------------------------
-- Os dígitos de um telefone, do jeito que o app já os compara.
--
-- Só tirar a pontuação não basta: "+55 31 99999-8888" e "31 99999-8888"
-- são o mesmo telefone e continuam dois textos diferentes depois da
-- limpeza. Esse detalhe não é hipótese — foi assim que o primeiro teste
-- deste conserto passou por cima do limite recém-escrito.
--
-- O 55 sai quando o que sobra tem 12 ou 13 dígitos, que é o tamanho de um
-- número brasileiro com código do país (55 + DDD + 8 ou 9 dígitos). Sem
-- essa condição, um fixo de São Paulo começando com 55 perderia os dois
-- primeiros dígitos e viraria outro número.
--
-- É a mesma regra que `whatsappVerify.ts` usa no app para casar o número
-- confirmado com o do anúncio. Escrita aqui para o banco poder aplicá-la
-- sozinho.
-- --------------------------------------------------------------------
create or replace function public.telefone_digitos(bruto text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when length(so_numeros) in (12, 13) and left(so_numeros, 2) = '55'
      then substr(so_numeros, 3)
    else so_numeros
  end
  from (select regexp_replace(coalesce(bruto, ''), '\D', '', 'g') as so_numeros) t;
$$;

-- Índice pelos dígitos: sem ele, cada pedido novo varre a tabela inteira
-- para contar os anteriores — e agora são duas contagens.
create index if not exists contact_requests_telefone_idx
  on public.contact_requests ((public.telefone_digitos(phone)), created_at desc);

create index if not exists contact_requests_recentes_idx
  on public.contact_requests (professional_id, created_at desc);

create or replace function public.contact_requests_freia_abuso()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  digitos text;
  recentes int;
  no_anuncio int;
begin
  digitos := public.telefone_digitos(new.phone);

  if digitos <> '' then
    select count(*) into recentes
      from public.contact_requests
     where public.telefone_digitos(phone) = digitos
       and created_at > now() - interval '10 minutes';

    if recentes >= 5 then
      raise exception 'Muitos pedidos seguidos deste telefone. Espere alguns minutos.';
    end if;

    -- Mesmo profissional, mesmo telefone, em sequência: é dedo nervoso no
    -- botão, não pedido novo.
    if exists (
      select 1 from public.contact_requests
       where professional_id = new.professional_id
         and public.telefone_digitos(phone) = digitos
         and created_at > now() - interval '2 minutes'
    ) then
      raise exception 'Você já enviou um pedido para este profissional agora há pouco.';
    end if;
  end if;

  -- Teto por anúncio, independente de telefone: é o que sobra quando quem
  -- abusa troca de número a cada envio.
  select count(*) into no_anuncio
    from public.contact_requests
   where professional_id = new.professional_id
     and created_at > now() - interval '1 hour';

  if no_anuncio >= 40 then
    raise exception 'Este profissional recebeu muitos pedidos agora há pouco. Tente de novo em alguns minutos ou chame direto no WhatsApp.';
  end if;

  return new;
end;
$$;

-- O gatilho (nome e ponto de disparo) continua o da 0028; só a função
-- mudou, e `create or replace` já a substituiu acima.


-- ───── 0058_foto_trocada_pela_admin_fica_na_pasta_do_dono.sql ─────
-- --------------------------------------------------------------------
-- A foto que a administração troca ficava guardada na pasta errada.
--
-- As fotos de anúncio são organizadas por dono: `<uid>/<carimbo>.jpg`, e a
-- policy da 0026 confere justamente essa primeira pasta —
-- `(storage.foldername(name))[1] = auth.uid()::text`. É o que impede uma
-- pessoa de sobrescrever a foto de outra.
--
-- O painel administrativo edita o cadastro dos outros, inclusive a foto (é
-- para isso que ele existe: enquadrar direito a foto de quem mandou torta).
-- Como a tela envia o arquivo com o id de quem está logado, a foto de um
-- pedreiro corrigida pela administração ia parar dentro da pasta da
-- administração. Funciona — o bucket é público, o cadastro aponta para a
-- URL e a imagem aparece —, mas guarda o arquivo debaixo do nome errado.
--
-- Isso importa no dia em que a pessoa pedir para sumir. A pasta é a única
-- coisa que liga um arquivo a um dono no Storage: uma limpeza por pasta
-- deixaria para trás exatamente as fotos que passaram pelo painel, e são
-- as das pessoas cujo cadastro alguém já teve que corrigir.
--
-- A tela passa a enviar na pasta do dono do cadastro. Para isso a policy
-- precisa deixar a administração escrever fora da própria pasta — e só ela.
-- --------------------------------------------------------------------
drop policy if exists "fotos de anuncio: envio do admin" on storage.objects;
create policy "fotos de anuncio: envio do admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'professional-photos'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "fotos de anuncio: troca do admin" on storage.objects;
create policy "fotos de anuncio: troca do admin"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'professional-photos'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  )
  with check (
    bucket_id = 'professional-photos'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  );


-- ───── 0059_mais_vistos_da_semana.sql ─────
-- --------------------------------------------------------------------
-- "Em alta em Itabirito": quem foi mais procurado nos últimos dias.
--
-- A tela inicial passou a mostrar gente antes de a pessoa pedir — em vez
-- de só oferecer categorias e esperar. Para isso precisa de uma ordem que
-- signifique alguma coisa, e a que existe hoje não serve: nota alta com uma
-- avaliação só não diz nada, e "mais recente" é o oposto de popular.
--
-- Quem foi visto é o sinal honesto disponível: não depende de ninguém
-- escrever avaliação, e acompanha o que a cidade está de fato procurando
-- nesta semana.
--
-- O problema é que `profile_views` não é pública, e por bons motivos. A
-- 0012 restringiu a leitura ao dono de cada cadastro, e a 0042 explicou por
-- quê ao criar `contagem_de_visitas()`: o total somado da cidade não é o
-- mesmo dado que a linha individual, mesmo saindo da mesma tabela.
--
-- Esta função segue o mesmo raciocínio, com três cuidados:
--
-- 1. **Devolve a ordem, não os números.** Nenhuma contagem sai daqui. Dizer
--    "fulano teve 47 visitas" entregaria de graça exatamente o número que o
--    Empresa Plus vende, e contaria ao concorrente da rua de baixo quanto
--    movimento cada um tem. A tela precisa saber quem vem primeiro; não
--    precisa saber por quanto.
--
-- 2. **Junta com `professionals_public`**, que já esconde suspenso e
--    pausado (0053). Sem essa junção, um cadastro tirado do ar pela
--    administração reapareceria em destaque na primeira tela do app — o
--    lugar mais visível que existe.
--
-- 3. **Exige um mínimo de acessos.** Com um acesso só, "em alta" é mentira.
--    Numa cidade pequena, sem esse piso, a prateleira viraria uma lista
--    aleatória de quem teve uma visita solta — e uma tela que promete
--    movimento e entrega acaso é pior que uma tela sem a prateleira.
-- --------------------------------------------------------------------
create or replace function public.mais_vistos(dias int default 7, quantos int default 12)
returns table (professional_id uuid)
language sql
stable
security definer set search_path = public
as $$
  select v.professional_id
    from public.profile_views v
    join public.professionals_public p on p.id = v.professional_id
   where v.viewed_at > now() - make_interval(days => dias)
   group by v.professional_id
  having count(*) >= 3
   order by count(*) desc, v.professional_id
   limit quantos;
$$;

grant execute on function public.mais_vistos(int, int) to anon, authenticated;

-- Índice pelo que a função filtra e agrupa. Sem ele, a consulta varre a
-- tabela de visitas inteira — que é a que mais cresce no banco — a cada
-- abertura da tela inicial, que é a tela mais aberta do app.
create index if not exists profile_views_recentes_idx
  on public.profile_views (viewed_at desc, professional_id);


-- ───── 0060_cidade_ganha_estado.sql ─────
-- --------------------------------------------------------------------
-- Cidade passa a ter estado, porque o procurô vai para o Brasil inteiro.
--
-- Até aqui o app atendia quatro cidades, todas em Minas, e `city` sozinho
-- bastava. Nacionalmente ele deixa de bastar — e o modo como deixa é
-- silencioso, que é o que torna isto urgente.
--
-- Existem 5.570 municípios no Brasil e centenas de nomes repetidos. Há
-- "Bom Jesus" em mais de vinte estados; há "Santa Maria", "Bela Vista",
-- "Boa Vista", "Santa Luzia" espalhadas pelo país. Sem o estado, o
-- eletricista de Bom Jesus/PI e o de Bom Jesus/RS caem na mesma busca, e
-- quem procura recebe o telefone de alguém a dois mil quilômetros. Não dá
-- erro em lugar nenhum: a lista vem, com gente dentro.
--
-- Esta é a razão de a coluna entrar AGORA e não quando doer. Depois de
-- existirem cadastros de várias cidades sem estado, não há como descobrir
-- de qual "Bom Jesus" cada um é — só perguntando a cada pessoa, uma por
-- uma.
--
-- O `default 'MG'` preenche os cadastros que já existem (as quatro cidades
-- atendidas até hoje são todas mineiras) e sai logo em seguida: com o app
-- aberto ao país, um estado presumido é exatamente o erro que esta
-- migration existe para impedir. Sem default e com `not null`, um cadastro
-- que chegue sem estado é recusado na hora, em vez de entrar como mineiro.
-- --------------------------------------------------------------------

alter table public.professionals
  add column if not exists uf text not null default 'MG';

alter table public.professionals
  alter column uf drop default;

-- Só as 27 siglas existentes, em maiúsculas. Um "mg" minúsculo ou um "MGG"
-- digitado errado viram uma cidade paralela que ninguém encontra.
alter table public.professionals
  drop constraint if exists professionals_uf_valida;
alter table public.professionals
  add constraint professionals_uf_valida check (uf in (
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
    'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
  ));

-- A busca filtra por cidade e estado juntos; o índice acompanha o par.
create index if not exists professionals_cidade_estado_idx
  on public.professionals (uf, city);

-- --------------------------------------------------------------------
-- A view pública precisa devolver a coluna nova.
--
-- ATENÇÃO ao recriar esta view: o `where` no fim é obrigatório e já foi
-- perdido uma vez. View no Postgres roda com os privilégios de quem a
-- criou, então ela passa por cima da RLS da tabela — o filtro de suspenso
-- e pausado precisa estar escrito aqui dentro. A 0049 recriou a view
-- copiando as colunas e deixando o `where` para trás, e durante semanas
-- cadastro suspenso pela administração continuou aparecendo na busca,
-- junto com a anotação interna que motivou a suspensão.
-- --------------------------------------------------------------------
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
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

comment on column public.professionals.uf is
  'Sigla do estado, sempre em maiúsculas. Vem junto com a cidade — separá-las faz "Bom Jesus" de estados diferentes virarem a mesma busca.';


-- ───── 0062_teto_de_linhas_cpf_e_view.sql ─────
-- 0062 — quatro pendências da auditoria, num arquivo só.

-- ── 1. Ninguém baixa a lista inteira de telefones ──────────────────────
-- A busca é pública de propósito, e isso está certo. O problema não é ver
-- UM telefone: é poder pedir TODOS de uma vez. A lista pública devolve
-- nome, telefone, WhatsApp e e-mail, e não havia teto — um único pedido
-- bem escrito baixava a base inteira de contatos, que é o ativo do app.
--
-- 200 é folgado para a tela (a busca pede 24 por vez) e curto para quem
-- quer levar tudo.
alter role anon set pgrst.db_max_rows = '200';
alter role authenticated set pgrst.db_max_rows = '200';

-- ── 2. A anotação da suspensão sai da lista pública ────────────────────
-- Hoje é inofensiva, porque a view só devolve quem NÃO está suspenso. Mas
-- é uma coluna que não tem por que estar ali, e já vazou uma vez: quando
-- o `where` se perdeu numa alteração, cadastros suspensos voltaram à busca
-- levando junto o motivo interno da suspensão.
--
-- ATENÇÃO ao recriar esta view: o `where` do fim é obrigatório.
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
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

-- ── 3. O CPF sai do banco ──────────────────────────────────────────────
-- Deixou de ser pedido na 0033 e a coluna ficou "para não apagar dado de
-- quem já preencheu". Guardar dado sem finalidade atual é o problema, não
-- a solução. A função que gravava nela já saiu do código.
alter table public.profiles drop column if exists cpf;

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema: aquele filtra por
-- privilégio do papel corrente e já respondeu "não existe" cinco vezes
-- para uma coluna que existia.
select
  case when (select count(*) from pg_attribute
              where attrelid = 'public.profiles'::regclass
                and attname = 'cpf' and not attisdropped) = 0
       and (select count(*) from pg_attribute
              where attrelid = 'public.professionals_public'::regclass
                and attname = 'suspended_reason' and not attisdropped) = 0
       and (select count(*) from pg_attribute
              where attrelid = 'public.professionals_public'::regclass
                and attname = 'uf' and not attisdropped) = 1
  then 'PRONTO — teto de linhas, cpf apagado, motivo da suspensao fora da lista'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;


-- ───── 0063_limpeza_agendada.sql ─────
-- ── 4. A limpeza de dados antigos passa a rodar ────────────────────────
-- A função existe desde a 0028 e a linha que a agendaria estava
-- comentada — ou seja, nada nunca foi apagado. "Guardar só pelo tempo
-- necessário" é princípio da LGPD, e a função foi escrita para isso.
create extension if not exists pg_cron;

select cron.unschedule('expurgo-diario')
 where exists (select 1 from cron.job where jobname = 'expurgo-diario');

select cron.schedule('expurgo-diario', '0 7 * * *', 'select public.expurgar_dados_antigos()');

-- ── Confere a si mesma ─────────────────────────────────────────────────
select case when (select count(*) from cron.job where jobname = 'expurgo-diario') = 1
  then 'PRONTO — a limpeza de dados antigos passa a rodar todo dia'
  else 'AINDA FALTA — o agendamento nao foi criado'
  end as resultado;


-- ───── 0064_perfil_com_email_e_telefone.sql ─────
-- 0064 — o perfil ganha e-mail e telefone próprios.
--
-- Até aqui `profiles` guardava só nome e foto, e isso bastava porque a
-- única porta de entrada era o Google: ele entrega nome, foto e e-mail
-- junto com a conta, e o e-mail ficava em `auth.users`.
--
-- Com o login por telefone, duas coisas mudaram. Quem entra pelo número
-- não tem e-mail nenhum em `auth.users` — e quem entra pelo Google não tem
-- telefone. Cada porta traz metade do contato, e a outra metade não existe
-- em lugar nenhum.
--
-- Por que colunas próprias, e não mexer em `auth.users`: lá o e-mail é
-- CREDENCIAL, não contato. Trocá-lo dispara confirmação por link, que é um
-- fluxo inteiro — e um link de confirmação não volta para dentro do app
-- instalado, que é o mesmo problema que tirou o login do Google de lá.
-- Aqui são dados de contato, e nada mais.

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;

-- Preenche quem já existe, com o que a conta de login já sabe. Sem isto,
-- todo mundo que já usa o app apareceria com o perfil "incompleto" e seria
-- mandado preencher o que o sistema já tinha.
update public.profiles p
   set email = coalesce(p.email, u.email),
       phone = coalesce(p.phone, u.phone)
  from auth.users u
 where u.id = p.id
   and (p.email is null or p.phone is null);

-- E as contas novas passam a nascer com o que a porta de entrada trouxe.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    new.email,
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- --------------------------------------------------------------------
-- Confere a si mesma. Lê o pg_catalog, nunca o information_schema.
-- --------------------------------------------------------------------
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.profiles'::regclass
           and attname in ('email','phone') and not attisdropped) = 2
  then 'PRONTO — o perfil ja tem e-mail e telefone'
  else 'AINDA FALTA — as colunas nao foram criadas'
  end as resultado;


-- ───── 0065_user_onboarding.sql ─────
-- 0065 — rastreamento de tipo de usuário e conclusão do onboarding.
--
-- O procurô serve dois tipos de usuário: profissionais (prestadores de
-- serviço) e empresas (contratantes). Ao entrar, a pessoa escolhe qual é,
-- e o app marca essa escolha e o status de conclusão do onboarding.
--
-- Este registro permite ao app saber: foi ou não foi escolhido tipo?
-- Já preencheu o formulário de cadastro? E quando.

create table if not exists public.user_onboarding (
  user_id uuid primary key references auth.users on delete cascade,
  user_type text not null check (user_type in ('professional', 'company')),
  completed boolean default false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Permite que o usuário logado leia e escreva apenas seu próprio registro.
alter table public.user_onboarding enable row level security;

create policy "Usuário lê seu próprio onboarding" on public.user_onboarding
  for select using (auth.uid() = user_id);

create policy "Usuário escreve seu próprio onboarding" on public.user_onboarding
  for insert with check (auth.uid() = user_id);

create policy "Usuário atualiza seu próprio onboarding" on public.user_onboarding
  for update using (auth.uid() = user_id);

-- Index para buscar tipo de usuário rapidamente.
create index if not exists idx_user_onboarding_type on public.user_onboarding(user_id, user_type);

-- Trigger para atualizar updated_at automaticamente.
create or replace function update_user_onboarding_timestamp()
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

create or replace trigger update_user_onboarding_timestamp_trigger
  before update on public.user_onboarding
  for each row
  execute function update_user_onboarding_timestamp();

-- Confere a si mesma.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.user_onboarding'::regclass
           and attname in ('user_id', 'user_type', 'completed', 'completed_at')
           and not attisdropped) = 4
  then 'PRONTO — user_onboarding foi criada com todas as colunas'
  else 'AINDA FALTA — as colunas nao foram criadas'
  end as resultado;


-- ───── 0066_companies.sql ─────
-- 0066 — tabela de empresas (contratantes).
--
-- Empresas são os usuários que publicam vagas de trabalho. Cada empresa
-- pertence a um usuário (owner_id) e guarda informações de razão social,
-- CNPJ, contato, localização e descrição.
--
-- Usa upsert com onConflict em owner_id porque cada usuário/empresa tem
-- apenas um cadastro — você não cria uma empresa nova, você atualiza a sua.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users on delete cascade,
  company_name text not null,
  cnpj text,
  city text not null,
  uf text,
  neighborhood text,
  address text,
  phone text not null,
  email text,
  website text,
  photo_url text,
  responsible_name text not null,
  description text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Permite que o dono da empresa leia e escreva seu próprio cadastro.
alter table public.companies enable row level security;

create policy "Empresa lê seu próprio cadastro" on public.companies
  for select using (auth.uid() = owner_id);

create policy "Empresa escreve seu próprio cadastro" on public.companies
  for insert with check (auth.uid() = owner_id);

create policy "Empresa atualiza seu próprio cadastro" on public.companies
  for update using (auth.uid() = owner_id);

-- Index para buscar empresa por dono.
create index if not exists idx_companies_owner on public.companies(owner_id);

-- Index para buscar empresa por cidade (usado nas buscas).
create index if not exists idx_companies_city on public.companies(city);

-- Trigger para atualizar updated_at.
create or replace function update_companies_timestamp()
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

create or replace trigger update_companies_timestamp_trigger
  before update on public.companies
  for each row
  execute function update_companies_timestamp();

-- Confere a si mesma.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.companies'::regclass
           and attname in ('id', 'owner_id', 'company_name', 'cnpj', 'city', 'uf',
                          'neighborhood', 'address', 'phone', 'email', 'website',
                          'photo_url', 'responsible_name', 'description', 'created_at', 'updated_at')
           and not attisdropped) = 16
  then 'PRONTO — companies foi criada com todas as colunas'
  else 'AINDA FALTA — as colunas nao foram criadas'
  end as resultado;


-- ───── 0067_job_listings.sql ─────
-- 0067 — tabela de vagas de trabalho.
--
-- Cada vaga pertence a uma empresa (company_id) e tem informações de
-- título, profissão, descrição, salário, modalidade de trabalho (presencial/
-- remoto/híbrido), requisitos de experiência, se está disponível para contratar
-- imediatamente, e localização.
--
-- A vaga passa pelos estados: active (aberta) e closed (fechada). Uma vaga
-- fechada pode ser reaberta — closed_at registra quando foi fechada.

create table if not exists public.job_listings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  title text not null,
  profession text not null,
  specialty text,
  description text not null,
  required_experience text,
  skills text[],
  work_modality text not null check (work_modality in ('presencial', 'remoto', 'hibrido')),
  available_immediately boolean default false,
  salary_range_min numeric,
  salary_range_max numeric,
  city text not null,
  uf text,
  neighborhood text,
  -- Sem raio em quilômetros, de propósito: o cadastro de profissional não
  -- guarda latitude nem longitude (só bairro, CEP, cidade e estado), então
  -- distância não é conta que este banco saiba fazer. A coluna existiu numa
  -- versão anterior deste arquivo e nenhuma consulta poderia usá-la.
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamp with time zone default now(),
  closed_at timestamp with time zone,
  updated_at timestamp with time zone default now()
);

-- RLS: qualquer um vê a vaga ativa; o dono vê sua própria vaga em qualquer estado.
alter table public.job_listings enable row level security;

create policy "Qualquer um lê vaga ativa" on public.job_listings
  for select using (status = 'active' or auth.uid() = (select owner_id from public.companies where id = company_id));

create policy "Empresa escreve vaga própria" on public.job_listings
  for insert with check (auth.uid() = (select owner_id from public.companies where id = company_id));

create policy "Empresa atualiza vaga própria" on public.job_listings
  for update using (auth.uid() = (select owner_id from public.companies where id = company_id));

-- Indexes para buscas comuns.
create index if not exists idx_job_listings_company on public.job_listings(company_id);
create index if not exists idx_job_listings_status on public.job_listings(status);
create index if not exists idx_job_listings_city on public.job_listings(city);
create index if not exists idx_job_listings_profession on public.job_listings(profession);
create index if not exists idx_job_listings_created on public.job_listings(created_at desc);

-- Trigger para atualizar updated_at.
create or replace function update_job_listings_timestamp()
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

create or replace trigger update_job_listings_timestamp_trigger
  before update on public.job_listings
  for each row
  execute function update_job_listings_timestamp();

-- Confere a si mesma.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.job_listings'::regclass
           and attname in ('id', 'company_id', 'title', 'profession', 'specialty',
                          'description', 'required_experience', 'skills', 'work_modality',
                          'available_immediately', 'salary_range_min', 'salary_range_max',
                          'city', 'uf', 'neighborhood', 'status',
                          'created_at', 'closed_at', 'updated_at')
           and not attisdropped) = 19
  then 'PRONTO — job_listings foi criada com todas as colunas'
  else 'AINDA FALTA — as colunas nao foram criadas'
  end as resultado;


-- ───── 0068_job_dispatches.sql ─────
-- 0068 — tabela de ondas de disparo (job_dispatches).
--
-- A vaga não vai para todo mundo de uma vez. Ela abre em três ondas, do
-- encaixe mais exato para o mais largo, e QUEM ABRE É A EMPRESA, num botão
-- na tela da vaga. Não há disparo automático, nem agendamento, nem cron:
-- enquanto a empresa não pedir, ninguém mais é avisado.
--
-- Onda 1 — quem é exatamente isso
--          `categories` contém a profissão E a especialidade bate.
-- Onda 2 — quem faz esse serviço
--          `categories` contém a profissão, qualquer especialidade.
-- Onda 3 — quem faz coisa do mesmo ramo
--          `categories` cruza com o grupo da profissão (ver
--          GRUPOS_DE_SERVICOS em src/types/domain.ts). Vaga de pedreiro
--          alcança "Casa e obra"; não alcança manicure.
--
-- Duas coisas que a versão anterior deste arquivo errava, e que estão aqui
-- para não voltarem:
--
-- 1. As ondas abriam por DISTÂNCIA. O cadastro de profissional não tem
--    latitude nem longitude — só bairro, CEP, cidade e estado —, então a
--    ordenação por quilômetro nunca poderia ser escrita. E Itabirito
--    inteira se atravessa em dez minutos: ordenar por proximidade aqui é
--    ordenar por ruído.
--
-- 2. A onda 3 era "todo mundo da cidade". Mandava vaga de pedreiro para
--    manicure — uma vez cada, e a pessoa silencia o app. Aí a vaga
--    seguinte, a que era mesmo dela, não chega mais. Alargar até o ramo é
--    o limite: passou disso, o aviso deixa de valer para todo mundo.
--
-- Cada onda aberta vira um registro aqui, com quantas pessoas alcançou e
-- quando. O `unique (job_listing_id, wave)` é o que garante que uma onda
-- abra uma vez só — dois toques no botão não avisam ninguém duas vezes.

create table if not exists public.job_dispatches (
  id uuid primary key default gen_random_uuid(),
  job_listing_id uuid not null references public.job_listings on delete cascade,
  wave integer not null check (wave in (1, 2, 3)),
  professionals_count integer default 0,
  sent_at timestamp with time zone default now(),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (job_listing_id, wave)
);

-- RLS: usuário vê ondas de suas próprias vagas.
alter table public.job_dispatches enable row level security;

create policy "Lê ondas de suas vagas" on public.job_dispatches
  for select using (
    exists (
      select 1 from public.job_listings
      where id = job_listing_id
        and company_id = (select id from public.companies where owner_id = auth.uid())
    )
  );

create policy "Insere ondas em suas vagas" on public.job_dispatches
  for insert with check (
    exists (
      select 1 from public.job_listings
      where id = job_listing_id
        and company_id = (select id from public.companies where owner_id = auth.uid())
    )
  );

create policy "Atualiza ondas de suas vagas" on public.job_dispatches
  for update using (
    exists (
      select 1 from public.job_listings
      where id = job_listing_id
        and company_id = (select id from public.companies where owner_id = auth.uid())
    )
  );

-- Indexes para buscas.
create index if not exists idx_job_dispatches_job on public.job_dispatches(job_listing_id);
create index if not exists idx_job_dispatches_wave on public.job_dispatches(job_listing_id, wave);
create index if not exists idx_job_dispatches_sent on public.job_dispatches(sent_at desc);

-- Trigger para atualizar updated_at.
create or replace function update_job_dispatches_timestamp()
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

create or replace trigger update_job_dispatches_timestamp_trigger
  before update on public.job_dispatches
  for each row
  execute function update_job_dispatches_timestamp();

-- Confere a si mesma.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.job_dispatches'::regclass
           and attname in ('id', 'job_listing_id', 'wave', 'professionals_count',
                          'sent_at', 'status', 'created_at', 'updated_at')
           and not attisdropped) = 8
  then 'PRONTO — job_dispatches foi criada com todas as colunas'
  else 'AINDA FALTA — as colunas nao foram criadas'
  end as resultado;


select 'PARTE 5 de 7 PRONTA' as resultado;
