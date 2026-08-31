-- ═══════════════════════════════════════════════════════════════════════
-- 18 — Pausar, arquivar e excluir vaga
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "o app tem como pausar o anúncio, arquivá-lo ou excluir?"
--
-- O que este teste protege são as bordas, que é onde estas três se
-- confundem:
--
--   · pausar NÃO pode esbarrar no teto do plano (senão a empresa de plano
--     cheio não conseguiria nem tirar uma vaga do ar)
--   · REABRIR precisa esbarrar (senão o teto do plano não existe)
--   · arquivar LIBERA a vaga do plano; pausar também, porque nenhuma das
--     duas está no ar
--   · vaga fora do ar não recebe interessado novo
--   · e a empresa continua podendo TRIAR quem respondeu antes de arquivar
--
-- Roda depois de todas as migrations. Ver o README desta pasta.

\set ON_ERROR_STOP on
begin;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.usuario', true), '')::uuid
$$;

-- ── Cenário: empresa do plano de UMA vaga ('pro'), para o teto ser fácil ─
insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-00000000c001', '5531900001111', now()),
       ('00000000-0000-4000-8000-00000000c002', '5531900002222', now())
on conflict (id) do nothing;

insert into public.companies
  (id, owner_id, company_name, city, uf, phone, responsible_name)
values ('00000000-0000-4000-8000-00000000e001',
        '00000000-0000-4000-8000-00000000c001',
        'Oficina Teste', 'Itabirito', 'MG', '31900001111', 'Responsável')
on conflict (id) do nothing;

update public.companies
   set plano = 'pro', plano_ate = now() + interval '30 days'
 where id = '00000000-0000-4000-8000-00000000e001';

set local app.confirmando_telefone_empresa = 'sim';
update public.companies
   set phone_verified = true, phone_verified_at = now()
 where id = '00000000-0000-4000-8000-00000000e001';
set local app.confirmando_telefone_empresa = '';

insert into public.job_listings
  (id, company_id, title, description, profession, work_modality, city, uf, status)
values ('00000000-0000-4000-8000-00000000f001',
        '00000000-0000-4000-8000-00000000e001',
        'Mecânico', '', 'Mecânico', 'presencial', 'Itabirito', 'MG', 'active');

-- ── 1. O plano de UMA vaga está cheio ──────────────────────────────────
do $$
declare v_deu boolean := false;
begin
  begin
    insert into public.job_listings
      (company_id, title, description, profession, work_modality, city, uf, status)
    values ('00000000-0000-4000-8000-00000000e001',
            'Segunda', '', 'Pintor', 'presencial', 'Itabirito', 'MG', 'active');
    v_deu := true;
  exception when others then null;
  end;

  if v_deu then
    raise exception 'FALHOU 1: o plano de uma vaga aceitou a segunda';
  end if;
  raise notice 'ok 1 — o cenário está com o plano cheio, como o teste precisa';
end $$;

-- ── 2. Pausar funciona MESMO com o plano cheio ─────────────────────────
-- É a borda que mais importa: se pausar passasse pelo teto, a empresa de
-- plano cheio ficaria sem conseguir tirar do ar a única vaga que tem.
do $$
declare v_status text;
begin
  update public.job_listings set status = 'paused'
   where id = '00000000-0000-4000-8000-00000000f001';

  select status into v_status from public.job_listings
   where id = '00000000-0000-4000-8000-00000000f001';
  if v_status <> 'paused' then
    raise exception 'FALHOU 2: a vaga não pausou (está %)', v_status;
  end if;
  raise notice 'ok 2 — pausar funciona mesmo com o plano cheio';
end $$;

-- ── 3. Pausada libera a vaga do plano ──────────────────────────────────
do $$
declare v_ativas int;
begin
  v_ativas := public.vagas_ativas_agora('00000000-0000-4000-8000-00000000e001');
  if v_ativas <> 0 then
    raise exception 'FALHOU 3: a vaga pausada ainda conta como no ar (%)', v_ativas;
  end if;

  insert into public.job_listings
    (company_id, title, description, profession, work_modality, city, uf, status)
  values ('00000000-0000-4000-8000-00000000e001',
          'Outra', '', 'Pintor', 'presencial', 'Itabirito', 'MG', 'active');
  raise notice 'ok 3 — pausar libera a vaga do plano';
