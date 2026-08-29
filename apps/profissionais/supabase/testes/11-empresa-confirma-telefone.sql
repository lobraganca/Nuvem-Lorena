-- O telefone confirmado da empresa (migration 0071).
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
insert into public.job_listings
  (id, company_id, title, profession, description, work_modality, city, uf)
values
  ('11110000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'Atendente', 'Vendedor', 'x', 'presencial', 'Itabirito', 'MG'),
  ('11110000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001',
   'Padeiro', 'Padeiro', 'x', 'presencial', 'Itabirito', 'MG');

do $$
begin
  -- Vaga criada e não disparada não gasta cota.
  if public.vagas_disparadas_no_mes('c0000000-0000-0000-0000-000000000001') <> 0 then
    raise exception 'FALHOU: vaga sem disparo ja contou na cota';
  end if;

  insert into public.job_dispatches (job_listing_id, wave, professionals_count, status)
  values ('11110000-0000-0000-0000-000000000001', 1, 3, 'sent');

  if public.vagas_disparadas_no_mes('c0000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'FALHOU: vaga disparada nao contou';
  end if;

  -- Alargar a MESMA vaga não gasta outra cota: é a mesma vaga procurando
  -- gente, e cobrar por isso faria a empresa hesitar justamente quando a
  -- onda 1 não deu resposta.
  insert into public.job_dispatches (job_listing_id, wave, professionals_count, status)
  values ('11110000-0000-0000-0000-000000000001', 2, 9, 'sent');
  insert into public.job_dispatches (job_listing_id, wave, professionals_count, status)
  values ('11110000-0000-0000-0000-000000000001', 3, 20, 'sent');

  if public.vagas_disparadas_no_mes('c0000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'FALHOU: abrir onda 2 e 3 da mesma vaga gastou cota nova';
  end if;

  -- Outra vaga, aí sim.
  insert into public.job_dispatches (job_listing_id, wave, professionals_count, status)
  values ('11110000-0000-0000-0000-000000000002', 1, 5, 'sent');

  if public.vagas_disparadas_no_mes('c0000000-0000-0000-0000-000000000001') <> 2 then
    raise exception 'FALHOU: segunda vaga nao contou';
  end if;

  raise notice 'PASSOU: a cota conta vagas disparadas, nao ondas abertas';
end $$;

-- ── Sem telefone confirmado, o BANCO recusa a vaga ─────────────────────
-- A tela também trava, mas trava de tela se contorna com uma chamada por
-- fora do app. Aqui a recusa é como `authenticated`, que é o papel de quem
-- usa o app de verdade — como dono do banco a RLS é ignorada e o teste
-- passaria sem provar nada.
grant select, insert on public.job_listings to authenticated;
grant select on public.companies to authenticated;

create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'bbbb0000-0000-0000-0000-00000000000b'::uuid $$;

set local role authenticated;

do $$
begin
  -- A empresa do Bruno nunca confirmou o telefone.
  begin
    insert into public.job_listings
      (company_id, title, profession, description, work_modality, city, uf)
    values ('c0000000-0000-0000-0000-000000000002', 'Caixa', 'Vendedor', 'x',
            'presencial', 'Itabirito', 'MG');
    raise exception 'FALHOU: empresa sem telefone confirmado publicou vaga';
  exception when insufficient_privilege then
    null; -- é o esperado: a policy recusou
  end;

  raise notice 'PASSOU: o banco recusa vaga de empresa sem telefone confirmado';
end $$;

reset role;

rollback;
