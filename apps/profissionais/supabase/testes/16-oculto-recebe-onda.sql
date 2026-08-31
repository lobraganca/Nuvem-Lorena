-- ═══════════════════════════════════════════════════════════════════════
-- 16 — Perfil oculto: fora da busca, DENTRO das ondas
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "público ele pode ser buscado pelas empresas, oculto ele recebe
--          oportunidades pelas ondas de disparos."
--
-- São duas metades, e o app tinha só uma. A chave escondia a pessoa da
-- busca E das ondas — enquanto a tela prometia, por escrito, que ela
-- continuaria recebendo vaga.
--
-- Este teste exercita as duas metades sobre a MESMA pessoa, porque é
-- justamente a combinação que estava errada: cada metade, sozinha,
-- funcionava.
--
-- Roda depois de todas as migrations. Ver o README desta pasta.

\set ON_ERROR_STOP on
begin;

-- O `auth.uid()` do ambiente de teste (00-ambiente-supabase.sql) devolve
-- sempre nulo — é um talo, porque quase nenhum teste precisa saber quem
-- está chamando. Este precisa: a função da 0077 recusa quem não é empresa.
-- Aqui ele passa a ler uma chave, e volta ao que era no `rollback`.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.usuario', true), '')::uuid
$$;

-- ── Cenário ────────────────────────────────────────────────────────────
insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000000f1', '5531977776666', now()),
       ('00000000-0000-4000-8000-0000000000f2', '5531966665555', now()),
       ('00000000-0000-4000-8000-0000000000f3', '5531955554444', now())
on conflict (id) do nothing;

insert into public.professionals
  (id, owner_id, name, category, categories, areas_de_interesse, city, uf, bio,
   phone, whatsapp, entity_type, whatsapp_verified, suspended, paused)
values
  -- Público: aparece na busca E recebe onda.
  ('00000000-0000-4000-8000-0000000000e1',
   '00000000-0000-4000-8000-0000000000f1',
   'Público', 'Pedreiro', array['Pedreiro'], array['Pedreiro'],
   'Itabirito', 'MG', '', '31977776666', '31977776666', 'pf', false, false, false),
  -- Oculto: NÃO aparece na busca, MAS recebe onda. É o caso do teste.
  ('00000000-0000-4000-8000-0000000000e2',
   '00000000-0000-4000-8000-0000000000f2',
   'Oculto', 'Pedreiro', array['Pedreiro'], array['Pedreiro'],
   'Itabirito', 'MG', '', '31966665555', '31966665555', 'pf', false, false, true),
  -- Suspenso: não aparece em lugar nenhum, nem oculto salva.
  ('00000000-0000-4000-8000-0000000000e3',
   '00000000-0000-4000-8000-0000000000f3',
   'Suspenso', 'Pedreiro', array['Pedreiro'], array['Pedreiro'],
   'Itabirito', 'MG', '', '31955554444', '31955554444', 'pf', false, true, false);

-- Ninguém nasce confirmado (o gatilho da 0024/0052 zera em todo INSERT), e
-- sem telefone confirmado ninguém entra em onda. Confirma os três pelo
-- único caminho legítimo.
set local app.confirmando_whatsapp = 'sim';
update public.professionals
   set whatsapp_verified = true, whatsapp_verified_at = now()
 where id in ('00000000-0000-4000-8000-0000000000e1',
              '00000000-0000-4000-8000-0000000000e2',
              '00000000-0000-4000-8000-0000000000e3');
set local app.confirmando_whatsapp = '';

-- A empresa que dispara. A função exige empresa cadastrada: sem ela,
-- qualquer conta poderia varrer a cidade perguntando quantos pedreiros
-- existem.
insert into public.companies
  (id, owner_id, company_name, city, uf, phone, responsible_name)
values ('00000000-0000-4000-8000-0000000000c9',
        '00000000-0000-4000-8000-0000000000f1',
        'Construtora Teste', 'Itabirito', 'MG', '31977776666', 'Responsável')
on conflict (id) do nothing;

-- ── 1. A busca esconde quem se escondeu ────────────────────────────────
do $$
declare v_publico int; v_oculto int; v_suspenso int;
begin
  select count(*) into v_publico from public.professionals_public
   where id = '00000000-0000-4000-8000-0000000000e1';
  select count(*) into v_oculto from public.professionals_public
   where id = '00000000-0000-4000-8000-0000000000e2';
  select count(*) into v_suspenso from public.professionals_public
   where id = '00000000-0000-4000-8000-0000000000e3';

  if v_publico <> 1 then
    raise exception 'FALHOU 1a: o perfil PÚBLICO não aparece na busca';
  end if;
  if v_oculto <> 0 then
    raise exception 'FALHOU 1b: o perfil OCULTO aparece na busca';
  end if;
  if v_suspenso <> 0 then
    raise exception 'FALHOU 1c: o perfil SUSPENSO aparece na busca';
  end if;
  raise notice 'ok 1 — a busca mostra o público e esconde o oculto';
