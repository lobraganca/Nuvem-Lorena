-- =====================================================================
-- 0003 — Pedidos e o motor de ondas
-- =====================================================================
--
-- O coração do app. Alguém publica o que precisa; o sistema procura quem
-- faz aquilo e avisa — os Premium primeiro, os Pro depois, e o Básico
-- nunca, porque Básico é plano de consulta.
--
-- Três decisões que sustentam o resto:
--
-- 1. **Quem já foi avisado é uma linha na tabela, não um campo no pedido.**
--    A alternativa seria guardar no pedido "onda atual = 2". Parece
--    econômico e apaga a história: não dá para saber quem recebeu, quando
--    recebeu, quem abriu, quem ignorou. E é justamente essa história que
--    responde as perguntas que aparecem depois — "por que ninguém me
--    respondeu?", "esse profissional recebe e nunca aceita". Uma linha por
--    (pedido, profissional) responde todas.
--
-- 2. **O motor é idempotente.** Ele pode rodar duas vezes no mesmo minuto,
--    ou rodar atrasado depois de o servidor ficar fora do ar meia hora, e
--    o resultado é o mesmo. Isso não é capricho: agendador de tarefa
--    repete execução, e um motor que não aguenta repetição manda a mesma
--    oportunidade três vezes para a mesma pessoa. Quem garante isso é a
--    chave única (pedido, profissional) somada ao `on conflict do nothing`.
--
-- 3. **Só recebe disparo quem confirmou o telefone.** Do outro lado tem
--    alguém esperando um retorno. Mandar oportunidade para número não
--    confirmado é prometer um contato que pode não existir.
--
-- =====================================================================

-- --- Distância entre dois pontos, em quilômetros ---------------------
--
-- Haversine escrito à mão em vez de PostGIS. PostGIS é melhor e é uma
-- extensão a mais para instalar, versionar e manter — para "está dentro
-- do raio de 15km?" a conta simples basta e não depende de nada.

create or replace function public.distancia_km(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
) returns double precision
language sql
immutable
as $$
  select case
    when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null
    else 6371 * 2 * asin(sqrt(
           power(sin(radians(lat2 - lat1) / 2), 2)
         + cos(radians(lat1)) * cos(radians(lat2))
         * power(sin(radians(lon2 - lon1) / 2), 2)
       ))
  end
$$;

-- --- Pedidos ---------------------------------------------------------

