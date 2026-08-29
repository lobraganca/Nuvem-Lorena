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