end $$;

-- ── 2. A onda alcança quem se escondeu ─────────────────────────────────
-- Esta é a metade que faltava. Antes da 0077 a consulta da onda lia a
-- mesma view da busca, então este bloco falharia dizendo que o oculto
-- não recebe — que era exatamente o que acontecia com gente de verdade.
do $$
declare v_publico int; v_oculto int; v_suspenso int;
begin
  -- Faz de conta que quem chama é a dona da empresa.
  perform set_config('teste.usuario', '00000000-0000-4000-8000-0000000000f1', true);

  select count(*) into v_publico
    from public.candidatos_da_onda('Itabirito', 'MG', array['Pedreiro'], 'categories')
   where id = '00000000-0000-4000-8000-0000000000e1';
  select count(*) into v_oculto
    from public.candidatos_da_onda('Itabirito', 'MG', array['Pedreiro'], 'categories')
   where id = '00000000-0000-4000-8000-0000000000e2';
  select count(*) into v_suspenso
    from public.candidatos_da_onda('Itabirito', 'MG', array['Pedreiro'], 'categories')
   where id = '00000000-0000-4000-8000-0000000000e3';

  if v_publico <> 1 then
    raise exception 'FALHOU 2a: o perfil PÚBLICO não entra na onda';
  end if;
  if v_oculto <> 1 then
    raise exception 'FALHOU 2b: o perfil OCULTO não recebe a onda — é o defeito que a 0077 conserta';
  end if;
  if v_suspenso <> 0 then
    raise exception 'FALHOU 2c: o perfil SUSPENSO entrou na onda';
  end if;
  raise notice 'ok 2 — a onda alcança o público E o oculto, e nunca o suspenso';
end $$;

-- ── 3. A função não entrega nome nem telefone ──────────────────────────
-- É o que permite incluir o pausado sem desfazer o esconderijo dele. Uma
-- view com os pausados precisaria de `grant`, e quem tivesse o `grant`
-- poderia LISTAR quem se escondeu.
do $$
declare v_colunas text;
begin
  select string_agg(a.attname, ',' order by a.attnum) into v_colunas
    from pg_proc p
    join lateral unnest(p.proallargtypes, p.proargnames) with ordinality
         as a(tipo, attname, attnum) on true
   where p.pronamespace = 'public'::regnamespace
     and p.proname = 'candidatos_da_onda'
     and p.proargmodes[a.attnum] = 't';

  if v_colunas <> 'id,owner_id' then
    raise exception 'FALHOU 3: a função devolve mais que id e owner_id — devolve: %', v_colunas;
  end if;
  raise notice 'ok 3 — a função devolve só id e owner_id, sem nome nem telefone';
end $$;

-- ── 4. Conta que não é empresa não conta onda ──────────────────────────
do $$
declare v_deu boolean := false; v_erro text := '';
begin
  -- Uma conta sem empresa nenhuma.
  perform set_config('teste.usuario', '00000000-0000-4000-8000-0000000000f2', true);
  begin
    perform * from public.candidatos_da_onda('Itabirito', 'MG', array['Pedreiro'], 'categories');
    v_deu := true;
  exception when others then
    v_erro := sqlerrm;
  end;

  if v_deu then
    raise exception 'FALHOU 4: conta sem empresa conseguiu varrer a cidade';
  end if;
  if v_erro not like '%empresa cadastrada%' then
    raise exception 'FALHOU 4: recusou pelo motivo errado — %', v_erro;
  end if;
  raise notice 'ok 4 — só empresa cadastrada conta onda';
end $$;

-- ── 5. Nome de coluna inventado é recusado ─────────────────────────────
do $$
declare v_deu boolean := false;
begin
  perform set_config('teste.usuario', '00000000-0000-4000-8000-0000000000f1', true);
  begin
    perform * from public.candidatos_da_onda('Itabirito', 'MG', array['Pedreiro'], 'phone');
    v_deu := true;
  exception when others then
    null;
  end;

  if v_deu then
    raise exception 'FALHOU 5: aceitou nome de coluna que não é ofício';
  end if;
  raise notice 'ok 5 — só categories e areas_de_interesse são aceitas';
end $$;

rollback;
