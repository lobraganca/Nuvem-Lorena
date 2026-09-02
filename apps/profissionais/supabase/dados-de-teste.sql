-- ═══════════════════════════════════════════════════════════════════════
-- DADOS DE TESTE — 5 empresas, 8 vagas e 8 candidatos
-- ═══════════════════════════════════════════════════════════════════════
-- Tudo com e-mail terminado em @exemplo.teste, para dar para apagar depois
-- com um comando só (está no fim deste arquivo, comentado).
begin;

-- Contas. Sem senha: ninguém entra com elas, servem só para as fichas
-- existirem. O gatilho do Supabase cria a linha em `profiles` sozinho.
insert into auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  raw_app_meta_data, raw_user_meta_data
)
select
  ('00000000-0000-4000-9000-0000000000' || lpad(n::text, 2, '0'))::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
  'teste' || n || '@exemplo.teste',
  '', now(), now(), now(), '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
from generate_series(1, 13) as n
on conflict (id) do nothing;

-- Garante o profile mesmo se o gatilho não rodar.
insert into public.profiles (id, full_name)
select id, 'Conta de teste' from auth.users where email like '%@exemplo.teste'
on conflict (id) do nothing;

-- ── AS EMPRESAS ────────────────────────────────────────────────────────
-- Com plano ativo, senão o banco recusa publicar vaga.
insert into public.companies (
  id, owner_id, company_name, city, uf, neighborhood, phone,
  responsible_name, description, phone_verified, phone_verified_at,
  plano, plano_ate
) values
 ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-9000-000000000001',
  'Padaria Pão de Minas', 'Itabirito', 'MG', 'Centro', '31988220001',
  'Sônia Ribeiro', 'Padaria de bairro, aberta desde 1998. Produção própria de pães e salgados.',
  true, now(), 'ilimitado', now() + interval '90 days'),
 ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-9000-000000000002',
  'Supermercado Boa Compra', 'Itabirito', 'MG', 'Praia', '31988220002',
  'Marcos Teixeira', 'Supermercado com 4 caixas e entrega no bairro.',
  true, now(), 'ilimitado', now() + interval '90 days'),
 ('00000000-0000-4000-a000-000000000003', '00000000-0000-4000-9000-000000000003',
  'Construtora Serra Norte', 'Itabirito', 'MG', 'Bela Vista', '31988220003',
  'Ana Paula Souza', 'Obras residenciais e reformas na região de Itabirito e Ouro Preto.',
  true, now(), 'ilimitado', now() + interval '90 days'),
 ('00000000-0000-4000-a000-000000000004', '00000000-0000-4000-9000-000000000004',
  'Clínica Vida Itabirito', 'Itabirito', 'MG', 'Centro', '31988220004',
  'Dr. Rogério Lima', 'Clínica de atendimento geral, com consultório e sala de exames.',
  true, now(), 'ilimitado', now() + interval '90 days'),
 ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-9000-000000000005',
  'Auto Center Rodas', 'Itabirito', 'MG', 'Vila Rica', '31988220005',
  'Juliano Martins', 'Oficina mecânica e troca de óleo, atendimento de segunda a sábado.',
  true, now(), 'ilimitado', now() + interval '90 days')
on conflict (id) do nothing;

