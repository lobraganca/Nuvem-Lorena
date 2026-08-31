-- ═══════════════════════════════════════════════════════════════════════
-- 0079 — A empresa pode pausar, arquivar e excluir a própria vaga
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona perguntou: "o app tem como pausar o anúncio, arquivá-lo ou
-- excluir?" A resposta era: pausar não, arquivar pela metade, excluir não.
--
-- ── O QUE FALTAVA ────────────────────────────────────────────────────
--
--   1. O ESTADO "pausada" NÃO EXISTIA NO BANCO. O tipo do app listava os
--      três (`"active" | "paused" | "closed"`) e o gatilho da 0073 já
--      tratava o caso com cuidado — mas a coluna aceitava só dois:
--
--        check (status in ('active', 'closed'))
--
--      Eu quase dei esta migration por escrita dizendo "pausar já funciona,
--      falta só a tela". Funcionava em três lugares e era recusado no
--      quarto. Quem confirmou foi o teste 18, na primeira execução; lendo o
--      código, passava — o tipo do TypeScript afirma o que ele gostaria que
--      o banco tivesse, e o banco não devia nada a ele.
--
--   2. EXCLUIR não era possível: não existe policy de DELETE em
--      `job_listings`, e sem policy o Postgres recusa tudo. Nem a dona da
--      vaga conseguia apagar a própria vaga.
--
--   3. Vaga PAUSADA ou ARQUIVADA ainda aceitava resposta nova. A tela de
--      quem procura já filtra por vaga ativa, mas tela é lembrete, não
--      tranca: uma aba aberta desde ontem, um toque numa página antiga, e a
--      pessoa manda interesse para uma vaga que a empresa já tirou do ar —
--      e fica esperando uma ligação que ninguém vai fazer.
--
-- ── O QUE JÁ ESTAVA CERTO ─────────────────────────────────────────────
--
-- O gatilho da 0073 trata os dois sentidos como deve: tirar do ar passa
-- direto (senão a empresa de plano cheio não conseguiria nem despublicar a
-- vaga que tem) e voltar ao ar passa pelo teto do plano.
--
-- E a policy de leitura da 0067 já deixa a dona ler a vaga em qualquer
-- estado ("status = 'active' OR sou a dona"), então a lista de interessados
-- de uma vaga arquivada nunca esteve perdida — estava inalcançável, porque
-- o painel só pedia as ativas. Isso é conserto de tela, não de banco.

-- ── Parte 0 — o estado que faltava ─────────────────────────────────────
--
-- `paused` não é `closed` com outro nome, e a diferença é de produto: a
-- empresa que recebeu gente demais e quer parar por uns dias não encerrou o
-- processo — encerrar é o que ela faz depois de contratar. Sem os dois
-- estados, a única saída para "chega de currículo por ora" era fechar de
-- vez e recriar tudo depois.
alter table public.job_listings drop constraint if exists job_listings_status_check;
alter table public.job_listings add constraint job_listings_status_check
  check (status in ('active', 'paused', 'closed'));

-- ── Parte 1 — excluir ──────────────────────────────────────────────────
--
-- Só a dona da vaga, e por decisão dela. O `on delete cascade` de
-- `job_responses` e `job_notifications` leva junto as respostas e os avisos
-- daquela vaga — é o certo: a vaga deixou de existir, e guardar "fulano se
-- interessou por uma vaga que não existe" não serve a ninguém.
--
-- Quem avisa do tamanho da coisa é a tela, dizendo quantas pessoas
-- interessadas somem junto. Aqui embaixo não dá para pedir confirmação.
drop policy if exists "Empresa apaga vaga própria" on public.job_listings;
create policy "Empresa apaga vaga própria" on public.job_listings
  for delete using (
    auth.uid() = (select owner_id from public.companies where id = company_id)
  );

-- ── Parte 2 — vaga fora do ar não recebe resposta nova ─────────────────
--
-- Vale para INSERT e para UPDATE: sem o UPDATE, quem tivesse respondido
-- "não é para mim" poderia mudar para "tenho interesse" depois de a vaga
-- sair do ar — pela mesma aba velha, com o mesmo resultado ruim.
--
-- Mudar de NÃO para NÃO, ou qualquer mexida que não acenda o interesse,
-- continua passando: a pessoa não está entrando numa fila que não existe.
create or replace function public.job_responses_so_em_vaga_ativa()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_status text;
begin
  -- A empresa continua podendo triar (`status`, `company_notes`) numa vaga
  -- arquivada — é exatamente o que ela faz depois de encerrar: olhar quem
  -- respondeu e marcar quem chamou. Só o INTERESSE novo é que trava.
  if tg_op = 'UPDATE'
     and (new.interessado is not true or old.interessado is true) then
    return new;
  end if;

  select status into v_status
    from public.job_listings where id = new.job_listing_id;

  if v_status is distinct from 'active' then
    raise exception 'Esta vaga não está mais recebendo interessados.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists job_responses_so_em_vaga_ativa on public.job_responses;
create trigger job_responses_so_em_vaga_ativa
  before insert or update on public.job_responses
  for each row execute function public.job_responses_so_em_vaga_ativa();

-- O índice do painel: ele passa a pedir as vagas da empresa em TODOS os
-- estados, e não só as ativas.
create index if not exists idx_job_listings_empresa_estado
  on public.job_listings (company_id, status, created_at desc);

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema.
select case
  when (select pg_get_constraintdef(oid) from pg_constraint
         where conrelid = 'public.job_listings'::regclass
           and conname = 'job_listings_status_check') like '%paused%'
   and (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'job_listings'
           and policyname = 'Empresa apaga vaga própria') = 1
   and (select count(*) from pg_trigger
         where tgrelid = 'public.job_responses'::regclass
           and tgname = 'job_responses_so_em_vaga_ativa') = 1
  then 'PRONTO — dá para pausar, arquivar e excluir vaga, e vaga fora do ar não recebe mais ninguém'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;
