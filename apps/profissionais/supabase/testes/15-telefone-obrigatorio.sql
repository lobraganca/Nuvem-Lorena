-- ═══════════════════════════════════════════════════════════════════════
-- 15 — A confirmação do telefone é obrigatória no cadastro
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "A confirmação do telefone é item obrigatório no cadastro."
--
-- A migration 0076 pôs a regra em dois lugares. Este teste confere os dois
-- exercitando o comportamento, e não lendo o schema: a conferência da
-- própria migration diz que o `where` está escrito, mas só uma consulta de
-- verdade prova que ele FILTRA.
--
-- Roda depois de todas as migrations. Ver o README desta pasta.

\set ON_ERROR_STOP on
begin;

-- ── Cenário ────────────────────────────────────────────────────────────
-- Duas contas, e não uma: um gatilho antigo (`professionals_evita_repetidos`)
-- recusa dois cadastros do mesmo dono com a mesma categoria na mesma cidade.
-- Com um dono só, o teste morria no cenário e não chegava a testar nada.
insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000000a1', '5531988887777', now()),
       ('00000000-0000-4000-8000-0000000000a2', '5531955554444', now())
on conflict (id) do nothing;

-- NINGUÉM NASCE CONFIRMADO.
-- ─────────────────────────
-- O gatilho da 0024/0052 zera `whatsapp_verified` em todo INSERT, sem
-- exceção — nem a chave que a função de confirmação usa vale ali. Confirmar
-- é sempre um segundo passo, e é essa a razão de a confirmação ser um item
-- do cadastro e não um campo do formulário.
--
-- Este teste nasceu FALHANDO por causa disso, dizendo que "quem confirmou
-- sumiu da lista": o cadastro tinha ido para o banco com o campo em false
-- sem ninguém avisar. Vale como prova de que o guarda funciona.
insert into public.professionals
  (id, owner_id, name, category, categories, city, uf, bio, phone, whatsapp,
   entity_type, whatsapp_verified, suspended, paused)
values
  -- Confirmou: tem que aparecer.
  ('00000000-0000-4000-8000-0000000000b1',
   '00000000-0000-4000-8000-0000000000a1',
   'Confirmado', 'Pedreiro', array['Pedreiro'], 'Itabirito', 'MG', '',
   '31988887777', '31988887777', 'pf', true, false, false),
  -- Não confirmou: NÃO pode aparecer, mesmo estando ativo e visível.
  ('00000000-0000-4000-8000-0000000000b2',
   '00000000-0000-4000-8000-0000000000a2',
   'Sem confirmar', 'Pedreiro', array['Pedreiro'], 'Itabirito', 'MG', '',
   '31955554444', '31955554444', 'pf', false, false, false);

-- O primeiro confirma, pelo mesmo caminho que a função usa. É o único
-- lugar em que mexer nesse campo à mão é legítimo.
set local app.confirmando_whatsapp = 'sim';
update public.professionals
   set whatsapp_verified = true, whatsapp_verified_at = now()
 where id = '00000000-0000-4000-8000-0000000000b1';
set local app.confirmando_whatsapp = '';

-- ── 1. A lista pública só mostra quem confirmou ────────────────────────
do $$
declare v_confirmado int; v_sem int;
begin
  select count(*) into v_confirmado from public.professionals_public
   where id = '00000000-0000-4000-8000-0000000000b1';
  select count(*) into v_sem from public.professionals_public
   where id = '00000000-0000-4000-8000-0000000000b2';

  if v_confirmado <> 1 then
    raise exception 'FALHOU 1a: quem confirmou sumiu da lista pública';
  end if;
  if v_sem <> 0 then
    raise exception 'FALHOU 1b: quem NÃO confirmou aparece na lista pública';
  end if;
  raise notice 'ok 1 — a lista pública só mostra quem confirmou o telefone';
end $$;

-- ── 2. O aviso de vaga também exige ────────────────────────────────────
insert into public.companies
  (id, owner_id, company_name, city, uf, phone, responsible_name)
