-- ═══════════════════════════════════════════════════════════════════════
-- 0111 — Quem tem duas empresas não conseguia disparar onda
-- ═══════════════════════════════════════════════════════════════════════
--
-- Mesma armadilha da 0109, agora na tabela das ONDAS — e esta é pior,
-- porque a onda é o coração do app: é ela que avisa quem faz o serviço.
--
-- As três policies de `job_dispatches` nasceram na 0068 comparando assim:
--
--     company_id = (select id from public.companies where owner_id = auth.uid())
--
-- Com a 0102 (mais de uma empresa por conta) essa subconsulta devolve
-- várias linhas, e o Postgres recusa: "more than one row returned by a
-- subquery used as an expression". Na prática, uma conta com duas empresas
-- não lê as ondas que já saíram, não abre onda nova e não atualiza
-- nenhuma. A vaga fica publicada e não avisa ninguém.
--
-- Encontrado na varredura de 03/09, procurando no pg_policies o mesmo
-- padrão que a 0109 corrigiu. `job_notifications` já usava `join` e está
-- correta — por isso não entra aqui.

drop policy if exists "Lê ondas de suas vagas" on public.job_dispatches;
create policy "Lê ondas de suas vagas" on public.job_dispatches
  for select using (
    exists (
      select 1 from public.job_listings jl
       where jl.id = job_dispatches.job_listing_id
         and jl.company_id in (select c.id from public.companies c where c.owner_id = auth.uid())
    )
  );

drop policy if exists "Insere ondas em suas vagas" on public.job_dispatches;
create policy "Insere ondas em suas vagas" on public.job_dispatches
  for insert with check (
    exists (
      select 1 from public.job_listings jl
       where jl.id = job_dispatches.job_listing_id
         and jl.company_id in (select c.id from public.companies c where c.owner_id = auth.uid())
    )
  );

drop policy if exists "Atualiza ondas de suas vagas" on public.job_dispatches;
create policy "Atualiza ondas de suas vagas" on public.job_dispatches
  for update using (
    exists (
      select 1 from public.job_listings jl
       where jl.id = job_dispatches.job_listing_id
         and jl.company_id in (select c.id from public.companies c where c.owner_id = auth.uid())
    )
  );

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema.
select case
  when (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'job_dispatches'
           and coalesce(qual, with_check) like '%IN ( SELECT%') = 3
  then 'PRONTO — quem tem mais de uma empresa volta a disparar as ondas'
  else 'AINDA FALTA — as tres regras nao foram trocadas'
  end as resultado;
