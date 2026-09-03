-- ═══════════════════════════════════════════════════════════════════════
-- 0114 — Primeiro emprego, freela, reembolso com motivo e as métricas
-- ═══════════════════════════════════════════════════════════════════════
--
-- Quatro pedidos da dona, e os quatro precisam de banco:
--
--   "ter uma opção da pessoa colocar no cadastro que é 1º emprego e no
--    perfil da vaga ter opção de escolher que pode ser pessoa que busca o
--    primeiro emprego"
--   "criar uma área pra freelancer"
--   "a pessoa ao pedir reembolso ter onde escrever o motivo e isso chegar
--    pra mim no painel do administrador"
--   "dentro do módulo do empregado, ter uma opção de métricas... seu
--    perfil apareceu para 8 empresas esta semana, você apareceu em 14
--    buscas"
--
-- ── A ORDEM IMPORTA MAIS QUE O CONTEÚDO ───────────────────────────────
--
-- Esta SQL vai ANTES do código que a usa. O formulário de cadastro grava
-- o objeto inteiro de uma vez: uma coluna que o app manda e o banco não
-- conhece derruba a gravação TODA, e não só o campo novo. Foi o que
-- aconteceu com a `uf` na 0060 e deixou gente sem conseguir se cadastrar
-- por um dia inteiro.
--
-- Coluna criada antes não quebra nada: o app de hoje simplesmente a
-- ignora.

-- ═══════════════════════════════════════════════════════════════════════
-- Parte 1 de 3 — PRIMEIRO EMPREGO E FREELA
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── Por que duas colunas e não uma etiqueta em `atributos` ────────────
--
-- `atributos` é uma lista de texto livre, boa para o que é enfeite. Estas
-- duas entram em CONTA: o primeiro emprego muda o que a onda deve
-- perdoar (não ter experiência), e o freela decide se a pessoa aparece na
-- área de bico. Critério que entra em conta precisa de coluna com tipo,
-- senão um dia alguém escreve "1o emprego" e a comparação para de bater.
--
-- ── O padrão é `false` nas três, e é de propósito ─────────────────────
--
-- Ninguém marcou nada ainda. Um padrão `true` diria, no dia seguinte à
-- SQL, que toda vaga da cidade aceita primeiro emprego — e a promessa
-- apareceria na tela de gente que a empresa nunca fez.

alter table public.professionals
  add column if not exists primeiro_emprego boolean not null default false,
  add column if not exists aceita_freela boolean not null default false;

alter table public.job_listings
  add column if not exists aceita_primeiro_emprego boolean not null default false;

-- A VIEW PÚBLICA PRECISA DAS DUAS COLUNAS NOVAS
-- ─────────────────────────────────────────────
-- A lista de talentos e a onda leem `professionals_public`, não a tabela.
-- Coluna que não estiver aqui chega como indefinida no app, sem erro
-- nenhum — e o selo "primeiro emprego" simplesmente nunca apareceria.
--
-- A view é recriada inteira (drop + create) porque a lista de colunas
-- muda no meio; e o `where` volta escrito à mão, porque view roda com os
-- direitos de quem a criou e ignora o RLS: sem ele, cadastro suspenso e
-- pausado voltam a aparecer para todo mundo (foi o defeito da 0049).
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, uf, bio, phone,
  whatsapp, email, instagram, linkedin,
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
  cnh, cnh_categorias, telefones_extra,
  modo_trabalho, fim_de_semana, inicio_imediato,
  primeiro_emprego, aceita_freela,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

-- A função que a onda usa também devolve o primeiro emprego e o freela.
-- ─────────────────────────────────────────────────────────────────────
-- Ela é da 0113 e entrega os campos da conta de compatibilidade, sem nome
-- e sem telefone. Sem estas duas colunas, a onda de uma vaga que aceita
-- primeiro emprego trataria a pessoa como qualquer outra — que é
-- justamente o que a dona pediu para mudar.
--
-- O corpo é o MESMO da 0113, com duas colunas a mais no fim da lista. Ele
-- é repetido inteiro (e não remendado) porque `create or replace` não
-- aceita mudar a lista de colunas devolvida — daí o `drop` antes.
-- Reescrever só um pedaço aqui foi tentado e apagou, sem erro nenhum, a
-- trava que só deixa empresa cadastrada contar onda.
drop function if exists public.candidatos_para_compatibilidade(text, text);

