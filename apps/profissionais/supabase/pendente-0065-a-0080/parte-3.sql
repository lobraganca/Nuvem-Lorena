-- Ei Itabirito — PARTE 3 de 3: perfil oculto nas ondas, recusar vaga, pausar/arquivar/excluir e os campos da vaga.
-- Cole tudo, clique uma vez no editor e toque em Run.
-- Pode colar de novo sem medo: repetir não estraga nada.

create or replace function public.candidatos_da_onda(
  p_cidade text,
  p_uf text,
  p_oficios text[],
  p_coluna text,
  p_especialidade text default null
)
returns table (id uuid, owner_id uuid)
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.companies c where c.owner_id = auth.uid()) then
    raise exception 'Só empresa cadastrada pode contar a onda.'
      using errcode = 'insufficient_privilege';
  end if;

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

create index if not exists idx_professionals_onda
  on public.professionals (city, uf)
  where suspended = false and whatsapp_verified = true;

alter table public.job_responses
  add column if not exists interessado boolean not null default true;

create index if not exists idx_job_responses_interessados
  on public.job_responses (job_listing_id)
  where interessado = true;

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

alter table public.job_listings drop constraint if exists job_listings_status_check;
alter table public.job_listings add constraint job_listings_status_check
  check (status in ('active', 'paused', 'closed'));

drop policy if exists "Empresa apaga vaga própria" on public.job_listings;
create policy "Empresa apaga vaga própria" on public.job_listings
  for delete using (
    auth.uid() = (select owner_id from public.companies where id = company_id)
  );

create or replace function public.job_responses_so_em_vaga_ativa()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_status text;
begin
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

create index if not exists idx_job_listings_empresa_estado
  on public.job_listings (company_id, status, created_at desc);

alter table public.job_listings
  add column if not exists tipo_contrato text,
  add column if not exists jornada text,
  add column if not exists beneficios text[] not null default '{}',
  add column if not exists salario_a_combinar boolean not null default false;

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

alter table public.job_listings drop constraint if exists job_listings_faixa_salarial_check;
alter table public.job_listings add constraint job_listings_faixa_salarial_check
  check (
    salary_range_min is null
    or salary_range_max is null
    or salary_range_max >= salary_range_min
  );

select case when (select count(*) from pg_proc
         where proname = 'candidatos_da_onda' and prosecdef) = 1
   and (select count(*) from pg_attribute where attrelid='public.job_responses'::regclass
          and attname='interessado' and not attisdropped) = 1
   and (select pg_get_constraintdef(oid) from pg_constraint
         where conrelid='public.job_listings'::regclass
           and conname='job_listings_status_check') like '%paused%'
   and (select count(*) from pg_attribute where attrelid='public.job_listings'::regclass
          and attname in ('tipo_contrato','jornada','beneficios','salario_a_combinar')
          and not attisdropped) = 4
  then 'PARTE 3 PRONTA — acabou, pode fechar'
  else 'PARTE 3 FALHOU — me mande o erro' end as resultado;
