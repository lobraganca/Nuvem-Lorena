-- =====================================================================
-- Teste — a busca
-- =====================================================================
--
-- O que precisa ser verdade:
--
--   1. Quem digita "chuveiro" acha eletricista E encanador — porque
--      chuveiro que não esquenta é um, chuveiro que vaza é outro.
--   2. Quem digita "chuveiro vazando" acha o encanador PRIMEIRO — a
--      expressão mais longa que casou é a que manda.
--   3. Premium aparece antes de Pro, que aparece antes de Básico.
--   4. Quem está de férias aparece DEPOIS de quem está disponível.
--   5. Quem se ocultou não aparece de jeito nenhum.
--   6. Acento e maiúscula não atrapalham.
--
-- Roda em transação e desfaz no fim.

begin;
set local client_min_messages to warning;

-- O catálogo já veio da 0005. Pegamos os ids que vamos usar.
create temporary table ids as
select
  (select id from public.cidades    where nome = 'Itabirito')   as cidade,
  (select id from public.categorias where nome = 'Eletricista') as eletricista,
  (select id from public.categorias where nome = 'Encanador')   as encanador;

-- --- O elenco --------------------------------------------------------
--
--   premium   Eletricista, Premium,  disponível
--   pro       Eletricista, Pro,      disponível
--   basico    Eletricista, Básico,   disponível
--   ferias    Eletricista, Premium,  de férias
--   oculto    Eletricista, Premium,  oculto
--   agua      Encanador,   Pro,      disponível

insert into auth.users (id, phone, phone_confirmed_at) values
  ('a0000000-0000-0000-0000-0000000000a1', '+5531900000001', now()),
  ('a0000000-0000-0000-0000-0000000000a2', '+5531900000002', now()),
  ('a0000000-0000-0000-0000-0000000000a3', '+5531900000003', now()),
  ('a0000000-0000-0000-0000-0000000000a4', '+5531900000004', now()),
  ('a0000000-0000-0000-0000-0000000000a5', '+5531900000005', now()),
  ('a0000000-0000-0000-0000-0000000000a6', '+5531900000006', now());

update public.perfis set nome = 'Premium Silva',  telefone = '+5531900000001' where id = 'a0000000-0000-0000-0000-0000000000a1';
update public.perfis set nome = 'Pro Souza',      telefone = '+5531900000002' where id = 'a0000000-0000-0000-0000-0000000000a2';
update public.perfis set nome = 'Basico Lima',    telefone = '+5531900000003' where id = 'a0000000-0000-0000-0000-0000000000a3';
update public.perfis set nome = 'Ferias Costa',   telefone = '+5531900000004' where id = 'a0000000-0000-0000-0000-0000000000a4';
update public.perfis set nome = 'Oculto Dias',    telefone = '+5531900000005' where id = 'a0000000-0000-0000-0000-0000000000a5';
update public.perfis set nome = 'Água Nogueira',  telefone = '+5531900000006' where id = 'a0000000-0000-0000-0000-0000000000a6';

insert into public.profissionais (id, perfil_id, categoria_id, cidade_id, situacao, ausente_ate, apresentacao)
select 'b0000000-0000-0000-0000-0000000000b1'::uuid, 'a0000000-0000-0000-0000-0000000000a1'::uuid, eletricista, cidade, 'disponivel', null::date, 'Instalação e manutenção elétrica.' from ids
union all select 'b0000000-0000-0000-0000-0000000000b2'::uuid, 'a0000000-0000-0000-0000-0000000000a2'::uuid, eletricista, cidade, 'disponivel', null::date, 'Reparos rápidos.' from ids
union all select 'b0000000-0000-0000-0000-0000000000b3'::uuid, 'a0000000-0000-0000-0000-0000000000a3'::uuid, eletricista, cidade, 'disponivel', null::date, 'Atendo a região.' from ids
union all select 'b0000000-0000-0000-0000-0000000000b4'::uuid, 'a0000000-0000-0000-0000-0000000000a4'::uuid, eletricista, cidade, 'ferias', current_date + 10, 'Volto em breve.' from ids
union all select 'b0000000-0000-0000-0000-0000000000b5'::uuid, 'a0000000-0000-0000-0000-0000000000a5'::uuid, eletricista, cidade, 'oculto', null::date, 'Escondido.' from ids
union all select 'b0000000-0000-0000-0000-0000000000b6'::uuid, 'a0000000-0000-0000-0000-0000000000a6'::uuid, encanador,   cidade, 'disponivel', null::date, 'Desentupimento e vazamentos.' from ids;

