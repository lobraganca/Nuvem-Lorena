-- =====================================================================
-- Teste — o motor de ondas
-- =====================================================================
--
-- Monta uma cidade com cinco eletricistas e um pedido, e confere que a
-- oportunidade chega em quem deve, na hora que deve.
--
-- O elenco, cada um provando uma regra diferente:
--   ana      Premium, disponível  -> recebe na 1a onda
--   bruno    Pro,     disponível  -> recebe só na 2a onda
--   carla    Básico,  disponível  -> NUNCA recebe (Básico é consulta)
--   diego    Premium, de férias   -> não recebe (ausente)
--   elena    Premium, sem telefone confirmado -> não recebe
--
-- Roda inteiro dentro de uma transação e desfaz no fim: pode rodar mil
-- vezes seguidas no mesmo banco sem sujar nada.

begin;

set local client_min_messages to warning;

-- --- Cenário ---------------------------------------------------------

-- A cidade e os ofícios vêm do catálogo semeado pela migration 0005. Este
-- teste criava os seus próprios, e passou a colidir no dia em que o
-- catálogo passou a existir — o próprio teste avisou, recusando-se a rodar.
create temporary table ids as
select
  (select id from public.cidades    where nome = 'Itabirito')   as cidade,
  (select id from public.categorias where nome = 'Eletricista') as eletricista;

-- A conta vem primeiro, e o PERFIL NASCE JUNTO com ela — o gatilho da
-- migration 0004 cuida disso. Este teste inseria o perfil à mão e passou a
-- colidir no dia em que o gatilho passou a existir; foi o próprio teste que
-- avisou.
--
-- Repare que `phone` e `phone_confirmed_at` vão no `auth.users`, não no
-- perfil: é de lá que a confirmação é lida, e escrever no perfil não
-- adianta nada — o gatilho descarta (é exatamente o que o teste 02 prova).
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001','+5531900000001', now(), '{"nome":"Ana"}'::jsonb),
  ('b0000000-0000-0000-0000-000000000002','+5531900000002', now(), '{"nome":"Bruno"}'::jsonb),
  ('c0000000-0000-0000-0000-000000000003','+5531900000003', now(), '{"nome":"Carla"}'::jsonb),
  ('d0000000-0000-0000-0000-000000000004','+5531900000004', now(), '{"nome":"Diego"}'::jsonb),
  -- Elena tem telefone, mas NUNCA confirmou por código: sem
  -- `phone_confirmed_at`, ela não entra na fila de disparo.
  ('e0000000-0000-0000-0000-000000000005','+5531900000005', null,  '{"nome":"Elena"}'::jsonb),
  ('f0000000-0000-0000-0000-000000000006','+5531900000006', now(), '{"nome":"Joana"}'::jsonb);

-- O telefone e a cidade do cadastro. O gatilho já preencheu o nome a partir
-- da conta; falta dizer qual é o número que a pessoa declara — e ele
-- precisa bater com o confirmado para valer.
update public.perfis p
   set telefone = u.phone, cidade_id = (select cidade from ids)
  from auth.users u
 where u.id = p.id;

insert into public.profissionais (id, perfil_id, categoria_id, cidade_id, situacao, ausente_ate) values
  ('a1000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',(select eletricista from ids),(select cidade from ids),'disponivel', null),
  ('b1000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002',(select eletricista from ids),(select cidade from ids),'disponivel', null),
  ('c1000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000003',(select eletricista from ids),(select cidade from ids),'disponivel', null),
  ('d1000000-0000-0000-0000-000000000004','d0000000-0000-0000-0000-000000000004',(select eletricista from ids),(select cidade from ids),'ferias', current_date + 5),
  ('e1000000-0000-0000-0000-000000000005','e0000000-0000-0000-0000-000000000005',(select eletricista from ids),(select cidade from ids),'disponivel', null);

-- Assinaturas: Ana, Diego e Elena Premium; Bruno Pro; Carla Básico.
insert into public.assinaturas (profissional_id, plano_id, vigente_ate)
select 'a1000000-0000-0000-0000-000000000001', id, now() + interval '30 days' from public.planos where slug='premium';
insert into public.assinaturas (profissional_id, plano_id, vigente_ate)
select 'd1000000-0000-0000-0000-000000000004', id, now() + interval '30 days' from public.planos where slug='premium';
insert into public.assinaturas (profissional_id, plano_id, vigente_ate)
select 'e1000000-0000-0000-0000-000000000005', id, now() + interval '30 days' from public.planos where slug='premium';
insert into public.assinaturas (profissional_id, plano_id, vigente_ate)
select 'b1000000-0000-0000-0000-000000000002', id, now() + interval '30 days' from public.planos where slug='pro';
insert into public.assinaturas (profissional_id, plano_id, vigente_ate)
select 'c1000000-0000-0000-0000-000000000003', id, now() + interval '30 days' from public.planos where slug='basico';

-- O pedido de Joana, publicado agora.
insert into public.pedidos (id, cliente_id, categoria_id, cidade_id, descricao)
values ('99999999-9999-9999-9999-999999999999',
        'f0000000-0000-0000-0000-000000000006',
        (select eletricista from ids),
        (select cidade from ids),
        'A tomada da cozinha parou de funcionar e cheira a queimado.');

-- =====================================================================
-- Momento 1 — logo depois de publicar
-- =====================================================================

select public.processar_ondas() as disparos_criados_no_primeiro_ciclo;

