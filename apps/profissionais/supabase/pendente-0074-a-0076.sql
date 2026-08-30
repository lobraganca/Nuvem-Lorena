-- Ei Itabirito — migrations 0074 a 0076, na ordem.
--
-- GERADO por scripts/gerar-sql-pendente.mjs. Não edite à mão.
--
-- Para um banco que JÁ EXISTE. Cole tudo no SQL Editor do Supabase e rode
-- uma vez só. São 3 migrations; a ordem importa, porque
-- várias recriam a mesma view acrescentando uma coluna de cada vez.
--
-- Rodar de novo é seguro: tudo aqui usa "if not exists" / "or replace" /
-- "drop ... if exists". O que não é seguro é rodar fora de ordem.

-- ══════════════════════════════════════════════════════════════════
-- 0074_aviso_por_push.sql
-- ══════════════════════════════════════════════════════════════════

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


-- ══════════════════════════════════════════════════════════════════
-- 0075_disponivel_e_cursos.sql
-- ══════════════════════════════════════════════════════════════════

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


-- ══════════════════════════════════════════════════════════════════
-- 0076_telefone_confirmado_e_obrigatorio.sql
-- ══════════════════════════════════════════════════════════════════

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
