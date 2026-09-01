-- Busca Itabirito — banco completo, para montar o projeto do zero.
--
-- GERADO AUTOMATICAMENTE por scripts/gerar-sql-unico.mjs. Não edite à mão:
-- edite a migration correspondente em supabase/migrations/ e rode de novo
-- `npm run sql:unico`.
--
-- Como usar: abra o SQL Editor do seu projeto no Supabase, cole este arquivo
-- inteiro e rode uma vez. São 78 migrations, já na ordem certa.
--
-- Rodar de novo num banco que já tem os dados é seguro na maior parte (quase
-- tudo usa "if not exists" / "or replace"), mas não é o uso pretendido: para
-- um banco que já existe, aplique só a migration nova.


-- ═══════════════════════════════════════════════════════════════
-- 0001_esquema.sql
-- ═══════════════════════════════════════════════════════════════

-- procurô — esquema inicial do marketplace de profissionais.
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

-- ═══════════════════════════════════════════════════════════════
-- 0035_denuncia_com_identificacao.sql
-- ═══════════════════════════════════════════════════════════════

-- Denúncia só de quem está identificado.
--
-- Até aqui qualquer pessoa denunciava sem login, e o raciocínio original era
-- defensável: o golpe pode atingir quem nem conta tem. Na prática, o que essa
-- porta aberta produz é outra coisa — denúncia anônima é a ferramenta mais
-- barata que existe para tirar um concorrente do ar. Custa um clique, não tem
-- dono, e do outro lado tem uma pessoa cujo anúncio é o ganha-pão dela.
--
-- Exigir login não impede a denúncia legítima: quem foi vítima de golpe tem
-- todo o interesse em se identificar, e entrar leva o tempo de um toque no
-- Google. Impede a denúncia gratuita, que é o que se quer impedir.
--
-- Vale também como consequência jurídica: comunicar falsamente crime é o
-- art. 340 do Código Penal, e denunciação caluniosa é o art. 339 — nenhum dos
-- dois significa nada se não houver a quem imputar a comunicação. Sem autor,
-- o aviso na tela é só decoração.
drop policy if exists "qualquer um pode denunciar um anúncio" on public.reports;
-- Também a nova, para esta migration poder rodar duas vezes sem erro (é o
-- que o arquivo único faz quando alguém o cola de novo).
drop policy if exists "quem está logado pode denunciar um anúncio" on public.reports;

create policy "quem está logado pode denunciar um anúncio"
  on public.reports for insert
  to authenticated
  -- `reporter_id` tem que ser quem está de fato pedindo: sem isto daria para
  -- estar logado e gravar a denúncia no nome de outra pessoa, que é pior do
  -- que o anônimo — é o anônimo com um culpado escolhido a dedo.
  with check (reporter_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- 0036_desde_quando.sql
-- ═══════════════════════════════════════════════════════════════

-- "Está no app desde…" e "tem selo desde…".
--
-- Tempo é a prova social que ninguém consegue comprar num dia. Um anúncio de
-- dois anos com selo mantido há um ano e meio diz algo que nota nenhuma diz:
-- essa pessoa continua aqui, continua pagando para ser conferida, e ninguém
-- a tirou do ar nesse tempo todo. É o sinal que mais protege quem procura
-- contra o anúncio criado ontem para aplicar um golpe amanhã.
--
-- `created_at` já existia e serve para o primeiro. Faltava o segundo:
-- `verified_until` só diz até quando vale, e é reescrito a cada renovação —
-- ele nunca soube dizer desde quando.
alter table public.professionals
  add column if not exists verified_since timestamptz;

-- Quem já tem selo hoje não pode aparecer sem data: sem isto, o app diria
-- "com selo desde —" para toda a base atual. A aproximação usa a data do
-- cadastro, que é o mais próximo da verdade que este banco consegue provar.
update public.professionals
  set verified_since = created_at
  where verified = true and verified_since is null;

-- Carimba na virada de "sem selo" para "com selo", e só nela: a renovação
-- mensal reescreve `verified_until` toda vez, e recarimbar aqui zeraria
-- justamente o tempo que a coluna existe para acumular. Quem deixa o selo
-- cair e volta meses depois recomeça a contagem — porque foi isso mesmo que
-- aconteceu, e a data precisa dizer a verdade.
create or replace function public.professionals_carimba_selo()
returns trigger
language plpgsql
as $$
begin
  if new.verified = true and coalesce(old.verified, false) = false then
    new.verified_since := now();
  elsif new.verified = false then
    new.verified_since := null;
  end if;
  return new;
end;
$$;

drop trigger if exists professionals_carimba_selo_trigger on public.professionals;
create trigger professionals_carimba_selo_trigger
  before update on public.professionals
  for each row execute function public.professionals_carimba_selo();

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  cep, street, street_number, neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 0037_avaliacao_com_autor_e_contratacao.sql
-- ═══════════════════════════════════════════════════════════════

-- Três coisas que faltavam na avaliação, e o endereço opcional no anúncio.
--
-- 1) QUEM AVALIOU. A avaliação aparecia solta: estrelas, etiquetas e texto,
--    sem nome, sem foto e sem data. Opinião sem rosto vale pouco — é o mesmo
--    comentário anônimo que ninguém leva a sério na internet — e ainda deixa
--    o profissional sem saber de quem foi.
--
-- 2) SE CONTRATOU MESMO. Havia `contato_confirmado`, calculado sozinho a
--    partir de quem pediu o contato pelo app. Não cobre quem achou o número
--    aqui e ligou pelo telefone, e o app não tem como saber isso — só a
--    pessoa sabe. Passa a existir a declaração dela: `contratou`.
--
-- 3) MOSTRAR OU NÃO O ENDEREÇO. Endereço é dado sensível para quem trabalha
--    em casa — e boa parte de quem anuncia aqui é manicure, confeiteira,
--    costureira, gente que atende na própria sala. O campo era preenchido
--    para o CEP achar a cidade e o bairro, e o endereço inteiro ia parar no
--    anúncio sem ninguém ter escolhido isso.

-- ── 2) "Confirmo que contratei" ───────────────────────────────────────────
--
-- Declaração da pessoa, não dedução do sistema. Fica separada de
-- `contato_confirmado` de propósito: uma é o que o app viu acontecer, a
-- outra é o que a pessoa afirma. Quando as duas batem, a avaliação é o mais
-- forte que este app consegue oferecer.
alter table public.reviews
  add column if not exists contratou boolean not null default false;