create function public.candidatos_para_compatibilidade(
  p_cidade text,
  p_uf text default null
)
returns table (
  id uuid,
  owner_id uuid,
  categories text[],
  areas_de_interesse text[],
  city text,
  especialidade text,
  modo_trabalho text,
  cnh boolean,
  cnh_categorias text[],
  aceita_viajar boolean,
  inicio_imediato boolean,
  fim_de_semana boolean,
  pretensao_centavos integer,
  pretensao_combinar boolean,
  disponibilidade text[],
  primeiro_emprego boolean,
  aceita_freela boolean,
  escolaridade text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Mesma porta da 0077: só empresa cadastrada conta onda. Sem ela,
  -- qualquer conta varreria a cidade para montar um retrato do banco.
  if not exists (select 1 from public.companies c where c.owner_id = auth.uid()) then
    raise exception 'Só empresa cadastrada pode contar a onda.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select p.id,
         p.owner_id,
         coalesce(p.categories, '{}')::text[],
         coalesce(p.areas_de_interesse, '{}')::text[],
         p.city,
         p.especialidade,
         p.modo_trabalho,
         coalesce(p.cnh, false),
         coalesce(p.cnh_categorias, '{}')::text[],
         coalesce(p.aceita_viajar, false),
         coalesce(p.inicio_imediato, false),
         coalesce(p.fim_de_semana, false),
         p.pretensao_centavos,
         coalesce(p.pretensao_combinar, false),
         coalesce(p.disponibilidade, '{}')::text[],
         coalesce(p.primeiro_emprego, false),
         coalesce(p.aceita_freela, false),
         -- A escolaridade não é coluna: é o maior NÍVEL entre as linhas de
         -- formação (0104). A ordem é escrita aqui porque "superior" não é
         -- maior que "medio" em ordem alfabética.
         (
           select c.nivel
             from public.professional_courses c
            where c.professional_id = p.id
              and c.tipo = 'formacao'
              and c.nivel is not null
            order by case c.nivel
                       when 'doutorado' then 7
                       when 'mestrado' then 6
                       when 'pos' then 5
                       when 'superior' then 4
                       when 'tecnico' then 3
                       when 'medio' then 2
                       when 'fundamental' then 1
                       else 0
                     end desc
            limit 1
         )
    from public.professionals p
   where p.city = p_cidade
     -- O estado anda junto com a cidade, sempre: há "Bom Jesus" em mais de
     -- vinte estados, e filtrar só pelo nome mistura cidades distantes numa
     -- lista que chega cheia, sem erro nenhum.
     and (p_uf is null or p.uf = p_uf)
     and p.suspended = false
     and p.whatsapp_verified = true;
end;
$$;

revoke all on function public.candidatos_para_compatibilidade(text, text) from public;
grant execute on function public.candidatos_para_compatibilidade(text, text) to authenticated;

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog: o information_schema filtra por privilégio do papel
-- corrente e já respondeu "não existe" cinco vezes para uma coluna que
-- estava lá (ver a 0060 no CLAUDE.md).
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.professionals'::regclass
           and attname in ('primeiro_emprego','aceita_freela')
           and not attisdropped) = 2
   and (select count(*) from pg_attribute
         where attrelid = 'public.job_listings'::regclass
           and attname = 'aceita_primeiro_emprego' and not attisdropped) = 1
   and (select count(*) from pg_attribute
         where attrelid = 'public.professionals_public'::regclass
           and attname in ('primeiro_emprego','aceita_freela')
           and not attisdropped) = 2
  then 'PRONTO — primeiro emprego e freela existem no banco'
  else 'AINDA FALTA — confira os comandos da Parte 1'
  end as resultado;

-- ═══════════════════════════════════════════════════════════════════════
-- Parte 2 de 3 — O PEDIDO DE REEMBOLSO, COM O MOTIVO ESCRITO
-- ═══════════════════════════════════════════════════════════════════════
--
-- Hoje "Pedir reembolso" é um link de WhatsApp: a pessoa sai do app, e o
-- pedido vira uma conversa no celular da dona no meio de outras trinta.
-- Não há lista, não há data, não há como saber o que já foi resolvido.
--
-- ── O motivo é obrigatório na tela, não no banco ──────────────────────
--
-- `motivo` é `not null`, mas o que impede o texto vazio é a tela. Um
-- `check (length(motivo) > 0)` no banco devolveria erro de constraint —
-- que chega ao app como uma mensagem em inglês sobre uma restrição, e é o
-- tipo de recusa que a pessoa lê como "o app quebrou".
--
-- ── Por que guardar o telefone junto ──────────────────────────────────
--
-- Para a dona responder sem ter de procurar a pessoa. O contato vem da
-- conta no momento do pedido: quem pede reembolso costuma cancelar tudo
-- em seguida, e aí o vínculo com a assinatura já não conta a história.

