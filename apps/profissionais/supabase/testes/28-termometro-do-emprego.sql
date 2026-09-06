-- ═══════════════════════════════════════════════════════════════════════
-- 28 — O termômetro conta as vagas certas, nos períodos certos?
-- ═══════════════════════════════════════════════════════════════════════
--
-- Este número vai para uma tela PÚBLICA, lida por quem ainda não tem
-- conta — e é sobre a cidade, não sobre uma pessoa. Errar aqui é publicar
-- informação errada sobre o mercado de trabalho de Itabirito.
--
-- Seis coisas:
--
--   1. vaga dos últimos 30 dias entra em "agora"
--   2. vaga dos 30 dias anteriores entra em "antes"
--   3. vaga de 90 dias atrás não entra em lugar nenhum
--   4. vaga ENCERRADA continua contando — ela existiu, e existir é o que
--      o termômetro mede (e é por isso que precisa ser `security definer`)
--   5. vaga de outra cidade não entra quando se pede uma cidade
--   6. quem não entrou (anon) consegue chamar, porque é onde ela aparece

\set ON_ERROR_STOP on
begin;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.usuario', true), '')::uuid
$$;

insert into auth.users (id, phone, phone_confirmed_at)
values ('00000000-0000-4000-8000-0000000e2801', '5531900002801', now())
on conflict (id) do nothing;

insert into public.companies (id, owner_id, company_name, city, uf, phone, responsible_name)
values ('00000000-0000-4000-8000-0000000e2810', '00000000-0000-4000-8000-0000000e2801',
        'Comercio do Termometro', 'Itabirito', 'MG', '5531900002801', 'Fulana')
on conflict (id) do nothing;

-- A regra da 0072 exige plano para a vaga existir. Ligado aqui como o
-- editor SQL, que é quem monta o cenário.
update public.companies
   set plano = 'dez', plano_ate = now() + interval '30 days'
 where id = '00000000-0000-4000-8000-0000000e2810';

-- Seis vagas, cada uma cobrindo um caso. `created_at` é escrito à mão
-- porque é exatamente ele que a função corta.
insert into public.job_listings (id, company_id, title, description, profession, city, uf,
                                 work_modality, status, created_at)
values
  -- ── "agora": ultimos 30 dias ───────────────────────────────────────
  ('00000000-0000-4000-8000-0000000e2821', '00000000-0000-4000-8000-0000000e2810',
   'Vendedor', 'Loja no Centro.', 'Vendedor', 'Itabirito', 'MG', 'presencial',
   'active', now() - interval '3 days'),
  ('00000000-0000-4000-8000-0000000e2822', '00000000-0000-4000-8000-0000000e2810',
   'Vendedor', 'Outra loja.', 'Vendedor', 'Itabirito', 'MG', 'presencial',
   'active', now() - interval '10 days'),
  -- Encerrada, e de 5 dias atras: TEM de contar em "agora".
  ('00000000-0000-4000-8000-0000000e2823', '00000000-0000-4000-8000-0000000e2810',
   'Pedreiro', 'Obra no Centro.', 'Pedreiro', 'Itabirito', 'MG', 'presencial',
   'closed', now() - interval '5 days'),

  -- ── "antes": entre 30 e 60 dias ────────────────────────────────────
  ('00000000-0000-4000-8000-0000000e2824', '00000000-0000-4000-8000-0000000e2810',
   'Vendedor', 'Loja antiga.', 'Vendedor', 'Itabirito', 'MG', 'presencial',
   'closed', now() - interval '45 days'),

  -- ── fora da janela: 90 dias ────────────────────────────────────────
  ('00000000-0000-4000-8000-0000000e2825', '00000000-0000-4000-8000-0000000e2810',
   'Vendedor', 'Muito antiga.', 'Vendedor', 'Itabirito', 'MG', 'presencial',
   'closed', now() - interval '90 days'),

  -- ── outra cidade ───────────────────────────────────────────────────
  ('00000000-0000-4000-8000-0000000e2826', '00000000-0000-4000-8000-0000000e2810',
   'Vendedor', 'Loja de Ouro Preto.', 'Vendedor', 'Ouro Preto', 'MG', 'presencial',
   'active', now() - interval '4 days')
on conflict (id) do nothing;

-- ── 1, 2 e 3. OS TRÊS PERÍODOS, NA CIDADE TODA ────────────────────────
-- Vendedor: 2 agora (3 e 10 dias) + 1 de outra cidade = 3; antes = 1.
-- A de 90 dias fica de fora dos dois.
select case
  when (select agora from public.termometro_do_emprego(30) where profissao = 'Vendedor') = 3
   and (select antes from public.termometro_do_emprego(30) where profissao = 'Vendedor') = 1
  then 'ok 1 — os tres periodos separam certo, e a de 90 dias ficou fora'
  else 'FALHOU 1 — agora='
       || coalesce((select agora from public.termometro_do_emprego(30)
                     where profissao = 'Vendedor')::text, 'nada')
       || ' antes='
       || coalesce((select antes from public.termometro_do_emprego(30)
                     where profissao = 'Vendedor')::text, 'nada')
  end as resultado;

-- ── 4. A VAGA ENCERRADA CONTINUA CONTANDO ─────────────────────────────
-- Pedreiro só tem a vaga `closed` de 5 dias atrás. Se a função lesse como
-- o app lê (só vaga ativa), este número seria zero — e o termômetro
-- mostraria uma cidade que parou de contratar.
select case
  when (select agora from public.termometro_do_emprego(30) where profissao = 'Pedreiro') = 1
  then 'ok 2 — vaga encerrada conta, que e o que faz o passado existir'
  else 'FALHOU 2 — a vaga encerrada sumiu da conta'
  end as resultado;

-- ── 5. FILTRAR POR CIDADE ─────────────────────────────────────────────
select case
  when (select agora from public.termometro_do_emprego(30, 'Itabirito')
         where profissao = 'Vendedor') = 2
   and (select agora from public.termometro_do_emprego(30, 'Ouro Preto')
         where profissao = 'Vendedor') = 1
  then 'ok 3 — a cidade separa as vagas'
  else 'FALHOU 3 — o filtro de cidade nao separou'
  end as resultado;

-- ── 6. QUEM NÃO ENTROU CONSEGUE CHAMAR ────────────────────────────────
-- É o ponto do termômetro: ele é a parte do app feita para ser vista de
-- fora, por quem ainda não tem conta.
set local role anon;

select case
  when (select agora from public.termometro_do_emprego(30, 'Itabirito')
         where profissao = 'Vendedor') = 2
  then 'PRONTO — o termometro conta certo e quem nao entrou tambem ve'
  else 'FALHOU 4 — anon nao conseguiu chamar a funcao'
  end as resultado;

rollback;