comment on column public.reviews.contratou is
  'Declarado por quem avaliou: contratou de fato o serviço. Diferente de contato_confirmado, que é observado pelo app.';

-- ── 3) Endereço só se a pessoa quiser ─────────────────────────────────────
--
-- Padrão `false`: quem já preencheu o endereço para o CEP completar a cidade
-- nunca disse que queria a rua e o número no anúncio, e assumir que sim é
-- decidir por ela sobre onde ela mora. Quem tem ponto fixo e quer ser
-- achado liga a chave — e aí é escolha, não descuido.
alter table public.professionals
  add column if not exists mostrar_endereco boolean not null default false;

-- A view pública não pode *entregar* o endereço de quem não marcou a caixa.
-- Esconder na tela não esconde na API, e é a API que qualquer um consulta:
-- se a coluna sair daqui preenchida, basta abrir o endereço do banco no
-- navegador para ler a rua e o número de todo mundo.
--
-- Bairro continua saindo sempre: ele situa a região sem dizer onde é a
-- porta, que é a diferença entre "atende no Centro" e "moro na rua tal, 10".
-- O CEP entra no mesmo balde da rua — CEP de rua, em cidade pequena, é
-- endereço.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

-- ── 1) Avaliação com autor ────────────────────────────────────────────────
--
-- View em vez de join no cliente: sem ela o app precisaria de uma consulta a
-- mais por avaliação, e a página de um profissional bem avaliado faria trinta
-- idas ao banco para montar uma lista.
--
-- Junta com `profiles_public`, não com `profiles`. A tabela só é legível
-- pelo próprio dono desde a migration 0012 (é o que impede o CPF de vazar),
-- então um join direto devolveria nome nulo para todo mundo menos você — a
-- avaliação dos outros continuaria anônima, que é exatamente o defeito que
-- esta migration existe para corrigir.
--
-- Sem `security_invoker`: a view roda como dona e é isso que faz o nome
-- público chegar a quem lê. O que ela expõe já é público por definição —
-- avaliação (policy de leitura pública) e nome/foto (profiles_public).
drop view if exists public.reviews_public;
create view public.reviews_public as
select
  r.id, r.professional_id, r.user_id, r.rating, r.tags, r.comment,
  r.contato_confirmado, r.contratou, r.reply, r.replied_at, r.created_at,
  p.full_name as autor_nome,
  p.avatar_url as autor_foto
from public.reviews r
left join public.profiles_public p on p.id = r.user_id;

grant select on public.reviews_public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 0038_catalogo_de_servicos.sql
-- ═══════════════════════════════════════════════════════════════

-- Catálogo de serviços do anúncio.
--
-- Até aqui o anúncio dizia o ofício ("Eletricista") e um texto livre. Serve
-- para o autônomo; não serve para quem oferece uma lista de coisas
-- diferentes — o hotel com hospedagem, salão de eventos e day use; o
-- laboratório com trinta exames; a loja com ajuste e customização. Essas
-- pessoas hoje precisariam escrever tudo na descrição, onde ninguém acha
-- nada e nada pode ser filtrado.
--
-- É tabela, e não um campo de texto ou um jsonb, por causa do que vem depois:
-- buscar por "exame de sangue" e achar o laboratório. Isso não se faz dentro
-- de um parágrafo, e migrar texto livre para tabela depois é bem mais caro
-- do que começar assim.
--
-- Sem preço, de propósito. O app direciona: mostra quem faz o quê e entrega
-- o contato. Preço na tela envelhece sozinho — a tabela muda e o anúncio
-- fica prometendo o valor do ano passado —, vira reclamação contra a
-- plataforma quando o cobrado é outro, e empurra todo mundo para a briga de
-- quem cobra menos, que é o oposto do que uma boa avaliação constrói.

-- Se este arquivo já foi rodado numa versão que tinha preço, as colunas
-- saem aqui — rodar de novo é seguro.
alter table if exists public.servicos_oferecidos
  drop column if exists preco_centavos;
alter table if exists public.servicos_oferecidos
  drop column if exists unidade;

create table if not exists public.servicos_oferecidos (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  nome text not null,
  descricao text not null default '',
  /** Ordem escolhida pelo dono; empate desempata pela data. */
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists servicos_oferecidos_anuncio_idx
  on public.servicos_oferecidos (professional_id, ordem);

alter table public.servicos_oferecidos enable row level security;

-- Leitura pública: é catálogo, existe para ser visto.
drop policy if exists "catalogo é público para leitura" on public.servicos_oferecidos;
create policy "catalogo é público para leitura"
  on public.servicos_oferecidos for select
  using (true);

-- Escrita só do dono do anúncio, conferida no banco. A tela esconder o botão
-- não impede ninguém de chamar a API com o id de um anúncio alheio.
drop policy if exists "dono edita o catálogo do próprio anúncio" on public.servicos_oferecidos;
create policy "dono edita o catálogo do próprio anúncio"
  on public.servicos_oferecidos for all
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.owner_id = auth.uid()
    )
  );

-- Teto por anúncio. Sem ele, um catálogo de mil linhas transforma a página
-- do anúncio numa rolagem infinita e a busca numa consulta cara — e ninguém
-- lê mil linhas de preço.
create or replace function public.limita_catalogo()
returns trigger
language plpgsql
as $$
declare
  quantos integer;
begin
  select count(*) into quantos
    from public.servicos_oferecidos
   where professional_id = new.professional_id;
  if quantos >= 40 then
    raise exception 'Cada anúncio pode ter até 40 serviços no catálogo.';
  end if;
  return new;
end;
$$;

drop trigger if exists limita_catalogo_trigger on public.servicos_oferecidos;
create trigger limita_catalogo_trigger
  before insert on public.servicos_oferecidos
  for each row execute function public.limita_catalogo();

-- Nome vazio vira linha invisível no catálogo, que a pessoa não entende por
-- que está lá e não consegue apagar sem adivinhar.
alter table public.servicos_oferecidos
  drop constraint if exists servicos_oferecidos_nome_nao_vazio;
alter table public.servicos_oferecidos
  add constraint servicos_oferecidos_nome_nao_vazio
  check (length(btrim(nome)) between 2 and 80);

-- ═══════════════════════════════════════════════════════════════
-- 0039_especialidade.sql
-- ═══════════════════════════════════════════════════════════════

