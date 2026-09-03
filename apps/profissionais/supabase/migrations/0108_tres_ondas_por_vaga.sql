-- 0108 — cada vaga passa a ter direito às TRÊS ondas.
--
-- A dona: "a parte de disparo de ondas tem que ficar melhor. Colocar 3
-- botões de ondas."
--
-- A tela passou a mostrar as três (exatamente isso → mesmo ofício → ramo
-- vizinho), e o teto de DUAS, escrito na 0072, deixava a terceira sempre
-- trancada. Duas coisas erradas nisso: a empresa via uma porta que nunca
-- abre, e a onda 3 é justamente a que salva a vaga que não encheu — é ela
-- que alcança "ofícios vizinhos", que é onde está quem faria o serviço sem
-- ter esse nome no cadastro.
--
-- O teto continua existindo, e continua sendo POR VAGA: sem ele, uma vaga
-- só poderia avisar a cidade inteira várias vezes, e o app viraria o que
-- as pessoas silenciam. Três é o número de ondas que existem (a coluna
-- `wave` já é `check (wave in (1,2,3))` desde a 0068), então o teto passa a
-- ser "todas as que existem, uma vez cada" — e o `unique (job_listing_id,
-- wave)` da 0068 é quem garante o "uma vez cada".
--
-- É uma parte só, e ela troca a função do gatilho. O gatilho em si não
-- muda de nome nem de tabela.

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

  if v_abertas >= 3 then
    raise exception 'Cada vaga tem direito a 3 ondas de disparo.';
  end if;

  return new;
end;
$$;

-- ── Confere a si mesma ─────────────────────────────────────────────────
select case
  when (select count(*) from pg_proc
         where proname = 'job_dispatches_teto_por_vaga'
           and prosrc like '%>= 3%') = 1
   and (select count(*) from pg_trigger
         where tgname = 'job_dispatches_teto_por_vaga_trigger') = 1
  then 'PRONTO — cada vaga pode usar as 3 ondas'
  else 'AINDA FALTA — confira o comando acima'
  end as resultado;
