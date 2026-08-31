-- ═══════════════════════════════════════════════════════════════════════
-- 17 — A pessoa responde SIM ou NÃO, e só o SIM chega ao anunciante
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "a pessoa escolhe se quer estar disponível ou se não tem
--          interesse. A lista de interessados aparece em um painel para o
--          anunciante."
--
-- O que este teste protege é a fronteira entre os dois lados da mesa:
-- `interessado` é da pessoa, `status` é da empresa. Uma policy de UPDATE
-- sozinha não sabe qual COLUNA mudou — sem o gatilho da 0078, a pessoa
-- podia se marcar como `accepted` e aparecer no painel como alguém que a
-- empresa já tinha escolhido.
--
-- Roda depois de todas as migrations. Ver o README desta pasta.

\set ON_ERROR_STOP on
begin;

-- O `auth.uid()` do ambiente de teste devolve sempre nulo; aqui ele lê uma
-- chave, e volta ao que era no `rollback`.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.usuario', true), '')::uuid
$$;

-- ── Cenário ────────────────────────────────────────────────────────────
insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-00000000a001', '5531911112222', now()),  -- quer
       ('00000000-0000-4000-8000-00000000a002', '5531922223333', now()),  -- não quer
       ('00000000-0000-4000-8000-00000000a003', '5531933334444', now())   -- a empresa
on conflict (id) do nothing;

insert into public.companies
  (id, owner_id, company_name, city, uf, phone, responsible_name)
values ('00000000-0000-4000-8000-00000000b001',
        '00000000-0000-4000-8000-00000000a003',
        'Padaria do Teste', 'Itabirito', 'MG', '31933334444', 'Responsável')
on conflict (id) do nothing;

-- Plano ativo e telefone confirmado: as duas portas da 0071 e da 0073, que
-- é o que a empresa precisa ter para publicar. Sem isso o teste morre no
-- cenário e nunca chega ao que ele veio testar.
update public.companies
   set plano = 'tres', plano_ate = now() + interval '30 days'
 where id = '00000000-0000-4000-8000-00000000b001';

set local app.confirmando_telefone_empresa = 'sim';
update public.companies
   set phone_verified = true, phone_verified_at = now()
 where id = '00000000-0000-4000-8000-00000000b001';
set local app.confirmando_telefone_empresa = '';

insert into public.job_listings
  (id, company_id, title, description, profession, work_modality, city, uf, status)
values ('00000000-0000-4000-8000-00000000d001',
        '00000000-0000-4000-8000-00000000b001',
        'Padeiro', '', 'Padeiro', 'presencial', 'Itabirito', 'MG', 'active')
on conflict (id) do nothing;

-- ── 1. As duas respostas cabem, e ficam distintas ──────────────────────
insert into public.job_responses (job_listing_id, professional_id, interessado)
values ('00000000-0000-4000-8000-00000000d001',
        '00000000-0000-4000-8000-00000000a001', true),
       ('00000000-0000-4000-8000-00000000d001',
        '00000000-0000-4000-8000-00000000a002', false);

do $$
declare v_sim int; v_nao int;
begin
  select count(*) into v_sim from public.job_responses
   where job_listing_id = '00000000-0000-4000-8000-00000000d001' and interessado;
  select count(*) into v_nao from public.job_responses
   where job_listing_id = '00000000-0000-4000-8000-00000000d001' and not interessado;

  if v_sim <> 1 or v_nao <> 1 then
    raise exception 'FALHOU 1: as duas respostas não ficaram distintas (sim=% nao=%)', v_sim, v_nao;
  end if;
  raise notice 'ok 1 — a pessoa pode dizer que tem interesse ou que não tem';
end $$;

-- ── 2. O painel do anunciante lista só os interessados ─────────────────
-- É a consulta que a tela faz. Um "não tenho interesse" que aparecesse
-- aqui faria a empresa ligar para quem já disse que não quer.
do $$
declare v_no_painel int;
begin
  select count(*) into v_no_painel from public.job_responses
   where job_listing_id = '00000000-0000-4000-8000-00000000d001'
     and interessado = true;

  if v_no_painel <> 1 then
    raise exception 'FALHOU 2: o painel mostraria % pessoas em vez de 1', v_no_painel;
  end if;
  raise notice 'ok 2 — só quem tem interesse chega ao painel do anunciante';
end $$;

-- ── 3. Mudar de ideia é permitido ──────────────────────────────────────
-- Não é detalhe: "não quero" na segunda-feira e desempregado na sexta é o
-- caso comum, não a exceção.
do $$
declare v_agora boolean;
begin
  perform set_config('teste.usuario', '00000000-0000-4000-8000-00000000a002', true);
  update public.job_responses set interessado = true
   where job_listing_id = '00000000-0000-4000-8000-00000000d001'
     and professional_id = '00000000-0000-4000-8000-00000000a002';

  select interessado into v_agora from public.job_responses
   where job_listing_id = '00000000-0000-4000-8000-00000000d001'
     and professional_id = '00000000-0000-4000-8000-00000000a002';

  if v_agora is not true then
    raise exception 'FALHOU 3: a pessoa não conseguiu mudar de ideia';
  end if;
  raise notice 'ok 3 — dá para mudar de ideia sobre uma vaga';
end $$;

-- ── 4. A pessoa NÃO mexe na triagem da empresa ─────────────────────────
do $$
declare v_deu boolean := false; v_erro text := '';
begin
  perform set_config('teste.usuario', '00000000-0000-4000-8000-00000000a001', true);
  begin
    update public.job_responses set status = 'accepted'
     where job_listing_id = '00000000-0000-4000-8000-00000000d001'
       and professional_id = '00000000-0000-4000-8000-00000000a001';
    v_deu := true;
  exception when others then
    v_erro := sqlerrm;
  end;

  if v_deu then
    raise exception 'FALHOU 4: a pessoa se marcou como escolhida pela empresa';
  end if;
  if v_erro not like '%triagem%' then
    raise exception 'FALHOU 4: recusou pelo motivo errado — %', v_erro;
  end if;
  raise notice 'ok 4 — a triagem da vaga continua sendo só de quem anunciou';
end $$;

-- ── 5. A empresa continua podendo triar ────────────────────────────────
-- O gatilho do 4 poderia ter fechado a porta para os dois lados, e aí a
-- empresa não conseguiria mais marcar ninguém — um conserto que quebra a
-- tela que ele veio proteger.
do $$
declare v_status text;
begin
  perform set_config('teste.usuario', '00000000-0000-4000-8000-00000000a003', true);
  update public.job_responses set status = 'accepted'
   where job_listing_id = '00000000-0000-4000-8000-00000000d001'
     and professional_id = '00000000-0000-4000-8000-00000000a001';

  select status into v_status from public.job_responses
   where job_listing_id = '00000000-0000-4000-8000-00000000d001'
     and professional_id = '00000000-0000-4000-8000-00000000a001';

  if v_status <> 'accepted' then
    raise exception 'FALHOU 5: a empresa não conseguiu triar a própria vaga';
  end if;
  raise notice 'ok 5 — a empresa continua marcando quem ela escolheu';
end $$;

rollback;