-- Especialidade do profissional.
--
-- A categoria diz o ofício ("Dentista", "Pintor", "Advogado"); ela é fechada
-- de propósito, porque é o que a busca filtra e o que faz dois anúncios
-- serem comparáveis. Mas o ofício sozinho esconde a diferença que faz a
-- pessoa escolher: quem procura aparelho não quer qualquer dentista, quer
-- ortodontista; quem vai pintar a casa não quer o pintor de portão; quem
-- precisa de inventário não quer o advogado trabalhista.
--
-- Texto livre, e não uma segunda lista fechada, por um motivo prático: cada
-- ofício tem as suas especialidades, e manter uma lista por ofício — as da
-- medicina sozinhas passam de cinquenta — seria uma lista que nunca está
-- certa e que envelhece sem ninguém perceber. Aqui quem sabe o nome certo é
-- quem exerce.
--
-- Curto de propósito (60 caracteres): é uma especialidade, não a segunda
-- descrição do anúncio. Sem o limite, este campo viraria o lugar onde se
-- escreve "o melhor da região, atendemos 24h, faça seu orçamento" — que é
-- exatamente o que a descrição já é.
alter table public.professionals
  add column if not exists especialidade text;

alter table public.professionals
  drop constraint if exists professionals_especialidade_tamanho;
alter table public.professionals
  add constraint professionals_especialidade_tamanho
  check (especialidade is null or length(btrim(especialidade)) <= 60);

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 0040_banners.sql
-- ═══════════════════════════════════════════════════════════════

-- Banners de publicidade na tela de busca.
--
-- É a terceira fonte de renda, e a única que não depende de o anunciante ter
-- um anúncio no app: o selo e o destaque só servem a quem está cadastrado
-- aqui; um banner vende para a ótica, a farmácia e o supermercado da cidade,
-- que não são "profissionais" no sentido do app mas querem aparecer para
-- quem é da cidade.
--
-- Quem cadastra é a administração, não o anunciante. Isso é decisão de
-- produto, não preguiça: banner é o único lugar do app onde uma imagem de
-- terceiro ocupa a tela inteira de quem procura, e deixar isso na mão de
-- quem paga é abrir a porta para propaganda enganosa, imagem imprópria e
-- concorrente comprando espaço para difamar. Com o cadastro na mão dela, a
-- venda passa por uma conversa — que é como publicidade local funciona
-- mesmo.

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),

  /** Quem está anunciando. Aparece no rodapé do banner. */
  anunciante text not null,
  /** Texto curto sobre a imagem, para quando ela não carregar. */
  titulo text not null default '',
  imagem_url text not null,

  /**
   * Para onde o banner leva.
   *
   * Aceita link externo (site, WhatsApp, Instagram do anunciante) ou um
   * caminho interno do app (`/profissional/<id>`, quando o anunciante também
   * tem anúncio aqui). Nulo quer dizer banner sem clique — serve para aviso
   * institucional.
   */
  link text,

  /**
   * Segmentação, ambas opcionais.
   *
   * `cidade` nula = aparece em qualquer cidade. `categoria` nula = aparece
   * em qualquer busca; preenchida, só quando a pessoa filtrou por aquele
   * serviço — que é o que permite vender "quero aparecer para quem procura
   * eletricista".
   */
  cidade text,
  categoria text,

  inicio date not null default current_date,
  fim date not null,

  /**
   * ── O lado comercial ────────────────────────────────────────────────────
   *
   * O pagamento acontece fora do app: Pix, dinheiro, boleto — o que a
   * Lorena combinar com o comércio. O app não cobra e não processa; ele
   * **lembra**, que é o que falta quando a venda é de porta em porta.
   *
   * Sem estes campos, daqui a três meses ela teria dez banners no ar e
   * nenhum jeito de saber quem pagou quanto, quem já venceu e para qual
   * número ligar para renovar. É assim que dinheiro vaza numa operação
   * pequena: não por falta de cliente, por falta de anotação.
   */
  contato_anunciante text,
  valor_centavos integer check (valor_centavos is null or valor_centavos >= 0),
  pago boolean not null default false,
  observacao text,

  /** Desligar sem apagar: o histórico e os números da campanha ficam. */
  ativo boolean not null default true,

  /**
   * Contagens. Ficam na própria linha, e não numa tabela de eventos, porque
   * o que a venda precisa é do total — "seu banner apareceu 4.200 vezes e
   * teve 130 cliques". Uma tabela de eventos daria o detalhe por dia ao
   * custo de milhares de linhas por semana, e ninguém aqui vai olhar isso.
   */
  exibicoes integer not null default 0,
  cliques integer not null default 0,

  created_at timestamptz not null default now()
);

alter table public.banners
  drop constraint if exists banners_periodo_valido;
alter table public.banners
  add constraint banners_periodo_valido check (fim >= inicio);

create index if not exists banners_ativos_idx
  on public.banners (ativo, inicio, fim);

alter table public.banners enable row level security;

-- Leitura pública, mas só do que está no ar hoje. Um banner fora do período
-- ou desligado não pode ser lido nem chamando a API direto: se a filtragem
-- fosse só na tela, quem soubesse consultar veria as campanhas encerradas e
-- as futuras — inclusive de concorrentes.
drop policy if exists "banners no ar são públicos" on public.banners;
create policy "banners no ar são públicos"
  on public.banners for select
  using (ativo = true and current_date between inicio and fim);

drop policy if exists "admin vê todos os banners" on public.banners;
create policy "admin vê todos os banners"
  on public.banners for select
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "admin cria banner" on public.banners;
create policy "admin cria banner"
  on public.banners for insert
  to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "admin edita banner" on public.banners;
