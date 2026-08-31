-- ═══════════════════════════════════════════════════════════════════════
-- PARTE ÚNICA — 0077, 0078 e 0079
--
-- Cola tudo isto de uma vez no SQL Editor do Supabase (projeto
-- dfdinrimxqoqjedemjbw, o do Ei Itabirito) e toca em Run.
--
-- CUIDADO: se houver texto SELECIONADO na tela, o botão Run executa só a
-- seleção. Clique uma vez no editor para tirar a seleção antes de rodar.
--
-- No fim ele responde sozinho, em português, se deu certo.
--
-- O que estas três fazem:
--
--   0077  quem escolheu "não aparecer na lista" volta a RECEBER vaga pelas
--         ondas. Hoje ele some da busca E das ondas — enquanto a tela
--         promete, por escrito, que ele continua recebendo.
--
--   0078  a pessoa passa a poder responder "não é para mim", além de
--         "tenho interesse" — e a mudar de ideia depois. O painel do
--         anunciante lista só quem tem interesse.
--
--   0079  a empresa passa a poder PAUSAR a vaga (hoje o banco nem aceita
--         esse estado), ARQUIVAR sem perder a lista de interessados, e
--         EXCLUIR. E vaga fora do ar deixa de aceitar interessado novo.
-- ═══════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
-- 0077 — Quem está oculto CONTINUA recebendo vaga pelas ondas
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "a pessoa que cadastra deve ter opção de ter o perfil público ou
--          oculto. Público ele pode ser buscado pelas empresas, oculto ele
--          recebe oportunidades pelas ondas de disparos."
--
-- ── O QUE ESTAVA ACONTECENDO ──────────────────────────────────────────
--
-- A chave existe na tela ("Não aparecer na lista") e grava direito na
-- coluna `paused`. O que não funcionava era a segunda metade da regra: quem
-- se escondia parava de receber TUDO.
--
-- A consulta da onda lê `professionals_public`, e essa view filtra
-- `paused = false`. Então esconder-se da busca escondia a pessoa também das
-- ondas — o oposto do que a chave promete.
--
-- E a tela promete por escrito, com estas palavras:
--
--   "Quem está empregado e não quer ser encontrado pelo patrão pode se
--    esconder da lista e CONTINUAR RECEBENDO VAGA."
--
-- É o pior tipo de defeito deste projeto: silencioso e do lado de quem tem
-- menos como perceber. A pessoa se esconde para o patrão não ver, acha que
-- continua na fila das oportunidades, e some do app sem nunca receber uma.
-- Ninguém reclama de vaga que não chegou — não dá para sentir falta do que
-- você não sabe que existiu.
--
-- ── POR QUE UMA FUNÇÃO, E NÃO OUTRA VIEW ──────────────────────────────
--
-- A saída óbvia — uma view que inclua os pausados — é justamente a errada:
-- view precisa de `grant`, e quem recebesse o `grant` poderia LISTAR quem
-- está escondido. Seria desfazer o esconderijo para consertar o esconderijo.
--
-- Aqui a função devolve `id` e `owner_id` e MAIS NADA. Sem nome, sem
-- telefone, sem bairro. A empresa recebe códigos que ela já teria de usar
-- para gravar os avisos, e que não abrem em lugar nenhum: a página de perfil
-- lê a view pública, e lá o pausado não está. Contar quantas pessoas a onda
-- alcança nunca precisou saber quem elas são.
--
-- ── AS TRÊS CONDIÇÕES QUE CONTINUAM VALENDO ───────────────────────────
--
--   suspended = false          quem foi suspenso não recebe nada
--   whatsapp_verified = true   sem telefone confirmado não entra em onda
--   paused                     NÃO filtra — é exatamente a mudança
--
-- ── ESTA MIGRATION NÃO MEXE NA BUSCA ──────────────────────────────────
--
-- `professionals_public` fica exatamente como está, com o `paused = false`.
-- Quem se escondeu continua fora da lista que as empresas procuram. As duas
-- metades da regra passam a existir de verdade, cada uma no seu lugar.

