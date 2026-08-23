-- =====================================================================
-- 0002 — Planos e assinaturas
-- =====================================================================
--
-- A decisão central desta migration: **a onda é propriedade do plano, não
-- do código.**
--
-- O caminho fácil seria escrever no app "se premium, dispara agora; se pro,
-- espera uma hora". Funciona no primeiro dia e engessa para sempre: mudar
-- de 1 hora para 30 minutos vira alteração de código, revisão, build e
-- publicação — e nenhuma dessas etapas é da dona do negócio. Ela ficaria
-- dependente de um programador para uma decisão comercial.
--
-- Aqui a onda e o atraso são COLUNAS. Trocar "Pro recebe 1h depois" por
-- "Pro recebe 20min depois" é um update, feito pelo painel, sem publicar
-- nada. O motor de disparo (0003) lê estas colunas e obedece.
--
-- Mesma lógica para o resto: WhatsApp liberado, chat interno, destaque na
-- busca — cada um é um booleano no plano. Quem decide o que cada plano dá
-- é o painel, não o `if` de alguém.
--
-- =====================================================================

create table if not exists public.planos (
  id      uuid primary key default gen_random_uuid(),
  -- Nome curto e estável, usado pelo código quando ele precisa mesmo
  -- apontar um plano específico. O `nome` pode virar marketing e mudar;
  -- o `slug` não muda.
  slug    text not null unique,
  nome    text not null,
  descricao text,

  preco_mensal_centavos  integer not null default 0,
  -- Empresa costuma pagar mais que autônomo pelo mesmo plano. Nulo = mesmo
  -- preço para os dois.
  preco_mensal_pj_centavos integer,

  -- --- Ondas de disparo ---------------------------------------------
  --
  -- `onda` é a posição na fila: 1 recebe primeiro, 2 recebe depois.
  -- NULO significa que este plano NÃO recebe disparo nenhum — é o caso do
  -- Básico, que é plano de consulta: o cadastro aparece para quem procura,
  -- mas oportunidade não chega nele.
  onda   smallint check (onda is null or onda >= 1),
  -- Quanto tempo depois do pedido publicado esta onda dispara.
  -- A onda 1 usa 0 (imediato).
  atraso_minutos integer not null default 0 check (atraso_minutos >= 0),

  -- --- O que o plano libera -----------------------------------------
  whatsapp_liberado    boolean not null default false,
  ligacao_liberada     boolean not null default false,
  pedir_proposta       boolean not null default false,  -- serviços
  pedir_orcamento      boolean not null default false,  -- comércios
  chat_interno         boolean not null default false,
  estatisticas         boolean not null default false,
  divulgacao           boolean not null default false,  -- anunciar serviço

  -- Peso na ordenação da busca. Maior aparece antes, com sorte de desempate
  -- para não congelar sempre os mesmos no topo (ver 0003).
  destaque_busca       smallint not null default 0,

  -- Quantas oportunidades em aberto o profissional pode ter ao mesmo tempo.
  -- Existe para impedir que alguém aceite trinta e não atenda nenhuma.
  -- NULO = sem limite.
  limite_oportunidades_abertas integer,

  ativo     boolean not null default true,
  ordem     integer not null default 100,
  criado_em timestamptz not null default now()
);

-- Duas ondas diferentes não podem ter o mesmo número, senão o motor não
-- sabe quem vem antes.
create unique index if not exists planos_onda_unica
  on public.planos (onda) where onda is not null and ativo;

-- --- Assinaturas -----------------------------------------------------

create table if not exists public.assinaturas (
  id              uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references public.profissionais (id) on delete cascade,
  plano_id        uuid not null references public.planos (id),

  status  text not null default 'ativa'
          check (status in ('ativa', 'atrasada', 'cancelada', 'expirada')),

  -- Até quando vale. É esta data que manda, não o status: um registro
  -- "ativa" com data vencida é uma assinatura vencida. O status serve para
  -- contar a história (por que caiu), a data serve para decidir.
  vigente_ate  timestamptz not null,

  -- Referência do provedor de pagamento, para conciliar quando o webhook
  -- chegar fora de ordem — e ele chega.
  provedor        text,
  provedor_ref    text,

  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);

