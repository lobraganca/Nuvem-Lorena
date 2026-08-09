-- Busca Itabirito — banco completo, para montar o projeto do zero.
--
-- GERADO AUTOMATICAMENTE por scripts/gerar-sql-unico.mjs. Não edite à mão:
-- edite a migration correspondente em supabase/migrations/ e rode de novo
-- `npm run sql:unico`.
--
-- Como usar: abra o SQL Editor do seu projeto no Supabase, cole este arquivo
-- inteiro e rode uma vez. São 34 migrations, já na ordem certa.
--
-- Rodar de novo num banco que já tem os dados é seguro na maior parte (quase
-- tudo usa "if not exists" / "or replace"), mas não é o uso pretendido: para
-- um banco que já existe, aplique só a migration nova.


-- ═══════════════════════════════════════════════════════════════
-- 0001_esquema.sql
-- ═══════════════════════════════════════════════════════════════

-- Busca Itabirito — esquema inicial do marketplace de profissionais.
-- Independente do banco do Avena: este projeto Supabase é próprio deste app.

create extension if not exists "pgcrypto";

-- Perfil público de cada usuário autenticado (espelha auth.users).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Cria/atualiza o profile automaticamente quando alguém faz login pela
-- primeira vez (inclusive via Google OAuth).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profissionais anunciados na plataforma.
create table if not exists public.professionals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  category text not null,
  city text not null default 'Itabirito',
  bio text not null default '',
  phone text not null default '',
  verified boolean not null default false,
  verified_until timestamptz,
  boosted boolean not null default false,
  boosted_until timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists professionals_city_idx on public.professionals (city);
create index if not exists professionals_category_idx on public.professionals (category);
create index if not exists professionals_owner_idx on public.professionals (owner_id);

-- Avaliações de usuários sobre profissionais.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  unique (professional_id, user_id)
);

create index if not exists reviews_professional_idx on public.reviews (professional_id);

-- Assinaturas pagas: selo de verificação (R$10,90/mês) ou anúncio turbinado.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  type text not null check (type in ('verification', 'boost')),
  mercadopago_subscription_id text,
  status text not null default 'pending'
    check (status in ('pending', 'authorized', 'active', 'paused', 'cancelled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_professional_idx on public.subscriptions (professional_id);
create index if not exists subscriptions_mp_idx on public.subscriptions (mercadopago_subscription_id);

-- View auxiliar: média e contagem de avaliações por profissional.
create or replace view public.professional_ratings as
select
  professional_id,
  round(avg(rating)::numeric, 2) as average_rating,
  count(*) as review_count
from public.reviews
group by professional_id;

-- ═══════════════════════════════════════════════════════════════
-- 0002_seguranca.sql
-- ═══════════════════════════════════════════════════════════════

-- Regras de RLS — leitura pública, escrita restrita ao dono/usuário autenticado.

alter table public.profiles enable row level security;
alter table public.professionals enable row level security;
alter table public.reviews enable row level security;
alter table public.subscriptions enable row level security;

-- profiles: qualquer um lê (nome/avatar são públicos), só o dono edita o seu.
drop policy if exists "profiles são públicos para leitura" on public.profiles;
create policy "profiles são públicos para leitura"
  on public.profiles for select
  using (true);

drop policy if exists "usuário edita o próprio profile" on public.profiles;
create policy "usuário edita o próprio profile"
  on public.profiles for update
  using (auth.uid() = id);

-- professionals: leitura pública (é um marketplace de busca); só o dono
-- autenticado cria/edita/apaga o seu próprio anúncio.
drop policy if exists "profissionais são públicos para leitura" on public.professionals;
create policy "profissionais são públicos para leitura"
  on public.professionals for select
  using (true);

drop policy if exists "usuário cria seu próprio anúncio" on public.professionals;
create policy "usuário cria seu próprio anúncio"
  on public.professionals for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "dono edita o próprio anúncio" on public.professionals;
create policy "dono edita o próprio anúncio"
  on public.professionals for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "dono apaga o próprio anúncio" on public.professionals;
create policy "dono apaga o próprio anúncio"
  on public.professionals for delete
  to authenticated
  using (auth.uid() = owner_id);

-- reviews: leitura pública; só usuário autenticado cria a sua própria
-- avaliação (um review por usuário por profissional, ver unique no schema);
-- só o autor edita/apaga a própria avaliação.
drop policy if exists "avaliações são públicas para leitura" on public.reviews;
create policy "avaliações são públicas para leitura"
  on public.reviews for select
  using (true);

drop policy if exists "usuário autenticado avalia" on public.reviews;
create policy "usuário autenticado avalia"
  on public.reviews for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "autor edita a própria avaliação" on public.reviews;
create policy "autor edita a própria avaliação"
  on public.reviews for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "autor apaga a própria avaliação" on public.reviews;
create policy "autor apaga a própria avaliação"
  on public.reviews for delete
  to authenticated
  using (auth.uid() = user_id);

-- subscriptions: só o dono do profissional enxerga/gerencia as assinaturas
-- dele. Escritas de confirmação de pagamento (marcar active/verified/boosted)
-- são feitas pela Edge Function do webhook usando a service_role key, que
-- ignora RLS — por isso não existe policy pública de update aqui.
drop policy if exists "dono vê as assinaturas do seu anúncio" on public.subscriptions;
create policy "dono vê as assinaturas do seu anúncio"
  on public.subscriptions for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = subscriptions.professional_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "dono inicia assinatura para o seu anúncio" on public.subscriptions;
create policy "dono inicia assinatura para o seu anúncio"
  on public.subscriptions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = subscriptions.professional_id
        and p.owner_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- 0003_cpf_avaliacao.sql
-- ═══════════════════════════════════════════════════════════════

-- Exige CPF do usuário logado antes de avaliar, para reduzir avaliações
-- falsas/anônimas. O CPF fica salvo uma vez no profile (ligado à conta
-- Google usada no login) e é reaproveitado nas próximas avaliações.

alter table public.profiles
  add column if not exists cpf text;

-- Um CPF só pode estar associado a uma conta.
create unique index if not exists profiles_cpf_key
  on public.profiles (cpf)
  where cpf is not null;

-- ═══════════════════════════════════════════════════════════════
-- 0004_exige_cpf_para_avaliar.sql
-- ═══════════════════════════════════════════════════════════════

-- Reforça no banco (não só na UI) que só usuário com CPF confirmado no
-- profile pode inserir avaliação.

drop policy if exists "usuário autenticado avalia" on public.reviews;

drop policy if exists "usuário autenticado com CPF avalia" on public.reviews;
create policy "usuário autenticado com CPF avalia"
  on public.reviews for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.cpf is not null
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- 0005_pessoa_fisica_juridica.sql
-- ═══════════════════════════════════════════════════════════════

-- Permite que empresas (pessoa jurídica) anunciem, além de profissionais
-- autônomos (pessoa física), no mesmo cadastro/busca. `document` guarda o
-- CPF ou CNPJ do anunciante — dado diferente do CPF de avaliação, que fica
-- em profiles.cpf. `company_name` é a razão social/nome fantasia, só
-- relevante quando entity_type = 'pj'.

alter table public.professionals
  add column if not exists entity_type text not null default 'pf' check (entity_type in ('pf', 'pj'));

alter table public.professionals
  add column if not exists document text;

alter table public.professionals
  add column if not exists company_name text;

-- ═══════════════════════════════════════════════════════════════
-- 0006_foto_e_responsavel.sql
-- ═══════════════════════════════════════════════════════════════

-- Foto do anúncio (foto de rosto para pessoa física, logo para empresa) e
-- nome do responsável pela empresa (obrigatório só quando entity_type = 'pj').
-- `photo_url` guarda a URL pública do arquivo enviado ao bucket de Storage
-- "professional-photos" (ver README.md — bucket criado no painel do
-- Supabase, não dá para criar bucket via migration SQL).

alter table public.professionals
  add column if not exists photo_url text;

alter table public.professionals
  add column if not exists responsible_name text;

-- ═══════════════════════════════════════════════════════════════
-- 0007_denuncias.sql
-- ═══════════════════════════════════════════════════════════════

-- Canal de denúncias de anúncios (perfil falso, golpe, conteúdo ofensivo etc).
-- Leitura fica restrita (sem policy de select pública) — só service_role ou
-- acesso direto ao banco enxerga as denúncias por enquanto; um painel admin
-- para revisão é um próximo passo, não implementado nesta versão (ver README).

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  reporter_id uuid references public.profiles (id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

-- Qualquer um pode denunciar, inclusive sem estar logado (o golpe pode
-- atingir alguém que nem conseguiu logar ainda). Sem policy de select
-- pública de propósito — denúncias não são um dado público.
drop policy if exists "qualquer um pode denunciar um anúncio" on public.reports;
create policy "qualquer um pode denunciar um anúncio"
  on public.reports for insert
  with check (true);

-- ═══════════════════════════════════════════════════════════════
-- 0008_admins.sql
-- ═══════════════════════════════════════════════════════════════

-- Painel administrativo simples: tabela `admins` marca quem pode ver/tratar
-- denúncias (`reports`). O projeto não tem sistema de roles — quem for
-- admin precisa ser inserido manualmente nesta tabela (ver README, seção
-- "Painel administrativo") direto no Supabase, depois do primeiro login.

create table if not exists public.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade
);

alter table public.admins enable row level security;

-- Sem NENHUMA policy pública de select/insert/update/delete de propósito:
-- só service_role ou acesso direto via Supabase Studio mexem nesta tabela.
-- Isso evita que qualquer usuário autenticado se auto-promova a admin.

-- reports: admin pode ler e mudar o status (pending -> reviewed/dismissed).
drop policy if exists "admin vê as denúncias" on public.reports;
create policy "admin vê as denúncias"
  on public.reports for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "admin atualiza o status da denúncia" on public.reports;
create policy "admin atualiza o status da denúncia"
  on public.reports for update
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════
-- 0009_suspensao_e_bloqueio.sql
-- ═══════════════════════════════════════════════════════════════

-- Suspensão de anúncios pelo painel admin (tirar do ar por denúncia
-- procedente ou violação das regras) e bloqueio de documento (CPF/CNPJ)
-- para impedir novo cadastro com o mesmo documento.

alter table public.professionals
  add column if not exists suspended boolean not null default false,
  add column if not exists suspended_reason text;

-- A policy pública de select de professionals passa a excluir suspensos:
-- um anúncio suspenso some da busca e do perfil público. O dono e admins
-- continuam vendo (o dono via policy própria, para entender o que houve;
-- admin via policy própria).
drop policy if exists "profissionais são públicos para leitura" on public.professionals;

drop policy if exists "profissionais não suspensos são públicos para leitura" on public.professionals;
create policy "profissionais não suspensos são públicos para leitura"
  on public.professionals for select
  using (suspended = false);

drop policy if exists "dono vê o próprio anúncio mesmo suspenso" on public.professionals;
create policy "dono vê o próprio anúncio mesmo suspenso"
  on public.professionals for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "admin vê qualquer anúncio, inclusive suspenso" on public.professionals;
create policy "admin vê qualquer anúncio, inclusive suspenso"
  on public.professionals for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

-- admin também precisa poder suspender/reativar (mudar suspended/suspended_reason).
drop policy if exists "admin suspende/reativa anúncios" on public.professionals;
create policy "admin suspende/reativa anúncios"
  on public.professionals for update
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

-- Bloqueio de documento (CPF/CNPJ, só dígitos) para impedir novo cadastro.
create table if not exists public.document_bans (
  document text primary key,
  reason text,
  banned_at timestamptz not null default now()
);

alter table public.document_bans enable row level security;

-- Sem select/insert público de propósito — só quem está em `admins` mexe
-- diretamente na tabela (mesmo padrão de `admins`). A checagem no cadastro
-- é feita via função security definer abaixo, não por select direto.
drop policy if exists "admin vê a lista de documentos bloqueados" on public.document_bans;
create policy "admin vê a lista de documentos bloqueados"
  on public.document_bans for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "admin bloqueia um documento" on public.document_bans;
create policy "admin bloqueia um documento"
  on public.document_bans for insert
  to authenticated
  with check (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "admin desbloqueia um documento" on public.document_bans;
create policy "admin desbloqueia um documento"
  on public.document_bans for delete
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

-- Função security definer: qualquer usuário autenticado pode checar se um
-- documento está bloqueado, sem enxergar a lista inteira de bloqueados
-- (RLS de document_bans continua restrita a admins).
create or replace function public.check_document_banned(doc text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.document_bans where document = doc);
$$;

grant execute on function public.check_document_banned(text) to authenticated, anon;

-- ═══════════════════════════════════════════════════════════════
-- 0010_resposta_favoritos.sql
-- ═══════════════════════════════════════════════════════════════

-- Resposta do profissional à avaliação + favoritos do usuário.

-- Resposta do dono do anúncio a uma avaliação recebida.
alter table public.reviews
  add column if not exists reply text,
  add column if not exists replied_at timestamptz;

-- O dono do anúncio pode atualizar (só) o campo de resposta de reviews do
-- seu profissional. A policy de update já existente ("autor edita a própria
-- avaliação") continua valendo para o autor editar rating/comment; esta é
-- adicional, para o dono responder.
drop policy if exists "dono do anúncio responde a avaliação" on public.reviews;
create policy "dono do anúncio responde a avaliação"
  on public.reviews for update
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = reviews.professional_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = reviews.professional_id
        and p.owner_id = auth.uid()
    )
  );

-- Favoritos: usuário autenticado favorita profissionais para achar depois.
create table if not exists public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, professional_id)
);

