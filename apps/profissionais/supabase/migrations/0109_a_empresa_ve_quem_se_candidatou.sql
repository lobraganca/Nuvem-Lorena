-- ═══════════════════════════════════════════════════════════════════════
-- 0109 — A empresa com mais de uma empresa via ZERO candidatos
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "toda pessoa que se candidata em uma vaga que você anunciou deve
--          receber uma notificação e essa vai pro painel dos avisos."
--
-- Ao escrever esse painel apareceu um defeito antigo, e grave: a lista de
-- quem se candidatou já estava vindo VAZIA para quem tem duas empresas.
--
-- ── A causa ────────────────────────────────────────────────────────────
--
-- As policies de `job_responses` nasceram na 0069, quando cada conta tinha
-- no máximo UMA empresa, e comparavam assim:
--
--     company_id = (select id from public.companies where owner_id = auth.uid())
--
-- A 0102 passou a permitir várias empresas por conta. A subconsulta virou
-- uma que devolve várias linhas, e o Postgres recusa isso com
-- "more than one row returned by a subquery used as an expression".
--
-- No app o erro não aparece como erro: quem tem duas empresas abre a vaga e
-- lê "ninguém se interessou ainda" — a mentira calma de sempre, com a
-- diferença de que aqui ela custa a contratação.
--
-- É a MESMA armadilha que já derrubou `obterMinhaEmpresa` no código do app,
-- agora do lado do banco. Está provada no teste 19 desta pasta.
--
-- ── A correção ─────────────────────────────────────────────────────────
--
-- `in (select ...)`: vale para qualquer número de empresas, inclusive uma.

drop policy if exists "Profissional lê suas respostas" on public.job_responses;
create policy "Profissional lê suas respostas" on public.job_responses
  for select using (
    auth.uid() = professional_id
    or exists (
      select 1 from public.job_listings jl
       where jl.id = job_responses.job_listing_id
         and jl.company_id in (select c.id from public.companies c where c.owner_id = auth.uid())
    )
  );

drop policy if exists "Empresa atualiza status da resposta" on public.job_responses;
create policy "Empresa atualiza status da resposta" on public.job_responses
  for update using (
    exists (
      select 1 from public.job_listings jl
       where jl.id = job_responses.job_listing_id
         and jl.company_id in (select c.id from public.companies c where c.owner_id = auth.uid())
    )
  );

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema.
select case
  when (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'job_responses'
           and policyname in ('Profissional lê suas respostas',
                              'Empresa atualiza status da resposta')
           and qual like '%IN ( SELECT%') = 2
  then 'PRONTO — quem tem mais de uma empresa volta a ver quem se candidatou'
  else 'AINDA FALTA — as duas regras não foram trocadas'
  end as resultado;
