-- O aviso da vaga e os aparelhos que o recebem (migration 0074).
--
-- Duas coisas em jogo. A primeira é privacidade: a lista de aparelhos de
-- alguém diz em quantos lugares a pessoa usa o app, e não é da conta de
-- ninguém. A segunda é a integridade do aviso: quem recebe não pode
-- reescrever de qual vaga ele é, nem apagar a data de envio.

begin;

insert into auth.users (id, phone, phone_confirmed_at) values
  ('f1110000-0000-0000-0000-00000000000a', '5531955550001', now()),
  ('f1110000-0000-0000-0000-00000000000b', '5531955550002', now()),
  ('f1110000-0000-0000-0000-00000000000c', '5531955550003', now())
on conflict do nothing;

-- A empresa e a vaga.
insert into public.companies
  (id, owner_id, company_name, city, uf, phone, responsible_name, description)
values
  ('c1110000-0000-0000-0000-000000000001', 'f1110000-0000-0000-0000-00000000000a',
   'Oficina do Zé', 'Itabirito', 'MG', '(31) 95555-0001', 'Ze', 'x');

create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'f1110000-0000-0000-0000-00000000000a'::uuid $$;
select public.confirmar_telefone_empresa('c1110000-0000-0000-0000-000000000001');

update public.companies
   set plano = 'ilimitado', plano_ate = now() + interval '30 days'
 where id = 'c1110000-0000-0000-0000-000000000001';

insert into public.job_listings
  (id, company_id, title, profession, description, work_modality, city, uf)
values
  ('44440000-0000-0000-0000-000000000001', 'c1110000-0000-0000-0000-000000000001',
   'Mecânico', 'Mecânico', 'x', 'presencial', 'Itabirito', 'MG');

-- Os dois precisam ter CADASTRO e telefone CONFIRMADO.
-- ────────────────────────────────────────────────────
-- Antes da 0076 este teste criava aviso para duas contas sem cadastro
-- nenhum, e passava. A regra nova fecha isso: aviso de vaga só existe para
-- quem confirmou o telefone — e quem não tem cadastro não confirmou nada.
--
-- Este bloco foi acrescentado porque o teste passou a FALHAR ao aplicar a
-- 0076, com a mensagem certa. O cenário é que estava desatualizado, não a
-- regra.
insert into public.professionals
  (id, owner_id, name, category, categories, city, uf, bio, phone, whatsapp, entity_type)
values
  ('b1110000-0000-0000-0000-00000000000b', 'f1110000-0000-0000-0000-00000000000b',
   'Profissional B', 'Mecânico', array['Mecânico'], 'Itabirito', 'MG', '',
   '31955550002', '31955550002', 'pf'),
  ('b1110000-0000-0000-0000-00000000000c', 'f1110000-0000-0000-0000-00000000000c',
   'Profissional C', 'Mecânico', array['Mecânico'], 'Itabirito', 'MG', '',
   '31955550003', '31955550003', 'pf');

-- Ninguém nasce confirmado: o gatilho da 0024 zera o campo em todo INSERT.
-- Confirmar é sempre um segundo passo, mesmo aqui.
set local app.confirmando_whatsapp = 'sim';
update public.professionals set whatsapp_verified = true, whatsapp_verified_at = now()
 where id in ('b1110000-0000-0000-0000-00000000000b',
              'b1110000-0000-0000-0000-00000000000c');
set local app.confirmando_whatsapp = '';

-- Dois profissionais avisados; só um tem aparelho.
insert into public.job_notifications (job_listing_id, professional_id, wave) values
  ('44440000-0000-0000-0000-000000000001', 'f1110000-0000-0000-0000-00000000000b', 1),
  ('44440000-0000-0000-0000-000000000001', 'f1110000-0000-0000-0000-00000000000c', 1);

insert into public.push_devices (user_id, plataforma, token)
values ('f1110000-0000-0000-0000-00000000000b', 'android', 'token-do-b');

-- Um dos avisos já saiu. Precisa estar preenchido para o teste 7 valer:
-- com `enviado_em` nulo, "apagar a data" não muda nada e o gatilho não tem
-- o que barrar — o teste passaria sem provar coisa alguma.
update public.job_notifications set enviado_em = now()
 where professional_id = 'f1110000-0000-0000-0000-00000000000c';