create index if not exists favorites_professional_idx on public.favorites (professional_id);

alter table public.favorites enable row level security;

drop policy if exists "usuário vê os próprios favoritos" on public.favorites;
create policy "usuário vê os próprios favoritos"
  on public.favorites for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "usuário favorita um profissional" on public.favorites;
create policy "usuário favorita um profissional"
  on public.favorites for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "usuário remove o próprio favorito" on public.favorites;
create policy "usuário remove o próprio favorito"
  on public.favorites for delete
  to authenticated
  using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- 0011_trigger_reviews_campo_restrito.sql
-- ═══════════════════════════════════════════════════════════════

-- Corrige uma brecha de integridade: a policy de update do dono do anúncio
-- (0010_resposta_favoritos.sql) permite, no papel, atualizar a linha inteira
-- de `reviews` — então hoje nada impede o dono de reescrever `rating`/
-- `comment` de uma avaliação recebida via API direta (só via `reply`, não
-- via UI, mas RLS não protegia isso). E o autor da review, via a policy dele,
-- também poderia em tese setar `reply`/`replied_at` direto.
--
-- RLS decide QUEM pode dar update (policies existentes, mantidas como
-- estão); este trigger decide O QUE cada um pode mudar nessa mesma
-- operação, validando campo a campo.

create or replace function public.reviews_valida_campos_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  eh_autor boolean;
  eh_dono boolean;
begin
  eh_autor := auth.uid() = old.user_id;
  eh_dono := exists (
    select 1 from public.professionals p
    where p.id = old.professional_id
      and p.owner_id = auth.uid()
  );

  if eh_autor then
    -- Autor pode mudar rating/comment, mas não a resposta do dono.
    if new.reply is distinct from old.reply or new.replied_at is distinct from old.replied_at then
      raise exception 'Autor da avaliação não pode alterar a resposta do profissional.';
    end if;
    -- Autor não deve conseguir se auto-declarar dono via update; mantém os
    -- demais campos imutáveis por segurança extra.
    new.professional_id := old.professional_id;
    new.user_id := old.user_id;
  elsif eh_dono then
    -- Dono do anúncio só pode mudar a resposta, nunca a nota/comentário do
    -- autor.
    if new.rating is distinct from old.rating or new.comment is distinct from old.comment then
      raise exception 'Dono do anúncio não pode alterar nota ou comentário da avaliação.';
    end if;
    new.professional_id := old.professional_id;
    new.user_id := old.user_id;
    if new.reply is distinct from old.reply then
      new.replied_at := now();
    end if;
  else
    -- Nem autor nem dono: não deveria nem passar pelas policies de RLS,
    -- mas por segurança em profundidade, barra qualquer mudança.
    raise exception 'Sem permissão para atualizar esta avaliação.';
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_valida_campos_update_trigger on public.reviews;
create trigger reviews_valida_campos_update_trigger
  before update on public.reviews
  for each row execute function public.reviews_valida_campos_update();

-- ═══════════════════════════════════════════════════════════════
-- 0012_views_publicas_sem_documento.sql
-- ═══════════════════════════════════════════════════════════════

-- Fecha exposição de dados sensíveis (LGPD): CPF/CNPJ do anunciante
-- (`professionals.document`) e CPF do avaliador (`profiles.cpf`) hoje vazam
-- para qualquer leitura pública via `select("*")`, porque a policy de select
-- é `using (true)`/`using (suspended = false)` na tabela inteira.
--
-- A partir daqui: leitura pública passa a usar views que omitem essas
-- colunas; a tabela crua só é lida diretamente por quem tem o próprio dado
-- (RLS `auth.uid() = id`/`owner_id`) ou é admin.

-- professionals_public: todas as colunas exceto `document`.
--
-- drop + create, e não `create or replace`: migrations posteriores acrescentam
-- colunas a esta view, e ao re-executar o script do zero o `create or replace`
-- tentaria REMOVER essas colunas — o Postgres recusa. Vale a mesma regra
-- sempre que uma view muda de formato mais adiante.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, city, bio, phone, entity_type,
  company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, created_at
from public.professionals;

grant select on public.professionals_public to anon, authenticated;

-- profiles_public: id, full_name, avatar_url, created_at — sem `cpf`.
create or replace view public.profiles_public as
select id, full_name, avatar_url, created_at
from public.profiles;

grant select on public.profiles_public to anon, authenticated;

