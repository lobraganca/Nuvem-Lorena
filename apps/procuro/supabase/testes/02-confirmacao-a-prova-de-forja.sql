-- =====================================================================
-- Teste — a confirmação do número não pode ser forjada
-- =====================================================================
--
-- A coluna `telefone_confirmado` decide duas coisas sérias: se o telefone
-- aparece para quem procura, e se a pessoa recebe oportunidade. Este teste
-- tenta fraudá-la de todos os jeitos que um app malicioso tentaria.
--
-- O elenco:
--   fraudador  — nunca confirmou nada, e escreve na coluna direto
--   honesto    — confirmou de verdade pelo Auth
--   trocador   — confirmou um número e depois editou o cadastro para outro
--
-- Roda em transação e desfaz no fim.

begin;

set local client_min_messages to warning;

-- A cidade e os ofícios vêm do catálogo semeado pela migration 0005. Este
-- teste criava os seus próprios, e passou a colidir no dia em que o
-- catálogo passou a existir — o próprio teste avisou, recusando-se a rodar.
create temporary table ids as
select
  (select id from public.cidades    where nome = 'Itabirito')   as cidade,
  (select id from public.categorias where nome = 'Eletricista') as eletricista;

-- =====================================================================
-- 1 — O perfil nasce junto com a conta
-- =====================================================================

insert into auth.users (id, raw_user_meta_data)
values ('a0000000-0000-0000-0000-00000000000f', '{"nome": "Fraudador"}'::jsonb);

select
  '1 — perfil automático' as caso,
  case when exists (select 1 from public.perfis where id = 'a0000000-0000-0000-0000-00000000000f')
       then 'PRONTO — nasceu junto com a conta' else 'FALHOU — não nasceu' end as perfil_criado,
  case when (select nome from public.perfis where id = 'a0000000-0000-0000-0000-00000000000f') = 'Fraudador'
       then 'PRONTO — pegou o nome' else 'FALHOU — perdeu o nome' end as nome_veio;

-- =====================================================================
-- 2 — Escrever na coluna direto não confirma nada
-- =====================================================================
-- Esta conta NUNCA passou pelo Auth: phone_confirmed_at está nulo. O
-- update abaixo é exatamente o que um app malicioso mandaria.

update public.perfis
   set nome = 'Fraudador',
       telefone = '+5531988887777',
       telefone_confirmado = '+5531988887777',       -- a forja
       telefone_confirmado_em = now()                -- a forja
 where id = 'a0000000-0000-0000-0000-00000000000f';

select
  '2 — forja direta' as caso,
  case when (select telefone_confirmado from public.perfis
              where id = 'a0000000-0000-0000-0000-00000000000f') is null
       then 'PRONTO — a forja foi descartada'
       else 'FALHOU — a forja passou' end as forja_bloqueada;

-- =====================================================================
-- 3 — Quem confirmou de verdade fica confirmado
-- =====================================================================

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data)
values ('b0000000-0000-0000-0000-00000000000e', '+5531977776666', now(), '{"nome": "Honesto"}'::jsonb);

update public.perfis
   set telefone = '+5531977776666',
       cidade_id = (select cidade from ids)
 where id = 'b0000000-0000-0000-0000-00000000000e';

select
  '3 — confirmação de verdade' as caso,
  case when (select telefone_confirmado from public.perfis
              where id = 'b0000000-0000-0000-0000-00000000000e') = '+5531977776666'
       then 'PRONTO — ficou confirmado'
       else 'FALHOU — não reconheceu a confirmação' end as honesto_confirmado;

-- =====================================================================
-- 4 — Confirmar um número e trocar por outro não vale
-- =====================================================================
-- O truque: confirmo o meu número, e depois edito o cadastro para o número
-- de outra pessoa. Se a view olhasse só "confirmou?", ela exibiria como
-- confirmado um número que ninguém conferiu.

insert into public.profissionais (id, perfil_id, categoria_id, cidade_id)
values ('b1000000-0000-0000-0000-00000000000e','b0000000-0000-0000-0000-00000000000e',
        (select eletricista from ids),(select cidade from ids));

-- Antes da troca: o telefone aparece.
select
  '4a — antes da troca' as caso,
  case when (select telefone from public.profissionais_publicos
              where id = 'b1000000-0000-0000-0000-00000000000e') = '+5531977776666'
       then 'PRONTO — telefone confirmado aparece'
       else 'FALHOU — deveria aparecer' end as aparece_na_busca;

-- A troca.
update public.perfis
   set telefone = '+5531900001111'   -- número de outra pessoa, nunca confirmado
 where id = 'b0000000-0000-0000-0000-00000000000e';

select
  '4b — depois da troca' as caso,
  case when (select telefone from public.profissionais_publicos
              where id = 'b1000000-0000-0000-0000-00000000000e') is null
       then 'PRONTO — o número trocado sumiu da busca'
       else 'FALHOU — a busca mostra número não confirmado' end as sumiu_da_busca;

-- =====================================================================
-- 5 — E o número trocado também não recebe oportunidade
-- =====================================================================

insert into public.assinaturas (profissional_id, plano_id, vigente_ate)
select 'b1000000-0000-0000-0000-00000000000e', id, now() + interval '30 days'
  from public.planos where slug = 'premium';

insert into auth.users (id, phone, phone_confirmed_at)
values ('c0000000-0000-0000-0000-00000000000d', '+5531966665555', now());

insert into public.pedidos (id, cliente_id, categoria_id, cidade_id, descricao)
values ('99999999-9999-9999-9999-99999999999f',
        'c0000000-0000-0000-0000-00000000000d',
        (select eletricista from ids),
        (select cidade from ids),
        'Preciso de um eletricista para revisar a fiação da casa.');

select public.processar_ondas() as disparos;

select
  '5 — fila de disparo' as caso,
  case when not exists (
         select 1 from public.disparos
          where profissional_id = 'b1000000-0000-0000-0000-00000000000e')
       then 'PRONTO — número não confirmado não recebe'
       else 'FALHOU — recebeu com número não confirmado' end as fora_da_fila;

-- =====================================================================
-- 6 — Reconfirmando o novo número, tudo volta
-- =====================================================================

update auth.users
   set phone = '+5531900001111', phone_confirmed_at = now()
 where id = 'b0000000-0000-0000-0000-00000000000e';

-- Um toque qualquer no perfil faz o gatilho reler o auth.
update public.perfis set nome = 'Honesto'
 where id = 'b0000000-0000-0000-0000-00000000000e';

select
  '6 — reconfirmou' as caso,
  case when (select telefone from public.profissionais_publicos
              where id = 'b1000000-0000-0000-0000-00000000000e') = '+5531900001111'
       then 'PRONTO — voltou a aparecer'
       else 'FALHOU — não voltou' end as voltou_para_a_busca;

rollback;
