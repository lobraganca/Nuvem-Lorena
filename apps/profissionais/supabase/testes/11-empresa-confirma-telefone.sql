-- O telefone confirmado da empresa (migrations 0071 e 0135).
--
-- O selo é o que separa uma empresa de um número digitado, e agora há
-- dinheiro do outro lado — quem publica vaga é procurado de volta. Este
-- teste fixa que ele não pode ser ligado por fora nem sobreviver a uma
-- troca de número.

begin;

insert into auth.users (id, phone, phone_confirmed_at) values
  ('bbbb0000-0000-0000-0000-00000000000a', '5531988880001', now()),
  ('bbbb0000-0000-0000-0000-00000000000b', '5531988880002', null)
on conflict do nothing;

insert into public.companies
  (id, owner_id, company_name, city, uf, phone, responsible_name, description)
values
  ('c0000000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-00000000000a',
   'Padaria da Praça', 'Itabirito', 'MG', '(31) 98888-0001', 'Ana', 'x'),
  ('c0000000-0000-0000-0000-000000000002', 'bbbb0000-0000-0000-0000-00000000000b',
   'Mercado Central', 'Itabirito', 'MG', '(31) 98888-0002', 'Bruno', 'x');

do $$
begin
  -- 1. Nenhuma empresa nasce confirmada.
  if (select phone_verified from public.companies
       where id = 'c0000000-0000-0000-0000-000000000001') then
    raise exception 'FALHOU: empresa nasceu com telefone confirmado';
  end if;

  -- 2. Ligar o selo por fora é recusado.
  begin
    update public.companies set phone_verified = true
     where id = 'c0000000-0000-0000-0000-000000000001';
    raise exception 'FALHOU: ligou o selo com um update direto';
  exception when others then
    if position('confirmação por código' in sqlerrm) = 0 then raise; end if;
  end;
end $$;

-- 3. Sem o Auth ter confirmado, a função recusa.
create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'bbbb0000-0000-0000-0000-00000000000b'::uuid $$;
do $$
begin
  begin
    perform public.confirmar_telefone_empresa('c0000000-0000-0000-0000-000000000002');
    raise exception 'FALHOU: confirmou sem o Auth ter confirmado';
  exception when others then
    if position('ainda não foi confirmado' in sqlerrm) = 0 then raise; end if;
  end;
end $$;

-- 4. Empresa alheia: recusa mesmo com tudo certo do lado de quem pede.
create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'bbbb0000-0000-0000-0000-00000000000a'::uuid $$;
do $$
begin
  begin
    perform public.confirmar_telefone_empresa('c0000000-0000-0000-0000-000000000002');
    raise exception 'FALHOU: confirmou o telefone de empresa alheia';
  exception when others then
    if position('Só o dono' in sqlerrm) = 0 then raise; end if;
  end;
end $$;

-- 5. Número certo, dono certo, Auth confirmado: confirma.
do $$
begin
  perform public.confirmar_telefone_empresa('c0000000-0000-0000-0000-000000000001');
  if not (select phone_verified from public.companies
           where id = 'c0000000-0000-0000-0000-000000000001') then
    raise exception 'FALHOU: nao confirmou com tudo certo';
  end if;
end $$;

do $$
begin
  -- 6. Salvar o cadastro sem mexer no número NÃO derruba o selo, mesmo com
  --    a máscara escrita de outro jeito. Sem isto, editar a descrição da
  --    empresa faria ela perder a confirmação sem nada explicando.
  update public.companies set phone = '31988880001', description = 'outra descricao'
   where id = 'c0000000-0000-0000-0000-000000000001';
  if not (select phone_verified from public.companies
           where id = 'c0000000-0000-0000-0000-000000000001') then
    raise exception 'FALHOU: mudar so a mascara do telefone derrubou o selo';
  end if;

  -- 7. Trocar o número de verdade derruba.
  update public.companies set phone = '(31) 97777-3333'
   where id = 'c0000000-0000-0000-0000-000000000001';
  if (select phone_verified from public.companies
       where id = 'c0000000-0000-0000-0000-000000000001') then
    raise exception 'FALHOU: selo sobreviveu a troca de numero';
  end if;

  raise notice 'PASSOU: o selo da empresa nao se liga por fora nem sobrevive a troca';
end $$;

-- ── A cota do mês ──────────────────────────────────────────────────────
-- Plano ativo: desde a 0073 nenhuma vaga entra sem ele. Aqui é só o
-- cenário — quem testa a regra do plano é o 13-plano-e-a-porta.sql.
update public.companies
   set plano = 'ilimitado', plano_ate = now() + interval '30 days'
 where id = 'c0000000-0000-0000-0000-000000000001';

insert into public.job_listings
  (id, company_id, title, profession, description, work_modality, city, uf)
