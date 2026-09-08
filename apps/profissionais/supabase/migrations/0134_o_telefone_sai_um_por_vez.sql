-- ═══════════════════════════════════════════════════════════════════════
-- 0134 — O telefone sai UM POR VEZ, com registro e teto por dia
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "consegue ver o número de um candidato só por um perfil de
-- empresa."
--
-- Consegue, e é mais largo do que ela viu: a `professionals_public` leva
-- `phone`, `whatsapp`, `email` e `telefones_extra`, e está liberada para
-- QUALQUER conta logada — empresa ou candidato. Sem limite e sem registro
-- nenhum. Uma conta criada em dois minutos por SMS baixa, em páginas, a
-- lista de telefones de todos os desempregados da cidade.
--
-- É o mesmo vazamento que a 0118 fechou para quem NÃO tem conta, e o
-- mesmo insumo do golpe de emprego falso. A conta só encareceu o ataque;
-- não o impediu.
--
-- ── O QUE ELA ESCOLHEU, E POR QUÊ ─────────────────────────────────────
--
-- Perguntei entre três caminhos e ela escolheu o do meio: continua de
-- graça ver e falar com as pessoas — o que a tela promete desde 01/09 —,
-- mas o telefone passa a sair um de cada vez, por uma porta que sabe quem
-- pediu e quantos já pediu hoje.
--
-- Quem quer contratar não sente diferença: ela abre a ficha de quem
-- interessa e o número está lá. Quem quer a lista inteira bate no teto na
-- vigésima ficha, e cada pedido ficou registrado com nome e hora.
--
-- ── AS TRÊS PEÇAS ─────────────────────────────────────────────────────
--
--   1. a view perde as colunas de contato — a porta larga fecha;
--   2. `ver_contato()` — a porta estreita, com teto e registro;
--   3. `contatos_dos_interessados()` — quem SE CANDIDATOU à sua vaga não
--      passa pelo teto: essa pessoa escolheu te dar o número.
--
-- A 3 é o que impede o remédio de virar doença. Sem ela, a empresa que
-- publicou uma vaga com trinta interessados não conseguiria falar com os
-- trinta — e aí o app deixaria de fazer a única coisa que ele existe para
-- fazer.

-- ══ PARTE 1: A VIEW PERDE O CONTATO ═══════════════════════════════════
--
-- `drop` e não `create or replace`: replace não consegue REMOVER coluna
-- (ele tenta casar posicionalmente e recusa). É a mesma pedra da 0014.
--
-- A lista de colunas é a da 0117 menos quatro: `phone`, `whatsapp`,
-- `email` e `telefones_extra`. O `where` é o mesmo, copiado por extenso —
-- view roda com os direitos de quem a criou e IGNORA o RLS, então toda
-- regra de quem aparece mora aqui dentro (é o defeito da 0049, no
-- CLAUDE.md). Ele já se perdeu duas vezes numa recriação; por isso a
-- conferência do fim lê o texto da view, e não só a existência dela.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, uf, bio,
  instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  case when mostrar_endereco then neighborhood end as neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, disponivel, atributos,
  areas_de_interesse,
  pretensao_centavos, pretensao_combinar, pretensao_periodo,
  disponibilidade, aceita_viajar,
  case when data_nascimento is not null
       then extract(year from age(data_nascimento))::int end as idade,
  cnh, cnh_categorias,
  modo_trabalho, fim_de_semana, inicio_imediato,
  primeiro_emprego, aceita_freela, pcd,
  mostrar_endereco, created_at
from public.professionals
where suspended = false
  and paused = false
  and whatsapp_verified = true;

grant select on public.professionals_public to authenticated;