-- profiles: a policy pública antiga (`using (true)`) devolvia a linha
-- inteira, inclusive `cpf`. Troca por uma policy que só permite ao próprio
-- dono ler a própria linha via select direto na tabela; leitura de
-- nome/avatar de outros usuários passa a ser feita via `profiles_public`.
drop policy if exists "profiles são públicos para leitura" on public.profiles;

drop policy if exists "usuário lê o próprio profile" on public.profiles;
create policy "usuário lê o próprio profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- ═══════════════════════════════════════════════════════════════
-- 0013_rate_limit_denuncias.sql
-- ═══════════════════════════════════════════════════════════════

-- Rate limit / anti-abuso simples em denúncias (reports).

-- Fingerprint opcional do denunciante anônimo (best-effort, não é segurança
-- forte — ver README). Usado só como sinal auxiliar, nunca como chave única
-- (fácil de forjar/trocar).
alter table public.reports
  add column if not exists reporter_fingerprint text;

-- Para denunciantes logados: no máximo uma denúncia em aberto (pending) por
-- profissional. Índice único parcial em vez de constraint simples porque só
-- queremos travar enquanto a denúncia está pendente — se for revisada/
-- descartada, o mesmo usuário pode denunciar de novo depois (ex: reincidência).
create unique index if not exists reports_reporter_professional_pending_uidx
  on public.reports (professional_id, reporter_id)
  where reporter_id is not null and status = 'pending';

-- ═══════════════════════════════════════════════════════════════
-- 0014_pay_per_lead.sql
-- ═══════════════════════════════════════════════════════════════

-- Fonte de renda: pagamento por contato (pay-per-lead), alternativa à
-- assinatura fixa do selo. O dono do anúncio escolhe, por profissional,
-- entre "whatsapp_livre" (grátis, ilimitado — comportamento atual) e
-- "pay_per_lead" (cada clique no WhatsApp consome 1 crédito pré-pago).

alter table public.professionals
  add column if not exists contact_mode text not null default 'whatsapp_livre'
    check (contact_mode in ('whatsapp_livre', 'pay_per_lead'));

-- Saldo de créditos pré-pagos por profissional. Preço por lead configurável
-- por linha para permitir promoções futuras sem migração nova; hoje sempre
-- criado com o preço padrão (R$2,90 = 290 centavos).
create table if not exists public.lead_credits (
  professional_id uuid primary key references public.professionals(id) on delete cascade,
  balance integer not null default 0,
  price_per_lead_cents integer not null default 290,
  updated_at timestamptz not null default now()
);

-- Um registro por clique no WhatsApp que consumiu (ou tentou consumir) um
-- crédito. `charged` fica true quando o crédito foi de fato debitado —
-- mantido para permitir, no futuro, registrar tentativas sem saldo.
create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  charged boolean not null default true
);

create index if not exists lead_events_professional_id_idx on public.lead_events (professional_id);

alter table public.lead_credits enable row level security;
alter table public.lead_events enable row level security;

-- lead_credits: só o dono do anúncio vê o próprio saldo. Não há insert/update
-- público — o saldo é criado/incrementado pela Edge Function de compra de
-- créditos (service_role) e decrementado pela função `consume_lead_credit`
-- abaixo (security definer, chamada via RPC pelo próprio dono do contato).
drop policy if exists "dono vê os créditos do seu anúncio" on public.lead_credits;
create policy "dono vê os créditos do seu anúncio"
  on public.lead_credits for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = lead_credits.professional_id
        and p.owner_id = auth.uid()
    )
  );

-- lead_events: só o dono do anúncio vê os próprios leads. Insert é feito
-- exclusivamente pela função `consume_lead_credit` (security definer), não
-- há policy pública de insert.
drop policy if exists "dono vê os leads do seu anúncio" on public.lead_events;
create policy "dono vê os leads do seu anúncio"
  on public.lead_events for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = lead_events.professional_id
        and p.owner_id = auth.uid()
    )
  );

-- Consome 1 crédito do profissional de forma atômica (evita condição de
-- corrida indo a saldo negativo com cliques concorrentes). Retorna true se
-- conseguiu debitar, false se não havia saldo (ou não existe registro de
-- créditos ainda). Chamada via RPC pelo client, autenticado ou anônimo,
-- antes de abrir o link do WhatsApp quando `contact_mode = 'pay_per_lead'`.
create or replace function public.consume_lead_credit(professional_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rows integer;
begin
  update public.lead_credits
    set balance = balance - 1, updated_at = now()
    where lead_credits.professional_id = consume_lead_credit.professional_id
      and balance > 0;

  get diagnostics updated_rows = row_count;

  if updated_rows > 0 then
    insert into public.lead_events (professional_id, user_id, charged)
    values (consume_lead_credit.professional_id, auth.uid(), true);
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.consume_lead_credit(uuid) to anon, authenticated;

-- Atualiza a view pública de professionals para incluir o novo contact_mode
-- (necessário para a ProfessionalPage decidir se mostra/esconde o botão de
-- WhatsApp sem precisar de outra query).
-- `create or replace view` só consegue ACRESCENTAR coluna no fim: inserir
-- `contact_mode` antes de `created_at` faria o Postgres tentar renomear a
-- coluna existente, e ele recusa. Por isso drop + create.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, city, bio, phone, entity_type,
  company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode, created_at
from public.professionals;

grant select on public.professionals_public to anon, authenticated;

-- Saldo de créditos pré-pagos é público-legível de forma restrita: a
-- ProfessionalPage precisa saber se há saldo > 0 para habilitar o botão de
-- WhatsApp, sem expor o saldo exato nem o preço por lead a qualquer um.
create or replace view public.lead_credits_public as
select professional_id, (balance > 0) as has_balance
from public.lead_credits;

grant select on public.lead_credits_public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 0015_patrocinio_categoria.sql
-- ═══════════════════════════════════════════════════════════════

-- Fonte de renda: banner de categoria patrocinada. Um profissional paga
-- para aparecer em destaque no topo da busca quando alguém filtra por uma
-- categoria (e cidade) específica, por um período determinado.

create table if not exists public.category_sponsorships (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  category text not null,
  city text not null default 'Itabirito',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  mercadopago_payment_id text,
  status text not null default 'pending' check (status in ('pending', 'active', 'expired')),
  created_at timestamptz not null default now()
);

create index if not exists category_sponsorships_lookup_idx
  on public.category_sponsorships (category, city, status, ends_at);

alter table public.category_sponsorships enable row level security;

-- Leitura pública só de patrocínios ativos e ainda dentro do período — é o
-- que a HomePage consulta para decidir se mostra o banner.
drop policy if exists "patrocínios ativos são públicos para leitura" on public.category_sponsorships;
create policy "patrocínios ativos são públicos para leitura"
  on public.category_sponsorships for select
  using (status = 'active' and ends_at > now());

-- Dono do anúncio vê todos os próprios patrocínios (inclusive
-- pending/expired, para o painel mostrar o histórico).
drop policy if exists "dono vê os próprios patrocínios" on public.category_sponsorships;
create policy "dono vê os próprios patrocínios"
  on public.category_sponsorships for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = category_sponsorships.professional_id
        and p.owner_id = auth.uid()
    )
  );

-- Dono inicia o patrocínio do próprio anúncio (fica "pending" até a
-- confirmação de pagamento, seguindo o mesmo padrão esqueleto do webhook).
drop policy if exists "dono cria patrocínio para o próprio anúncio" on public.category_sponsorships;
create policy "dono cria patrocínio para o próprio anúncio"
  on public.category_sponsorships for insert
  to authenticated
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = category_sponsorships.professional_id
        and p.owner_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- 0016_empresa_plus.sql
-- ═══════════════════════════════════════════════════════════════

-- Fonte de renda: plano "Empresa Plus" (assinatura recorrente adicional,
-- só disponível para entity_type = 'pj') que dá acesso a uma tela de
-- estatísticas do próprio anúncio (visualizações de perfil, leads,
-- avaliações). Mesmo padrão de expiração de verified/boosted.

alter table public.professionals
  add column if not exists plus_active boolean not null default false,
  add column if not exists plus_until timestamptz;

-- subscriptions.type só aceitava 'verification'/'boost' — amplia para o
-- novo tipo de assinatura recorrente do Plus.
alter table public.subscriptions drop constraint if exists subscriptions_type_check;
alter table public.subscriptions add constraint subscriptions_type_check check (type in ('verification', 'boost', 'plus'));

-- Contagem de visualizações de perfil, sem dados pessoais — só o registro
-- de "alguém abriu esta página" para alimentar o analytics do Plus.
create table if not exists public.profile_views (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists profile_views_professional_id_idx on public.profile_views (professional_id);

alter table public.profile_views enable row level security;

-- Só o dono do anúncio lê as próprias visualizações (é o dado que alimenta
-- a tela de analytics do Plus).
drop policy if exists "dono vê as visualizações do próprio anúncio" on public.profile_views;
create policy "dono vê as visualizações do próprio anúncio"
  on public.profile_views for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = profile_views.professional_id
        and p.owner_id = auth.uid()
    )
  );