create index if not exists assinaturas_vigentes_idx
  on public.assinaturas (profissional_id, vigente_ate desc)
  where status = 'ativa';

-- =====================================================================
-- Plano vigente de cada profissional
-- =====================================================================
--
-- Uma função e não uma coluna em `profissionais`, porque plano vence
-- sozinho com a passagem do tempo. Uma coluna precisaria de alguém
-- passando para atualizá-la, e no intervalo entre o vencimento e essa
-- passagem o profissional continuaria recebendo o que já não pagou.
--
-- Quem não tem assinatura vigente cai no plano marcado como padrão
-- (o Básico). Assim NUNCA existe profissional sem plano — e portanto
-- nunca existe um caminho no código que precise tratar "plano nulo".

create or replace function public.plano_vigente(p_profissional_id uuid)
returns public.planos
language sql
stable
as $$
  select p.*
    from public.planos p
    join public.assinaturas a on a.plano_id = p.id
   where a.profissional_id = p_profissional_id
     and a.status = 'ativa'
     and a.vigente_ate > now()
     and p.ativo
   order by coalesce(p.onda, 999) asc   -- se houver duas, vale a melhor
   limit 1
$$;

-- =====================================================================
-- RLS
-- =====================================================================

alter table public.planos      enable row level security;
alter table public.assinaturas enable row level security;

-- Plano é vitrine: todo mundo precisa ver o que cada um oferece para
-- poder escolher.
drop policy if exists planos_leitura on public.planos;
create policy planos_leitura on public.planos for select using (ativo);

-- Assinatura é do dono. Ninguém mais precisa saber o que o vizinho paga.
drop policy if exists assinaturas_dono on public.assinaturas;
create policy assinaturas_dono on public.assinaturas
  for select
  using (exists (
    select 1 from public.profissionais pr
     where pr.id = assinaturas.profissional_id
       and pr.perfil_id = auth.uid()
  ));

-- Escrita de assinatura NÃO tem policy para o cliente de propósito: quem
-- grava é o webhook do pagamento, rodando com service_role. Deixar o app
-- gravar assinatura é deixar o app se dar Premium de graça.

-- =====================================================================
-- Os três planos
-- =====================================================================
--
-- Preços e prazos aqui são ponto de partida — a ideia é justamente que
-- mudem pelo painel sem precisar de código.

insert into public.planos
  (slug, nome, descricao, preco_mensal_centavos, preco_mensal_pj_centavos,
   onda, atraso_minutos,
   whatsapp_liberado, ligacao_liberada, pedir_proposta, pedir_orcamento,
   chat_interno, estatisticas, divulgacao, destaque_busca,
   limite_oportunidades_abertas, ordem)
values
  ('basico', 'Básico',
   'Seu cadastro aparece na busca com telefone visível. Não recebe oportunidades.',
   0, 0,
   null, 0,                      -- onda NULA: plano de consulta, não recebe disparo
   false, false, false, false, false, false, false, 0,
   null, 10),

  ('pro', 'Pro',
   'Recebe as oportunidades na segunda onda, com WhatsApp, ligação e estatísticas.',
   4900, 7900,
   2, 60,                        -- segunda onda, 1 hora depois
   true, true, true, true, false, true, false, 10,
   5, 20),

  ('premium', 'Premium',
   'Recebe as oportunidades primeiro, com chat interno, divulgação e destaque máximo.',
   14900, 19900,
   1, 0,                         -- primeira onda, imediato
   true, true, true, true, true, true, true, 30,
   15, 30)
on conflict (slug) do nothing;

-- =====================================================================
-- Conferência
-- =====================================================================

select case
  when (select count(*) from public.planos where slug in ('basico','pro','premium')) = 3
   and (select onda from public.planos where slug = 'premium') = 1
   and (select onda from public.planos where slug = 'pro') = 2
   and (select onda from public.planos where slug = 'basico') is null
  then 'PRONTO — os 3 planos existem. Premium na 1a onda, Pro na 2a, Básico sem disparo.'
  else 'AINDA FALTA — os planos não ficaram como deviam. Rode esta parte inteira de novo, sem selecionar trecho.'
end as resultado;
