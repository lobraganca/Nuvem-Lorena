-- 0124 — O reembolso passa a agir sozinho.
--
-- A dona: "quero que faça tudo automático. Se a pessoa pedir reembolso
-- antes dos 7 dias, [encerra]; depois dos 7 dias, o plano se encerra no
-- vencimento do mês."
--
-- ── O QUE ACONTECIA ANTES ─────────────────────────────────────────────
--
-- Pedir reembolso gravava uma linha em `pedidos_reembolso` e mais nada.
-- O plano continuava ligado, as vagas continuavam no ar recebendo
-- candidato, e as ondas continuavam disparáveis. Conferido: nenhuma outra
-- parte do app sequer lê essa tabela.
--
-- E havia um segundo buraco, pior, que aparecia mesmo desligando o plano
-- à mão: a regra do banco (0072) só confere o plano na hora de ANUNCIAR a
-- vaga. Depois de anunciada ela fica visível até `anunciada_ate` vencer —
-- até um mês. Ou seja, a dona devolvia o dinheiro e continuava
-- entregando o serviço.
--
-- ── AS DUAS PORTAS, E POR QUE SÃO DUAS ────────────────────────────────
--
-- Até 7 dias corridos da compra é o direito de arrependimento do art. 49
-- do CDC: o dinheiro volta inteiro, sem justificativa, e o serviço para.
-- Aqui isso vira: plano desligado AGORA e vagas fora do ar AGORA.
--
-- Depois de 7 dias já não é arrependimento, é cancelamento: a empresa usou
-- o serviço e tem direito ao que pagou até o fim do período. Aqui isso
-- vira: o plano não renova, e as vagas saem do ar exatamente no dia em que
-- o mês pago acaba.
--
-- Esse segundo caso é feito ENCURTANDO `anunciada_ate` para a data do
-- vencimento, e não com uma faxina agendada. É de propósito: sem tarefa
-- que roda de hora em hora, sem depender do GitHub estar de pé, e o dia
-- em que a vaga sai já fica escrito na própria linha da vaga — dá para
-- conferir olhando, hoje, o que vai acontecer daqui a três semanas.
--
-- ── PARTE 1: a coluna que registra o que o pedido causou ──────────────
-- Sem ela, a tela não teria como dizer à pessoa qual das duas portas ela
-- pegou — e o painel não teria como saber o que já foi feito sozinho.
--
-- `plano_cortesia` também entra aqui (de novo, e sem estragar nada se já
-- existir) para esta migration não depender da ordem em que a 0123 for
-- colada.

alter table public.companies
  add column if not exists plano_cortesia boolean not null default false;

alter table public.pedidos_reembolso
  add column if not exists efeito text
    check (efeito is null or efeito in ('encerrado_agora', 'ate_o_vencimento', 'sem_plano'));

-- ── PARTE 2: a proteção do plano abre para as funções do banco ────────
--
-- A 0123 pôs um gatilho que devolve `plano`, `plano_ate` e companhia ao
-- valor antigo quando quem grava não é a administração. Ele existe porque
-- a empresa tem `update` na própria linha e podia se dar o Ei Infinit.
--
-- Só que ele barraria também a função da Parte 3, que é justamente quem
-- precisa desligar o plano — e a empresa que pede reembolso não é
-- administração.
--
-- A primeira tentativa foi olhar `current_user`, contando que numa função
-- `security definer` ele vira o dono dela. Não funciona, e o teste 25
-- pegou na hora: o PRÓPRIO GATILHO é `security definer`, então dentro
-- dele `current_user` já é o dono sempre — a condição valia para todo
-- mundo e a proteção da 0123 sumia inteira. Um buraco novo no lugar do
-- que ela tinha fechado.
--
-- O jeito certo é o que a 0024 já usa neste mesmo banco para o WhatsApp
-- confirmado: quem tem direito se IDENTIFICA, com uma marca de sessão que
-- só vive dentro da transação (`set_config(..., true)`). O gatilho deixa
-- passar quem carrega a marca.
--
-- E ela não vira porta dos fundos: pelo app só se chega ao banco por
-- consultas de tabela e por funções expostas de propósito — não há como
-- mandar um `set_config`. Quem consegue rodar SQL solto aqui já é dono do
-- banco, e para esse nenhum gatilho é barreira.

create or replace function public.companies_protege_o_plano()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  eh_admin boolean;
begin
  select exists (select 1 from public.admins a where a.user_id = auth.uid()) into eh_admin;
  if eh_admin then
    return new;
  end if;

  -- A função do banco que tem direito de mexer no plano se identifica com
  -- esta marca (ver `pedir_reembolso`, na Parte 3).
  if coalesce(current_setting('ei.mexendo_no_plano', true), '') = 'sim' then
    return new;
  end if;

  -- `role` é o papel que o PostgREST assume ao atender o app:
  -- `authenticated` para quem entrou, `anon` para quem não entrou.
  -- Qualquer outra coisa é editor SQL, migration ou teste — que já têm
  -- acesso total, e para quem gatilho não é barreira nenhuma.
  if coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.plano := null;
    new.plano_ate := null;
    new.plano_desde := null;
    new.plano_cortesia := false;
  else
    new.plano := old.plano;
    new.plano_ate := old.plano_ate;
    new.plano_desde := old.plano_desde;
    new.plano_cortesia := old.plano_cortesia;
  end if;
  return new;
end;
$$;

drop trigger if exists companies_protege_o_plano on public.companies;
create trigger companies_protege_o_plano
  before insert or update on public.companies
  for each row execute function public.companies_protege_o_plano();