-- Insert é público (qualquer visita à página do profissional gera o
-- registro, inclusive sem login) — é só uma contagem, sem vínculo com
-- usuário.
drop policy if exists "qualquer visita registra uma visualização" on public.profile_views;
create policy "qualquer visita registra uma visualização"
  on public.profile_views for insert
  with check (true);

-- Atualiza a view pública de professionals para incluir plus_active/
-- plus_until (o painel usa para decidir se mostra a tela de analytics).
-- Mesmo motivo da 0014: a lista de colunas muda no meio, então drop + create.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, city, bio, phone, entity_type,
  company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, created_at
from public.professionals;

grant select on public.professionals_public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 0017_assinatura_anual.sql
-- ═══════════════════════════════════════════════════════════════

-- Fonte de renda: alternativa "plano anual à vista" para as 3 assinaturas
-- recorrentes (selo de verificação, turbinar anúncio e Empresa Plus), com
-- 20% de desconto sobre 12x o valor mensal. Diferente do plano mensal (que
-- usa `/preapproval` e só aceita cartão), o plano anual é um pagamento
-- avulso via `checkout/preferences` (aceita Pix, cartão e boleto
-- automaticamente, sem configuração extra) — não renova sozinho, o dono do
-- anúncio precisa comprar de novo ao expirar.

alter table public.subscriptions
  add column if not exists billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'annual'));

-- ═══════════════════════════════════════════════════════════════
-- 0018_sugestoes.sql
-- ═══════════════════════════════════════════════════════════════

-- Canal de sugestões gerais sobre a plataforma (feedback de produto, ideias
-- como "poderia ter tal categoria" etc) — diferente de `reports`, que é
-- denúncia sobre um anúncio específico. Mesmo padrão de leitura restrita a
-- admin (reaproveita a tabela `admins` de 0008_admins.sql).

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  message text not null,
  created_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'reviewed'))
);

alter table public.suggestions enable row level security;

-- Qualquer um pode enviar uma sugestão, inclusive sem estar logado. Quando
-- logado, o client captura o user_id automaticamente (não é obrigatório).
drop policy if exists "qualquer um pode enviar uma sugestão" on public.suggestions;
create policy "qualquer um pode enviar uma sugestão"
  on public.suggestions for insert
  with check (true);

-- Sem policy de select pública de propósito — só admin lê (mesmo padrão de
-- `reports`).
drop policy if exists "admin vê as sugestões" on public.suggestions;
create policy "admin vê as sugestões"
  on public.suggestions for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "admin atualiza o status da sugestão" on public.suggestions;
create policy "admin atualiza o status da sugestão"
  on public.suggestions for update
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════
-- 0019_renovacao_anual.sql
-- ═══════════════════════════════════════════════════════════════

-- Torna o plano anual realmente recorrente, em dois caminhos diferentes
-- (porque a API do Mercado Pago só faz débito automático com cartão):
--
--   a) Anual no CARTÃO — `/preapproval` com `auto_recurring.frequency = 12`
--      / `frequency_type = 'months'`: o Mercado Pago cobra o cartão sozinho a
--      cada 12 meses. Renova de verdade, sem ação do dono do anúncio.
--   b) Anual no PIX/BOLETO — continua sendo pagamento único
--      (`checkout/preferences`), porque Pix/boleto não têm débito automático.
--      A "recorrência" aqui é operacional: a Edge Function agendada
--      `renew-annual-plans` roda 1x/dia, acha os planos perto de vencer, já
--      gera a nova cobrança e manda o link por e-mail ao dono.
--
-- Colunas novas em `subscriptions`:
--   - `auto_renew`  — true quando a linha é cobrada automaticamente pelo
--     Mercado Pago (mensal via preapproval, ou anual via preapproval de 12
--     meses); false quando é pagamento único que depende de o dono pagar de
--     novo (anual no Pix/boleto). É o que separa quem recebe o e-mail de
--     aviso de quem não precisa receber.
--   - `renewal_notified_at` — quando o aviso de renovação deste ciclo foi
--     enviado, para o cron não reenviar o e-mail todo dia. É zerado
--     (`null`) pelo webhook quando o pagamento da renovação é confirmado,
--     liberando o aviso do ciclo seguinte.

alter table public.subscriptions
  add column if not exists auto_renew boolean not null default true,
  add column if not exists renewal_notified_at timestamptz;

-- Backfill: antes desta migration, TODA linha anual era o plano à vista
-- (pagamento único via checkout/preferences) — nenhuma renovava sozinha.
update public.subscriptions
  set auto_renew = false
  where billing_cycle = 'annual';

-- Índice para a varredura diária do cron (planos anuais à vista ativos,
-- ainda sem aviso enviado neste ciclo).
create index if not exists subscriptions_renovacao_idx
  on public.subscriptions (billing_cycle, auto_renew, status, current_period_end);

-- ═══════════════════════════════════════════════════════════════
-- 0020_etiquetas_avaliacao.sql
-- ═══════════════════════════════════════════════════════════════

-- Etiquetas rápidas na avaliação (modelo 99/Uber): a pessoa avalia tocando
-- em estrelas e em algumas etiquetas prontas, sem precisar escrever nada. O
-- comentário em texto livre continua existindo, mas passa a ser opcional.
--
-- As etiquetas são texto livre no banco de propósito: o conjunto oferecido
-- na UI vive em `src/types/domain.ts` (POSITIVE_REVIEW_TAGS /
-- NEGATIVE_REVIEW_TAGS / MIXED_REVIEW_TAGS) e pode ser ajustado sem
-- migração. O `check` abaixo só limita a quantidade, para o campo não virar
-- vetor de lixo via API direta.

alter table public.reviews
  add column if not exists tags text[] not null default '{}';

alter table public.reviews
  drop constraint if exists reviews_tags_max;

alter table public.reviews
  add constraint reviews_tags_max
  check (coalesce(array_length(tags, 1), 0) <= 12);

-- O trigger de 0011_trigger_reviews_campo_restrito.sql valida campo a campo
-- QUEM pode mudar O QUÊ num update de `reviews`. Como ele lista os campos
-- explicitamente, a coluna nova precisa entrar nessa conta:
--
--   - autor da avaliação: pode mudar `rating`, `comment` e agora `tags`
--     (é ele quem escolhe as etiquetas ao editar a própria avaliação);
--   - dono do anúncio: continua podendo mudar só `reply`/`replied_at` —
--     `tags` entra na lista de campos que ele não pode reescrever, junto
--     com `rating`/`comment`.
--
-- Sem isso, editar uma avaliação com etiquetas falharia (o dono) ou o dono
-- conseguiria apagar as etiquetas recebidas (brecha equivalente à que a
-- 0011 fechou para nota/comentário). O resto do comportamento é idêntico ao
-- da 0011.

create or replace function public.reviews_valida_campos_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  eh_autor boolean;
  eh_dono boolean;
begin
  eh_autor := auth.uid() = old.user_id;
  eh_dono := exists (
    select 1 from public.professionals p
    where p.id = old.professional_id
      and p.owner_id = auth.uid()
  );

  if eh_autor then
    -- Autor pode mudar rating/comment/tags, mas não a resposta do dono.
    if new.reply is distinct from old.reply or new.replied_at is distinct from old.replied_at then
      raise exception 'Autor da avaliação não pode alterar a resposta do profissional.';
    end if;
    -- Autor não deve conseguir se auto-declarar dono via update; mantém os
    -- demais campos imutáveis por segurança extra.
    new.professional_id := old.professional_id;
    new.user_id := old.user_id;
  elsif eh_dono then
    -- Dono do anúncio só pode mudar a resposta, nunca a nota, o comentário
    -- ou as etiquetas escolhidas pelo autor.
    if new.rating is distinct from old.rating
      or new.comment is distinct from old.comment
      or new.tags is distinct from old.tags then
      raise exception 'Dono do anúncio não pode alterar nota, comentário ou etiquetas da avaliação.';
    end if;
    new.professional_id := old.professional_id;
    new.user_id := old.user_id;
    if new.reply is distinct from old.reply then
      new.replied_at := now();
    end if;
  else
    -- Nem autor nem dono: não deveria nem passar pelas policies de RLS,
    -- mas por segurança em profundidade, barra qualquer mudança.
    raise exception 'Sem permissão para atualizar esta avaliação.';
  end if;

  return new;
end;
$$;

-- O trigger em si (nome e ponto de disparo) continua o mesmo da 0011; só a
-- função foi trocada acima, então não é preciso recriá-lo.

-- ═══════════════════════════════════════════════════════════════
-- 0021_idempotencia_pagamentos.sql
-- ═══════════════════════════════════════════════════════════════

