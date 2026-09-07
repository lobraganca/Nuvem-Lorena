-- ═══════════════════════════════════════════════════════════════════════
-- 29 — Os acessos do dia, e por qual porta
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "quero ter no painel bem claramente 3 coisas: quantidade total
-- de acessos do dia; quantidade de pessoas que entraram em empresa e em
-- candidatos."
--
-- O jeito errado de fazer isso — e que este teste existe para impedir —
-- é contar dois: um na abertura e outro na escolha da porta. O total
-- ficaria o dobro do real, e ninguém desconfiaria, porque um número que
-- sobe rápido demais parece boa notícia.
--
-- A porta é escolhida DEPOIS da abertura: a pessoa abre o app, lê, e só
-- então toca em "procuro emprego". Por isso a mesma linha é atualizada, e
-- é isso que se mede aqui.
--
-- As cinco perguntas:
--   1. abrir conta um acesso;
--   2. escolher a porta depois NÃO conta outro;
--   3. e a porta fica registrada na linha que já existia;
--   4. uma chamada posterior sem porta não APAGA a porta escolhida;
--   5. quem não é admin não lê o movimento do app.

\set ON_ERROR_STOP on
begin;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.usuario', true), '')::uuid
$$;

insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000f2901', '5531900002901', now()),
  ('00000000-0000-4000-8000-0000000f2902', '5531900002902', now())
on conflict (id) do nothing;

-- A conta de administração deste teste.
insert into public.profiles (id) values ('00000000-0000-4000-8000-0000000f2901')
on conflict (id) do nothing;
insert into public.admins (user_id) values ('00000000-0000-4000-8000-0000000f2901')
on conflict (user_id) do nothing;

-- Limpa o que outros testes possam ter deixado, para os números serem os
-- deste arquivo e não a soma de tudo.
delete from public.visitas_app;

-- ── 1. Três aberturas, ainda sem porta escolhida ──────────────────────
select public.registrar_acesso('00000000-0000-4000-8000-0000000fa001');
select public.registrar_acesso('00000000-0000-4000-8000-0000000fa002');
select public.registrar_acesso('00000000-0000-4000-8000-0000000fa003');

set local role authenticated;
set local teste.usuario = '00000000-0000-4000-8000-0000000f2901';

select case when total = 3 and empresa = 0 and candidato = 0 and sem_escolha = 3
            then 'ok 1 — três aberturas viraram três acessos'
            else 'FALHOU 1 — ' || total || '/' || empresa || '/' || candidato
       end as resultado
  from public.acessos_de_hoje();

reset role;

-- ── 2 e 3. As portas chegam depois, na MESMA linha ────────────────────
select public.registrar_acesso('00000000-0000-4000-8000-0000000fa001', 'empresa');
select public.registrar_acesso('00000000-0000-4000-8000-0000000fa002', 'candidato');

set local role authenticated;
set local teste.usuario = '00000000-0000-4000-8000-0000000f2901';

select case when total = 3
            then 'ok 2 — escolher a porta NÃO criou acesso novo'
            else 'FALHOU 2 — o total virou ' || total || ' (contou duas vezes)'
       end as resultado
  from public.acessos_de_hoje();

select case when empresa = 1 and candidato = 1 and sem_escolha = 1
            then 'ok 3 — cada porta com o seu, e um que abriu e não entrou'
            else 'FALHOU 3 — ' || empresa || ' empresa, ' || candidato
                 || ' candidato, ' || sem_escolha || ' sem escolha'
       end as resultado
  from public.acessos_de_hoje();

reset role;

-- ── 4. Uma chamada sem porta não apaga a porta ────────────────────────
-- Acontece de verdade: outra tela do mesmo acesso chama de novo, e nela o
-- lado pode não estar à mão. Sem o `coalesce`, o registro voltaria a
-- "não escolheu" e a conta da dona encolheria sozinha.
select public.registrar_acesso('00000000-0000-4000-8000-0000000fa001');

set local role authenticated;
set local teste.usuario = '00000000-0000-4000-8000-0000000f2901';

select case when empresa = 1
            then 'ok 4 — chamar de novo sem porta não apagou a escolha'
            else 'FALHOU 4 — a porta foi perdida'
       end as resultado
  from public.acessos_de_hoje();

-- ── 5. Quem não é admin não lê o movimento ────────────────────────────
set local teste.usuario = '00000000-0000-4000-8000-0000000f2902';
select case when total = 0
            then 'PRONTO — e quem não é da administração não vê o movimento'
            else 'FALHOU 5 — VAZOU: ' || total || ' acessos para quem não é admin'
       end as resultado
  from public.acessos_de_hoje();

reset role;
rollback;