select
  'MOMENTO 1 (imediato)' as momento,
  (select count(*) from public.disparos where pedido_id='99999999-9999-9999-9999-999999999999') as total,
  case when exists (select 1 from public.disparos where profissional_id='a1000000-0000-0000-0000-000000000001')
       then 'PRONTO' else 'FALHOU' end as ana_premium_recebeu,
  case when not exists (select 1 from public.disparos where profissional_id='b1000000-0000-0000-0000-000000000002')
       then 'PRONTO' else 'FALHOU' end as bruno_pro_ainda_nao,
  case when not exists (select 1 from public.disparos where profissional_id='c1000000-0000-0000-0000-000000000003')
       then 'PRONTO' else 'FALHOU' end as carla_basico_nunca,
  case when not exists (select 1 from public.disparos where profissional_id='d1000000-0000-0000-0000-000000000004')
       then 'PRONTO' else 'FALHOU' end as diego_de_ferias_nao,
  case when not exists (select 1 from public.disparos where profissional_id='e1000000-0000-0000-0000-000000000005')
       then 'PRONTO' else 'FALHOU' end as elena_sem_confirmar_nao;

-- =====================================================================
-- Momento 2 — o motor roda de novo no mesmo minuto
-- =====================================================================
-- O agendador repete execução. Se o motor não aguentar repetição, a mesma
-- oportunidade chega duas vezes na mesma pessoa.

select public.processar_ondas() as disparos_criados_no_segundo_ciclo;

select
  'MOMENTO 2 (repetido)' as momento,
  case when (select count(*) from public.disparos where pedido_id='99999999-9999-9999-9999-999999999999') = 1
       then 'PRONTO — rodar de novo não duplicou nada'
       else 'FALHOU — o motor duplicou disparo' end as idempotencia;

-- =====================================================================
-- Momento 3 — uma hora depois
-- =====================================================================
-- Envelhece o pedido em 61 minutos para a 2a onda vencer.

update public.pedidos
   set criado_em = criado_em - interval '61 minutes'
 where id = '99999999-9999-9999-9999-999999999999';

select public.processar_ondas() as disparos_criados_no_terceiro_ciclo;

select
  'MOMENTO 3 (1h depois)' as momento,
  case when exists (select 1 from public.disparos where profissional_id='b1000000-0000-0000-0000-000000000002' and onda=2)
       then 'PRONTO' else 'FALHOU' end as bruno_pro_recebeu_na_2a,
  case when not exists (select 1 from public.disparos where profissional_id='c1000000-0000-0000-0000-000000000003')
       then 'PRONTO' else 'FALHOU' end as carla_basico_continua_fora,
  case when (select count(*) from public.disparos where profissional_id='a1000000-0000-0000-0000-000000000001') = 1
       then 'PRONTO' else 'FALHOU' end as ana_nao_recebeu_de_novo;

-- =====================================================================
-- Momento 4 — bloqueio
-- =====================================================================
-- Joana bloqueia Bruno e publica outro pedido. Bruno não pode receber.

insert into public.bloqueios (de_id, para_id)
values ('f0000000-0000-0000-0000-000000000006','b0000000-0000-0000-0000-000000000002');

insert into public.pedidos (id, cliente_id, categoria_id, cidade_id, descricao, criado_em)
values ('88888888-8888-8888-8888-888888888888',
        'f0000000-0000-0000-0000-000000000006',
        (select eletricista from ids),
        (select cidade from ids),
        'Preciso trocar o disjuntor do quadro de luz.',
        now() - interval '61 minutes');   -- já nasce com as duas ondas vencidas

select public.processar_ondas() as disparos_do_pedido_com_bloqueio;

select
  'MOMENTO 4 (bloqueio)' as momento,
  case when exists (select 1 from public.disparos where pedido_id='88888888-8888-8888-8888-888888888888' and profissional_id='a1000000-0000-0000-0000-000000000001')
       then 'PRONTO' else 'FALHOU' end as ana_recebeu_o_novo_pedido,
  case when not exists (select 1 from public.disparos where pedido_id='88888888-8888-8888-8888-888888888888' and profissional_id='b1000000-0000-0000-0000-000000000002')
       then 'PRONTO — bloqueado não recebe' else 'FALHOU — bloqueado recebeu' end as bruno_bloqueado;

-- =====================================================================
-- Momento 5 — pedido vencido para de disparar
-- =====================================================================

insert into public.pedidos (id, cliente_id, categoria_id, cidade_id, descricao, criado_em, expira_em)
values ('77777777-7777-7777-7777-777777777777',
        'f0000000-0000-0000-0000-000000000006',
        (select eletricista from ids),
        (select cidade from ids),
        'Pedido antigo que ninguém respondeu a tempo.',
        now() - interval '3 days',
        now() - interval '1 day');

select public.processar_ondas() as ciclo_com_pedido_vencido;

select
  'MOMENTO 5 (vencido)' as momento,
  case when (select status from public.pedidos where id='77777777-7777-7777-7777-777777777777') = 'expirado'
       then 'PRONTO' else 'FALHOU' end as pedido_virou_expirado,
  case when not exists (select 1 from public.disparos where pedido_id='77777777-7777-7777-7777-777777777777')
       then 'PRONTO — vencido não dispara' else 'FALHOU — vencido disparou' end as vencido_nao_disparou;

-- =====================================================================
-- Momento 6 — férias que acabam sozinhas
-- =====================================================================

update public.profissionais
   set ausente_ate = current_date - 1
 where id = 'd1000000-0000-0000-0000-000000000004';

select public.encerrar_ausencias() as voltaram_das_ferias;

select
  'MOMENTO 6 (fim das férias)' as momento,
  case when (select situacao from public.profissionais where id='d1000000-0000-0000-0000-000000000004') = 'disponivel'
       then 'PRONTO — voltou sozinho' else 'FALHOU — continua de férias' end as diego_voltou;

rollback;
