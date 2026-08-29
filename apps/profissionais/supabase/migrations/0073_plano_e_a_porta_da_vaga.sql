-- 0073 — o plano deixa de ser sobre anunciar e passa a ser a porta.
--
-- O modelo anterior (0071/0072) cobrava pelo ANÚNCIO — a vaga parada na
-- tela onde as pessoas procuram — e deixava de graça publicar a vaga e
-- disparar as ondas. Estava ao contrário: a onda é a parte valiosa, porque
-- vai atrás de quem encaixa e chega no telefone de quem nem estava
-- procurando. Anunciar é passivo. Cobrar pelo passivo e dar o ativo de
-- graça deixava o plano sem motivo para existir — bastava publicar,
-- disparar as duas ondas e nunca assinar nada.
--
-- Como fica:
--
--   SEM plano   vê e procura todos os profissionais, e fala com cada um
--               por conta própria. É o app inteiro que já existia, aberto,
--               sem conta — e continua assim para todo mundo.
--
--   COM plano   publica vaga, dispara as ondas, e recebe quem se
--               interessou. O anúncio na área de anúncios vem junto.
--
-- O teto do plano passa a contar VAGAS ATIVAS, não vagas anunciadas: agora
-- a vaga é o produto, e o anúncio é parte dela.
--
--   Pro          R$ 29,90/mês   1 vaga por vez
--   Três         R$ 59,90/mês   3 vagas
--   Ilimitado    R$ 89,90/mês   sem teto
--
-- Vai em 3 partes numeradas. O editor do painel desfaz o bloco inteiro
-- quando um comando falha no meio, então cada parte é rodada sozinha.

-- ── Parte 1 ────────────────────────────────────────────────────────────
-- Quantas vagas ATIVAS a empresa tem agora.
--
-- Substitui `vagas_anunciadas_agora` como a conta que importa. Vaga fechada
-- libera o lugar sozinha — a empresa do plano Pro fecha a que encheu e abre
-- a próxima, sem falar com ninguém.

create or replace function public.vagas_ativas_agora(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select count(*)::integer
    from public.job_listings v
   where v.company_id = p_company_id
     and v.status = 'active';
$$;

-- ── Parte 2 ────────────────────────────────────────────────────────────
-- Sem plano, não publica vaga.
--
-- O gatilho vem ANTES da policy e é ele que fala com gente: policy recusada
-- devolve "permission denied", que não diz o que fazer. Aqui a empresa lê o
-- motivo. A policy da Parte 3 é a rede embaixo, para quem chamar por fora
-- do app.

create or replace function public.job_listings_exige_plano()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_limite integer;
  v_ativas integer;
begin
  -- Fechar ou reabrir vaga não passa por aqui como criação. E vaga que está
  -- sendo fechada nunca deve esbarrar no teto — senão a empresa do plano
  -- cheio não conseguiria nem fechar as que tem.
  if tg_op = 'UPDATE' and new.status is distinct from 'active' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' and new.status = 'active' then
    return new;  -- edição comum de uma vaga que já estava no ar
  end if;

  v_limite := public.limite_de_vagas_do_plano(new.company_id);

  if v_limite = 0 then
    raise exception 'Para publicar vaga é preciso ter um plano ativo.';
  end if;

  if v_limite > 0 then
    v_ativas := public.vagas_ativas_agora(new.company_id);
    -- No UPDATE que reabre, a própria vaga ainda não está contada como
    -- ativa (o estado antigo era outro), então não há o que descontar.
    if v_ativas >= v_limite then
      raise exception 'Seu plano permite % vaga(s) aberta(s) por vez. Feche uma para abrir outra.', v_limite;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists job_listings_exige_plano_trigger on public.job_listings;
create trigger job_listings_exige_plano_trigger
  before insert or update on public.job_listings
  for each row execute function public.job_listings_exige_plano();

-- O gatilho da 0072 sai: ele contava vagas ANUNCIADAS, e o anúncio deixou
-- de ser o que se compra. Dois gatilhos com tetos diferentes sobre a mesma
-- tabela é o tipo de coisa que recusa uma gravação por um motivo que
-- ninguém consegue explicar depois.
drop trigger if exists job_listings_respeita_plano_trigger on public.job_listings;

-- ── Parte 3 ────────────────────────────────────────────────────────────
-- A rede embaixo: a policy também exige plano.
--
-- Substitui a da 0071, que exigia só o telefone confirmado. As duas
-- condições continuam valendo — o telefone é como as pessoas procuram a
-- empresa de volta, e sem ele a vaga não sai.

drop policy if exists "Empresa escreve vaga própria" on public.job_listings;
create policy "Empresa escreve vaga própria" on public.job_listings
  for insert with check (
    exists (
      select 1 from public.companies c
       where c.id = company_id
         and c.owner_id = auth.uid()
         and c.phone_verified
         and c.plano_ate is not null
         and c.plano_ate > now()
    )
  );

-- ── Confere a si mesma ─────────────────────────────────────────────────
select case
  when (select count(*) from pg_proc where proname = 'vagas_ativas_agora') = 1
   and (select count(*) from pg_trigger
         where tgname = 'job_listings_exige_plano_trigger') = 1
   and (select count(*) from pg_trigger
         where tgname = 'job_listings_respeita_plano_trigger') = 0
   and (select count(*) from pg_policies
         where tablename = 'job_listings'
           and policyname = 'Empresa escreve vaga própria'
           and with_check like '%plano_ate%') = 1
  then 'PRONTO — sem plano nao publica vaga; o teto conta vagas abertas'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;