-- Idempotência dos eventos de pagamento do Mercado Pago.
--
-- O Mercado Pago envia MAIS DE UMA notificação para o mesmo pagamento
-- (`payment.created` e `payment.updated`, além de reenvios automáticos), e
-- todas chegam no webhook com o mesmo `data.id`. Os fluxos que apenas
-- gravam um estado final (marcar patrocínio como 'active', calcular
-- "..._until" a partir de agora) toleram repetição sem estragar nada, mas a
-- compra de créditos de contato SOMA ao saldo — processar o mesmo pagamento
-- duas vezes daria crédito em dobro ao profissional, de graça.
--
-- Esta tabela funciona como um livro-caixa de eventos já processados: o
-- webhook "reserva" o id do pagamento antes de aplicar o efeito e ignora o
-- evento se o id já estiver reservado. Se o processamento falhar no meio, a
-- reserva é desfeita para que o reenvio do Mercado Pago possa tentar de novo.

create table if not exists public.processed_payments (
  payment_id text primary key,
  processed_at timestamptz not null default now()
);

-- Nenhuma policy: a tabela é manipulada exclusivamente pelo webhook, que usa
-- a service_role key (ignora RLS). Nenhum usuário final lê ou escreve aqui.
alter table public.processed_payments enable row level security;

-- Soma créditos de contato de forma atômica, criando a linha se ainda não
-- existir. Evita o padrão "lê o saldo, soma no client, grava de volta", que
-- perde uma das compras se dois pagamentos forem confirmados ao mesmo tempo.
-- Só o webhook (service_role) chama esta função — por isso não há grant para
-- anon/authenticated, ao contrário de `consume_lead_credit`.
-- Os parâmetros levam prefixo `p_` porque `on conflict (professional_id)` não
-- aceita qualificação de tabela: com um parâmetro de mesmo nome, o Postgres
-- não sabe se a coluna do conflito é a coluna ou a variável, e recusa a
-- chamada inteira em tempo de execução.
-- `create or replace function` não consegue trocar o NOME de um parâmetro
-- (só o corpo), então uma versão anterior já aplicada bloquearia esta. Drop
-- antes resolve, e é inofensivo: a função não guarda estado.
drop function if exists public.add_lead_credits(uuid, integer);
create function public.add_lead_credits(p_professional_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount deve ser positivo';
  end if;

  insert into public.lead_credits (professional_id, balance)
  values (p_professional_id, p_amount)
  on conflict (professional_id) do update
    set balance = public.lead_credits.balance + p_amount,
        updated_at = now();
end;
$$;

revoke execute on function public.add_lead_credits(uuid, integer) from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 0022_contatos_e_pedidos.sql
-- ═══════════════════════════════════════════════════════════════

-- Mais formas de contato, e o caminho inverso: o cliente pedir que o
-- profissional ligue para ele.

-- 1) Canais de contato do anúncio. `phone` já existia (usado como WhatsApp);
--    agora ele volta a ser só telefone e o WhatsApp ganha campo próprio, para
--    quem atende num número e conversa em outro.
alter table public.professionals
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists instagram text,
  add column if not exists linkedin text;

-- Quem já tinha telefone cadastrado usava aquele número como WhatsApp — sem
-- este backfill, todo anúncio existente perderia o botão de WhatsApp.
update public.professionals
  set whatsapp = phone
  where whatsapp is null and coalesce(phone, '') <> '';

-- 2) Pedidos de contato: o cliente deixa o número e pede para ser chamado.
create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  -- Quem pediu, quando estava logado. Nulo para pedido feito sem conta.
  requester_id uuid references public.profiles (id) on delete set null,
  name text not null,
  phone text not null,
  message text not null default '',
  status text not null default 'new' check (status in ('new', 'contacted', 'archived')),
  created_at timestamptz not null default now(),
  contacted_at timestamptz
);

create index if not exists contact_requests_professional_idx
  on public.contact_requests (professional_id, status, created_at desc);

alter table public.contact_requests enable row level security;

-- Qualquer visitante pode pedir contato, com ou sem login: exigir conta aqui
-- só afastaria quem está com pressa de resolver um problema em casa.
drop policy if exists "qualquer pessoa pede contato" on public.contact_requests;
create policy "qualquer pessoa pede contato"
  on public.contact_requests for insert
  with check (true);

-- Só o dono do anúncio lê e atualiza os pedidos que recebeu. Não há policy de
-- leitura pública: são dados de contato de terceiros.
drop policy if exists "dono vê os pedidos do próprio anúncio" on public.contact_requests;
create policy "dono vê os pedidos do próprio anúncio"
  on public.contact_requests for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = contact_requests.professional_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "dono atualiza os pedidos do próprio anúncio" on public.contact_requests;
create policy "dono atualiza os pedidos do próprio anúncio"
  on public.contact_requests for update
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = contact_requests.professional_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = contact_requests.professional_id
        and p.owner_id = auth.uid()
    )
  );

-- 3) A view pública precisa enxergar os campos novos (ela lista colunas uma a
--    uma justamente para nunca devolver `document`).
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, created_at
from public.professionals
where suspended = false;

grant select on public.professionals_public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 0023_varios_servicos.sql
-- ═══════════════════════════════════════════════════════════════

-- Um anúncio, vários serviços.
--
-- Até aqui cada anúncio tinha UMA categoria, então quem faz encanamento e
-- elétrica precisava criar dois anúncios — dois cadastros para manter, duas
-- reputações separadas, e a pessoa aparecendo duas vezes na busca. Agora o
-- anúncio carrega uma lista.
--
-- `category` continua existindo como a categoria principal: é o que aparece
-- em destaque no card e é o que o patrocínio de categoria usa. `categories`
-- é a lista completa, e é ela que a busca consulta.

alter table public.professionals
  add column if not exists categories text[] not null default '{}';

-- Backfill: sem isto, todo anúncio existente sairia da busca no instante em
-- que ela passasse a filtrar pela lista.
update public.professionals
  set categories = array[category]
  where categories = '{}' and coalesce(category, '') <> '';

-- Índice GIN é o que faz `categories @> array['Encanador']` usar índice em
-- vez de varrer a tabela inteira.
create index if not exists professionals_categories_idx
  on public.professionals using gin (categories);

-- Garante que a categoria principal está sempre dentro da lista — a busca
-- olha só para `categories`, então uma principal fora dela sumiria da busca
-- pela própria categoria.
create or replace function public.sincroniza_categorias()
returns trigger
language plpgsql
as $$
begin
  if new.category is not null and new.category <> '' and not (new.category = any(new.categories)) then
    new.categories := array_prepend(new.category, new.categories);
  end if;
  return new;
end;
$$;

drop trigger if exists professionals_sincroniza_categorias on public.professionals;
create trigger professionals_sincroniza_categorias
  before insert or update on public.professionals
  for each row execute function public.sincroniza_categorias();

-- A view pública lista colunas uma a uma (para nunca devolver `document`),
-- então precisa ser recriada para enxergar a coluna nova.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, created_at
from public.professionals
where suspended = false;

grant select on public.professionals_public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 0024_whatsapp_confirmado.sql
-- ═══════════════════════════════════════════════════════════════

-- Confirmação do WhatsApp por código.
--
-- Até aqui, qualquer pessoa podia cadastrar o telefone de outra: bastava
-- digitar. Isso permite dois abusos que ferem exatamente quem a plataforma
-- existe para ajudar — anunciar em nome de um profissional real (que passa a
-- receber ligações de trabalhos que não combinou) e publicar um número de
-- golpe com o nome de alguém conhecido na cidade.
--
-- O código enviado ao WhatsApp resolve o caso comum: quem não tem o aparelho
-- na mão não conclui o cadastro. Não é prova de identidade — é prova de posse
-- do número, que é o que o contratante usa para chegar na pessoa.
--
-- A confirmação em si é feita pelo Supabase Auth (`auth.users.phone` +
-- `phone_confirmed_at`), que fala com o provedor de mensagens. Este arquivo
-- cuida de trazer esse fato para o anúncio, e de garantir que ele não possa
-- ser forjado pelo navegador.

alter table public.professionals
  add column if not exists whatsapp_verified boolean not null default false,
  add column if not exists whatsapp_verified_at timestamptz;

-- O cliente escreve na tabela `professionals` com a chave anon. Se a coluna
-- fosse gravável por ele, "verificado" seria só mais um campo de formulário:
-- um `update` direto pela API marcaria o selo sem nenhum código enviado.
-- Este trigger é o que torna a coluna não-falsificável — só a função abaixo,
-- que confere o Auth, consegue mudá-la.
create or replace function public.professionals_protege_whatsapp_verificado()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    -- Ninguém nasce verificado.
    new.whatsapp_verified := false;
    new.whatsapp_verified_at := null;
    return new;
  end if;

  if new.whatsapp_verified is distinct from old.whatsapp_verified
     or new.whatsapp_verified_at is distinct from old.whatsapp_verified_at then
    -- `current_setting` com o segundo argumento true devolve null em vez de
    -- estourar quando a variável não existe — é assim que a função de
    -- confirmação se identifica.
    if coalesce(current_setting('app.confirmando_whatsapp', true), '') <> 'sim' then
      raise exception 'O WhatsApp verificado só pode ser alterado pela confirmação por código.';
    end if;
  end if;

  -- Trocar o número derruba a confirmação: o selo vale para o número que foi
  -- confirmado, não para o anúncio em geral. Sem isto, bastaria confirmar o
  -- próprio celular e depois trocar pelo número do golpe.
  if new.whatsapp is distinct from old.whatsapp
     and coalesce(current_setting('app.confirmando_whatsapp', true), '') <> 'sim' then
    new.whatsapp_verified := false;
    new.whatsapp_verified_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists professionals_protege_whatsapp_verificado_trigger on public.professionals;