-- ── AS VAGAS ───────────────────────────────────────────────────────────
insert into public.job_listings (
  id, company_id, title, profession, description, work_modality, city, uf,
  neighborhood, status, anunciada_ate, tipo_contrato, jornada,
  salary_range_min, salary_range_max, salario_periodo, beneficios,
  escolaridade_minima, quantidade_vagas, campos_compatibilidade
) values
 ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000001',
  'Atendente de balcão', 'Atendente', 'Atendimento no balcão, montagem de vitrine e caixa. Turno da manhã, de segunda a sábado.',
  'presencial', 'Itabirito', 'MG', 'Centro', 'active', now() + interval '30 days',
  'clt', 'integral', 1600, 1900, 'mes', array['Vale-transporte','Refeição no local'],
  'medio', 1, array['profissao','cidade']),
 ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000001',
  'Ajudante de cozinha', 'Auxiliar de cozinha', 'Apoio na produção de salgados e pães. Não precisa de experiência, a gente ensina.',
  'presencial', 'Itabirito', 'MG', 'Centro', 'active', now() + interval '30 days',
  'clt', 'integral', 1550, null, 'mes', array['Refeição no local'],
  'fundamental', 2, array['profissao','cidade']),
 ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000002',
  'Operador de caixa', 'Operador de caixa', 'Operação de caixa, conferência de valores e apoio na reposição em horário de pico.',
  'presencial', 'Itabirito', 'MG', 'Praia', 'active', now() + interval '30 days',
  'clt', 'turnos', 1580, 1750, 'mes', array['Vale-transporte','Cesta básica'],
  'medio', 3, array['profissao','cidade','disponibilidade']),
 ('00000000-0000-4000-b000-000000000004', '00000000-0000-4000-a000-000000000002',
  'Repositor de mercadorias', 'Repositor', 'Reposição de gôndolas, controle de validade e organização do estoque.',
  'presencial', 'Itabirito', 'MG', 'Praia', 'active', now() + interval '30 days',
  'clt', 'integral', 1520, null, 'mes', array['Vale-transporte'],
  'fundamental', 1, array['profissao','cidade']),
 ('00000000-0000-4000-b000-000000000005', '00000000-0000-4000-a000-000000000003',
  'Pedreiro', 'Pedreiro', 'Alvenaria, reboco e acabamento em obra residencial no bairro Bela Vista.',
  'presencial', 'Itabirito', 'MG', 'Bela Vista', 'active', now() + interval '30 days',
  'temporario', 'integral', 180, 220, 'dia', array['Vale-transporte'],
  null, 2, array['profissao','cidade','experiencia']),
 ('00000000-0000-4000-b000-000000000006', '00000000-0000-4000-a000-000000000003',
  'Servente de obra', 'Servente', 'Apoio geral na obra: massa, transporte de material e limpeza do canteiro.',
  'presencial', 'Itabirito', 'MG', 'Bela Vista', 'active', now() + interval '30 days',
  'temporario', 'integral', 140, null, 'dia', array['Vale-transporte'],
  null, 3, array['profissao','cidade']),
 ('00000000-0000-4000-b000-000000000007', '00000000-0000-4000-a000-000000000004',
  'Recepcionista', 'Recepcionista', 'Recepção de pacientes, agenda e confirmação de consultas por telefone.',
  'presencial', 'Itabirito', 'MG', 'Centro', 'active', now() + interval '30 days',
  'clt', 'meio_periodo', 1500, 1700, 'mes', array['Vale-transporte'],
  'medio', 1, array['profissao','cidade','escolaridade']),
 ('00000000-0000-4000-b000-000000000008', '00000000-0000-4000-a000-000000000005',
  'Mecânico de automóveis', 'Mecânico', 'Manutenção preventiva e corretiva, revisão e troca de óleo. Experiência comprovada.',
  'presencial', 'Itabirito', 'MG', 'Vila Rica', 'active', now() + interval '30 days',
  'clt', 'integral', 2400, 3200, 'mes', array['Vale-transporte','Refeição no local'],
  'fundamental', 1, array['profissao','cidade','experiencia'])
on conflict (id) do nothing;

