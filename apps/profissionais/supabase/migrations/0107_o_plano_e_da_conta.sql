-- 0107 — o plano passa a ser da CONTA, e não de cada empresa.
--
-- A dona: "o plano é pelo usuário, então se ele quiser utilizar as vagas em
-- outras empresas cadastradas ele pode."
--
-- Como era: `companies.plano` valia para AQUELA empresa. Quem tinha padaria
-- e lanchonete e assinou um plano só conseguia publicar pela padaria; a
-- lanchonete respondia "para publicar vaga é preciso ter um plano ativo",
-- como se a assinatura não existisse. Quem quisesse anunciar pelas duas
-- pagaria duas vezes — e ninguém entende por que, já que é a mesma pessoa,
-- o mesmo telefone e o mesmo dinheiro.
--
-- Como fica: a conta tem UM plano, e o teto de vagas abertas é somado entre
-- todas as empresas dela. Com o Premium (3 vagas), dá para abrir 2 na
-- padaria e 1 na lanchonete, ou 3 numa só — quem decide é a dona.
--
-- ONDE O PLANO FICA GUARDADO NÃO MUDA: continua em `companies.plano` e
-- `companies.plano_ate`. Mudar isso de tabela obrigaria a mexer também na
-- Edge Function que recebe o aviso de pagamento do Mercado Pago — e uma
-- migration que quebra o recebimento de pagamento é a pior de todas. O que
-- muda é a LEITURA: as funções passam a olhar todas as empresas do mesmo
-- dono. Se a dona assinou por qualquer uma delas, a conta tem plano.
--
-- Vai em 3 partes numeradas. O editor do painel desfaz o bloco inteiro
-- quando um comando falha no meio, então rode uma parte de cada vez.

-- ── Parte 1 ────────────────────────────────────────────────────────────
-- O limite passa a ser o do DONO da empresa, e não o da empresa.
--
-- Entre as empresas do mesmo dono vale o plano mais alto que estiver em
-- dia: assinar o Multi por uma loja não pode valer menos por causa de um
-- Pro vencido em outra. `-1` continua sendo o sem teto.

create or replace function public.limite_de_vagas_do_plano(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- Escolhe o plano mais alto EM DIA e só depois traduz para o teto. Fazer
  -- o contrário — pegar o maior teto — daria errado justamente no melhor
  -- plano: o sem teto é `-1`, o MENOR número da lista.
  select case coalesce(
           (select max(
                     case
                       when c.plano_ate is null or c.plano_ate < now() then 0
                       when c.plano = 'ilimitado' then 3
                       when c.plano = 'tres' then 2
                       when c.plano = 'pro' then 1
                       else 0
                     end)
              from public.companies c
             where c.owner_id = (select owner_id from public.companies
                                  where id = p_company_id)),
           0)
         when 3 then -1   -- Multi: sem teto
         when 2 then 3    -- Premium
         when 1 then 1    -- Pro
         else 0           -- sem plano em dia
         end;
$$;

-- ── Parte 2 ────────────────────────────────────────────────────────────
-- As vagas abertas passam a ser contadas em TODAS as empresas do dono.
--
-- É a outra metade da mesma regra: se o teto é da conta, o que ele conta
-- também tem que ser da conta. Contar só a empresa aberta deixaria o Pro
-- (1 vaga) publicar uma em cada loja, sem limite nenhum.

create or replace function public.vagas_ativas_agora(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select count(*)::integer
    from public.job_listings v
    join public.companies c on c.id = v.company_id
   where c.owner_id = (select owner_id from public.companies
                        where id = p_company_id)
     and v.status = 'active';
$$;

-- ── Parte 3 ────────────────────────────────────────────────────────────
-- A rede embaixo: a policy também passa a olhar a conta.
--
-- Sem isto, o gatilho da Parte 2 deixaria publicar e a policy recusaria
-- logo em seguida com "permission denied" — que não diz nada a ninguém.
-- O telefone confirmado continua sendo DA EMPRESA que publica: é por ele
-- que quem responde à vaga procura a empresa de volta.

drop policy if exists "Empresa escreve vaga própria" on public.job_listings;
create policy "Empresa escreve vaga própria" on public.job_listings
  for insert with check (
    exists (
      select 1 from public.companies c
       where c.id = company_id
         and c.owner_id = auth.uid()
         and c.phone_verified
         and exists (
           select 1 from public.companies plano
            where plano.owner_id = c.owner_id
              and plano.plano_ate is not null
              and plano.plano_ate > now()
         )
    )
  );

-- ── Confere a si mesma ─────────────────────────────────────────────────
select case
  when (select count(*) from pg_proc p
         where p.proname = 'limite_de_vagas_do_plano'
           and pg_get_functiondef(p.oid) like '%owner_id%') = 1
   and (select count(*) from pg_proc p
         where p.proname = 'vagas_ativas_agora'
           and pg_get_functiondef(p.oid) like '%owner_id%') = 1
   and (select count(*) from pg_policies
         where tablename = 'job_listings'
           and policyname = 'Empresa escreve vaga própria'
           and with_check like '%plano.owner_id%') = 1
  then 'PRONTO — o plano vale para todas as empresas da mesma conta'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;