create or replace function public.candidatos_da_onda(
  p_cidade text,
  p_uf text,
  p_oficios text[],
  -- Onde procurar o ofício: `categories` é o que a pessoa FAZ,
  -- `areas_de_interesse` é onde ela ACEITARIA trabalhar. A onda alcança
  -- pelas duas, e quem chama pede uma de cada vez, como já fazia.
  p_coluna text,
  -- Só a onda 1 usa, e só quando a vaga pediu especialidade.
  p_especialidade text default null
)
returns table (id uuid, owner_id uuid)
language plpgsql
security definer set search_path = public
as $$
begin
  -- Só empresa cadastrada conta onda. Sem esta porta, qualquer conta
  -- poderia varrer a cidade inteira perguntando "quantos pedreiros existem"
  -- — e, repetindo por ofício, montar um retrato do banco.
  if not exists (select 1 from public.companies c where c.owner_id = auth.uid()) then
    raise exception 'Só empresa cadastrada pode contar a onda.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Nome de coluna não entra por texto em consulta montada: são duas
  -- consultas escritas por extenso, e qualquer outro valor é recusado.
  if p_coluna not in ('categories', 'areas_de_interesse') then
    raise exception 'Coluna inválida: %', p_coluna using errcode = 'invalid_parameter_value';
  end if;

  return query
  select p.id, p.owner_id
    from public.professionals p
   where p.city = p_cidade
     and (p_uf is null or p.uf = p_uf)
     and p.suspended = false
     and p.whatsapp_verified = true
     -- `paused` de fora de propósito. É a migration inteira.
     and (
       (p_coluna = 'categories' and p.categories && p_oficios)
       or (p_coluna = 'areas_de_interesse' and p.areas_de_interesse && p_oficios)
     )
     and (
       p_especialidade is null
       or p_especialidade = ''
       or p.especialidade ilike '%' || p_especialidade || '%'
     );
end;
$$;

revoke all on function public.candidatos_da_onda(text, text, text[], text, text) from public;
grant execute on function public.candidatos_da_onda(text, text, text[], text, text) to authenticated;

-- O índice que faz isto não varrer a tabela quando a cidade crescer.
create index if not exists idx_professionals_onda
  on public.professionals (city, uf)
  where suspended = false and whatsapp_verified = true;

-- ═══════════════════════════════════════════════════════════════════════
-- 0078 — A pessoa responde SIM ou NÃO ao aviso de compatibilidade
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "ao disparar uma onda, o aviso de compatibilidade será enviado aos
--          perfis compatíveis. A pessoa escolhe se quer estar disponível ou
--          se não tem interesse. A lista de interessados aparece em um
--          painel para o anunciante."
--
-- ── O QUE FALTAVA ─────────────────────────────────────────────────────
--
-- Só existia o SIM. A tela tinha um botão, "Tenho interesse", e mais nada:
-- quem não queria aquela vaga não tinha o que tocar. E, sem o não, o app
-- não conseguia distinguir três situações completamente diferentes:
--
--   ainda não abriu  ·  abriu e não quis  ·  abriu e ainda está pensando
--
-- As três apareciam iguais. A vaga recusada continuava na lista da pessoa
-- para sempre, com o mesmo botão pedindo resposta — e "Novas" contava como
-- pendente uma decisão que já tinha sido tomada.
--
-- ── POR QUE UMA COLUNA NOVA, E NÃO MAIS UM VALOR EM `status` ──────────
--
-- `status` é a triagem da EMPRESA: new (chegou), read (li), accepted
-- (chamei), rejected (descartei). São os passos de quem contrata.
--
-- Enfiar o "não quero" da pessoa nessa mesma coluna misturaria duas
-- decisões de donos diferentes num campo só, e `rejected` (a empresa
-- descartou) viraria vizinho de `declined` (a pessoa recusou) — duas
-- palavras parecidas para coisas opostas, no mesmo lugar. Quem lesse o
-- painel um ano depois não teria como saber qual foi qual.
--
-- Aqui são dois campos, um para cada lado da mesa. `interessado` é da
-- pessoa; `status` continua sendo da empresa.
--
-- ── `default true` de propósito ───────────────────────────────────────
--
-- Toda linha que já existe foi criada por alguém tocando em "Tenho
-- interesse" — não havia outro caminho. `true` é a verdade histórica delas,
-- não um chute.