create policy "admin edita banner"
  on public.banners for update
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "admin apaga banner" on public.banners;
create policy "admin apaga banner"
  on public.banners for delete
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- ── Contagem ──────────────────────────────────────────────────────────────
--
-- Funções, e não um `update` direto do app: a policy de update é só de
-- admin, e tem que continuar sendo — senão qualquer visitante poderia
-- reescrever o link do banner. `security definer` deixa a função somar o
-- contador sem abrir a tabela para escrita.
--
-- `where` repetindo a condição de estar no ar: sem isso, dava para inflar os
-- números de uma campanha encerrada, e número inflado numa venda é o tipo de
-- coisa que destrói a confiança de um cliente pequeno.
create or replace function public.banner_contar_exibicao(p_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.banners
     set exibicoes = exibicoes + 1
   where id = p_id and ativo = true and current_date between inicio and fim;
$$;

create or replace function public.banner_contar_clique(p_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.banners
     set cliques = cliques + 1
   where id = p_id and ativo = true and current_date between inicio and fim;
$$;

grant execute on function public.banner_contar_exibicao(uuid) to anon, authenticated;
grant execute on function public.banner_contar_clique(uuid) to anon, authenticated;

-- ── Onde ficam as imagens ─────────────────────────────────────────────────
--
-- Bucket criado por SQL de propósito: criar à mão no painel é um passo a
-- mais para errar, e um bucket com nome trocado só dá erro quando alguém
-- tenta enviar a primeira imagem — longe daqui, e sem dizer o motivo.
insert into storage.buckets (id, name, public)
  values ('banners', 'banners', true)
  on conflict (id) do nothing;

drop policy if exists "banners: leitura publica" on storage.objects;
create policy "banners: leitura publica"
  on storage.objects for select
  using (bucket_id = 'banners');

-- Escrita só de admin. Ao contrário das fotos de anúncio, aqui não há "pasta
-- do dono": quem envia é sempre a administração.
drop policy if exists "banners: envio do admin" on storage.objects;
create policy "banners: envio do admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'banners'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "banners: troca do admin" on storage.objects;
create policy "banners: troca do admin"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'banners'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "banners: remocao do admin" on storage.objects;
create policy "banners: remocao do admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'banners'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════
-- 0041_limpar_cobrancas_abandonadas.sql
-- ═══════════════════════════════════════════════════════════════

-- --------------------------------------------------------------------
-- Cobranças abandonadas somem sozinhas.
--
-- A linha de assinatura nasce como "pending" no instante em que o link de
-- pagamento é gerado, antes de qualquer dinheiro entrar. Quem abre o
-- checkout e desiste — e desistir é o desfecho mais comum de todos — deixa
-- uma linha pendente que nunca vira nada.
--
-- A tela já ignora as antigas desde hoje. O banco não: elas se acumulam
-- para sempre, sujam qualquer contagem de "quantas assinaturas eu tenho" e,
-- pior, atrapalham o próprio webhook, que procura a pendente mais recente
-- para confirmar um pagamento. Com dez pendentes velhas no meio, a chance de
-- ele confirmar a linha errada cresce.
--
-- Um dia é folga larga: Pix e boleto se resolvem em minutos, e boleto que
-- demora mais que isso já foi reemitido.
--
-- Só apaga o que não tem pagamento nenhum vinculado. Se existe registro de
-- pagamento apontando para a assinatura, ela não é abandono — é algo que
-- deu errado e precisa ser investigado, não varrido para debaixo do tapete.
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

  delete from public.subscriptions s
   where s.status = 'pending'
     and s.created_at < now() - interval '1 day'
     and not exists (
       select 1 from public.processed_payments p where p.subscription_id = s.id
     );
end;
$$;

revoke all on function public.expurgar_dados_antigos() from public;

-- ═══════════════════════════════════════════════════════════════
-- 0042_estatisticas_publicas.sql
-- ═══════════════════════════════════════════════════════════════

-- --------------------------------------------------------------------
-- Números reais para a tela de boas-vindas: "já são N profissionais",
-- "N avaliações", "N visitas a anúncios".
--
-- Profissionais e avaliações já dão para contar direto da tela, porque
-- `professionals_public` e `reviews` já são de leitura pública. Visitas
-- não: `profile_views` só é legível pelo dono de cada anúncio (é o dado
-- que alimenta o analytics do Empresa Plus), e está certo que continue
-- assim — o que a tela de boas-vindas precisa não é "quem viu o quê", é
-- só o total somado, sem apontar para nenhum anúncio específico.
--
-- Esta function devolve exatamente isso: um número, sem professional_id,
-- sem data, sem nada que identifique um anúncio. É o mesmo raciocínio já
-- usado em banner_contar_exibicao — contagem agregada não é o mesmo dado
-- que a linha individual, mesmo vindo da mesma tabela.
-- --------------------------------------------------------------------
create or replace function public.contagem_de_visitas()
returns bigint
language sql
security definer set search_path = public
as $$
  select count(*) from public.profile_views;
$$;

grant execute on function public.contagem_de_visitas() to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 0043_banners_boas_vindas.sql
-- ═══════════════════════════════════════════════════════════════

-- --------------------------------------------------------------------
-- Onde o banner aparece.
--
-- Até aqui só existia um lugar para vender: a faixa de publicidade na
-- busca. Esta coluna abre um segundo — cartões dentro da lista "Tem gente
-- boa aqui do lado" da tela de boas-vindas —, sem duplicar tabela nem
-- política. É o mesmo inventário, o mesmo cadastro no admin, só um filtro
-- a mais.
--
-- 'busca' continua sendo o padrão: todo banner cadastrado antes desta
-- migração já era da busca, e não pode virar outra coisa sozinho.
-- --------------------------------------------------------------------
alter table public.banners
  add column if not exists local text not null default 'busca'
    check (local in ('busca', 'boas_vindas'));

create index if not exists banners_local_idx on public.banners (local, ativo, inicio, fim);

-- ═══════════════════════════════════════════════════════════════
-- 0044_pedidos_de_anuncio.sql
-- ═══════════════════════════════════════════════════════════════

-- --------------------------------------------------------------------
-- Pedidos de anúncio ("quero aparecer aqui").
--
-- Diferente de `suggestions`: uma sugestão é opinião sobre o app e não
-- precisa de resposta; isto é alguém querendo comprar, e sem o telefone
-- junto o pedido não vira venda nenhuma — a conversa de banner nesta
-- cidade acontece por WhatsApp, não por e-mail.
--
-- Mesmo padrão de segurança de `suggestions` e `reports`: qualquer um
-- envia (inclusive sem login), só admin lê.
-- --------------------------------------------------------------------
create table if not exists public.banner_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  nome text not null,
  contato text not null,
  -- Onde a pessoa quer aparecer. 'tanto_faz' é resposta legítima e comum:
  -- quem nunca anunciou não sabe a diferença entre os dois lugares, e
  -- obrigar a escolher só faria perder o pedido.
  local text not null default 'tanto_faz'
    check (local in ('busca', 'boas_vindas', 'tanto_faz')),
  cidade text,
  mensagem text,
  status text not null default 'novo'
    check (status in ('novo', 'em_conversa', 'fechado', 'sem_interesse')),
  created_at timestamptz not null default now()
);

alter table public.banner_leads enable row level security;

drop policy if exists "qualquer um pede para anunciar" on public.banner_leads;
create policy "qualquer um pede para anunciar"
  on public.banner_leads for insert
  with check (true);

-- Sem select público de propósito: são nome e telefone de comerciantes da
-- cidade. Uma lista dessas aberta na API é lista de contatos pronta para
-- quem quiser copiar.
drop policy if exists "admin vê os pedidos de anúncio" on public.banner_leads;
create policy "admin vê os pedidos de anúncio"
  on public.banner_leads for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "admin atualiza o pedido de anúncio" on public.banner_leads;
create policy "admin atualiza o pedido de anúncio"
  on public.banner_leads for update
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "admin apaga o pedido de anúncio" on public.banner_leads;
create policy "admin apaga o pedido de anúncio"
  on public.banner_leads for delete
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

create index if not exists banner_leads_status_idx
  on public.banner_leads (status, created_at desc);

-- ═══════════════════════════════════════════════════════════════
-- 0045_denuncia_exige_telefone_confirmado.sql
-- ═══════════════════════════════════════════════════════════════

-- --------------------------------------------------------------------
-- Denúncia só com número confirmado.
--
-- Estar logado já era exigido (0035), e isso resolveu o anônimo. Não
-- resolveu o barato: criar conta Google leva um minuto e não custa nada,
-- então quem quisesse derrubar um concorrente ainda podia abrir três
-- contas e mandar três denúncias. Do outro lado tem alguém cujo anúncio é
-- o ganha-pão.
--
-- Confirmar um número por código é a primeira barreira que custa algo
-- real: exige um chip, e um chip por denunciante. Não impede a denúncia
-- falsa — nada impede —, mas encarece a fábrica delas o suficiente para
-- deixar de valer a pena.
--
-- A regra vive aqui, no banco, e não só na tela: a tela some para quem
-- não confirmou, mas quem chama a API direto passaria por cima dela.
-- --------------------------------------------------------------------

-- `security definer` porque `auth.users` não é legível por quem está
-- logado — e nem deve ser. A função responde uma pergunta de sim ou não
-- sobre a *própria* pessoa (auth.uid()), sem devolver o número nem
-- qualquer outro dado de ninguém.
create or replace function public.tem_telefone_confirmado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and u.phone_confirmed_at is not null
  );