insert into public.assinaturas (profissional_id, plano_id, vigente_ate)
select 'b0000000-0000-0000-0000-0000000000b1', id, now() + interval '30 days' from public.planos where slug='premium';
insert into public.assinaturas (profissional_id, plano_id, vigente_ate)
select 'b0000000-0000-0000-0000-0000000000b4', id, now() + interval '30 days' from public.planos where slug='premium';
insert into public.assinaturas (profissional_id, plano_id, vigente_ate)
select 'b0000000-0000-0000-0000-0000000000b5', id, now() + interval '30 days' from public.planos where slug='premium';
insert into public.assinaturas (profissional_id, plano_id, vigente_ate)
select 'b0000000-0000-0000-0000-0000000000b2', id, now() + interval '30 days' from public.planos where slug='pro';
insert into public.assinaturas (profissional_id, plano_id, vigente_ate)
select 'b0000000-0000-0000-0000-0000000000b6', id, now() + interval '30 days' from public.planos where slug='pro';
insert into public.assinaturas (profissional_id, plano_id, vigente_ate)
select 'b0000000-0000-0000-0000-0000000000b3', id, now() + interval '30 days' from public.planos where slug='basico';

-- =====================================================================
-- 1 — "chuveiro" traz os dois ofícios
-- =====================================================================

select
  '1 — chuveiro traz os dois' as caso,
  case when exists (select 1 from public.buscar_profissionais('chuveiro') where categoria_nome = 'Eletricista')
        and exists (select 1 from public.buscar_profissionais('chuveiro') where categoria_nome = 'Encanador')
       then 'PRONTO — achou eletricista e encanador'
       else 'FALHOU — deveria trazer os dois' end as resultado;

-- =====================================================================
-- 2 — "chuveiro vazando" põe o encanador na frente
-- =====================================================================

select
  '2 — chuveiro vazando' as caso,
  (select categoria_nome from public.buscar_profissionais('chuveiro vazando') limit 1) as primeiro,
  case when (select categoria_nome from public.buscar_profissionais('chuveiro vazando') limit 1) = 'Encanador'
       then 'PRONTO — a expressão mais longa mandou'
       else 'FALHOU — o encanador deveria vir primeiro' end as resultado;

-- =====================================================================
-- 3 — a ordem dos planos
-- =====================================================================

select
  '3 — ordem dos planos' as caso,
  string_agg(nome, ' > ' order by ord) as ordem_encontrada
  from (
    select nome, row_number() over () as ord
      from public.buscar_profissionais(null, null, (select eletricista from ids))
  ) x;

select
  '3 — ordem dos planos' as caso,
  case when (select nome from public.buscar_profissionais(null, null, (select eletricista from ids)) limit 1) = 'Premium Silva'
       then 'PRONTO — Premium primeiro'
       else 'FALHOU — Premium deveria vir primeiro' end as premium_na_frente,
  case when (select array_position(
               array(select nome from public.buscar_profissionais(null, null, (select eletricista from ids))),
               'Ferias Costa')
             ) > (select array_position(
               array(select nome from public.buscar_profissionais(null, null, (select eletricista from ids))),
               'Basico Lima'))
       then 'PRONTO — de férias fica atrás até do Básico disponível'
       else 'FALHOU — de férias deveria ficar atrás' end as ferias_atras;

-- =====================================================================
-- 4 — quem se ocultou não aparece
-- =====================================================================

select
  '4 — oculto' as caso,
  case when not exists (select 1 from public.buscar_profissionais(null, null, (select eletricista from ids)) where nome = 'Oculto Dias')
       then 'PRONTO — oculto não aparece'
       else 'FALHOU — oculto apareceu na busca' end as resultado;

-- =====================================================================
-- 5 — acento e maiúscula não atrapalham
-- =====================================================================

select
  '5 — acento e maiuscula' as caso,
  case when exists (select 1 from public.buscar_profissionais('AGUA'))
        and exists (select 1 from public.buscar_profissionais('água'))
        and exists (select 1 from public.buscar_profissionais('Água'))
       then 'PRONTO — acha dos três jeitos'
       else 'FALHOU — o acento ou a maiúscula atrapalharam' end as resultado;

-- =====================================================================
-- 6 — busca por nome do ofício direto
-- =====================================================================

select
  '6 — pelo nome do oficio' as caso,
  case when (select count(*) from public.buscar_profissionais('eletricista')) = 4
       then 'PRONTO — 4 eletricistas visíveis (o oculto ficou de fora)'
       else 'FALHOU — esperava 4, veio '
            || (select count(*)::text from public.buscar_profissionais('eletricista')) end as resultado;

-- =====================================================================
-- 7 — termo que não existe devolve vazio, sem erro
-- =====================================================================

select
  '7 — termo sem resultado' as caso,
  case when (select count(*) from public.buscar_profissionais('astronauta')) = 0
       then 'PRONTO — vazio, sem erro'
       else 'FALHOU — trouxe algo que não deveria' end as resultado;

rollback;
