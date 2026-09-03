-- ═══════════════════════════════════════════════════════════════════════
-- 21 — A função que alimenta as ondas por compatibilidade (0113)
-- ═══════════════════════════════════════════════════════════════════════
--
-- Não testa a NOTA (ela é calculada no app, em `compatibilidade.ts`) —
-- testa o que o banco entrega para a conta: quem entra na lista, quem não
-- entra, e se a escolaridade sai certa.
--
--   · quem está PAUSADO entra (é a promessa da 0077: esconder-se da lista
--     e continuar recebendo vaga);
--   · suspenso não entra;
--   · sem telefone confirmado não entra;
--   · a escolaridade é o MAIOR nível da formação, não a primeira linha.

\set ON_ERROR_STOP on
begin;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.usuario', true), '')::uuid
$$;

insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-00000000f001', '5531900010001', now()),  -- a empresa
  ('00000000-0000-4000-8000-00000000f002', '5531900010002', now()),  -- entra (pausado)
  ('00000000-0000-4000-8000-00000000f003', '5531900010003', now()),  -- suspenso
  ('00000000-0000-4000-8000-00000000f004', '5531900010004', now())   -- sem telefone confirmado
on conflict (id) do nothing;

insert into public.companies (id, owner_id, company_name, city, uf, phone, responsible_name)
values ('00000000-0000-4000-8000-00000000f101', '00000000-0000-4000-8000-00000000f001',
        'Obra Central', 'Itabirito', 'MG', '5531900010001', 'Ana');

-- O gatilho da 0076 zera `whatsapp_verified` em escrita comum — quem marca
-- é a função de confirmação. Aqui ele sai de cena dentro da transação, para
-- o cenário poder ter gente com telefone confirmado.
alter table public.professionals disable trigger professionals_protege_whatsapp_verificado_trigger;

insert into public.professionals
  (id, owner_id, name, category, city, uf, categories, whatsapp_verified, suspended, paused)
values
  ('00000000-0000-4000-8000-00000000f201', '00000000-0000-4000-8000-00000000f002',
   'Escondido', 'Pedreiro', 'Itabirito', 'MG', array['Pedreiro'], true, false, true),
  ('00000000-0000-4000-8000-00000000f202', '00000000-0000-4000-8000-00000000f003',
   'Suspenso', 'Pedreiro', 'Itabirito', 'MG', array['Pedreiro'], true, true, false),
  ('00000000-0000-4000-8000-00000000f203', '00000000-0000-4000-8000-00000000f004',
   'Sem telefone', 'Pedreiro', 'Itabirito', 'MG', array['Pedreiro'], false, false, false);

-- Duas formações: a função tem de devolver a MAIOR.
insert into public.professional_courses (professional_id, nome, tipo, nivel)
values ('00000000-0000-4000-8000-00000000f201', 'Ensino médio', 'formacao', 'medio'),
       ('00000000-0000-4000-8000-00000000f201', 'Técnico em edificações', 'formacao', 'tecnico');

grant execute on function public.candidatos_para_compatibilidade(text, text) to authenticated;
grant select on public.companies to authenticated;

set local role authenticated;
set local teste.usuario = '00000000-0000-4000-8000-00000000f001';

-- O banco de teste pode já ter gente cadastrada (o `dados-de-teste.sql`),
-- então a conferência olha SÓ os três deste cenário.
select case
  when (select count(*) from public.candidatos_para_compatibilidade('Itabirito', 'MG')
         where id in ('00000000-0000-4000-8000-00000000f201',
                      '00000000-0000-4000-8000-00000000f202',
                      '00000000-0000-4000-8000-00000000f203')) = 1
   and (select escolaridade from public.candidatos_para_compatibilidade('Itabirito', 'MG')
         where id = '00000000-0000-4000-8000-00000000f201') = 'tecnico'
  then 'PRONTO — só o candidato válido entrou, e a escolaridade é a maior formação'
  else 'AINDA FALTA — confira quem entrou na lista'
  end as resultado;

reset role;
alter table public.professionals enable trigger professionals_protege_whatsapp_verificado_trigger;
rollback;