-- ── E O `anon` PRECISA SER RECUSADO OUTRA VEZ ─────────────────────────
--
-- Isto não é repetição da 0118: é conserto de um efeito que só aparece
-- ao RECRIAR a view. O Supabase mantém um `alter default privileges` que
-- concede `select` a `anon` e `authenticated` em todo objeto NOVO do
-- schema `public` — e uma view recriada é um objeto novo. Ou seja, o
-- `revoke` da 0118 morreu junto com a view antiga, e quem não tem conta
-- voltaria a ler a lista.
--
-- O teste 30 pegou isto na primeira execução ("VAZOU: o anon voltou a ler
-- a professionals_public"), e é exatamente para isso que ele existe. Sem
-- ele, o conserto de um vazamento teria reaberto outro — o mesmo, um ano
-- depois, na mesma view.
revoke select on public.professionals_public from anon;
revoke select on public.contatos_vistos from anon;

-- ══ PARTE 2: O REGISTRO ═══════════════════════════════════════════════
--
-- Uma linha por vez que alguém abre um contato. Serve a duas coisas:
-- contar o teto do dia e responder "quem viu o meu telefone?" — pergunta
-- que a LGPD dá à pessoa e que hoje o app não saberia responder.
create table if not exists public.contatos_vistos (
  id uuid primary key default gen_random_uuid(),
  -- Quem pediu.
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- De quem é o contato pedido.
  professional_id uuid not null references public.professionals (id) on delete cascade,
  visto_em timestamptz not null default now()
);

/* O teto é contado por conta e por dia, então é por aqui que a contagem
   entra. Sem índice, cada abertura de ficha varre a tabela inteira — e
   ela só cresce. */
create index if not exists contatos_vistos_conta_dia_idx
  on public.contatos_vistos (user_id, visto_em desc);

alter table public.contatos_vistos enable row level security;

/* A PESSOA vê quem pediu o contato dela. É o direito dela, e é a resposta
   para "como você conseguiu meu número?". */
drop policy if exists contato_visto_e_do_dono on public.contatos_vistos;
create policy contato_visto_e_do_dono
  on public.contatos_vistos for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
       where p.id = contatos_vistos.professional_id
         and p.owner_id = auth.uid()
    )
  );

/* E a administração vê tudo, que é como se apura um abuso. */
drop policy if exists admin_ve_contatos_vistos on public.contatos_vistos;
create policy admin_ve_contatos_vistos
  on public.contatos_vistos for select
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

/* NINGUÉM escreve pelo app: não há policy de insert, de propósito. Quem
   grava é a função da Parte 3, que é `security definer` e passa por cima
   da RLS. Uma policy de insert aqui deixaria qualquer conta encher a
   tabela de registros falsos — e o registro é justamente o que fica de
   prova. */

grant select on public.contatos_vistos to authenticated;

-- ══ PARTE 3: A PORTA ESTREITA ═════════════════════════════════════════
--
-- O TETO. Vinte fichas por dia é largo para quem contrata (ninguém liga
-- para vinte pessoas num dia) e estreito para quem quer a lista: numa
-- cidade com mil cadastrados, cinquenta dias.
--
-- Para mudar, é uma linha só, sem publicar código:
--   create or replace function ... (trocando o 20)
-- ou, mais simples, avise que quer outro número e ele vem numa SQL nova.
create or replace function public.ver_contato(p_professional_id uuid)
returns table (phone text, whatsapp text, email text, telefones_extra text[])
language plpgsql
security definer set search_path = public
as $$
declare
  quem uuid := auth.uid();
  hoje int;
  TETO constant int := 20;
begin
  if quem is null then
    raise exception 'Entre na sua conta para ver o contato.';
  end if;

  -- ── O PRÓPRIO CADASTRO NÃO GASTA O TETO ───────────────────────────
  -- Quem abre a própria ficha está conferindo o que a cidade vê. Contar
  -- isso seria gastar o dia da pessoa com ela mesma.
  if exists (
    select 1 from public.professionals p
     where p.id = p_professional_id and p.owner_id = quem
  ) then
    return query
      select p.phone, p.whatsapp, p.email, p.telefones_extra
        from public.professionals p
       where p.id = p_professional_id;
    return;
  end if;

  -- ── O MESMO CONTATO, DE NOVO, NÃO GASTA DE NOVO ───────────────────
  -- Abrir a mesma ficha duas vezes no mesmo dia é o que qualquer pessoa
  -- faz (voltou para copiar o número certo). Cobrar por isso faria a
  -- empresa perder o teto sem ter visto ninguém novo.
  select count(distinct c.professional_id) into hoje
    from public.contatos_vistos c
   where c.user_id = quem
     and c.visto_em >= date_trunc('day', now())
     and c.professional_id <> p_professional_id;

  if hoje >= TETO then
    raise exception 'Você já abriu % contatos hoje. Amanhã libera de novo.', TETO;
  end if;

  insert into public.contatos_vistos (user_id, professional_id)
  values (quem, p_professional_id);

  -- O cadastro tem de estar VISÍVEL. Sem esta linha, a função entregaria
  -- o telefone de quem se marcou como oculto ou foi tirado do ar — e aí
  -- ela seria uma porta maior que a que acabou de ser fechada.
  return query
    select p.phone, p.whatsapp, p.email, p.telefones_extra
      from public.professionals p
     where p.id = p_professional_id
       and p.suspended = false
       and p.paused = false
       and p.whatsapp_verified = true;