end $$;

-- ── 4. Reabrir esbarra no teto ─────────────────────────────────────────
-- O outro lado da mesma moeda. Sem isto, pausar e reabrir seria um jeito de
-- ter duas vagas no ar pagando por uma.
do $$
declare v_deu boolean := false; v_erro text := '';
begin
  begin
    update public.job_listings set status = 'active'
     where id = '00000000-0000-4000-8000-00000000f001';
    v_deu := true;
  exception when others then
    v_erro := sqlerrm;
  end;

  if v_deu then
    raise exception 'FALHOU 4: reabriu passando do teto do plano';
  end if;
  if v_erro not like '%plano permite%' then
    raise exception 'FALHOU 4: recusou pelo motivo errado — %', v_erro;
  end if;
  raise notice 'ok 4 — reabrir passa pelo teto do plano, como criar';
end $$;

-- ── 5. Vaga fora do ar não recebe interessado novo ─────────────────────
-- A tela de quem procura já filtra por vaga ativa, mas tela é lembrete, não
-- tranca: uma aba aberta desde ontem manda o interesse do mesmo jeito.
do $$
declare v_deu boolean := false; v_erro text := '';
begin
  begin
    insert into public.job_responses (job_listing_id, professional_id, interessado)
    values ('00000000-0000-4000-8000-00000000f001',
            '00000000-0000-4000-8000-00000000c002', true);
    v_deu := true;
  exception when others then
    v_erro := sqlerrm;
  end;

  if v_deu then
    raise exception 'FALHOU 5: vaga pausada aceitou interessado novo';
  end if;
  if v_erro not like '%recebendo interessados%' then
    raise exception 'FALHOU 5: recusou pelo motivo errado — %', v_erro;
  end if;
  raise notice 'ok 5 — vaga fora do ar não recebe mais ninguém';
end $$;

-- ── 6. A empresa continua triando quem respondeu ANTES ─────────────────
-- É o que ela faz depois de arquivar: olhar a lista e marcar quem chamou.
-- Um conserto que travasse isso quebraria a tela que ele veio proteger.
-- A resposta que já existia ANTES de a vaga sair do ar. O gatilho fica
-- desligado só para montar esse passado — é cenário, não é o que se testa.
alter table public.job_responses disable trigger job_responses_so_em_vaga_ativa;
insert into public.job_responses (job_listing_id, professional_id, interessado, status)
values ('00000000-0000-4000-8000-00000000f001',
        '00000000-0000-4000-8000-00000000c002', true, 'new');
alter table public.job_responses enable trigger job_responses_so_em_vaga_ativa;

do $$
declare v_status text;
begin
  perform set_config('teste.usuario', '00000000-0000-4000-8000-00000000c001', true);
  update public.job_responses set status = 'accepted'
   where job_listing_id = '00000000-0000-4000-8000-00000000f001';

  select status into v_status from public.job_responses
   where job_listing_id = '00000000-0000-4000-8000-00000000f001';
  if v_status <> 'accepted' then
    raise exception 'FALHOU 6: a empresa não conseguiu triar numa vaga fora do ar';
  end if;
  raise notice 'ok 6 — a empresa continua marcando quem respondeu antes';
end $$;

-- ── 7. Excluir apaga a vaga e o que dependia dela ──────────────────────
do $$
declare v_vagas int; v_respostas int;
begin
  delete from public.job_listings
   where id = '00000000-0000-4000-8000-00000000f001';

  select count(*) into v_vagas from public.job_listings
   where id = '00000000-0000-4000-8000-00000000f001';
  select count(*) into v_respostas from public.job_responses
   where job_listing_id = '00000000-0000-4000-8000-00000000f001';

  if v_vagas <> 0 then
    raise exception 'FALHOU 7: a vaga não foi apagada';
  end if;
  if v_respostas <> 0 then
    raise exception 'FALHOU 7: sobraram % respostas apontando para uma vaga que não existe', v_respostas;
  end if;
  raise notice 'ok 7 — excluir apaga a vaga e as respostas dela';
end $$;

rollback;