do $$
begin
  -- 1. A mesma vaga não avisa a mesma pessoa duas vezes. É o que impede a
  --    onda 2 de reavisar quem a onda 1 já alcançou.
  begin
    insert into public.job_notifications (job_listing_id, professional_id, wave)
    values ('44440000-0000-0000-0000-000000000001', 'f1110000-0000-0000-0000-00000000000b', 2);
    raise exception 'FALHOU: avisou a mesma pessoa duas vezes da mesma vaga';
  exception when unique_violation then null;
  end;

  -- 2. A conta de quem recebe push é a verdade sobre o alcance: dois
  --    alcançados, um só com aparelho.
  if public.quantos_recebem_push(array[
       'f1110000-0000-0000-0000-00000000000b'::uuid,
       'f1110000-0000-0000-0000-00000000000c'::uuid]) <> 1 then
    raise exception 'FALHOU: a conta de quem recebe push saiu errada';
  end if;

  raise notice 'PASSOU: um aviso por pessoa, e a conta de alcance real bate';
end $$;

-- ── Como `authenticated`, que é quem usa o app de verdade ──────────────
-- As policies daqui chamam `auth.uid()`, e chamar uma função exige poder
-- enxergar o schema dela. No Supabase o papel `authenticated` já tem esse
-- acesso; num Postgres pelado, não — e sem isto o teste morre por um motivo
-- que não existe em produção.
grant usage on schema auth to authenticated;
grant select, insert, update, delete on public.push_devices to authenticated;
grant select, update on public.job_notifications to authenticated;
-- `job_listings` e `companies` entram porque a policy de leitura do aviso
-- pergunta a elas de quem é a vaga — e essa pergunta roda com os direitos
-- de quem está lendo. No Supabase esses acessos vêm por default privileges
-- do projeto; num Postgres pelado, não.
grant select on public.job_listings to authenticated;
grant select on public.companies to authenticated;

-- Redefinir `auth.uid()` vem ANTES de trocar o papel: `authenticated` nao
-- escreve no schema `auth`, e na ordem inversa o teste morre antes de
-- testar qualquer coisa.
create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'f1110000-0000-0000-0000-00000000000c'::uuid $$;

set local role authenticated;

do $$
declare v_id uuid;
begin
  -- 3. Ninguém vê os aparelhos de outra pessoa.
  if exists (select 1 from public.push_devices
              where user_id = 'f1110000-0000-0000-0000-00000000000b') then
    raise exception 'FALHOU: enxergou o aparelho de outra pessoa';
  end if;

  -- 4. Nem cadastra aparelho no nome de outra.
  begin
    insert into public.push_devices (user_id, plataforma, token)
    values ('f1110000-0000-0000-0000-00000000000b', 'android', 'token-forjado');
    raise exception 'FALHOU: cadastrou aparelho no nome de outra pessoa';
  exception when insufficient_privilege then null;
  end;

  -- 5. O profissional marca o PRÓPRIO aviso como visto.
  select id into v_id from public.job_notifications
   where professional_id = 'f1110000-0000-0000-0000-00000000000c';
  if v_id is null then
    raise exception 'FALHOU: nao enxergou o proprio aviso';
  end if;
  update public.job_notifications set visto_em = now() where id = v_id;

  -- 6. E NÃO mexe em mais nada. A policy diz quais LINHAS, nunca quais
  --    colunas — sem o gatilho, ele reescreveria de qual vaga é o aviso.
  begin
    update public.job_notifications
       set job_listing_id = '44440000-0000-0000-0000-000000000001', wave = 3
     where id = v_id;
    raise exception 'FALHOU: o profissional alterou o conteudo do aviso';
  exception when others then
    if position('data de visualização' in sqlerrm) = 0 then raise; end if;
  end;

  -- 7. Nem apaga a data de envio para "receber de novo".
  begin
    update public.job_notifications set enviado_em = null where id = v_id;
    raise exception 'FALHOU: o profissional apagou a data de envio';
  exception when others then
    if position('data de visualização' in sqlerrm) = 0 then raise; end if;
  end;

  raise notice 'PASSOU: aparelho e aviso so sao mexidos por quem e dono deles';
end $$;

reset role;

rollback;