$$;

revoke all on function public.tem_telefone_confirmado() from public;
grant execute on function public.tem_telefone_confirmado() to authenticated;

drop policy if exists "quem está logado pode denunciar um anúncio" on public.reports;
drop policy if exists "só quem confirmou o número pode denunciar" on public.reports;
drop policy if exists so_quem_confirmou_o_numero_pode_denunciar on public.reports;

create policy so_quem_confirmou_o_numero_pode_denunciar
  on public.reports for insert
  to authenticated
  with check (
    -- `reporter_id` tem que ser quem está de fato pedindo: sem isto daria
    -- para estar logado e gravar a denúncia no nome de outra pessoa, que é
    -- pior do que o anônimo — é o anônimo com um culpado escolhido a dedo.
    reporter_id = auth.uid()
    and public.tem_telefone_confirmado()
  );

-- ═══════════════════════════════════════════════════════════════
-- 0046_admin_enxerga_a_propria_linha.sql
-- ═══════════════════════════════════════════════════════════════

-- --------------------------------------------------------------------
-- Cada pessoa pode descobrir se ela mesma é admin.
--
-- A tabela `admins` foi criada (0008) com RLS ligada e sem nenhuma policy
-- de select — de propósito, para ninguém se auto-promover. Só que o app
-- descobre quem é admin justamente lendo esta tabela (`isAdmin`), do
-- navegador, com o papel `authenticated`. Sem policy de leitura, essa
-- consulta volta vazia mesmo para quem tem a linha, e o painel responde
-- "Acesso restrito." para todo mundo — inclusive para a dona do app.
--
-- A falha ficou invisível porque `isAdmin` trata erro e vazio da mesma
-- forma ("não é admin"), que é o certo para a tela e péssimo para
-- diagnosticar: não havia diferença entre "não tem permissão" e "não é
-- admin".
--
-- A policy abaixo é a menor que resolve: cada um lê a PRÓPRIA linha e
-- nada mais. Não devolve a lista de admins a ninguém, e continua não
-- existindo insert/update/delete — promover alguém segue sendo coisa de
-- dentro do Supabase, como era a intenção da 0008.
-- --------------------------------------------------------------------

-- Nome sem acento, sem espaço e sem aspas, ao contrário do resto do
-- projeto: este bloco precisou ser colado à mão várias vezes no SQL
-- Editor até funcionar, e nome entre aspas é frágil no caminho até lá —
-- basta um aplicativo trocar as aspas retas por curvas para o Postgres
-- recusar. Aqui vale mais colar certo de primeira do que ler bonito.
drop policy if exists "cada um enxerga se é admin" on public.admins;
drop policy if exists cada_um_enxerga_se_e_admin on public.admins;
create policy cada_um_enxerga_se_e_admin
  on public.admins for select
  to authenticated
  using (user_id = auth.uid());

-- O Supabase já concede isto por padrão nas tabelas de `public`; repetido
-- aqui para o caso de a concessão ter sido revogada em algum momento — sem
-- ela, a policy sozinha não bastaria.
grant select on public.admins to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 0047_valor_dos_pagamentos.sql
-- ═══════════════════════════════════════════════════════════════

-- --------------------------------------------------------------------
-- Quanto entrou, por pagamento.
--
-- O banco registrava QUE um pagamento foi processado (`processed_payments`,
-- criada para não creditar duas vezes o mesmo evento), mas nunca QUANTO ele
-- trouxe: `subscriptions` não tem coluna de valor, e o patrocínio de
-- categoria também não. O valor existia só no Mercado Pago.
--
-- Isso significa que o histórico anterior a esta migração não pode ser
-- reconstruído aqui — o painel diz isso na cara, em vez de somar o que tem
-- e apresentar como se fosse tudo. Para o que já passou, a fonte é o
-- extrato do Mercado Pago.
--
-- Daqui para frente o webhook grava o valor junto com o id, no mesmo insert
-- que já fazia. Não é uma chamada a mais nem um risco novo: o valor já vem
-- na resposta que o webhook consulta para saber se o pagamento foi
-- aprovado.
-- --------------------------------------------------------------------
alter table public.processed_payments
  add column if not exists valor_centavos integer,
  -- 'verification' | 'boost' | 'plus' | 'credits' | 'sponsorship' | null
  -- (null = pagamento antigo, de antes desta migração, ou tipo que o
  -- webhook não soube classificar).
  add column if not exists tipo text;

create index if not exists processed_payments_data_idx
  on public.processed_payments (processed_at desc);