create table if not exists public.pedidos_reembolso (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  motivo text not null,
  contato text,
  status text not null default 'novo' check (status in ('novo', 'lido', 'resolvido')),
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists pedidos_reembolso_data_idx
  on public.pedidos_reembolso (created_at desc);

alter table public.pedidos_reembolso enable row level security;

-- Quem pede é quem está logado, e só em nome próprio.
drop policy if exists "A pessoa faz o próprio pedido" on public.pedidos_reembolso;
create policy "A pessoa faz o próprio pedido" on public.pedidos_reembolso
  for insert to authenticated
  with check (user_id = auth.uid());

-- E vê o que pediu — senão a tela não tem como dizer "seu pedido chegou".
drop policy if exists "A pessoa vê os próprios pedidos" on public.pedidos_reembolso;
create policy "A pessoa vê os próprios pedidos" on public.pedidos_reembolso
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Administração lê os pedidos de reembolso" on public.pedidos_reembolso;
create policy "Administração lê os pedidos de reembolso" on public.pedidos_reembolso
  for select using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- Marcar como lido/resolvido e anotar o que foi feito.
drop policy if exists "Administração responde os pedidos de reembolso" on public.pedidos_reembolso;
create policy "Administração responde os pedidos de reembolso" on public.pedidos_reembolso
  for update using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- ── Confere a si mesma ─────────────────────────────────────────────────
select case
  when (select count(*) from pg_class
         where relname = 'pedidos_reembolso'
           and relnamespace = 'public'::regnamespace) = 1
   and (select count(*) from pg_policy
         where polrelid = 'public.pedidos_reembolso'::regclass) = 4
  then 'PRONTO — o pedido de reembolso com motivo já pode chegar no painel'
  else 'AINDA FALTA — confira os comandos da Parte 2'
  end as resultado;

-- ═══════════════════════════════════════════════════════════════════════
-- Parte 3 de 3 — AS MÉTRICAS DE QUEM PROCURA TRABALHO
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "seu perfil apareceu para 8 empresas esta semana; você apareceu
-- em 14 buscas; você está entre os profissionais mais compatíveis para 3
-- oportunidades."
--
-- Das três, duas já existem no banco:
--
--   as empresas que abriram o cadastro  →  `profile_views` (0106)
--   as vagas em que a pessoa é das mais compatíveis  →  conta feita no
--     próprio app, com a mesma fórmula da onda
--
-- Falta a do meio: aparecer numa BUSCA não deixava rastro nenhum.
--
-- ── Uma linha por dia, e não por aparição ─────────────────────────────
--
-- Uma linha por vez que alguém rolou a lista encheria a tabela com
-- milhares de linhas por semana para dizer um número só. Aqui é
-- (pessoa, dia) e um contador — a mesma decisão da 0106 para as visitas.
--
-- ── Por que uma função, e não um insert do app ────────────────────────
--
-- Quem aparece na busca não é quem está buscando: o app precisaria de
-- permissão para escrever numa linha de OUTRA pessoa, o que abriria a
-- tabela para qualquer um escrever qualquer coisa em qualquer cadastro.
-- A função roda com os direitos do dono do banco (`security definer`) e
-- só sabe fazer uma coisa: somar 1 no dia de hoje.

create table if not exists public.aparicoes_em_busca (
  professional_id uuid not null references public.professionals(id) on delete cascade,
  dia date not null default current_date,
  vezes integer not null default 0,
  primary key (professional_id, dia)
);

alter table public.aparicoes_em_busca enable row level security;

-- Só a própria pessoa lê o próprio número.
drop policy if exists "A pessoa vê as próprias aparições" on public.aparicoes_em_busca;
create policy "A pessoa vê as próprias aparições" on public.aparicoes_em_busca
  for select to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = aparicoes_em_busca.professional_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "Administração vê as aparições" on public.aparicoes_em_busca;
create policy "Administração vê as aparições" on public.aparicoes_em_busca
  for select using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- Escrever, só pela função abaixo. Nenhuma policy de insert/update de
-- propósito: sem elas, o PostgREST recusa qualquer gravação direta.

create or replace function public.registrar_aparicao_em_busca(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_ids is null or array_length(p_ids, 1) is null then
    return;
  end if;

  /* Teto de 200 por chamada: é o tamanho de uma página de busca. Sem
     ele, uma chamada com dez mil ids viraria dez mil somas — e o
     contador de "buscas" perderia o sentido junto. */
  if array_length(p_ids, 1) > 200 then
    return;
  end if;

  insert into public.aparicoes_em_busca (professional_id, dia, vezes)
  select t.id, current_date, 1
    from unnest(p_ids) as t(id)
   where exists (select 1 from public.professionals p where p.id = t.id)
  on conflict (professional_id, dia)
    do update set vezes = public.aparicoes_em_busca.vezes + 1;
end;
$$;

-- A busca de talentos é aberta a quem não entrou (é assim desde sempre),
-- então a contagem também precisa ser.
grant execute on function public.registrar_aparicao_em_busca(uuid[]) to anon, authenticated;

-- ── Confere a si mesma ─────────────────────────────────────────────────
select case
  when (select count(*) from pg_class
         where relname = 'aparicoes_em_busca'
           and relnamespace = 'public'::regnamespace) = 1
   and (select count(*) from pg_proc
         where proname = 'registrar_aparicao_em_busca'
           and pronamespace = 'public'::regnamespace) = 1
  then 'PRONTO — as métricas de quem procura trabalho já podem ser contadas'
  else 'AINDA FALTA — confira os comandos da Parte 3'
  end as resultado;