values ('00000000-0000-4000-8000-0000000000c1',
        '00000000-0000-4000-8000-0000000000a1',
        'Padaria Teste', 'Itabirito', 'MG', '31988887777', 'Responsável')
on conflict (id) do nothing;

-- Telefone confirmado e plano ativo: as duas portas da 0071 e da 0073, que
-- é o que a empresa precisa ter para publicar. Sem isso o teste morre no
-- cenário e nunca chega ao que ele veio testar.
update public.companies
   set plano = 'tres', plano_ate = now() + interval '30 days'
 where id = '00000000-0000-4000-8000-0000000000c1';

set local app.confirmando_telefone_empresa = 'sim';
update public.companies
   set phone_verified = true, phone_verified_at = now()
 where id = '00000000-0000-4000-8000-0000000000c1';
set local app.confirmando_telefone_empresa = '';

insert into public.job_listings
  (id, company_id, title, description, profession, work_modality, city, uf, status)
values ('00000000-0000-4000-8000-0000000000d1',
        '00000000-0000-4000-8000-0000000000c1',
        'Pedreiro', '', 'Pedreiro', 'presencial', 'Itabirito', 'MG', 'active')
on conflict (id) do nothing;

do $$
declare v_deu boolean := false; v_erro text := '';
begin
  begin
    insert into public.job_notifications (job_listing_id, professional_id, wave)
    values ('00000000-0000-4000-8000-0000000000d1',
            '00000000-0000-4000-8000-0000000000a2', 1);
    v_deu := true;
  exception when others then
    v_erro := sqlerrm;
  end;

  if v_deu then
    raise exception 'FALHOU 2: gravou aviso de vaga para quem não confirmou o telefone';
  end if;

  -- Confere a MENSAGEM, e não só que deu erro.
  -- ──────────────────────────────────────────
  -- Este bloco já passou pelo motivo errado: faltava a coluna `wave` no
  -- insert, o banco recusou por causa disso, e o teste comemorou achando
  -- que a regra do telefone tinha funcionado. Um teste que aceita qualquer
  -- erro passa até quando a regra que ele testa foi apagada.
  if v_erro not like '%confirmou o telefone%' then
    raise exception 'FALHOU 2: recusou pelo motivo errado — %', v_erro;
  end if;
  raise notice 'ok 2 — quem não confirmou não recebe aviso de vaga';
end $$;

-- E quem confirmou recebe normalmente.
do $$
begin
  insert into public.job_notifications (job_listing_id, professional_id, wave)
  values ('00000000-0000-4000-8000-0000000000d1',
          '00000000-0000-4000-8000-0000000000a1', 1);
  raise notice 'ok 3 — quem confirmou recebe o aviso';
exception when others then
  raise exception 'FALHOU 3: a regra barrou quem JÁ tinha confirmado — %', sqlerrm;
end $$;

-- ── 4. Confirmar depois faz o cadastro aparecer ────────────────────────
-- É o caminho normal: a pessoa preenche, confirma, e só então entra na
-- lista. Sem esta parte o teste provaria só metade — que a porta fecha,
-- mas não que ela abre.
do $$
declare v_antes int; v_depois int;
begin
  select count(*) into v_antes from public.professionals_public
   where id = '00000000-0000-4000-8000-0000000000b2';

  perform set_config('app.confirmando_whatsapp', 'sim', true);
  update public.professionals
     set whatsapp_verified = true, whatsapp_verified_at = now()
   where id = '00000000-0000-4000-8000-0000000000b2';
  perform set_config('app.confirmando_whatsapp', '', true);

  select count(*) into v_depois from public.professionals_public
   where id = '00000000-0000-4000-8000-0000000000b2';

  if v_antes <> 0 or v_depois <> 1 then
    raise exception 'FALHOU 4: confirmar não pôs o cadastro na lista (antes=% depois=%)',
      v_antes, v_depois;
  end if;
  raise notice 'ok 4 — confirmar o telefone põe o cadastro no ar';
end $$;

rollback;