create table if not exists public.pedidos (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references public.perfis (id) on delete cascade,
  categoria_id uuid not null references public.categorias (id),
  cidade_id    uuid not null references public.cidades (id),

  descricao    text not null check (length(trim(descricao)) >= 10),
  -- Onde o serviço acontece. Pode não ser a casa de quem pediu.
  latitude     double precision,
  longitude    double precision,
  bairro       text,

  -- 'proposta' para serviço, 'orcamento' para comércio. Muda o texto da
  -- tela e o que o plano precisa liberar para poder responder.
  tipo         text not null default 'proposta'
               check (tipo in ('proposta', 'orcamento')),

  status       text not null default 'aberto'
               check (status in ('aberto', 'atendido', 'cancelado', 'expirado')),

  -- Depois disto o pedido para de disparar onda nova. Sem prazo, um pedido
  -- esquecido continuaria acordando gente meses depois.
  expira_em    timestamptz not null default now() + interval '48 hours',

  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists pedidos_abertos_idx
  on public.pedidos (criado_em)
  where status = 'aberto';

create index if not exists pedidos_do_cliente_idx
  on public.pedidos (cliente_id, criado_em desc);

-- --- Disparos --------------------------------------------------------
--
-- Uma linha por (pedido, profissional). É o registro de que a oportunidade
-- chegou — e, depois, do que a pessoa fez com ela.

create table if not exists public.disparos (
  id              uuid primary key default gen_random_uuid(),
  pedido_id       uuid not null references public.pedidos (id) on delete cascade,
  profissional_id uuid not null references public.profissionais (id) on delete cascade,

  -- Em que onda esta pessoa foi avisada. Guardado no disparo e não lido do
  -- plano na hora da consulta porque o plano dela pode mudar depois, e a
  -- história tem que continuar contando o que aconteceu naquele dia.
  onda            smallint not null,

  enviado_em      timestamptz not null default now(),
  visto_em        timestamptz,
  respondido_em   timestamptz,
  resposta        text check (resposta in ('aceito', 'recusado')),

  -- Esta chave é o que torna o motor seguro para repetir. Rodou duas vezes?
  -- A segunda não insere nada.
  unique (pedido_id, profissional_id)
);

create index if not exists disparos_do_profissional_idx
  on public.disparos (profissional_id, enviado_em desc);

create index if not exists disparos_em_aberto_idx
  on public.disparos (profissional_id)
  where respondido_em is null;

-- --- Bloqueios -------------------------------------------------------
--
-- Mora aqui, e não junto das denúncias, porque bloqueio não é assunto de
-- moderação: é regra de disparo. Quem foi bloqueado não pode receber o
-- pedido de quem o bloqueou, e essa checagem roda dentro do motor.
--
-- (A primeira versão desta migration tentou deixar a tabela para depois e
-- proteger a consulta com `to_regclass`. Não funciona: função `language
-- sql` é validada na hora em que é criada, então o Postgres recusa a
-- referência a uma tabela que ainda não existe — o teste pegou isso na
-- primeira execução.)

create table if not exists public.bloqueios (
  id        uuid primary key default gen_random_uuid(),
  de_id     uuid not null references public.perfis (id) on delete cascade,
  para_id   uuid not null references public.perfis (id) on delete cascade,
  motivo    text,
  criado_em timestamptz not null default now(),
  unique (de_id, para_id),
  -- Bloquear a si mesmo não quer dizer nada e deixaria o cadastro fora dos
  -- próprios disparos.
  check (de_id <> para_id)
);

create index if not exists bloqueios_para_idx on public.bloqueios (para_id);

alter table public.bloqueios enable row level security;

drop policy if exists bloqueios_meus on public.bloqueios;
create policy bloqueios_meus on public.bloqueios
  for all using (de_id = auth.uid()) with check (de_id = auth.uid());

-- =====================================================================
-- Quem deve receber uma onda
-- =====================================================================
--
-- Separado do motor de propósito: assim dá para PERGUNTAR "quem receberia
-- este pedido na onda 1?" sem disparar nada. Serve para o painel mostrar o
-- alcance antes de publicar, e serve para conferir um disparo que deu
-- errado sem ter que reproduzi-lo.

create or replace function public.candidatos_da_onda(
  p_pedido_id uuid,
  p_onda      smallint
) returns table (profissional_id uuid)
language sql
stable
as $$
  with pedido as (
    select * from public.pedidos where id = p_pedido_id
  )
  select pr.id
    from public.profissionais pr
    join pedido ped on true
    join public.perfis perf on perf.id = pr.perfil_id
    -- O plano vigente é que diz a onda. Quem não tem assinatura ativa não
    -- entra aqui de jeito nenhum — e é isso que mantém o Básico fora.
    join lateral public.plano_vigente(pr.id) pl on true
   where pr.categoria_id = ped.categoria_id
     and pr.cidade_id    = ped.cidade_id
     and pl.onda         = p_onda
     -- Só quem está de fato disponível. Pausado, de férias e oculto ficam
     -- de fora — é exatamente para isso que esses estados existem.
     and pr.situacao     = 'disponivel'
     and pr.suspenso_em is null
     -- Telefone confirmado: sem isso, o cliente recebe um contato que
     -- ninguém garante.
     and perf.telefone_confirmado is not null
     -- Dentro do raio que a própria pessoa declarou atender. Sem
     -- coordenada de um dos lados, a cidade já basta como critério.
     and (
       ped.latitude is null or pr.latitude is null
       or public.distancia_km(pr.latitude, pr.longitude, ped.latitude, ped.longitude) <= pr.raio_km
     )
     -- Respeita o limite de oportunidades em aberto do plano.
     and (
       pl.limite_oportunidades_abertas is null
       or (select count(*) from public.disparos d
            where d.profissional_id = pr.id
              and d.respondido_em is null) < pl.limite_oportunidades_abertas
     )
     -- Não manda para quem o cliente bloqueou, nem para quem bloqueou o
     -- cliente. Nos dois sentidos: bloqueio que só vale de um lado obriga
     -- quem se incomodou a continuar recebendo pedido de quem o incomodou.
     and not exists (
       select 1 from public.bloqueios b
        where (b.de_id = ped.cliente_id and b.para_id = perf.id)
           or (b.de_id = perf.id and b.para_id = ped.cliente_id)
     )
$$;

-- =====================================================================
-- O motor
-- =====================================================================
--
-- Roda de minuto em minuto. Para cada pedido aberto e não vencido, olha
-- cada onda configurada e pergunta: já passou o atraso dela? Ela ainda não
-- foi disparada para este pedido? Então dispara.
--
-- Devolve quantos disparos criou — número que vira linha de log e responde
-- "o motor rodou e não fez nada" versus "o motor não rodou", que são
-- problemas completamente diferentes e parecem iguais no silêncio.

create or replace function public.processar_ondas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido  record;
  v_plano   record;
  v_criados integer := 0;
  -- `get diagnostics` só aceita `variável = item`; não dá para somar na
  -- mesma linha. Por isso o acumulador tem esta companheira.
  v_linhas  integer := 0;
  v_agora   timestamptz := now();
begin
  -- Fecha o que venceu antes de disparar qualquer coisa, senão um pedido
  -- vencido ainda acorda a onda seguinte neste mesmo ciclo.
  update public.pedidos
     set status = 'expirado', atualizado_em = v_agora
   where status = 'aberto' and expira_em <= v_agora;

  for v_pedido in
    select * from public.pedidos
     where status = 'aberto' and expira_em > v_agora
  loop
    for v_plano in
      select * from public.planos
       where ativo and onda is not null
       order by onda asc
    loop
      -- Ainda não chegou a hora desta onda: como as ondas vêm ordenadas,
      -- nenhuma das seguintes chegou também.
      exit when v_pedido.criado_em + (v_plano.atraso_minutos || ' minutes')::interval > v_agora;

      -- Esta onda já foi disparada para este pedido.
      continue when exists (
        select 1 from public.disparos d
         where d.pedido_id = v_pedido.id and d.onda = v_plano.onda
      );

      insert into public.disparos (pedido_id, profissional_id, onda)
      select v_pedido.id, c.profissional_id, v_plano.onda
        from public.candidatos_da_onda(v_pedido.id, v_plano.onda) c
      on conflict (pedido_id, profissional_id) do nothing;

      get diagnostics v_linhas = row_count;
      v_criados := v_criados + v_linhas;
    end loop;
  end loop;

  return v_criados;
end;
$$;

-- =====================================================================
-- Férias que acabam sozinhas
-- =====================================================================
--
-- Sem isto, "volto dia 20" vira cadastro invisível para sempre — porque
-- ninguém lembra de voltar e destravar.

create or replace function public.encerrar_ausencias()
returns integer
language sql
security definer
set search_path = public
as $$
  with voltaram as (
    update public.profissionais
       set situacao = 'disponivel', ausente_ate = null, atualizado_em = now()
     where situacao = 'ferias'
       and ausente_ate is not null
       and ausente_ate < current_date
    returning 1
  )
  select count(*)::integer from voltaram
$$;

-- =====================================================================
-- RLS
-- =====================================================================

alter table public.pedidos  enable row level security;
alter table public.disparos enable row level security;

-- O pedido é de quem pediu.
drop policy if exists pedidos_do_cliente on public.pedidos;
create policy pedidos_do_cliente on public.pedidos
  for all using (cliente_id = auth.uid()) with check (cliente_id = auth.uid());

-- ...e de quem recebeu o disparo. Sem esta segunda policy, o profissional
-- receberia a notificação e não conseguiria ler o que foi pedido.
drop policy if exists pedidos_de_quem_recebeu on public.pedidos;
create policy pedidos_de_quem_recebeu on public.pedidos
  for select using (exists (
    select 1 from public.disparos d
      join public.profissionais pr on pr.id = d.profissional_id
     where d.pedido_id = pedidos.id and pr.perfil_id = auth.uid()
  ));

-- O disparo é do profissional que o recebeu.
drop policy if exists disparos_do_profissional on public.disparos;
create policy disparos_do_profissional on public.disparos
  for select using (exists (
    select 1 from public.profissionais pr
     where pr.id = disparos.profissional_id and pr.perfil_id = auth.uid()
  ));

-- Responder é UPDATE, nunca upsert. O `upsert` do PostgREST é
-- `insert ... on conflict`, então ele passa pela policy de INSERT mesmo
-- quando está editando linha que já existe — e com policy só de update a
-- gravação é recusada sem explicar por quê. Já custou um dia inteiro num
-- projeto vizinho.
drop policy if exists disparos_responder on public.disparos;
create policy disparos_responder on public.disparos
  for update
  using (exists (
    select 1 from public.profissionais pr
     where pr.id = disparos.profissional_id and pr.perfil_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.profissionais pr
     where pr.id = disparos.profissional_id and pr.perfil_id = auth.uid()
  ));

-- O cliente precisa ver quem respondeu o pedido dele.
drop policy if exists disparos_vistos_pelo_cliente on public.disparos;
create policy disparos_vistos_pelo_cliente on public.disparos
  for select using (exists (
    select 1 from public.pedidos p
     where p.id = disparos.pedido_id and p.cliente_id = auth.uid()
  ));

-- =====================================================================
-- Conferência
-- =====================================================================

select case
  when (select count(*) from pg_class
         where relname in ('pedidos','disparos')
           and relnamespace = 'public'::regnamespace) = 2
   and (select count(*) from pg_proc
         where proname in ('processar_ondas','candidatos_da_onda','distancia_km','encerrar_ausencias')
           and pronamespace = 'public'::regnamespace) = 4
  then 'PRONTO — pedidos, disparos e o motor de ondas estão no ar.'
  else 'AINDA FALTA — alguma tabela ou função não foi criada. Rode esta parte inteira de novo, sem selecionar trecho.'
end as resultado;