end;
$$;

grant execute on function public.ver_contato(uuid) to authenticated;

-- ══ PARTE 4: QUEM SE CANDIDATOU À SUA VAGA ════════════════════════════
--
-- Aqui não há teto, e não é descuido: essa pessoa APERTOU um botão para
-- se oferecer à sua vaga. O contato é consentido, e limitar seria quebrar
-- o app — a empresa com trinta interessados precisa falar com os trinta.
--
-- O que a função garante é o contrário: só os interessados nas vagas DA
-- SUA empresa, e só se a empresa for sua.
-- Recebe a VAGA, e não a empresa: é o que a tela pede (a lista de
-- interessados é de uma vaga por vez), e é a porta mais estreita que
-- resolve o caso. Pela empresa, um pedido devolveria os interessados de
-- todas as vagas dela de uma vez — mais dados do que a tela usa, e dado
-- que sai sem ser usado é dado que um dia vaza.
create or replace function public.contatos_dos_interessados(p_job_id uuid)
returns table (owner_id uuid, phone text, whatsapp text)
language plpgsql
security definer set search_path = public
as $$
declare
  quem uuid := auth.uid();
begin
  if quem is null then
    return;
  end if;

  -- A vaga é de uma empresa MINHA? Sem esta pergunta, qualquer conta
  -- pediria os interessados de qualquer vaga da cidade — e aí a porta
  -- estreita seria maior que a larga que acabou de fechar.
  if not exists (
    select 1
      from public.job_listings v
      join public.companies c on c.id = v.company_id
     where v.id = p_job_id and c.owner_id = quem
  ) then
    return;
  end if;

  return query
    select distinct p.owner_id, p.phone, p.whatsapp
      from public.job_responses r
      join public.professionals p on p.owner_id = r.professional_id
     where r.job_listing_id = p_job_id
       and r.interessado = true;
end;
$$;

grant execute on function public.contatos_dos_interessados(uuid) to authenticated;

-- ── Confere a si mesma ────────────────────────────────────────────────
-- Lê o `pg_catalog`, nunca o `information_schema`: ele filtra por
-- privilégio do papel corrente, e o editor do painel não roda como dono.
--
-- A pergunta mais importante é a primeira: a view NÃO PODE mais ter
-- coluna de contato. É o `where` e a lista de colunas desta view que já se
-- perderam duas vezes numa recriação, sem ninguém ver.
--
-- É o ÚLTIMO comando do arquivo de propósito: a dona lê o resultado do
-- último, e qualquer coisa depois disto engoliria a resposta.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.professionals_public'::regclass
           and attname in ('phone', 'whatsapp', 'email', 'telefones_extra')
           and not attisdropped) = 0
   and (select count(*) from pg_proc
         where proname = 'ver_contato' and pronamespace = 'public'::regnamespace) = 1
   and (select count(*) from pg_proc
         where proname = 'contatos_dos_interessados'
           and pronamespace = 'public'::regnamespace) = 1
   and (select count(*) from pg_class
         where relname = 'contatos_vistos'
           and relnamespace = 'public'::regnamespace) = 1
  then 'PRONTO — o telefone agora sai um por vez, com registro e teto de 20 por dia'
  else 'AINDA FALTA — confira as partes acima'
end as resultado;