create trigger professionals_protege_whatsapp_verificado_trigger
  before insert or update on public.professionals
  for each row execute function public.professionals_protege_whatsapp_verificado();

-- Marca o anúncio como confirmado, mas só se o Auth concordar.
--
-- Três condições, todas conferidas no servidor: quem chama é o dono do
-- anúncio, o telefone daquela conta está confirmado no Auth
-- (`phone_confirmed_at`), e o número confirmado é o mesmo que está no
-- anúncio. A comparação usa só os dígitos, e ignora o 55 do país, porque o
-- Auth guarda em formato internacional e o formulário guarda como se escreve
-- aqui.
create or replace function public.confirmar_whatsapp(p_professional_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_dono uuid;
  v_whatsapp text;
  v_auth_phone text;
  v_confirmado timestamptz;
  v_digitos_anuncio text;
  v_digitos_auth text;
begin
  select owner_id, coalesce(nullif(whatsapp, ''), phone)
    into v_dono, v_whatsapp
    from public.professionals
   where id = p_professional_id;

  if v_dono is null then
    raise exception 'Anúncio não encontrado.';
  end if;
  if v_dono <> auth.uid() then
    raise exception 'Só o dono do anúncio pode confirmar o WhatsApp dele.';
  end if;

  select phone, phone_confirmed_at
    into v_auth_phone, v_confirmado
    from auth.users
   where id = auth.uid();

  if v_confirmado is null then
    raise exception 'O número ainda não foi confirmado por código.';
  end if;

  v_digitos_anuncio := regexp_replace(coalesce(v_whatsapp, ''), '\D', '', 'g');
  v_digitos_auth := regexp_replace(coalesce(v_auth_phone, ''), '\D', '', 'g');
  v_digitos_anuncio := regexp_replace(v_digitos_anuncio, '^55', '');
  v_digitos_auth := regexp_replace(v_digitos_auth, '^55', '');

  if v_digitos_anuncio = '' or v_digitos_anuncio <> v_digitos_auth then
    raise exception 'O número confirmado é diferente do que está no anúncio.';
  end if;

  perform set_config('app.confirmando_whatsapp', 'sim', true);
  update public.professionals
     set whatsapp_verified = true,
         whatsapp_verified_at = now()
   where id = p_professional_id;
  perform set_config('app.confirmando_whatsapp', '', true);

  return true;
end;
$$;

revoke all on function public.confirmar_whatsapp(uuid) from public;
grant execute on function public.confirmar_whatsapp(uuid) to authenticated;

-- A view pública lista colunas uma a uma, então precisa ser recriada para
-- enxergar as colunas novas. Quem busca vê que o número foi confirmado —
-- é justamente para quem contrata que essa informação serve.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, created_at
from public.professionals
where suspended = false;

grant select on public.professionals_public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 0025_endereco.sql
-- ═══════════════════════════════════════════════════════════════

-- Endereço de atendimento do anúncio.
--
-- É opcional de propósito. Metade de quem anuncia aqui trabalha na casa do
-- cliente — eletricista, diarista, montador — e para essa gente o endereço
-- que existe é o de casa. Obrigar a preencher seria obrigar a publicar onde
-- se mora, em troca de nada.
--
-- Para quem tem ponto fixo (salão, oficina, loja), é o contrário: sem o
-- endereço, o anúncio não serve. Daí os campos existirem, e aparecerem no
-- perfil só quando preenchidos.
--
-- Guardado em partes, e não numa linha de texto só, porque bairro é o
-- recorte que as pessoas usam de verdade para escolher perto de casa — e um
-- campo separado permite filtrar por ele depois sem migração nova.

alter table public.professionals
  add column if not exists cep text,
  add column if not exists street text,
  add column if not exists street_number text,
  add column if not exists neighborhood text;

-- A view pública lista colunas uma a uma, então precisa ser recriada para
-- enxergar as novas. O endereço é público por natureza: é para ser
-- encontrado que ele foi preenchido.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  cep, street, street_number, neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, created_at
from public.professionals
where suspended = false;

grant select on public.professionals_public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 0026_politicas_storage_fotos.sql
-- ═══════════════════════════════════════════════════════════════

-- Regras de acesso ao bucket das fotos.
--
-- Marcar o bucket como público libera a LEITURA — é o que faz a foto
-- aparecer no anúncio para quem nem tem conta. Não libera a ESCRITA: sem as
-- políticas abaixo, o envio é recusado e o anúncio de pessoa física, que
-- exige foto de rosto, não consegue ser publicado.
--
-- O caminho do arquivo é `<id do dono>/<hora>.<extensão>` (ver
-- src/lib/storage.ts), e é isso que sustenta a regra: a primeira pasta do
-- caminho tem que ser o id de quem está enviando. Assim ninguém sobrescreve
-- nem apaga a foto de outra pessoa, mesmo chamando a API direto — a
-- verificação é do servidor, não da tela.

-- Leitura: qualquer um, inclusive visitante sem conta. É uma foto de
-- anúncio; escondê-la de quem procura anularia o propósito dela.
drop policy if exists "fotos de anuncio: leitura publica" on storage.objects;
create policy "fotos de anuncio: leitura publica"
  on storage.objects for select
  using (bucket_id = 'professional-photos');

-- Envio: só logado, e só dentro da própria pasta.
drop policy if exists "fotos de anuncio: envio do dono" on storage.objects;
create policy "fotos de anuncio: envio do dono"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'professional-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Substituir a própria foto (trocar a imagem do anúncio).
drop policy if exists "fotos de anuncio: troca do dono" on storage.objects;
create policy "fotos de anuncio: troca do dono"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'professional-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'professional-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Apagar a própria foto.
drop policy if exists "fotos de anuncio: exclusao do dono" on storage.objects;
create policy "fotos de anuncio: exclusao do dono"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'professional-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ═══════════════════════════════════════════════════════════════
-- 0027_pausar_anuncio.sql
-- ═══════════════════════════════════════════════════════════════

-- Pausar o próprio anúncio — e proteger a suspensão da administração.
--
-- São duas coisas que pareciam uma só e não são:
--
-- `suspended` é castigo: a administração tira o anúncio do ar por denúncia
-- procedente. `paused` é escolha: quem viajou, está sem agenda ou parou de
-- atender por um tempo tira o anúncio da busca e o traz de volta quando
-- quiser, sem perder avaliações nem ter que cadastrar tudo de novo.
--
-- Guardar as duas no mesmo campo seria dar ao anunciante suspenso o botão de
-- se reativar. E é exatamente isso que acontecia até aqui: a policy de update
-- deixa o dono mudar qualquer coluna do próprio anúncio, e `suspended` é uma
-- coluna. Quem fosse tirado do ar por golpe podia voltar sozinho chamando a
-- API — não pela tela, que não oferece o botão, mas RLS não protege o que a
-- tela esconde.

alter table public.professionals
  add column if not exists paused boolean not null default false;

-- Impede que o dono mexa no que é da administração.
--
-- Admin continua podendo tudo: a checagem só exige que quem alterou
-- `suspended` esteja em `public.admins`.
create or replace function public.professionals_protege_suspensao()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.suspended is distinct from old.suspended
     or new.suspended_reason is distinct from old.suspended_reason then
    if not exists (select 1 from public.admins a where a.user_id = auth.uid()) then
      raise exception 'Só a administração pode suspender ou reativar um anúncio.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists professionals_protege_suspensao_trigger on public.professionals;
create trigger professionals_protege_suspensao_trigger
  before update on public.professionals
  for each row execute function public.professionals_protege_suspensao();

-- A busca pública ignora tanto o suspenso quanto o pausado. Para quem
-- procura, os dois são a mesma coisa: não está atendendo agora.
--
-- O anúncio pausado continua existindo para o dono (a tela do painel lê a
-- tabela, não a view), com avaliações e histórico intactos.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  cep, street, street_number, neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 0028_antiabuso_e_expurgo.sql
-- ═══════════════════════════════════════════════════════════════

-- Freios de abuso e prazo de guarda.
--
-- Três tabelas aceitam escrita de qualquer visitante, sem login: pedidos de
-- contato, sugestões e visualizações de perfil. Isso é deliberado — exigir
-- conta para pedir um orçamento afastaria justamente quem está com um cano
-- estourado em casa. Mas "sem login" não pode significar "sem limite":
--
--   * pedidos de contato: um laço simples enche o painel de um profissional
--     com milhares de pedidos falsos, e ele perde os verdadeiros no meio.
--   * sugestões: mesma coisa, com o seu painel de administração.
--   * visualizações: dá para fingir 10.000 visitas no próprio anúncio e
--     estragar o único número que o anunciante usa para decidir se o app
--     vale a pena.
--
-- Os limites são por janela de tempo e generosos para uso humano: ninguém
-- pede contato a seis profissionais no mesmo minuto de boa-fé.

-- --------------------------------------------------------------------
-- Pedidos de contato: no máximo 5 por telefone a cada 10 minutos.
-- --------------------------------------------------------------------
create or replace function public.contact_requests_freia_abuso()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recentes int;
begin
  select count(*) into recentes
    from public.contact_requests
   where phone = new.phone
     and created_at > now() - interval '10 minutes';

  if recentes >= 5 then
    raise exception 'Muitos pedidos seguidos deste telefone. Espere alguns minutos.';
  end if;

  -- Mesmo profissional, mesmo telefone, em sequência: é dedo nervoso no
  -- botão, não pedido novo.
  if exists (
    select 1 from public.contact_requests
     where professional_id = new.professional_id
       and phone = new.phone
       and created_at > now() - interval '2 minutes'
  ) then
    raise exception 'Você já enviou um pedido para este profissional agora há pouco.';
  end if;

  return new;
end;
$$;

drop trigger if exists contact_requests_freia_abuso_trigger on public.contact_requests;
create trigger contact_requests_freia_abuso_trigger
  before insert on public.contact_requests
  for each row execute function public.contact_requests_freia_abuso();

-- --------------------------------------------------------------------
-- Sugestões: no máximo 3 por hora por usuário logado; anônimas, 20/hora no
-- total (não há de quem cobrar, então o teto é global e frouxo).
-- --------------------------------------------------------------------
create or replace function public.suggestions_freia_abuso()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recentes int;
begin
  if new.user_id is not null then
    select count(*) into recentes
      from public.suggestions
     where user_id = new.user_id
       and created_at > now() - interval '1 hour';
    if recentes >= 3 then
      raise exception 'Você já enviou várias sugestões agora há pouco. Tente mais tarde.';
    end if;
  else
    select count(*) into recentes
      from public.suggestions
     where user_id is null
       and created_at > now() - interval '1 hour';
    if recentes >= 20 then
      raise exception 'Muitas sugestões recebidas agora. Tente mais tarde.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists suggestions_freia_abuso_trigger on public.suggestions;
create trigger suggestions_freia_abuso_trigger
  before insert on public.suggestions
  for each row execute function public.suggestions_freia_abuso();

-- --------------------------------------------------------------------
-- Visualizações: uma por anúncio a cada 30 minutos por usuário logado.
--
-- Visitante sem conta continua contando sempre — não há como distingui-lo
-- sem rastrear, e rastrear visitante para inflar um contador seria trocar
-- privacidade por vaidade. O número segue aproximado, e é assim que ele é
-- apresentado ao anunciante ("pessoas viram seu anúncio").
-- --------------------------------------------------------------------
create or replace function public.profile_views_freia_abuso()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null then
    if exists (
      select 1 from public.profile_views
       where professional_id = new.professional_id
         and viewer_id = auth.uid()
         and viewed_at > now() - interval '30 minutes'
    ) then
      -- Devolver null cancela a inserção sem estourar erro: a página do
      -- profissional não pode quebrar porque a contagem foi ignorada.
      return null;
    end if;
    new.viewer_id := auth.uid();
  end if;
  return new;
end;
$$;

-- A coluna pode não existir em bases antigas.
alter table public.profile_views
  add column if not exists viewer_id uuid references auth.users(id) on delete set null;

create index if not exists profile_views_dedupe_idx
  on public.profile_views (professional_id, viewer_id, viewed_at desc);

drop trigger if exists profile_views_freia_abuso_trigger on public.profile_views;
create trigger profile_views_freia_abuso_trigger
  before insert on public.profile_views
  for each row execute function public.profile_views_freia_abuso();

-- --------------------------------------------------------------------
-- Prazo de guarda (LGPD): dados que não servem mais são apagados.
--
-- Pedidos de contato guardam nome e telefone de gente que talvez nem tenha
-- conta aqui. Guardar isso para sempre é acúmulo sem finalidade — e
-- finalidade é justamente o que a lei exige para guardar qualquer coisa.
-- Um ano cobre o uso real (reencontrar um cliente antigo) com folga.
--
-- Chame periodicamente. Com pg_cron:
--   select cron.schedule('expurgo', '0 4 * * *', 'select public.expurgar_dados_antigos()');
-- --------------------------------------------------------------------
create or replace function public.expurgar_dados_antigos()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.contact_requests where created_at < now() - interval '12 months';
  -- Visualizações só alimentam o "últimos 30 dias"; 6 meses já é folga.
  delete from public.profile_views where viewed_at < now() - interval '6 months';
end;
$$;

revoke all on function public.expurgar_dados_antigos() from public;

-- ═══════════════════════════════════════════════════════════════
-- 0029_limite_de_anuncios.sql
-- ═══════════════════════════════════════════════════════════════

-- Vários anúncios por pessoa, sem virar terra de ninguém.
--
-- Ter mais de um anúncio é legítimo: quem é fotógrafo e também dá aula de
-- violão tem duas vitrines diferentes, com fotos, textos e reputações
-- separadas — e amontoar isso num anúncio só piora para quem procura.
--
-- O que não pode é o mesmo serviço repetido. Cinco anúncios de "Eletricista"
-- na mesma cidade não informam nada a mais: só empurram os concorrentes para
-- baixo e transformam a busca numa disputa de quem cadastra mais vezes. Quem
-- perde é quem procura, que vê a mesma pessoa cinco vezes e desiste.
--
-- Duas travas, ambas no servidor:
--   1. Nenhum serviço repetido entre os anúncios da mesma pessoa na mesma
--      cidade.
--   2. Teto de anúncios por conta.

alter table public.professionals
  add column if not exists paused boolean not null default false;

create or replace function public.professionals_evita_repetidos()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  quantos int;
  conflito text;
begin
  -- 1. Serviço repetido na mesma cidade, entre anúncios do mesmo dono.
  select c into conflito
    from public.professionals p, unnest(p.categories) as c
   where p.owner_id = new.owner_id
     and p.id is distinct from new.id
     and lower(p.city) = lower(new.city)
     and c = any(new.categories)
   limit 1;

  if conflito is not null then
    raise exception 'Você já tem um anúncio de "%" em %. Edite o que existe em vez de criar outro igual.',
      conflito, new.city;
  end if;

  -- 2. Teto por conta. Cinco cobre com folga quem realmente faz coisas
  --    diferentes, e barra quem quer ocupar a busca.
  if tg_op = 'INSERT' then
    select count(*) into quantos from public.professionals where owner_id = new.owner_id;
    if quantos >= 5 then
      raise exception 'Você já tem 5 anúncios, que é o limite por conta.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists professionals_evita_repetidos_trigger on public.professionals;
create trigger professionals_evita_repetidos_trigger
  before insert or update on public.professionals
  for each row execute function public.professionals_evita_repetidos();

-- ═══════════════════════════════════════════════════════════════
-- 0030_reembolso_e_cancelamento.sql
-- ═══════════════════════════════════════════════════════════════

-- Guarda a que assinatura cada pagamento pertence.
--
-- `processed_payments` nasceu só para impedir que o mesmo aviso do Mercado
-- Pago fosse processado duas vezes: bastava o número do pagamento. Agora ela
-- precisa responder a outra pergunta — "qual foi o último pagamento desta
-- assinatura?" —, que é o que permite devolver o dinheiro de quem desiste
-- dentro dos 7 dias do direito de arrependimento.
--
-- Sem esta coluna, o reembolso teria de sair da conversa com o Mercado Pago a
-- cada pedido, e um cancelamento que depende de uma consulta a mais é um
-- cancelamento que falha na hora errada.

alter table public.processed_payments
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null;

create index if not exists processed_payments_subscription_idx
  on public.processed_payments (subscription_id, processed_at desc);

-- ═══════════════════════════════════════════════════════════════
-- 0031_limite_destaques.sql
-- ═══════════════════════════════════════════════════════════════

-- Teto de 5 destaques por categoria e cidade, com lista de espera.
--
-- Destaque só destaca enquanto é escasso. Se metade dos eletricistas de
-- Itabirito turbinar, todo mundo pagou para ficar igual — e o produto morre
-- de sucesso: ninguém renova algo que não muda nada. O limite protege quem
-- comprou, não a plataforma.
--
-- Quando esgota, o pedido vira lista de espera em vez de venda perdida. Isso
-- também é o melhor termômetro de preço que existe: categoria com fila é
-- categoria onde o destaque está barato demais.

create table if not exists public.destaque_espera (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  category text not null,
  city text not null,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (professional_id, category, city)
);

alter table public.destaque_espera enable row level security;

drop policy if exists "dono entra na fila do proprio anuncio" on public.destaque_espera;
create policy "dono entra na fila do proprio anuncio"
  on public.destaque_espera for insert
  to authenticated
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "dono ve a propria fila" on public.destaque_espera;
create policy "dono ve a propria fila"
  on public.destaque_espera for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "dono sai da fila" on public.destaque_espera;
create policy "dono sai da fila"
  on public.destaque_espera for delete
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.owner_id = auth.uid()
    )
  );

