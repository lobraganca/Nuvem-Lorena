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

alter table public.profile_views
  add column if not exists viewer_id uuid references auth.users(id) on delete set null;

create index if not exists profile_views_dedupe_idx
  on public.profile_views (professional_id, viewer_id, viewed_at desc);

drop trigger if exists profile_views_freia_abuso_trigger on public.profile_views;
create trigger profile_views_freia_abuso_trigger
  before insert on public.profile_views
  for each row execute function public.profile_views_freia_abuso();

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

alter table public.processed_payments
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null;

create index if not exists processed_payments_subscription_idx
  on public.processed_payments (subscription_id, processed_at desc);

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

drop policy if exists "admin ve toda a fila" on public.destaque_espera;
create policy "admin ve toda a fila"
  on public.destaque_espera for select
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

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

create table if not exists public.indicacoes (
  id uuid primary key default gen_random_uuid(),

  servico_buscado text,
  cidade text,

  nome_indicado text,
  contato_indicado text,
  mensagem text,

  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'nova' check (status in ('nova','contatada','descartada')),
  created_at timestamptz not null default now()
);

alter table public.indicacoes enable row level security;

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

create table if not exists public.contatos_registrados (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,

  tipo text not null,
  created_at timestamptz not null default now()
);

create index if not exists contatos_registrados_par_idx
  on public.contatos_registrados (professional_id, user_id);

alter table public.contatos_registrados enable row level security;

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

comment on column public.profiles.cpf is
  'Legado: não é mais pedido para avaliar (ver migration 0033).';

alter table public.professionals
  add column if not exists atributos text[] not null default '{}';

alter table public.professionals
  drop constraint if exists professionals_atributos_limite;
alter table public.professionals
  add constraint professionals_atributos_limite
  check (array_length(atributos, 1) is null or array_length(atributos, 1) <= 8);

create index if not exists professionals_atributos_idx
  on public.professionals using gin (atributos);

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

drop policy if exists "qualquer um pode denunciar um anúncio" on public.reports;
drop policy if exists "quem está logado pode denunciar um anúncio" on public.reports;

create policy "quem está logado pode denunciar um anúncio"
  on public.reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

alter table public.professionals
  add column if not exists verified_since timestamptz;

update public.professionals
  set verified_since = created_at
  where verified = true and verified_since is null;

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

alter table public.reviews
  add column if not exists contratou boolean not null default false;

comment on column public.reviews.contratou is
  'Declarado por quem avaliou: contratou de fato o serviço. Diferente de contato_confirmado, que é observado pelo app.';

alter table public.professionals
  add column if not exists mostrar_endereco boolean not null default false;

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

alter table if exists public.servicos_oferecidos
  drop column if exists preco_centavos;
alter table if exists public.servicos_oferecidos
  drop column if exists unidade;

create table if not exists public.servicos_oferecidos (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  nome text not null,
  descricao text not null default '',

  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists servicos_oferecidos_anuncio_idx
  on public.servicos_oferecidos (professional_id, ordem);

alter table public.servicos_oferecidos enable row level security;

drop policy if exists "catalogo é público para leitura" on public.servicos_oferecidos;
create policy "catalogo é público para leitura"
  on public.servicos_oferecidos for select
  using (true);

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

alter table public.servicos_oferecidos
  drop constraint if exists servicos_oferecidos_nome_nao_vazio;
alter table public.servicos_oferecidos
  add constraint servicos_oferecidos_nome_nao_vazio
  check (length(btrim(nome)) between 2 and 80);

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
