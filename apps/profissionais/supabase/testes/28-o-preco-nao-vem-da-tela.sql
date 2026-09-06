-- ═══════════════════════════════════════════════════════════════════════
-- 28 — O preço não vem da tela
-- ═══════════════════════════════════════════════════════════════════════
--
-- A tabela `pedidos` (0129) é onde fica escrito, antes de o dinheiro sair,
-- o que foi comprado e por quanto. Ela tem uma propriedade que decide se a
-- cobrança do site é segura ou não:
--
--   NINGUÉM escreve nela pelo navegador. Nem o dono da própria linha.
--
-- Quem cria o pedido é a Edge Function `criar-pagamento`, com a
-- service_role, lendo o valor da tabela de preços do servidor. Se o
-- navegador pudesse inserir, bastaria trocar um número na requisição para
-- assinar o plano de R$ 129,90 por um centavo — e isso não seria descoberto
-- por ninguém olhando a tela, porque a tela continuaria mostrando o preço
-- certo.
--
-- Isto é um teste de RLS e não de código: a garantia tem de estar no banco.
-- Uma conferência no aplicativo protege só o caminho que passa pelo
-- aplicativo, e a chave pública do Supabase está dentro do pacote que
-- qualquer um baixa.
--
-- As três perguntas:
--   1. um usuário comum consegue INSERIR um pedido? (tem de NÃO)
--   2. ele consegue MEXER no valor de um pedido que é dele? (tem de NÃO)
--   3. ele vê os pedidos dele, e só os dele?

\set ON_ERROR_STOP on
begin;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.usuario', true), '')::uuid
$$;

insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000f2801', '5531900002801', now()),
  ('00000000-0000-4000-8000-0000000f2802', '5531900002802', now())
on conflict (id) do nothing;

insert into public.companies (id, owner_id, company_name, city, uf, phone, responsible_name)
values
  ('00000000-0000-4000-8000-0000000f2810', '00000000-0000-4000-8000-0000000f2801',
   'Padaria do Teste', 'Itabirito', 'MG', '5531900002801', 'Dona do Teste')
on conflict (id) do nothing;

-- O pedido nasce pelo servidor, que ignora RLS. É o que a Edge Function faz.
insert into public.pedidos (id, user_id, tipo, plano, company_id, dias, centavos)
values ('00000000-0000-4000-8000-0000000f2820',
        '00000000-0000-4000-8000-0000000f2801',
        'plano_empresa', 'dez',
        '00000000-0000-4000-8000-0000000f2810', 30, 12990)
on conflict (id) do nothing;

set local role authenticated;

-- 1. O dono da conta NÃO consegue criar um pedido — nem barato, nem caro.
set local teste.usuario = '00000000-0000-4000-8000-0000000f2801';
do $$
begin
  insert into public.pedidos (user_id, tipo, plano, company_id, dias, centavos)
  values ('00000000-0000-4000-8000-0000000f2801', 'plano_empresa', 'dez',
          '00000000-0000-4000-8000-0000000f2810', 30, 1);
  raise exception 'FALHOU 1 — o navegador conseguiu criar um pedido de R$ 0,01';
exception
  when insufficient_privilege then
    raise notice 'ok 1 — o navegador não cria pedido (o preço não vem da tela)';
end $$;

-- 2. E não consegue baixar o valor de um pedido que é dele.
--
--    Duas defesas podem barrar isto, e a conferência aceita as duas: a
--    permissão tirada na unha pela 0129 (que dá erro) e a ausência de
--    policy (que não dá erro nenhum — o `update` acerta ZERO linhas,
--    calado). Por isso o que se confere depois é o VALOR continuar o
--    mesmo: um "deu certo" que não mudou nada já passou despercebido
--    neste app antes.
do $$
begin
  update public.pedidos set centavos = 1
   where id = '00000000-0000-4000-8000-0000000f2820';
exception
  when insufficient_privilege then
    raise notice 'ok — a permissão de update nem existe';
end $$;

select case when centavos = 12990
            then 'ok 2 — o valor do pedido não muda pelo navegador'
            else 'FALHOU 2 — o valor foi alterado para ' || centavos
       end as resultado
  from public.pedidos
 where id = '00000000-0000-4000-8000-0000000f2820';

-- 3. Cada um vê o que é seu.
select case when count(*) = 1
            then 'ok 3 — a pessoa vê o próprio pedido'
            else 'FALHOU 3 — a pessoa não vê o próprio pedido'
       end as resultado
  from public.pedidos;

set local teste.usuario = '00000000-0000-4000-8000-0000000f2802';
select case when count(*) = 0
            then 'PRONTO — o preço não vem da tela, e ninguém vê pedido alheio'
            else 'FALHOU 4 — VAZOU: pedido de pagamento de outra pessoa'
       end as resultado
  from public.pedidos;

reset role;
rollback;
