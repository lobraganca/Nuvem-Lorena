-- ═══════════════════════════════════════════════════════════════════════
-- 0112 — A administração enxerga as empresas, as vagas e as candidaturas
-- ═══════════════════════════════════════════════════════════════════════
--
-- O painel de administração nasceu no outro produto e só sabia de
-- profissionais, denúncias, banners e dinheiro. Do Ei Emprego — que é o
-- que existe hoje — ele não mostrava NADA: nem quantas empresas há, nem
-- quantas vagas estão no ar, nem quem assinou.
--
-- O motivo não era a tela, era o banco: `companies` e `job_listings` só
-- têm regra para o próprio dono. Para a conta da administração, a
-- consulta voltava vazia — sem erro, como sempre.
--
-- Aqui entram as mesmas regras de administração que `professionals` já
-- tem desde a 0008, e mais uma que resolve um trabalho manual: ligar e
-- renovar plano de empresa. Isso vinha sendo feito colando SQL no painel
-- do Supabase, uma linha por vez; agora é um botão na tela — e o carimbo
-- da data de início (0110) continua sendo do gatilho, venha a mudança de
-- onde vier.
--
-- ── O que a administração NÃO ganha aqui ──────────────────────────────
--
-- Apagar empresa e apagar vaga. Não é esquecimento: exclusão leva junto
-- as candidaturas, e uma tela de administração é exatamente onde um toque
-- errado apaga o trabalho de outra pessoa. Tirar do ar já é possível
-- (`status`), e isso se desfaz.

drop policy if exists "Administração lê todas as empresas" on public.companies;
create policy "Administração lê todas as empresas" on public.companies
  for select using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "Administração muda o plano da empresa" on public.companies;
create policy "Administração muda o plano da empresa" on public.companies
  for update using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "Administração lê todas as vagas" on public.job_listings;
create policy "Administração lê todas as vagas" on public.job_listings
  for select using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "Administração muda a situação da vaga" on public.job_listings;
create policy "Administração muda a situação da vaga" on public.job_listings
  for update using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "Administração lê todas as candidaturas" on public.job_responses;
create policy "Administração lê todas as candidaturas" on public.job_responses
  for select using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema.
select case
  when (select count(*) from pg_policies
         where schemaname = 'public'
           and policyname in ('Administração lê todas as empresas',
                              'Administração muda o plano da empresa',
                              'Administração lê todas as vagas',
                              'Administração muda a situação da vaga',
                              'Administração lê todas as candidaturas')) = 5
  then 'PRONTO — o painel de administração passa a ver empresas, vagas e candidaturas'
  else 'AINDA FALTA — confira os comandos acima'
  end as resultado;