-- ── OS CANDIDATOS ──────────────────────────────────────────────────────
insert into public.professionals (
  id, owner_id, name, category, categories, city, uf, neighborhood, bio,
  phone, whatsapp, entity_type, disponivel, especialidade,
  pretensao_centavos, pretensao_periodo, disponibilidade, modo_trabalho,
  cnh, cnh_categorias, aceita_viajar, inicio_imediato, data_nascimento
) values
 ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-9000-000000000006',
  'Camila Fernandes', 'Atendente', array['Atendente'], 'Itabirito', 'MG', 'Centro',
  'Trabalhei três anos no atendimento de uma loja de roupas. Gosto de lidar com o público.',
  '31988220006', '31988220006', 'pf', true, 'Atendimento e caixa',
  170000, 'mes', array['manha','tarde'], 'presencial', false, array[]::text[], false, true, '1998-04-12'),
 ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-9000-000000000007',
  'Rafael Andrade', 'Pedreiro', array['Pedreiro'], 'Itabirito', 'MG', 'Bela Vista',
  'Pedreiro há 12 anos, faço alvenaria, reboco e acabamento. Trabalho por dia ou por empreitada.',
  '31988220007', '31988220007', 'pf', true, 'Alvenaria e acabamento',
  20000, 'dia', array['manha','tarde'], 'presencial', true, array['B'], true, true, '1985-09-03'),
 ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-9000-000000000008',
  'Juliana Costa', 'Recepcionista', array['Recepcionista'], 'Itabirito', 'MG', 'Praia',
  'Formada em administração, com experiência em recepção de clínica e agenda de consultas.',
  '31988220008', '31988220008', 'pf', true, 'Recepção e agendamento',
  180000, 'mes', array['tarde'], 'presencial', false, array[]::text[], false, false, '1995-01-27'),
 ('00000000-0000-4000-c000-000000000004', '00000000-0000-4000-9000-000000000009',
  'Diego Moreira', 'Mecânico', array['Mecânico'], 'Itabirito', 'MG', 'Vila Rica',
  'Mecânico de carros leves, revisão, suspensão e freios. Tenho ferramenta própria.',
  '31988220009', '31988220009', 'pf', true, 'Carros leves',
  280000, 'mes', array['manha','tarde'], 'presencial', true, array['AB'], false, true, '1990-06-15'),
 ('00000000-0000-4000-c000-000000000005', '00000000-0000-4000-9000-000000000010',
  'Patrícia Nunes', 'Auxiliar de cozinha', array['Auxiliar de cozinha'], 'Itabirito', 'MG', 'Centro',
  'Ajudo na cozinha de restaurante há dois anos. Sei fazer salgado e trabalho bem em equipe.',
  '31988220010', '31988220010', 'pf', true, 'Cozinha e salgados',
  160000, 'mes', array['manha','noite'], 'presencial', false, array[]::text[], false, true, '2000-11-08'),
 ('00000000-0000-4000-c000-000000000006', '00000000-0000-4000-9000-000000000011',
  'Bruno Carvalho', 'Operador de caixa', array['Operador de caixa'], 'Itabirito', 'MG', 'Praia',
  'Primeiro emprego formal, mas já ajudei no comércio da família no caixa e no estoque.',
  '31988220011', '31988220011', 'pf', true, 'Caixa e estoque',
  155000, 'mes', array['manha','tarde','noite'], 'presencial', false, array[]::text[], false, true, '2004-02-20'),
 ('00000000-0000-4000-c000-000000000007', '00000000-0000-4000-9000-000000000012',
  'Simone Alves', 'Serviços gerais', array['Serviços gerais'], 'Itabirito', 'MG', 'São Sebastião',
  'Faço limpeza e serviços gerais. Tenho disponibilidade de manhã e posso começar na hora.',
  '31988220012', '31988220012', 'pf', true, 'Limpeza',
  9000, 'dia', array['manha'], 'presencial', false, array[]::text[], false, true, '1979-07-30'),
 ('00000000-0000-4000-c000-000000000008', '00000000-0000-4000-9000-000000000013',
  'Leandro Pinto', 'Motorista', array['Motorista'], 'Itabirito', 'MG', 'Centro',
  'Motorista com CNH D, dirijo caminhão e van. Aceito viagem e horário de turno.',
  '31988220013', '31988220013', 'pf', true, 'Caminhão e van',
  260000, 'mes', array['manha','tarde','noite'], 'presencial', true, array['D'], true, false, '1988-12-05')
on conflict (id) do nothing;

-- O telefone confirmado é gravado por gatilho protegido: sem esta senha
-- interna o banco recusa a mudança — e sem ela ninguém aparece na busca,
-- porque a view só mostra quem confirmou o número.
select set_config('app.confirmando_whatsapp', 'sim', true);
update public.professionals
   set whatsapp_verified = true, whatsapp_verified_at = now()
 where id::text like '00000000-0000-4000-c000-%';

commit;

-- Confere a si mesma.
select case
  when (select count(*) from public.companies_public) >= 5
   and (select count(*) from public.job_listings where status = 'active') >= 8
   and (select count(*) from public.professionals_public) >= 8
  then 'PRONTO — ' ||
       (select count(*) from public.companies_public) || ' empresas, ' ||
       (select count(*) from public.job_listings where status = 'active') || ' vagas e ' ||
       (select count(*) from public.professionals_public) || ' candidatos aparecendo no app'
  else 'AINDA FALTA — empresas: ' || (select count(*) from public.companies_public) ||
       ', vagas: ' || (select count(*) from public.job_listings where status = 'active') ||
       ', candidatos: ' || (select count(*) from public.professionals_public)
  end as resultado;