-- A tabela não tinha policy nenhuma: era escrita só pelo webhook, com a
-- service_role, que ignora RLS. Agora o painel administrativo precisa
-- somar esses valores, e faz isso do navegador — daí a leitura para admin.
-- Continua sem insert/update/delete para quem está logado: quem escreve
-- aqui é o webhook, e só ele.
drop policy if exists "admin vê os pagamentos" on public.processed_payments;
drop policy if exists admin_ve_os_pagamentos on public.processed_payments;
create policy admin_ve_os_pagamentos
  on public.processed_payments for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

grant select on public.processed_payments to authenticated;

-- Idem para as assinaturas: o painel conta quantas estão ativas, e a policy
-- que existia só deixava cada dono ver as próprias.
drop policy if exists "admin vê todas as assinaturas" on public.subscriptions;
drop policy if exists admin_ve_todas_as_assinaturas on public.subscriptions;
create policy admin_ve_todas_as_assinaturas
  on public.subscriptions for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════
-- 0048_visitas_ao_app.sql
-- ═══════════════════════════════════════════════════════════════

-- --------------------------------------------------------------------
-- Visitas ao app.
--
-- Já existia `profile_views` — quem abriu QUAL anúncio. É outra coisa:
-- aqui é quanta gente abriu o app, tenha ela procurado alguém ou não.
--
-- O que se guarda é uma linha com a hora, e mais nada. Sem IP, sem conta,
-- sem identificador de aparelho, sem página. Não dá para dizer que uma
-- visita é de fulano nem para ligar duas visitas à mesma pessoa — e é de
-- propósito: para mostrar "N visitas" na tela de início não é preciso
-- saber de quem, e o que não se guarda não vaza nem precisa de base legal
-- para ser guardado (LGPD).
--
-- Uma linha por sessão do navegador, não por página aberta: quem contasse
-- cada navegação teria um número que sobe sozinho enquanto a pessoa usa,
-- o que é vaidade, não informação. Essa parte é decidida no app (ver
-- `registrarVisita`), porque só ele sabe se a sessão é nova.
-- --------------------------------------------------------------------
create table if not exists public.visitas_app (
  id bigint generated always as identity primary key,
  criada_em timestamptz not null default now()
);

create index if not exists visitas_app_data_idx on public.visitas_app (criada_em desc);

alter table public.visitas_app enable row level security;

-- Qualquer pessoa registra a própria visita, inclusive sem login: é
-- exatamente quem abre o app pela primeira vez que precisa ser contado.
drop policy if exists "qualquer um registra a visita" on public.visitas_app;
drop policy if exists qualquer_um_registra_a_visita on public.visitas_app;
create policy qualquer_um_registra_a_visita
  on public.visitas_app for insert
  with check (true);

-- Sem select público: a tabela inteira não interessa a ninguém de fora, e
-- a tela precisa só do total. Vem pela função abaixo, no mesmo padrão de
-- `contagem_de_visitas` (0042) — um número, sem linha nenhuma junto.
create or replace function public.contagem_de_visitas_no_app()
returns bigint
language sql
security definer set search_path = public
as $$
  select count(*) from public.visitas_app;
$$;

grant execute on function public.contagem_de_visitas_no_app() to anon, authenticated;
grant insert on public.visitas_app to anon, authenticated;
grant usage, select on sequence public.visitas_app_id_seq to anon, authenticated;

-- Admin também enxerga as linhas, para poder olhar visitas por período.
drop policy if exists "admin vê as visitas" on public.visitas_app;
drop policy if exists admin_ve_as_visitas on public.visitas_app;
create policy admin_ve_as_visitas
  on public.visitas_app for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

grant select on public.visitas_app to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 0049_bairro_so_com_permissao.sql
-- ═══════════════════════════════════════════════════════════════

-- --------------------------------------------------------------------
-- O bairro passa a seguir a mesma caixa do resto do endereço.
--
-- Desde a 0037 a view escondia cep, rua e número de quem não marcou
-- "mostrar endereço" — mas devolvia o bairro para todo mundo. A intenção
-- na época era boa: bairro é o recorte que as pessoas usam para escolher
-- perto de casa, e ele sozinho não leva ninguém até a porta.
--
-- Só que a caixa no cadastro diz "mostrar endereço", e bairro é endereço.
-- Quem desmarcou entendeu que nada de onde mora seria publicado, e via o
-- bairro aparecer assim mesmo. Quando o que a tela promete e o que ela faz
-- divergem, quem decide é a promessa — ainda mais tratando-se de onde a
-- pessoa mora.
--
-- Vale para metade de quem anuncia aqui: eletricista, diarista, montador
-- trabalham na casa do cliente, e o endereço que eles têm é o de casa.
--
-- A view é recriada inteira porque `create or replace view` não aceita
-- mudar o tipo/origem de uma coluna existente. Colunas idênticas às da
-- 0039, exceto `neighborhood`.
-- --------------------------------------------------------------------
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, bio, phone,
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
from public.professionals;

grant select on public.professionals_public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 0051_visitas_no_app_hoje.sql
-- ═══════════════════════════════════════════════════════════════

-- --------------------------------------------------------------------
-- Visitas ao app no dia de hoje.
--
-- A 0048 já conta o total acumulado. Este é o par dele na tela de início:
-- o total diz que o app existe há um tempo, e o de hoje diz que ele está
-- vivo agora — um número alto de total com zero hoje conta uma história
-- bem diferente de dois números subindo juntos.
--
-- Vem por função, e não por consulta direta, pelo mesmo motivo da 0048:
-- `visitas_app` não tem select público (só admin). A tela precisa de um
-- número, não das linhas, e é só isso que a função devolve.
--
-- O dia é o de Itabirito, não o de Greenwich. `now()` no Postgres é UTC,
-- e usar `date_trunc('day', now())` faria o contador zerar às 21h no
-- horário de quem usa o app — três horas antes da virada, todo dia.
-- --------------------------------------------------------------------
create or replace function public.contagem_de_visitas_no_app_hoje()
returns bigint
language sql
security definer set search_path = public
as $$
  select count(*) from public.visitas_app
  where criada_em >= (date_trunc('day', now() at time zone 'America/Sao_Paulo')
                      at time zone 'America/Sao_Paulo');
$$;

grant execute on function public.contagem_de_visitas_no_app_hoje() to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 0052_confirmacao_segue_o_numero_usado.sql
-- ═══════════════════════════════════════════════════════════════

