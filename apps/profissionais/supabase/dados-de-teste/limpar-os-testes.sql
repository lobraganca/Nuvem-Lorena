-- ═══════════════════════════════════════════════════════════════════════
-- Apaga TODOS os dados de teste, de uma vez
-- ═══════════════════════════════════════════════════════════════════════
--
-- Tudo o que `encher-o-app.sql` criou tem id começando com `eeee0000`, e
-- toda tabela do app aponta, direta ou indiretamente, para `auth.users`
-- com `on delete cascade`. Então apagar as contas leva junto os cadastros,
-- as empresas, as vagas, as candidaturas e os avisos — sem sobrar linha
-- órfã em lugar nenhum.
--
-- RODE ISTO ANTES DE ABRIR O APP PARA A CIDADE. Enquanto os dados de
-- teste estiverem lá, quem entrar vai ver 30 pessoas e 20 vagas que não
-- existem — e pode tentar ligar para elas.
--
-- É seguro rodar a qualquer momento: nenhuma conta de verdade tem id
-- começando com `eeee0000`.

delete from auth.users where id::text like 'eeee0000%';

-- ── Confere a si mesma ─────────────────────────────────────────────────
select case
  when (select count(*) from public.professionals where id::text like 'eeee0000%') = 0
   and (select count(*) from public.companies     where id::text like 'eeee0000%') = 0
   and (select count(*) from public.job_listings  where id::text like 'eeee0000%') = 0
   and (select count(*) from public.job_responses where id::text like 'eeee0000%') = 0
  then 'PRONTO — não sobrou nenhum dado de teste no app'
  else 'AINDA FALTA — sobrou coisa; confira as tabelas acima'
  end as resultado;
