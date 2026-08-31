-- 0100 — A empresa passa a ter uma face pública, e as duas telas de quem
--        procura trabalho voltam a ter conteúdo.
--
-- ── O DEFEITO ─────────────────────────────────────────────────────────
--
-- `companies` só tem uma policy de leitura, da 0066:
--
--     create policy "Empresa lê seu próprio cadastro" on public.companies
--       for select using (auth.uid() = owner_id);
--
-- Ou seja: quem NÃO é dono de uma empresa não enxerga empresa nenhuma.
--
-- E as duas telas de quem procura trabalho — "Vagas" e "Avisos" — pedem a
-- vaga JUNTO com a empresa dela:
--
--     job_listings!inner ( ..., companies!inner ( company_name, photo_url ) )
--
-- No PostgREST o `!inner` é junção interna DE VERDADE, e a RLS vale para a
-- tabela embutida também. Empresa invisível derruba a vaga junto. As duas
-- telas voltam VAZIAS — não com erro, com zero linhas.
--
-- Medido num banco local com as migrations até a 0080, como um usuário
-- autenticado que não é dono de empresa:
--
--     vagas ativas ............................... 1
--     empresas ................................... 0
--     vaga junto com a empresa (o inner de hoje) . 0
--
-- É o laço inteiro do produto parado: a empresa publica, a onda dispara, o
-- aviso é gravado — e a pessoa abre o app e não vê nada. Ninguém reclama de
-- vaga que não chegou.
--
-- ── POR QUE UMA VIEW, E NÃO UMA POLICY ────────────────────────────────
--
-- Uma policy resolveria as linhas, mas RLS é por LINHA, não por coluna:
-- liberar a linha libera `cnpj_cpf`, `phone`, `responsible_name`, `plano`.
--
-- E GRANT por coluna também não serve: o dono da empresa e quem procura
-- trabalho são o MESMO papel (`authenticated`). Restringir colunas para o
-- papel cegaria o painel da própria empresa.
--
-- Sobra a view com as colunas seguras. E ela vem com o `where` escrito
-- aqui dentro, porque VIEW IGNORA RLS — roda com os direitos de quem a
-- criou. Foi assim que a 0049 deixou cadastro suspenso reaparecer e a
-- `profiles_public` entregou a lista de todas as contas.

drop view if exists public.companies_public;

create view public.companies_public as
  select
    c.id,
    c.company_name,
    c.photo_url,
    c.city,
    c.uf,
    c.neighborhood
  from public.companies c
  -- O `where` da view, que é o que substitui a RLS que ela não tem.
  -- Só aparece a empresa que tem pelo menos UMA vaga no ar. Empresa que
  -- nunca publicou, ou que fechou tudo, não vira diretório de CNPJ.
  where exists (
    select 1 from public.job_listings v
     where v.company_id = c.id
       and v.status = 'active'
  );

comment on view public.companies_public is
  'A face pública da empresa: nome, foto e onde fica. Sem CNPJ, sem
   telefone, sem responsável, sem plano. Só empresas com vaga no ar.
   O `where` mora na view de propósito — view não obedece RLS.';

grant select on public.companies_public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- A CONFERÊNCIA. É a resposta desta janela que vale.
-- ═══════════════════════════════════════════════════════════════════════
-- Lê o pg_catalog, nunca o information_schema.
select case
  when (select count(*) from pg_class
         where relnamespace = 'public'::regnamespace
           and relname = 'companies_public' and relkind = 'v') = 1
   and (select pg_get_viewdef('public.companies_public'::regclass)) like '%active%'
   and (select count(*) from pg_attribute
         where attrelid = 'public.companies_public'::regclass
           and attname in ('cnpj_cpf', 'phone', 'responsible_name', 'plano')
           and not attisdropped) = 0
   and has_table_privilege('anon', 'public.companies_public', 'select')
  then 'PRONTO — a empresa tem face pública, sem CNPJ nem telefone, e só com vaga no ar'
  else 'AINDA FALTA — alguma parte acima não passou; me mande o erro que apareceu'
  end as resultado;