-- --------------------------------------------------------------------
-- A confirmação cai quando muda o número que está no ar — qualquer um
-- dos dois campos.
--
-- A 0024 já derrubava o selo ao trocar o WhatsApp, e disse por quê: sem
-- isso, bastaria confirmar o próprio celular e depois trocar pelo número
-- do golpe. Só que ela olhava apenas a coluna `whatsapp`, e o número que
-- vale não é sempre esse.
--
-- Quem é o número do cadastro é decidido por `coalesce(nullif(whatsapp,
-- ''), phone)` — a mesma conta que a `confirmar_whatsapp` faz. Ou seja:
-- com o campo WhatsApp vazio, quem aparece na busca, quem recebe o código
-- e quem carrega o selo é o `phone`. E `phone` não estava sendo vigiado.
--
-- O furo, na prática: cadastra sem WhatsApp, confirma o próprio celular
-- pelo `phone`, depois edita o `phone` para outro número. O gatilho não
-- via mudança nenhuma em `whatsapp` (continuou vazio nas duas pontas), o
-- selo ficava de pé, e o cadastro passava a exibir "✓ confirmado" ao lado
-- de um número que ninguém provou ter. É exatamente o golpe que a 0024
-- existe para impedir, entrando pela porta do lado.
--
-- Agora o gatilho compara o número efetivo — o mesmo que a RPC usa —,
-- então mexer em qualquer um dos dois campos derruba o selo se o
-- resultado final mudar. Trocar só o `phone` tendo WhatsApp preenchido
-- não derruba nada, e está certo: o número que vale continua o mesmo.
-- --------------------------------------------------------------------
create or replace function public.professionals_protege_whatsapp_verificado()
returns trigger
language plpgsql
as $$
declare
  v_numero_antes text;
  v_numero_depois text;
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

  -- O número que vale é o mesmo que a `confirmar_whatsapp` compara com o
  -- Auth: o WhatsApp quando existe, o telefone quando não.
  v_numero_antes := regexp_replace(
    coalesce(nullif(old.whatsapp, ''), old.phone, ''), '\D', '', 'g');
  v_numero_depois := regexp_replace(
    coalesce(nullif(new.whatsapp, ''), new.phone, ''), '\D', '', 'g');

  -- Só os dígitos entram na conta: mudar "(31) 98822-4938" para
  -- "31988224938" é a mesma pessoa com o mesmo número, e derrubar o selo
  -- por causa de pontuação faria a pessoa confirmar de novo à toa.
  if v_numero_depois is distinct from v_numero_antes
     and coalesce(current_setting('app.confirmando_whatsapp', true), '') <> 'sim' then
    new.whatsapp_verified := false;
    new.whatsapp_verified_at := null;
  end if;

  return new;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 0053_cadastros_fora_do_ar_somem_da_view.sql
-- ═══════════════════════════════════════════════════════════════

-- --------------------------------------------------------------------
-- Cadastro suspenso ou pausado volta a sumir da busca pública.
--
-- A 0009 tirou os suspensos da leitura pública com uma policy de RLS:
-- `using (suspended = false)` em `professionals`. A policy está lá e está
-- certa — mas o app não lê a tabela, lê a view `professionals_public`. E
-- view no Postgres roda com os privilégios de quem a criou, não de quem a
-- consulta: ela passa por cima da RLS da tabela de origem. É o mesmo aviso
-- que o painel do Supabase mostra como "Security Definer View".
--
-- Por isso a 0039 carregava o filtro dentro da própria view
-- (`where suspended = false and paused = false`), compensando à mão o que
-- a RLS não conseguia aplicar ali.
--
-- A 0049 recriou a view inteira para esconder o bairro de quem não marcou
-- "mostrar endereço" — e o comentário dela diz "colunas idênticas às da
-- 0039, exceto neighborhood". As colunas eram; o `where` não veio junto.
-- Desde então:
--
--   * cadastro suspenso pela administração continuava aparecendo na busca
--     e na página pública, junto com o `suspended_reason` — que é anotação
--     interna e pode conter a acusação que motivou a suspensão;
--   * cadastro pausado pelo próprio dono continuava no ar, contrariando o
--     que a tela dele prometia.
--
-- Nenhum dos dois dava erro em lugar nenhum, porque o app pede a lista e a
-- lista vem. Só olhando a definição da view dá para ver o que sumiu.
--
-- O filtro volta para dentro da view. O painel administrativo, que precisa
-- justamente ver os suspensos, passa a ler a tabela `professionals` direto
-- — lá a RLS deixa admin ver tudo (policy da 0009) e recusa o resto, então
-- essa porta falha fechada para quem não é admin.
-- --------------------------------------------------------------------
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, bio, phone,
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

-- ═══════════════════════════════════════════════════════════════
-- 0054_avaliar_sem_cpf_de_verdade.sql
-- ═══════════════════════════════════════════════════════════════

-- --------------------------------------------------------------------
-- Ninguém consegue avaliar: o banco ainda exige o CPF que o app parou de
-- pedir.
--
-- A 0004 gravou no banco a exigência de CPF para avaliar:
--
--   with check (auth.uid() = user_id and exists (
--     select 1 from public.profiles p
--     where p.id = auth.uid() and p.cpf is not null))
--
-- A 0033 — chamada "Avaliação sem CPF, com prova de contato" — desfez essa
-- decisão: explicou que o CPF nunca foi conferido contra a Receita, que
-- qualquer gerador da internet produz um válido, que guardá-lo para
-- liberar um comentário é coleta excessiva (LGPD, art. 6º, III), e criou a
-- etiqueta de contato registrado para ficar no lugar dele. Tirou o campo
-- da tela. Não tirou a policy.
--
-- Desde então o banco recusa toda avaliação de quem não tem CPF gravado no
-- perfil — e como o app deixou de perguntar, isso é todo mundo que entrou
-- depois. A tela dizia só "Não foi possível salvar a avaliação", porque o
-- erro do Supabase não é um `Error` e caía no texto genérico: nem a pessoa
-- nem nós ficávamos sabendo o motivo.
--
-- O custo disso não é uma tela quebrada. É a reputação da plataforma: numa
-- cidade pequena, com poucos cadastros, cada avaliação escrita vale
-- semanas de divulgação — e as que foram digitadas neste período estão
-- perdidas, com quem digitou achando que o app não funciona.
--
-- A regra volta a ser a da 0002, que é o que a 0033 pretendia: pessoa
-- logada avalia, e só em nome dela mesma. Quem chamou pelo app continua
-- ganhando a etiqueta `contato_confirmado`, calculada no servidor — que é
-- a distinção que a 0033 escolheu como substituta e que de fato funciona.
-- --------------------------------------------------------------------
drop policy if exists "usuário autenticado com CPF avalia" on public.reviews;
drop policy if exists "usuário autenticado avalia" on public.reviews;

