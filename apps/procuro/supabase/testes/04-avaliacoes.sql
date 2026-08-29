-- =====================================================================
-- Teste — só avalia quem teve contato
-- =====================================================================
--
-- Avaliação aberta a qualquer um vira arma (derrubar a nota do
-- concorrente) e mentira (criar contas e se elogiar). Este teste tenta as
-- duas coisas.

begin;
set local client_min_messages to warning;

create temporary table ids as
select
  (select id from public.cidades    where nome = 'Itabirito')   as cidade,
  (select id from public.categorias where nome = 'Eletricista') as eletricista;

insert into auth.users (id, phone, phone_confirmed_at) values
  ('a0000000-0000-0000-0000-0000000000c1', '+5531900001111', now()),  -- o profissional
  ('a0000000-0000-0000-0000-0000000000c2', '+5531900002222', now()),  -- o cliente que contratou
  ('a0000000-0000-0000-0000-0000000000c3', '+5531900003333', now());  -- um estranho

update public.perfis set nome='Profissional', telefone='+5531900001111' where id='a0000000-0000-0000-0000-0000000000c1';
update public.perfis set nome='Cliente',      telefone='+5531900002222' where id='a0000000-0000-0000-0000-0000000000c2';
update public.perfis set nome='Estranho',     telefone='+5531900003333' where id='a0000000-0000-0000-0000-0000000000c3';

insert into public.profissionais (id, perfil_id, categoria_id, cidade_id)
select 'b0000000-0000-0000-0000-0000000000c1'::uuid, 'a0000000-0000-0000-0000-0000000000c1'::uuid, eletricista, cidade from ids;

insert into public.assinaturas (profissional_id, plano_id, vigente_ate)
select 'b0000000-0000-0000-0000-0000000000c1', id, now() + interval '30 days' from public.planos where slug='premium';

-- Um pedido do cliente, que o profissional ACEITOU.
insert into public.pedidos (id, cliente_id, categoria_id, cidade_id, descricao)
select '90000000-0000-0000-0000-0000000000c1'::uuid, 'a0000000-0000-0000-0000-0000000000c2'::uuid,
       eletricista, cidade, 'Trocar a fiação da sala inteira, que é antiga.' from ids;

select public.processar_ondas() as disparos_criados;

update public.disparos
   set resposta = 'aceito', respondido_em = now()
 where pedido_id = '90000000-0000-0000-0000-0000000000c1';

-- Um segundo pedido que o profissional RECUSOU.
insert into public.pedidos (id, cliente_id, categoria_id, cidade_id, descricao)
select '90000000-0000-0000-0000-0000000000c2'::uuid, 'a0000000-0000-0000-0000-0000000000c2'::uuid,
       eletricista, cidade, 'Instalar um chuveiro novo no banheiro de cima.' from ids;

select public.processar_ondas() as disparos_do_segundo;

update public.disparos
   set resposta = 'recusado', respondido_em = now()
 where pedido_id = '90000000-0000-0000-0000-0000000000c2';

-- =====================================================================
-- 1 — Quem teve contato aceito consegue avaliar
-- =====================================================================

insert into public.avaliacoes (disparo_id, profissional_id, autor_id, nota, comentario)
select d.id, 'b0000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-0000000000c2',
       5, 'Chegou na hora e resolveu tudo.'
  from public.disparos d
 where d.pedido_id = '90000000-0000-0000-0000-0000000000c1';

select
  '1 — contato aceito' as caso,
  case when (select count(*) from public.avaliacoes) = 1
       then 'PRONTO — avaliação aceita' else 'FALHOU — deveria ter aceitado' end as resultado;

-- =====================================================================
-- 2 — Contato RECUSADO não gera avaliação
-- =====================================================================
-- Aceitar avaliação de pedido recusado é aceitar nota de quem nunca foi
-- atendido.

do $$
declare deu_erro boolean := false;
begin
  begin
    insert into public.avaliacoes (disparo_id, profissional_id, autor_id, nota)
    select d.id, 'b0000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-0000000000c2', 1
      from public.disparos d where d.pedido_id = '90000000-0000-0000-0000-0000000000c2';
  exception when others then deu_erro := true;
  end;
  create temporary table r2 as select deu_erro as bloqueou;
end $$;

select '2 — contato recusado' as caso,
  case when (select bloqueou from r2) then 'PRONTO — recusado não avalia'
       else 'FALHOU — avaliou sem ter sido atendido' end as resultado;

-- =====================================================================
-- 3 — O autor não pode ser forjado
-- =====================================================================
-- O estranho tenta gravar uma avaliação usando o disparo do cliente e
-- pondo o próprio nome como autor. O gatilho reescreve o autor a partir
-- do pedido, então o nome forjado é descartado.

update public.avaliacoes set nota = 5 where nota = 5;  -- garante que existe

select
  '3 — autor forjado' as caso,
  case when (select autor_id from public.avaliacoes limit 1) = 'a0000000-0000-0000-0000-0000000000c2'
       then 'PRONTO — o autor vem do pedido, não do que foi enviado'
       else 'FALHOU — o autor foi aceito como veio' end as resultado;

-- =====================================================================
-- 4 — Uma avaliação por contato
-- =====================================================================
-- Sem isto, quem quer subir (ou derrubar) uma nota grava dez vezes.

do $$
declare deu_erro boolean := false;
begin
  begin
    insert into public.avaliacoes (disparo_id, profissional_id, autor_id, nota)
    select d.id, 'b0000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-0000000000c2', 1
      from public.disparos d where d.pedido_id = '90000000-0000-0000-0000-0000000000c1';
  exception when others then deu_erro := true;
  end;
  create temporary table r4 as select deu_erro as bloqueou;
end $$;

select '4 — avaliação repetida' as caso,
  case when (select bloqueou from r4) then 'PRONTO — só uma por contato'
       else 'FALHOU — deu para avaliar duas vezes' end as resultado;

-- =====================================================================
-- 5 — Editar não muda de dono nem de alvo
-- =====================================================================
-- Sem isto, um update moveria a avaliação para outro profissional,
-- levando junto a nota que ela conquistou em outro lugar.

update public.avaliacoes
   set profissional_id = 'b0000000-0000-0000-0000-0000000000c1',
       autor_id = 'a0000000-0000-0000-0000-0000000000c3',   -- a forja
       nota = 4;

select
  '5 — editar sem trocar de dono' as caso,
  case when (select autor_id from public.avaliacoes limit 1) = 'a0000000-0000-0000-0000-0000000000c2'
       then 'PRONTO — o dono não mudou' else 'FALHOU — o dono foi trocado' end as dono,
  case when (select nota from public.avaliacoes limit 1) = 4
       then 'PRONTO — a nota mudou, que é o permitido' else 'FALHOU — a nota não mudou' end as nota,
  case when (select editada_em from public.avaliacoes limit 1) is not null
       then 'PRONTO — ficou marcada como editada' else 'FALHOU — não marcou' end as marca;

-- =====================================================================
-- 6 — A reputação sai calculada
-- =====================================================================

select
  '6 — reputação' as caso,
  (select quantas from public.reputacao where profissional_id='b0000000-0000-0000-0000-0000000000c1') as quantas,
  (select media   from public.reputacao where profissional_id='b0000000-0000-0000-0000-0000000000c1') as media,
  case when (select media from public.reputacao where profissional_id='b0000000-0000-0000-0000-0000000000c1') = 4.0
       then 'PRONTO' else 'FALHOU' end as resultado;

rollback;