alter table public.job_responses
  add column if not exists interessado boolean not null default true;

-- O painel do anunciante filtra por esta coluna, e é a consulta mais quente
-- da tela dele.
create index if not exists idx_job_responses_interessados
  on public.job_responses (job_listing_id)
  where interessado = true;

-- ── A pessoa pode mudar de ideia ───────────────────────────────────────
--
-- Faltava: havia policy de INSERT para a pessoa e de UPDATE só para a
-- empresa. Quem recusasse ficava preso na recusa, sem nenhum caminho de
-- volta — e mudar de ideia sobre uma vaga é a coisa mais normal do mundo
-- ("não quero" na segunda-feira, desempregado na sexta).
--
-- O `with check` é o que impede a pessoa de mexer no que não é dela: sem
-- ele, ela poderia se marcar como `accepted` na triagem da empresa e
-- aparecer no painel como alguém que a empresa já escolheu.
drop policy if exists "Pessoa muda a própria resposta" on public.job_responses;
create policy "Pessoa muda a própria resposta" on public.job_responses
  for update
  using (auth.uid() = professional_id)
  with check (auth.uid() = professional_id);

create or replace function public.job_responses_pessoa_so_mexe_no_interesse()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  /* Quando quem edita é a própria pessoa, só `interessado` pode mudar.
     A triagem (`status`, `company_notes`) é da empresa, e uma policy de
     UPDATE sozinha não sabe distinguir QUAL coluna mudou. */
  if auth.uid() = new.professional_id
     and not exists (
       select 1 from public.job_listings jl
        join public.companies c on c.id = jl.company_id
       where jl.id = new.job_listing_id and c.owner_id = auth.uid()
     )
  then
    if new.status is distinct from old.status
       or new.company_notes is distinct from old.company_notes then
      raise exception 'A triagem da vaga é de quem anunciou.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists job_responses_pessoa_so_mexe_no_interesse on public.job_responses;
create trigger job_responses_pessoa_so_mexe_no_interesse
  before update on public.job_responses
  for each row execute function public.job_responses_pessoa_so_mexe_no_interesse();

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

-- ═══════════════════════════════════════════════════════════════════════
-- A CONFERÊNCIA. É a resposta desta janela que vale.
-- ═══════════════════════════════════════════════════════════════════════
-- Lê o pg_catalog, nunca o information_schema: o information_schema filtra
-- por privilégio do papel corrente e já respondeu "não existe" cinco vezes
-- sobre uma coluna que estava lá.
select case
  when (select count(*) from pg_proc
         where pronamespace = 'public'::regnamespace
           and proname = 'candidatos_da_onda' and prosecdef) = 1
   and (select pg_get_viewdef('public.professionals_public'::regclass)) like '%paused%'
   and (select count(*) from pg_attribute
         where attrelid = 'public.job_responses'::regclass
           and attname = 'interessado' and not attisdropped) = 1
   and (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'job_responses'
           and policyname = 'Pessoa muda a própria resposta') = 1
   and (select count(*) from pg_trigger
         where tgrelid = 'public.job_responses'::regclass
           and tgname = 'job_responses_pessoa_so_mexe_no_interesse') = 1
   and (select pg_get_constraintdef(oid) from pg_constraint
         where conrelid = 'public.job_listings'::regclass
           and conname = 'job_listings_status_check') like '%paused%'
   and (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'job_listings'
           and policyname = 'Empresa apaga vaga própria') = 1
   and (select count(*) from pg_trigger
         where tgrelid = 'public.job_responses'::regclass
           and tgname = 'job_responses_so_em_vaga_ativa') = 1
  then 'PRONTO — oculto volta a receber vaga, a pessoa pode recusar, e a empresa pode pausar, arquivar e excluir'
  else 'AINDA FALTA — alguma parte acima não passou; me mande o erro que apareceu'
  end as resultado;