-- ── PARTE 3: pedir reembolso, e o que isso faz ────────────────────────
--
-- Uma função só, e não o app fazendo três gravações, por três motivos:
--
--   . as datas TÊM de ser as do banco. Se o app calculasse "faz menos de
--     7 dias", bastaria mexer no relógio do celular para transformar um
--     cancelamento em arrependimento;
--   . ou grava tudo, ou não grava nada. Um pedido registrado com o plano
--     ainda ligado (ou o contrário) é pior que qualquer um dos dois;
--   . a empresa não pode desligar o próprio plano por fora — e não passa
--     a poder: quem desliga é esta função, para este caso, e só.
--
-- Devolve qual das portas foi usada, para a tela dizer à pessoa o que
-- acabou de acontecer com o plano dela.

create or replace function public.pedir_reembolso(
  p_motivo text,
  p_contato text default null,
  p_company_id uuid default null
)
returns text
language plpgsql
security definer set search_path = public, pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_empresa public.companies%rowtype;
  v_efeito text;
  v_comeco timestamptz;
begin
  if v_user is null then
    raise exception 'Entre na sua conta para pedir reembolso.';
  end if;
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'Escreva o motivo do pedido.';
  end if;

  -- A empresa tem de ser DESTA conta. Sem o `owner_id` aqui, uma chamada
  -- escrita à mão cancelaria o plano da empresa de outra pessoa.
  if p_company_id is not null then
    select * into v_empresa from public.companies
     where id = p_company_id and owner_id = v_user;
  else
    -- Sem empresa dita, a que tem plano valendo. Se houver mais de uma, a
    -- que começou por último — é a compra mais recente, e é dela que
    -- alguém se arrepende.
    select * into v_empresa from public.companies
     where owner_id = v_user
       and plano is not null
       and plano_ate is not null
       and plano_ate > now()
     order by coalesce(plano_desde, created_at) desc
     limit 1;
  end if;

  if v_empresa.id is null
     or v_empresa.plano is null
     or v_empresa.plano_ate is null
     or v_empresa.plano_ate <= now() then
    -- Sem plano valendo não há o que encerrar. O pedido é gravado do
    -- mesmo jeito: pode ser sobre uma cobrança que a dona precisa olhar,
    -- e engolir o pedido seria a pior resposta possível.
    v_efeito := 'sem_plano';
  else
    -- `plano_desde` é carimbado pelo gatilho da 0110 quando o plano passa
    -- a valer. `created_at` é a rede: cadastro antigo, de antes daquela
    -- migration, tem a coluna vazia — e nesse caso a compra é
    -- necessariamente velha, então cair no cancelamento é o certo.
    v_comeco := coalesce(v_empresa.plano_desde, v_empresa.created_at);
    if v_comeco > now() - interval '7 days' then
      v_efeito := 'encerrado_agora';
    else
      v_efeito := 'ate_o_vencimento';
    end if;
  end if;

  insert into public.pedidos_reembolso (user_id, motivo, contato, company_id, efeito)
  values (v_user, btrim(p_motivo), nullif(btrim(p_contato), ''), v_empresa.id, v_efeito);

  -- A marca que o gatilho da proteção do plano reconhece. `true` no
  -- terceiro argumento: vale só dentro desta transação, e some sozinha
  -- quando ela termina — não há como vazar para a chamada seguinte.
  perform set_config('ei.mexendo_no_plano', 'sim', true);

  if v_efeito = 'encerrado_agora' then
    update public.companies
       set plano = null,
           plano_ate = null,
           plano_cortesia = false,
           plano_recorrente = false
     where id = v_empresa.id;

    -- Fora do ar agora. `paused` e não `closed`: encerrar joga fora quem
    -- já tinha se interessado, e a empresa pode voltar atrás — quem pede
    -- reembolso às vezes só queria falar com alguém.
    update public.job_listings
       set anunciada_ate = null,
           status = 'paused'
     where company_id = v_empresa.id
       and status = 'active';

  elsif v_efeito = 'ate_o_vencimento' then
    update public.companies
       set plano_recorrente = false
     where id = v_empresa.id;

    -- A vaga sai do ar no dia em que o mês pago acaba, e nem um dia
    -- depois. Só encurta: vaga que já ia sair antes fica como está.
    update public.job_listings
       set anunciada_ate = v_empresa.plano_ate
     where company_id = v_empresa.id
       and anunciada_ate is not null
       and anunciada_ate > v_empresa.plano_ate;
  end if;

  -- Larga a marca antes de devolver: o resto da transação (um gatilho que
  -- rode depois, por exemplo) não tem por que herdar o direito.
  perform set_config('ei.mexendo_no_plano', '', true);

  return v_efeito;
end;
$$;

revoke all on function public.pedir_reembolso(text, text, uuid) from public;
grant execute on function public.pedir_reembolso(text, text, uuid) to authenticated;

-- ── Confere a si mesma ────────────────────────────────────────────────
-- Lê o `pg_catalog`, nunca o `information_schema`. É o último comando do
-- arquivo de propósito: a dona lê o resultado do último.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.pedidos_reembolso'::regclass
           and attname = 'efeito' and not attisdropped) = 1
   and (select count(*) from pg_proc
         where proname = 'pedir_reembolso'
           and pronamespace = 'public'::regnamespace) = 1
  then 'PRONTO — o reembolso já encerra o plano sozinho'
  else 'AINDA FALTA — confira as partes acima'
end as resultado;