-- Admin lê a fila inteira: é dali que sai a decisão de preço.
drop policy if exists "admin ve toda a fila" on public.destaque_espera;
create policy "admin ve toda a fila"
  on public.destaque_espera for select
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

/**
 * Quantas vagas de destaque restam numa categoria/cidade.
 *
 * `security definer` porque a contagem precisa enxergar todos os anúncios,
 * inclusive os que a pessoa não veria — e o que ela recebe de volta é só um
 * número, nunca a lista de quem são.
 */
create or replace function public.vagas_de_destaque(p_category text, p_city text)
returns int
language sql
security definer set search_path = public
stable
as $$
  select greatest(
    0,
    5 - (
      select count(*)
        from public.professionals p
       where lower(p.city) = lower(p_city)
         and p_category = any(p.categories)
         and p.suspended = false
         and p.paused = false
         and p.boosted = true
         and (p.boosted_until is null or p.boosted_until > now())
    )
  )::int
$$;

grant execute on function public.vagas_de_destaque(text, text) to authenticated, anon;

-- ═══════════════════════════════════════════════════════════════
-- 0032_indicacoes.sql
-- ═══════════════════════════════════════════════════════════════

-- Indicações: quem a cidade procurou e não achou.
--
-- Busca vazia é o momento mais informativo do app e o mais desperdiçado. A
-- pessoa acabou de dizer exatamente o que precisa, não encontrou, e vai
-- embora — e essa demanda, que é a lista do que falta em Itabirito, se perde.
--
-- Aqui ela vira duas coisas: a lista de quem prospectar (com nome e telefone
-- de gente real, indicada por quem confia nela) e o termômetro do que a
-- cidade procura sem oferta.
--
-- O termo buscado é gravado junto mesmo quando ninguém indica ninguém: saber
-- que 40 pessoas procuraram "soldador" e não acharam já vale sozinho.

