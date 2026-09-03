-- ═══════════════════════════════════════════════════════════════════════
-- 0110 — Desde quando o plano vale
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "dentro da tela de planos, colocar data de início, a vigência."
--
-- A vigência já existia: `plano_ate` diz até quando vale. O começo, não —
-- e sem ele a tela consegue dizer "vale até 3 de outubro" mas não "de 3 de
-- setembro a 3 de outubro", que é o que uma pessoa confere quando quer
-- saber se foi cobrada duas vezes no mesmo mês.
--
-- ── Por que um gatilho, e não o app gravando ──────────────────────────
--
-- Quem liga o plano hoje é a dona, à mão, e amanhã será o retorno do
-- pagamento. São dois lugares, e um deles ainda nem existe — se a data
-- dependesse de alguém lembrar de escrevê-la, ela nasceria errada no
-- primeiro caminho esquecido. O gatilho carimba sozinho, venha de onde
-- vier a mudança.
--
-- Carimba quando o plano é LIGADO ou RENOVADO (o `plano_ate` andou para a
-- frente), e não a cada `update` da linha: trocar o telefone da empresa
-- não recomeça a assinatura.

alter table public.companies
  add column if not exists plano_desde timestamp with time zone;

-- Quem já tem plano em dia e ficou sem a data: assume a última alteração
-- conhecida da linha. É uma aproximação, e é melhor que um campo vazio na
-- tela — mas só para quem tem plano, para não inventar começo de assinatura
-- que nunca houve.
update public.companies
   set plano_desde = coalesce(updated_at, created_at)
 where plano is not null
   and plano_ate is not null
   and plano_desde is null;

create or replace function public.companies_carimba_inicio_do_plano()
returns trigger
language plpgsql
security definer set search_path = public, pg_catalog
as $$
begin
  -- Ligou agora (não tinha plano, ou não tinha validade).
  if new.plano is not null and new.plano_ate is not null
     and (tg_op = 'INSERT' or old.plano is null or old.plano_ate is null) then
    new.plano_desde := now();
    return new;
  end if;

  -- Renovou: a validade andou para a frente. Uma correção de data para
  -- TRÁS não é renovação — é conserto, e conserto não recomeça o ciclo.
  if tg_op = 'UPDATE' and new.plano_ate is not null and old.plano_ate is not null
     and new.plano_ate > old.plano_ate then
    new.plano_desde := now();
  end if;

  -- Desligou o plano: a data de começo vai junto, senão a tela mostraria
  -- "começou em" de uma assinatura que não existe mais.
  if new.plano is null or new.plano_ate is null then
    new.plano_desde := null;
  end if;

  return new;
end;
$$;

drop trigger if exists companies_carimba_inicio_do_plano on public.companies;
create trigger companies_carimba_inicio_do_plano
  before insert or update on public.companies
  for each row execute function public.companies_carimba_inicio_do_plano();

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.companies'::regclass
           and attname = 'plano_desde' and not attisdropped) = 1
   and (select count(*) from pg_trigger
         where tgrelid = 'public.companies'::regclass
           and tgname = 'companies_carimba_inicio_do_plano') = 1
  then 'PRONTO — a tela de planos passa a mostrar desde quando o plano vale'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;
