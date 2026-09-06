-- ═══════════════════════════════════════════════════════════════════════
-- 0129 — Os pedidos de pagamento (Mercado Pago)
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "vamos configurar o mercado livre pro site."
--
-- Até hoje o botão de assinar abria o WhatsApp: a empresa falava com ela,
-- pagava por Pix, e a administração ligava o plano à mão. Isto aqui é a
-- mesa onde o pagamento pelo site vai se apoiar.
--
-- ── POR QUE UMA TABELA, E NÃO SÓ O REGISTRO DO PAGAMENTO ──────────────
--
-- Já existe `processed_payments` (0021/0047), que anota o pagamento DEPOIS
-- de ele ser aprovado, para não creditar duas vezes o mesmo aviso do
-- Mercado Pago. Ela não serve para o que falta: quando a confirmação
-- chega, é preciso saber O QUE foi comprado e PARA QUEM. Essa informação
-- nasce ANTES do pagamento, no momento em que a pessoa toca no botão — e
-- não existe lugar nenhum guardando isso hoje.
--
-- ── O PREÇO NUNCA VEM DA TELA ─────────────────────────────────────────
--
-- A linha é criada pela Edge Function `criar-pagamento`, que roda no
-- servidor com a service_role, e o valor sai da tabela de preços do
-- próprio servidor. Ninguém insere aqui pelo navegador — é o que as
-- policies abaixo garantem.
--
-- Se o navegador pudesse inserir, bastaria trocar um número na requisição
-- para assinar o plano de R$ 129,90 por um centavo. Não é hipótese: é o
-- primeiro lugar onde alguém mexe.
--
-- ── STATUS: 'aberto' É O NORMAL, NÃO UM ERRO ──────────────────────────
--
-- A maior parte das linhas vai morrer em 'aberto': gente que toca no botão,
-- vê a tela do Mercado Pago e desiste. Isso é o funil, não defeito. Quem
-- for olhar o painel precisa saber disso antes de se assustar com a
-- proporção.

-- ── 1. A tabela ────────────────────────────────────────────────────────
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),

  /* Quem tocou no botão. É por ele que a pessoa vê o próprio pedido, e é
     ele que o servidor confere contra o dono da empresa/cadastro antes de
     criar a cobrança. */
  user_id uuid not null references auth.users on delete cascade,

  /* O que está sendo comprado. Em texto e com `check` em vez de enum:
     produto novo aqui é um `alter ... drop constraint` de uma linha, e não
     um tipo do Postgres que exige migração para ganhar valor novo. */
  tipo text not null check (tipo in ('plano_empresa', 'destaque_profissional')),

  /* A chave do plano quando `tipo = plano_empresa` ('pro', 'tres',
     'cinco', 'dez', 'ilimitado' — as mesmas de `companies.plano`, ver a
     0120). Nula no destaque, que não tem plano. */
  plano text,

  /* Para quem o benefício vai. Um dos dois, conforme o tipo.
     `on delete cascade` nos dois: pedido de empresa apagada não tem o que
     ligar quando o pagamento cair, e uma linha órfã aqui é dinheiro
     recebido sem destino — melhor não existir do que existir sem dono. */
  company_id uuid references public.companies on delete cascade,
  professional_id uuid references public.professionals on delete cascade,

  /* Por quantos dias o benefício vale, e quanto custa — os dois GRAVADOS
     no pedido, e não consultados depois na tabela de preços.

     É de propósito: quem pagou R$ 89,90 pagou R$ 89,90. Se o preço subir
     amanhã e o webhook for ler a tabela de preços na hora de aplicar, um
     pagamento que estava a caminho vira outro valor no meio do caminho. O
     pedido é o contrato, e contrato não muda depois de assinado. */
  dias integer not null check (dias > 0),
  centavos integer not null check (centavos > 0),

  status text not null default 'aberto'
    check (status in ('aberto', 'pago', 'cancelado')),

  /* Os dois lados do Mercado Pago: a preferência é o que se cria para
     abrir a tela de pagamento; o pagamento é o que volta aprovado. São
     números diferentes, e confundir os dois é o erro clássico dessa
     integração. */
  mp_preference_id text,
  mp_payment_id text,

  pago_em timestamptz,
  created_at timestamptz not null default now()
);

/* Achar o pedido pelo pagamento (é o que o webhook faz) e listar os
   pedidos de uma pessoa, sem varrer a tabela. */
create index if not exists pedidos_user_idx on public.pedidos (user_id, created_at desc);
create index if not exists pedidos_payment_idx on public.pedidos (mp_payment_id);
create index if not exists pedidos_status_idx on public.pedidos (status, created_at desc);

-- ── 2. Quem enxerga o quê ──────────────────────────────────────────────
alter table public.pedidos enable row level security;

/* A pessoa vê os PRÓPRIOS pedidos — é o que faz a tela "Suas compras"
   existir sem passar pelo servidor. */
drop policy if exists pedido_e_de_quem_pediu on public.pedidos;
create policy pedido_e_de_quem_pediu
  on public.pedidos for select
  to authenticated
  using (user_id = auth.uid());

/* A administração vê todos, para o painel financeiro. */
drop policy if exists admin_ve_os_pedidos on public.pedidos;
create policy admin_ve_os_pedidos
  on public.pedidos for select
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

/* NENHUMA policy de insert, update ou delete, e isso é a parte que
   importa: sem policy, o navegador não escreve — nem o dono da linha.
   Quem cria o pedido é a Edge Function com a service_role, que ignora RLS.

   Um `insert` liberado aqui, mesmo "só para o próprio usuário", seria a
   porta para escolher o próprio preço. */

/* E, além da ausência de policy, a permissão é tirada na unha.
   ────────────────────────────────────────────────────────────
   Isto é cinto e suspensório de propósito. O Supabase concede, por padrão,
   todas as permissões de tabela nova a `anon` e `authenticated`, deixando
   a defesa inteira por conta do RLS — o que funciona, e funciona só
   enquanto ninguém acrescentar uma policy de insert "para facilitar".

   Com o revoke, essa policy futura não bastaria: seria preciso conceder a
   permissão também, de propósito, escrevendo uma linha que este comentário
   explica. Numa tabela onde a linha diz quanto alguém vai pagar, esse
   segundo cadeado vale o incômodo.

   `service_role` não é tocada aqui: ela tem concessão própria e ignora
   RLS. É com ela que a Edge Function grava. */
revoke insert, update, delete on public.pedidos from anon, authenticated;
grant select on public.pedidos to authenticated;

-- ── 3. A conferência ───────────────────────────────────────────────────
-- Lê `pg_catalog`, e nunca `information_schema`: depois da 0060 o
-- `information_schema` respondeu cinco vezes que uma coluna que existia
-- não existia (está no CLAUDE.md). E é o ÚLTIMO comando do arquivo de
-- propósito — o painel mostra o resultado do último, então qualquer coisa
-- depois disto engoliria a resposta.
select case
  when (select count(*) from pg_class
         where relname = 'pedidos' and relnamespace = 'public'::regnamespace) = 1
   and (select count(*) from pg_policy
         where polrelid = 'public.pedidos'::regclass) = 2
  then 'PRONTO — a tabela de pedidos existe, e só o servidor escreve nela.'
  else 'AINDA FALTA — rode o arquivo inteiro, do começo, sem nada selecionado.'
end as resultado;