values
  ('11110000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'Atendente', 'Vendedor', 'x', 'presencial', 'Itabirito', 'MG'),
  ('11110000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001',
   'Padeiro', 'Padeiro', 'x', 'presencial', 'Itabirito', 'MG');

-- A cota MENSAL que existiu aqui foi aposentada pela migration 0072: o teto
-- passou a ser de 2 ondas POR VAGA, e quem o testa agora é o
-- 12-planos-da-empresa.sql. O bloco saiu em vez de ficar comentado — teste
-- que não roda mais é teste que mente sobre o que está protegido.

-- ── A VAGA SAI SEM O TELEFONE CONFIRMADO — mudou em 08/09 (0135) ───────
--
-- Até a 0135 este bloco provava o contrário: que o banco RECUSAVA a vaga
-- de empresa sem telefone confirmado. A dona mandou tirar a trava ("tirar
-- a confirmação do telefone da empresa dentro do cadastro da vaga"), e um
-- teste que guarda a regra antiga é pior que teste nenhum — ele reprova o
-- pedido e faz parecer defeito o que foi decidido.
--
-- Então ele foi INVERTIDO, e não apagado. Apagar deixaria a policy sem
-- ninguém olhando; invertido, ele passa a guardar as duas metades que
-- importam agora:
--
--   1. o telefone não trava mais (o pedido da dona);
--   2. e as OUTRAS duas travas da mesma policy continuam de pé.
--
-- A 2 é a que justifica o bloco existir. Mexer numa policy para tirar uma
-- condição é onde se derruba outra sem perceber — e as que sobraram são as
-- graves: sem a do dono, qualquer conta publica vaga em nome de qualquer
-- empresa da cidade; sem a do plano, o app fica de graça.
--
-- Como `authenticated`, que é o papel de quem usa o app de verdade: como
-- dono do banco a RLS é ignorada e o teste passaria sem provar nada.
grant select, insert on public.job_listings to authenticated;
grant select on public.companies to authenticated;

-- A empresa do Bruno ganha plano ativo: sem ele a vaga seria barrada pela
-- regra do PLANO, e o teste passaria pelo motivo errado — provando uma
-- trava no lugar da outra.
update public.companies
   set plano = 'ilimitado', plano_ate = now() + interval '30 days'
 where id = 'c0000000-0000-0000-0000-000000000002';

-- A empresa da pergunta 3 é de OUTRA CONTA, e isso não é detalhe: desde a
-- 0107 o plano é da CONTA, não da empresa. A primeira versão deste teste
-- deu esta empresa ao Bruno e ela publicou — certíssimo, porque a outra
-- empresa dele já tinha plano e a policy olha `plano.owner_id`. Uma conta
-- limpa é a única forma de perguntar pelo plano de verdade.
insert into auth.users (id, phone, phone_confirmed_at) values
  ('bbbb0000-0000-0000-0000-00000000000c', '5531988880003', now())
on conflict do nothing;

insert into public.companies
  (id, owner_id, company_name, city, uf, phone, responsible_name, description)
values
  ('c0000000-0000-0000-0000-000000000003', 'bbbb0000-0000-0000-0000-00000000000c',
   'Bar sem plano', 'Itabirito', 'MG', '(31) 98888-0003', 'Carla', 'x');

create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'bbbb0000-0000-0000-0000-00000000000b'::uuid $$;

set local role authenticated;

do $$
begin
  -- 1. A empresa do Bruno nunca confirmou o telefone — e publica.
  insert into public.job_listings
    (company_id, title, profession, description, work_modality, city, uf)
  values ('c0000000-0000-0000-0000-000000000002', 'Caixa', 'Vendedor', 'x',
          'presencial', 'Itabirito', 'MG');

  -- 2. Mas a empresa dos OUTROS continua trancada. A da Ana tem telefone
  --    confirmado E plano — ou seja, só o dono a separa do Bruno.
  begin
    insert into public.job_listings
      (company_id, title, profession, description, work_modality, city, uf)
    values ('c0000000-0000-0000-0000-000000000001', 'Vaga na loja alheia',
            'Vendedor', 'x', 'presencial', 'Itabirito', 'MG');
    raise exception 'FALHOU: publicou vaga em nome de empresa de outra pessoa';
  exception when insufficient_privilege then
    null; -- é o esperado
  end;

  raise notice 'PASSOU: a vaga sai sem telefone confirmado, e a empresa dos outros continua trancada';
end $$;

-- 3. E a conta SEM PLANO continua trancada. Como a Carla, que não tem
--    nenhuma empresa com plano — ver o comentário do insert dela.
reset role;
create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'bbbb0000-0000-0000-0000-00000000000c'::uuid $$;
set local role authenticated;

do $$
begin
  begin
    insert into public.job_listings
      (company_id, title, profession, description, work_modality, city, uf)
    values ('c0000000-0000-0000-0000-000000000003', 'Vaga sem plano',
            'Vendedor', 'x', 'presencial', 'Itabirito', 'MG');
    raise exception 'FALHOU: conta sem plano publicou vaga';
  exception when others then
    /* `others`, e não `insufficient_privilege`: quem barra o plano é o
       GATILHO da 0107, com uma frase em português, e ele dispara antes de
       a policy ser consultada. Capturar só o erro de permissão deixava
       essa frase passar direto e derrubava o teste — que foi como isto
       apareceu. Conferir o texto é o que impede o `others` de engolir um
       erro qualquer e passar por engano. */
    if position('plano ativo' in sqlerrm) = 0 then raise; end if;
  end;

  raise notice 'PASSOU: e a conta sem plano continua trancada';
end $$;

reset role;

rollback;