create table if not exists public.indicacoes (
  id uuid primary key default gen_random_uuid(),
  /** O que a pessoa procurava quando não achou. */
  servico_buscado text,
  cidade text,
  /** Quem ela indica — tudo opcional: às vezes só se lembra do apelido. */
  nome_indicado text,
  contato_indicado text,
  mensagem text,
  /** Quem indicou, se estava logada. Vira null se a conta for apagada. */
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'nova' check (status in ('nova','contatada','descartada')),
  created_at timestamptz not null default now()
);

alter table public.indicacoes enable row level security;

-- Qualquer pessoa indica, com ou sem conta: exigir login aqui perderia
-- justamente a indicação de quem passou uma vez pelo app.
drop policy if exists "qualquer pessoa indica" on public.indicacoes;
create policy "qualquer pessoa indica"
  on public.indicacoes for insert
  with check (true);

drop policy if exists "so admin le indicacoes" on public.indicacoes;
create policy "so admin le indicacoes"
  on public.indicacoes for select
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "so admin atualiza indicacoes" on public.indicacoes;
create policy "so admin atualiza indicacoes"
  on public.indicacoes for update
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create index if not exists indicacoes_status_idx on public.indicacoes (status, created_at desc);

-- Mesmo freio das outras tabelas abertas: sem login não pode significar sem
-- limite. 10 por hora entre anônimos cobre uso real com folga.
create or replace function public.indicacoes_freia_abuso()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recentes int;
begin
  select count(*) into recentes
    from public.indicacoes
   where created_at > now() - interval '1 hour'
     and (user_id is not distinct from new.user_id);
  if recentes >= 10 then
    raise exception 'Muitas indicações seguidas. Tente novamente mais tarde.';
  end if;
  return new;
end;
$$;

drop trigger if exists indicacoes_freia_abuso_trigger on public.indicacoes;
create trigger indicacoes_freia_abuso_trigger
  before insert on public.indicacoes
  for each row execute function public.indicacoes_freia_abuso();

-- ═══════════════════════════════════════════════════════════════
-- 0033_avaliacao_sem_cpf.sql
-- ═══════════════════════════════════════════════════════════════

-- Avaliação sem CPF, com prova de contato.
--
-- Pedir CPF para avaliar não impedia avaliação falsa: o número nunca foi
-- conferido contra a Receita, e qualquer gerador na internet produz um CPF
-- válido. Barrava só quem não pensou em burlar — e cobrava de todo mundo o
-- preço da desconfiança, num app onde a avaliação já é o passo mais frágil.
--
-- Pior: guardar CPF para liberar um comentário é coleta excessiva (LGPD,
-- art. 6º, III). Aumenta muito a gravidade de um vazamento para resolver um
-- problema que ele não resolvia.
--
-- O que substitui é mais barato e mais verdadeiro: registrar quando alguém
-- realmente pediu o contato do profissional, e marcar a avaliação de quem
-- fez isso. Quem procura passa a distinguir "avaliação de quem chamou" de
-- opinião solta — que é a única distinção que importa para confiar.
--
-- Não é trava, é etiqueta. Travar avaliação a quem chamou pelo app deixaria
-- de fora quem achou o número aqui e ligou pelo telefone — e no começo, com
-- pouca gente, uma trava dessas seca a reputação antes de ela existir.

create table if not exists public.contatos_registrados (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  /** whatsapp | telefone | pedido */
  tipo text not null,
  created_at timestamptz not null default now()
);

create index if not exists contatos_registrados_par_idx
  on public.contatos_registrados (professional_id, user_id);

alter table public.contatos_registrados enable row level security;

-- Qualquer visitante registra o próprio contato; ninguém lê a tabela pelo
-- app (ela só alimenta a etiqueta, calculada no gatilho abaixo).
drop policy if exists "qualquer pessoa registra contato" on public.contatos_registrados;
create policy "qualquer pessoa registra contato"
  on public.contatos_registrados for insert
  with check (true);

drop policy if exists "dono ve os contatos do proprio anuncio" on public.contatos_registrados;
create policy "dono ve os contatos do proprio anuncio"
  on public.contatos_registrados for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.owner_id = auth.uid()
    )
  );

alter table public.reviews
  add column if not exists contato_confirmado boolean not null default false;

/**
 * Marca a avaliação de quem realmente pediu o contato.
 *
 * Calculado no servidor, no momento da gravação: se viesse do navegador,
 * seria só mais um campo que qualquer um manda como quiser — e uma etiqueta
 * de confiança que se pode forjar é pior do que nenhuma.
 */
create or replace function public.reviews_marca_contato()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.contato_confirmado := exists (
    select 1 from public.contatos_registrados c
     where c.professional_id = new.professional_id
       and c.user_id = new.user_id
  );
  return new;
end;
$$;

drop trigger if exists reviews_marca_contato_trigger on public.reviews;
create trigger reviews_marca_contato_trigger
  before insert on public.reviews
  for each row execute function public.reviews_marca_contato();

-- O CPF deixa de ser exigido. A coluna continua existindo para não apagar
-- dado de quem já preencheu sem aviso — quem quiser sumir com o seu usa
-- "Excluir minha conta", e a limpeza geral fica para uma migração própria,
-- decidida com calma.
comment on column public.profiles.cpf is
  'Legado: não é mais pedido para avaliar (ver migration 0033).';

-- ═══════════════════════════════════════════════════════════════
-- 0034_etiquetas_do_anuncio.sql
-- ═══════════════════════════════════════════════════════════════

-- Etiquetas de atendimento no anúncio.
--
-- Hoje o anúncio diz o que a pessoa faz e onde. Não diz *quando* nem *como* —
-- e é justamente isso que quem procura pergunta primeiro no WhatsApp:
-- "atende sábado?", "vai até o Praia?", "é urgente, dá pra hoje?". Cada uma
-- dessas perguntas é uma conversa que só existe porque o anúncio não
-- respondeu antes, e boa parte delas termina sem contratação.
--
-- Texto livre em vez de uma tabela de opções porque a lista vai mudar
-- (bairro, forma de pagamento, atendimento a idosos), e uma lista que muda
-- não merece uma migração por item. O que a tela oferece é fechado; a coluna
-- só guarda.
alter table public.professionals
  add column if not exists atributos text[] not null default '{}';

-- Teto por anúncio: quem marca tudo não está informando nada, e a etiqueta
-- perde exatamente o valor que a torna útil — ser um recorte.
alter table public.professionals
  drop constraint if exists professionals_atributos_limite;
alter table public.professionals
  add constraint professionals_atributos_limite
  check (array_length(atributos, 1) is null or array_length(atributos, 1) <= 8);

-- Índice GIN pelo mesmo motivo de `categories`: a busca por etiqueta é
-- "contém", e sem ele vira varredura da tabela inteira a cada filtro.
create index if not exists professionals_atributos_idx
  on public.professionals using gin (atributos);

-- A view precisa ser recriada para a coluna aparecer para quem procura: sem
-- isto a etiqueta existe no banco, é salva pelo painel e não chega à busca.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  cep, street, street_number, neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;