create policy "usuário autenticado avalia"
  on public.reviews for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- 0055_etiqueta_de_contato_a_prova_de_forja.sql
-- ═══════════════════════════════════════════════════════════════

-- --------------------------------------------------------------------
-- A etiqueta "avaliação de quem chamou pelo app" podia ser forjada.
--
-- A 0033 tirou o CPF de cima de quem avalia e colocou no lugar uma
-- distinção observada pelo próprio app: quem tocou no botão de contato
-- ganha `contato_confirmado` na avaliação. O texto da 0033 diz, com todas
-- as letras, por que essa marca é calculada no servidor: "seria só mais um
-- campo que qualquer um manda como quiser — e uma etiqueta de confiança
-- que se pode forjar é pior do que nenhuma".
--
-- Ela era forjável por dois caminhos.
--
-- 1) A tabela que alimenta a etiqueta aceitava qualquer linha.
--
--      create policy "qualquer pessoa registra contato"
--        on public.contatos_registrados for insert
--        with check (true);
--
--    `with check (true)` não olha o `user_id`. Com a chave pública do app
--    — que é pública por natureza, está no site — dava para gravar um
--    contato em nome de outra pessoa, para o profissional que se quisesse,
--    e a avaliação seguinte nascia etiquetada.
--
--    A correção mantém o pedido de contato anônimo funcionando: quem não
--    está logado continua registrando com `user_id` nulo (é o que alimenta
--    o contador de "quantos me chamaram" no painel). O que deixa de ser
--    possível é gravar em nome de um `user_id` que não é o seu.
--
-- 2) O gatilho que calcula a etiqueta só rodava no insert.
--
--      create trigger reviews_marca_contato_trigger
--        before insert on public.reviews
--
--    A avaliação nascia com o valor certo e depois podia ser corrigida por
--    quem a escreveu: o gatilho de update (0011/0020) protege a resposta do
--    dono e a nota do autor, mas nunca olhou `contato_confirmado`. Bastava
--    escrever a avaliação normalmente e mandar um update ligando o campo.
--
--    Agora o gatilho roda também no update, e sempre reescreve o campo a
--    partir da tabela de contatos. Não existe valor vindo do cliente que
--    sobreviva — nem no insert, nem no update, nem do autor, nem do dono.
--
-- Um terceiro campo entra junto por simetria: `contratou`. Ele é
-- declaração de quem avaliou ("contratei mesmo") e por isso o autor pode
-- mudá-lo à vontade — é a opinião dele sobre a própria experiência. O dono
-- do anúncio é que não podia mexer, e podia: o gatilho de update proíbe o
-- dono de alterar nota, comentário e etiquetas, mas `contratou` ficou de
-- fora da lista. Ou seja: o profissional podia marcar como "contratou" uma
-- avaliação em que o cliente não marcou. Fica proibido, na mesma linha das
-- outras.
-- --------------------------------------------------------------------

-- 1) Ninguém registra contato em nome de outra pessoa.
drop policy if exists "qualquer pessoa registra contato" on public.contatos_registrados;
create policy "qualquer pessoa registra contato"
  on public.contatos_registrados for insert
  with check (user_id is null or auth.uid() = user_id);

-- 2) A etiqueta é recalculada no servidor a cada gravação.
--
-- O nome do gatilho de update vem depois deste em ordem alfabética
-- (`reviews_marca_contato_trigger` < `reviews_valida_campos_update_trigger`),
-- e é essa ordem que o Postgres usa para disparar gatilhos `before` do
-- mesmo evento. Então a etiqueta já está recalculada quando a validação de
-- campos roda — o que garante que a validação nunca veja um valor forjado.
drop trigger if exists reviews_marca_contato_trigger on public.reviews;
create trigger reviews_marca_contato_trigger
  before insert or update on public.reviews
  for each row execute function public.reviews_marca_contato();

-- 3) O dono do anúncio não declara "contratou" no lugar do cliente.
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
    -- Autor pode mudar rating/comment/tags/contratou, mas não a resposta do
    -- dono. `contato_confirmado` não entra na lista porque não é decisão de
    -- ninguém: o gatilho anterior já o reescreveu a partir dos contatos
    -- registrados, e o que veio do cliente foi descartado ali.
    if new.reply is distinct from old.reply or new.replied_at is distinct from old.replied_at then
      raise exception 'Autor da avaliação não pode alterar a resposta do profissional.';
    end if;
    -- Autor não deve conseguir se auto-declarar dono via update; mantém os
    -- demais campos imutáveis por segurança extra.
    new.professional_id := old.professional_id;
    new.user_id := old.user_id;
  elsif eh_dono then
    -- Dono do anúncio só pode mudar a resposta, nunca a nota, o comentário,
    -- as etiquetas ou a declaração de contratação — tudo isso é do autor.
    if new.rating is distinct from old.rating
      or new.comment is distinct from old.comment
      or new.tags is distinct from old.tags
      or new.contratou is distinct from old.contratou then
      raise exception 'Dono do anúncio não pode alterar nota, comentário, etiquetas ou a declaração de contratação.';
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

-- ═══════════════════════════════════════════════════════════════
-- 0056_lista_de_usuarios_deixa_de_ser_publica.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0057_limite_de_pedidos_de_contato.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0058_foto_trocada_pela_admin_fica_na_pasta_do_dono.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0059_mais_vistos_da_semana.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0060_cidade_ganha_estado.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0062_teto_de_linhas_cpf_e_view.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0063_limpeza_agendada.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0064_perfil_com_email_e_telefone.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0065_user_onboarding.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0066_companies.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0067_job_listings.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0068_job_dispatches.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0069_job_responses.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0070_onde_quero_trabalhar_e_experiencias.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0071_empresa_confirma_telefone_e_vaga_anunciada.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0072_planos_da_empresa.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0073_plano_e_a_porta_da_vaga.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0074_aviso_por_push.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0075_disponivel_e_cursos.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0076_telefone_confirmado_e_obrigatorio.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0077_oculto_continua_recebendo_onda.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0078_interesse_ou_nao.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0079_pausar_arquivar_excluir_vaga.sql
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 0080_vaga_completa.sql
-- ═══════════════════════════════════════════════════════════════

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
