-- Ei Itabirito — PARTE 2 de 3: planos, telefone confirmado, aviso por push e cursos.
-- Cole tudo, clique uma vez no editor e toque em Run.
-- Pode colar de novo sem medo: repetir não estraga nada.

alter table public.companies
  add column if not exists phone_verified boolean not null default false;
alter table public.companies
  add column if not exists phone_verified_at timestamp with time zone;

create or replace function public.companies_protege_telefone_confirmado()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
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

alter table public.job_listings
  add column if not exists anunciada_ate timestamp with time zone;

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

alter table public.companies
  add column if not exists plano text
    check (plano is null or plano in ('pro', 'tres', 'ilimitado'));
alter table public.companies
  add column if not exists plano_ate timestamp with time zone;
alter table public.companies
  add column if not exists plano_recorrente boolean not null default false;

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

create or replace function public.job_listings_respeita_plano()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_limite integer;
  v_agora integer;
begin
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

comment on function public.vagas_disparadas_no_mes(uuid) is
  'Sem uso desde a 0072: o teto passou a ser de 2 ondas POR VAGA, não por mês.';

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

create or replace function public.job_listings_exige_plano()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_limite integer;
  v_ativas integer;
begin
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

drop trigger if exists job_listings_respeita_plano_trigger on public.job_listings;

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

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  plataforma text not null check (plataforma in ('android', 'ios', 'web')),
  token text,
  endpoint text,
  p256dh text,
  auth text,
  criado_em timestamp with time zone default now(),
  visto_em timestamp with time zone default now()
);

create unique index if not exists idx_push_devices_token
  on public.push_devices (token) where token is not null;
create unique index if not exists idx_push_devices_endpoint
  on public.push_devices (endpoint) where endpoint is not null;
create index if not exists idx_push_devices_user on public.push_devices (user_id);

alter table public.push_devices enable row level security;

drop policy if exists "Dono lê seus aparelhos" on public.push_devices;
create policy "Dono lê seus aparelhos" on public.push_devices
  for select using (auth.uid() = user_id);
drop policy if exists "Dono cadastra seu aparelho" on public.push_devices;
create policy "Dono cadastra seu aparelho" on public.push_devices
  for insert with check (auth.uid() = user_id);
drop policy if exists "Dono atualiza seu aparelho" on public.push_devices;
create policy "Dono atualiza seu aparelho" on public.push_devices
  for update using (auth.uid() = user_id);
drop policy if exists "Dono apaga seu aparelho" on public.push_devices;
create policy "Dono apaga seu aparelho" on public.push_devices
  for delete using (auth.uid() = user_id);

create table if not exists public.job_notifications (
  id uuid primary key default gen_random_uuid(),
  job_listing_id uuid not null references public.job_listings on delete cascade,
  professional_id uuid not null references auth.users on delete cascade,
  wave integer not null check (wave in (1, 2, 3)),
  criado_em timestamp with time zone default now(),
  enviado_em timestamp with time zone,
  visto_em timestamp with time zone,
  unique (job_listing_id, professional_id)
);

create index if not exists idx_job_notifications_prof
  on public.job_notifications (professional_id, criado_em desc);
create index if not exists idx_job_notifications_vaga
  on public.job_notifications (job_listing_id);
create index if not exists idx_job_notifications_fila
  on public.job_notifications (enviado_em) where enviado_em is null;

alter table public.job_notifications enable row level security;

drop policy if exists "Vê os avisos que lhe dizem respeito" on public.job_notifications;
create policy "Vê os avisos que lhe dizem respeito" on public.job_notifications
  for select using (
    auth.uid() = professional_id
    or exists (
      select 1 from public.job_listings v
       join public.companies c on c.id = v.company_id
      where v.id = job_listing_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "Empresa registra o aviso da sua vaga" on public.job_notifications;
create policy "Empresa registra o aviso da sua vaga" on public.job_notifications
  for insert with check (
    exists (
      select 1 from public.job_listings v
       join public.companies c on c.id = v.company_id
      where v.id = job_listing_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "Profissional marca o aviso como visto" on public.job_notifications;
create policy "Profissional marca o aviso como visto" on public.job_notifications
  for update using (auth.uid() = professional_id);

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

alter table public.job_dispatches
  add column if not exists podiam_receber integer;

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

alter table public.professionals
  add column if not exists disponivel boolean not null default true;

comment on column public.professionals.disponivel is
  'Aceitando trabalho agora. Diferente de `paused`, que tira da busca.';

create table if not exists public.professional_courses (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null
    references public.professionals(id) on delete cascade,
  nome text not null,
  instituicao text,
  ano text,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists professional_courses_dono
  on public.professional_courses(professional_id, ordem);

alter table public.professional_courses enable row level security;

drop policy if exists "Qualquer um lê curso" on public.professional_courses;
create policy "Qualquer um lê curso" on public.professional_courses
  for select using (true);

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
where suspended = false
  and paused = false
  and whatsapp_verified = true;

grant select on public.professionals_public to anon, authenticated;

create or replace function public.job_notifications_exige_confirmacao()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
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

select case when to_regclass('public.push_devices') is not null
   and to_regclass('public.professional_courses') is not null
   and (select count(*) from pg_proc where proname = 'limite_de_vagas_do_plano') = 1
   and (select pg_get_viewdef('public.professionals_public'::regclass)) like '%whatsapp_verified = true%'
  then 'PARTE 2 PRONTA — pode colar a Parte 3'
  else 'PARTE 2 FALHOU — me mande o erro' end as resultado;
