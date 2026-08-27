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
