-- ═══════════════════════════════════════════════════════════════════════
-- DADOS DE TESTE — enche o app de vagas e candidatos
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "encha o app de vagas e candidatos para que eu possa testar as
-- funcionalidades e quebras de layout."
--
-- ── LEIA ISTO ANTES DE COLAR ──────────────────────────────────────────
--
-- Isto cria GENTE QUE NÃO EXISTE dentro do app de verdade: 30 cadastros
-- de profissionais, 8 empresas e 20 vagas. Elas aparecem na busca, no
-- banco de talentos e no banco de vagas para QUALQUER pessoa que abrir o
-- app enquanto estiverem lá. Enquanto o app está em teste fechado isso é
-- inofensivo; no dia da abertura, não é.
--
-- Por isso TODO id criado aqui começa com `eeee0000`, e existe um arquivo
-- que apaga tudo de uma vez: `limpar-os-testes.sql`. Uma linha, e o app
-- volta a ter só gente de verdade.
--
-- Os telefones são todos (31) 90000-00xx — prefixo 9000 não existe em
-- celular no Brasil, então nenhum toque em "Chamar no WhatsApp" vai
-- incomodar uma pessoa real.
--
-- ── O que dá para testar com isto ─────────────────────────────────────
--
--   . nome muito comprido no cartão      (Marcos Vinícius de Oliveira
--                                         Santana Nascimento)
--   . título de vaga muito comprido      (três das vinte)
--   . 1, 2, 3 e 4+ funções por pessoa    (o "+N" do cartão)
--   . com e sem foto, com e sem resumo
--   . destaque pago valendo e vencido    (a área "Em alta"/"Em destaque")
--   . vaga aberta, pausada e encerrada
--   . primeiro emprego, PCD, salário a combinar, diária, PJ
--   . gente já candidatada, para a tela de interessados ter conteúdo
--   . avisos recentes e um de 40 dias    (prova a regra dos 15 dias)
--
-- Roda quantas vezes quiser: tudo é `on conflict do nothing`.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. As contas ───────────────────────────────────────────────────────
-- `professionals.owner_id` aponta para `profiles`, que aponta para
-- `auth.users`. Sem uma linha em auth.users não há cadastro nenhum — é por
-- isso que dados de teste deste app não são "só um insert na tabela".
--
-- Os campos preenchidos são o mínimo que o GoTrue precisa para a linha ser
-- válida. Ninguém entra com estas contas: elas não têm senha utilizável.

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, phone, phone_confirmed_at)
values
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000000','authenticated','authenticated','teste0@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000000',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000001','authenticated','authenticated','teste1@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000001',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000002','authenticated','authenticated','teste2@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000002',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000003','authenticated','authenticated','teste3@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000003',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000004','authenticated','authenticated','teste4@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000004',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000005','authenticated','authenticated','teste5@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000005',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000006','authenticated','authenticated','teste6@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000006',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000007','authenticated','authenticated','teste7@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000007',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000008','authenticated','authenticated','teste8@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000008',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000009','authenticated','authenticated','teste9@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000009',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000010','authenticated','authenticated','teste10@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000010',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000011','authenticated','authenticated','teste11@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000011',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000012','authenticated','authenticated','teste12@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000012',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000013','authenticated','authenticated','teste13@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000013',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000014','authenticated','authenticated','teste14@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000014',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000015','authenticated','authenticated','teste15@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000015',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000016','authenticated','authenticated','teste16@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000016',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000017','authenticated','authenticated','teste17@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000017',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000018','authenticated','authenticated','teste18@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000018',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000019','authenticated','authenticated','teste19@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000019',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000020','authenticated','authenticated','teste20@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000020',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000021','authenticated','authenticated','teste21@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000021',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000022','authenticated','authenticated','teste22@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000022',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000023','authenticated','authenticated','teste23@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000023',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000024','authenticated','authenticated','teste24@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000024',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000025','authenticated','authenticated','teste25@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000025',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000026','authenticated','authenticated','teste26@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000026',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000027','authenticated','authenticated','teste27@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000027',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000028','authenticated','authenticated','teste28@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000028',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-a00000000029','authenticated','authenticated','teste29@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900000029',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-b00000000000','authenticated','authenticated','empresa0@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900001000',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-b00000000001','authenticated','authenticated','empresa1@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900001001',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-b00000000002','authenticated','authenticated','empresa2@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900001002',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-b00000000003','authenticated','authenticated','empresa3@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900001003',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-b00000000004','authenticated','authenticated','empresa4@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900001004',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-b00000000005','authenticated','authenticated','empresa5@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900001005',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-b00000000006','authenticated','authenticated','empresa6@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900001006',now()),
  ('00000000-0000-0000-0000-000000000000','eeee0000-0000-4000-8000-b00000000007','authenticated','authenticated','empresa7@eiemprego.teste','','now()'::timestamptz,now(),now(),'{"provider":"phone","providers":["phone"]}'::jsonb,'{}'::jsonb,'+5531900001007',now())
on conflict (id) do nothing;

insert into public.profiles (id)
select id from auth.users where id::text like 'eeee0000%'
on conflict (id) do nothing;

-- ── 2. Os cadastros de quem procura emprego ────────────────────────────
insert into public.professionals (id, owner_id, name, category, categories, areas_de_interesse, city, uf, neighborhood, bio, phone, whatsapp, whatsapp_verified, entity_type, contact_mode, disponivel, boosted, boosted_until, primeiro_emprego, pcd, data_nascimento, genero, pretensao_centavos, pretensao_combinar, pretensao_periodo, inicio_imediato, aceita_viajar, fim_de_semana, cnh, created_at)
values
  ('eeee0000-0000-4000-8000-c00000000000','eeee0000-0000-4000-8000-a00000000000','Ana Cláudia Ferreira','limpeza',array['Diarista','Auxiliar de limpeza','Passadeira']::text[],array['Diarista','Auxiliar de limpeza','Passadeira']::text[],'Itabirito','MG','Centro','Trabalho com limpeza residencial há 12 anos. Tenho referências no Centro e na Praia.','31900000000','31900000000',true,'pf','whatsapp_livre',false,false,null,false,false,(now() - interval '20 years')::date,'feminino',null,true,'mes',true,true,true,true,now() - interval '0 days'),
  ('eeee0000-0000-4000-8000-c00000000001','eeee0000-0000-4000-8000-a00000000001','Marcos Vinícius de Oliveira Santana Nascimento','construcao',array['Pedreiro','Azulejista','Servente']::text[],array['Pedreiro','Azulejista','Servente']::text[],'Itabirito','MG','Praia','Pedreiro de acabamento. Faço reboco, assentamento de piso e revestimento.','31900000001','31900000001',true,'pf','whatsapp_livre',true,true,now() + interval '20 days',false,false,(now() - interval '23 years')::date,'masculino',175000,false,'mes',false,false,false,false,now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-c00000000002','eeee0000-0000-4000-8000-a00000000002','Joana Silva','cuidados',array['Cuidadora de idosos','Babá']::text[],array['Cuidadora de idosos','Babá']::text[],'Itabirito','MG','Vila Rica','Cuidadora com curso de primeiros socorros. Disponível para plantão noturno.','31900000002','31900000002',true,'pf','whatsapp_livre',true,false,null,false,false,(now() - interval '26 years')::date,'outro',200000,false,'mes',false,false,false,false,now() - interval '2 days'),
  ('eeee0000-0000-4000-8000-c00000000003','eeee0000-0000-4000-8000-a00000000003','Rafael Andrade','logistica',array['Motorista','Entregador']::text[],array['Motorista','Entregador']::text[],'Itabirito','MG','Nossa Senhora do Carmo','CNH categoria D. Trabalhei 6 anos com entrega de carga na região.','31900000003','31900000003',true,'pf','whatsapp_livre',true,false,null,false,false,(now() - interval '29 years')::date,'feminino',225000,false,'mes',true,false,false,false,now() - interval '3 days'),
  ('eeee0000-0000-4000-8000-c00000000004','eeee0000-0000-4000-8000-a00000000004','Beatriz Nogueira','alimentacao',array['Cozinheira','Auxiliar de cozinha','Chapeira','Confeiteira']::text[],array['Cozinheira','Auxiliar de cozinha','Chapeira','Confeiteira']::text[],'Itabirito','MG','Santa Efigênia','','31900000004','31900000004',true,'pf','whatsapp_livre',true,false,null,false,false,(now() - interval '32 years')::date,'masculino',250000,false,'mes',false,false,true,false,now() - interval '4 days'),
  ('eeee0000-0000-4000-8000-c00000000005','eeee0000-0000-4000-8000-a00000000005','Carlos Eduardo Pinto','comercio',array['Vendedor','Repositor','Operador de caixa']::text[],array['Vendedor','Repositor','Operador de caixa']::text[],'Itabirito','MG','Água Limpa','Vendas em loja de material de construção. Bom com atendimento.','31900000005','31900000005',true,'pf','whatsapp_livre',true,false,null,false,false,(now() - interval '35 years')::date,'outro',null,true,'mes',false,false,false,true,now() - interval '5 days'),
  ('eeee0000-0000-4000-8000-c00000000006','eeee0000-0000-4000-8000-a00000000006','Luana Martins','beleza',array['Manicure','Cabeleireira','Depiladora']::text[],array['Manicure','Cabeleireira','Depiladora']::text[],'Itabirito','MG','São Sebastião','Atendo em salão e a domicílio. Alongamento de unha em gel.','31900000006','31900000006',true,'pf','whatsapp_livre',true,true,now() + interval '20 days',false,false,(now() - interval '38 years')::date,'feminino',300000,false,'mes',true,true,false,false,now() - interval '6 days'),
  ('eeee0000-0000-4000-8000-c00000000007','eeee0000-0000-4000-8000-a00000000007','Pedro Henrique Rocha','construcao',array['Eletricista','Ajudante geral']::text[],array['Eletricista','Ajudante geral']::text[],'Itabirito','MG','Bela Vista','Instalação elétrica residencial e predial. NR-10 em dia.','31900000007','31900000007',true,'pf','whatsapp_livre',false,false,null,false,false,(now() - interval '41 years')::date,'masculino',325000,false,'mes',false,false,false,false,now() - interval '7 days'),
  ('eeee0000-0000-4000-8000-c00000000008','eeee0000-0000-4000-8000-a00000000008','Fernanda Costa','administrativo',array['Recepcionista','Auxiliar administrativo']::text[],array['Recepcionista','Auxiliar administrativo']::text[],'Itabirito','MG','Nova Itabirito','Pacote Office. Trabalhei em clínica e em escritório contábil.','31900000008','31900000008',true,'pf','whatsapp_livre',true,false,null,false,true,(now() - interval '44 years')::date,'outro',350000,false,'mes',false,false,true,false,now() - interval '8 days'),
  ('eeee0000-0000-4000-8000-c00000000009','eeee0000-0000-4000-8000-a00000000009','Wesley Aparecido de Souza','mineracao',array['Operador de máquinas','Mecânico']::text[],array['Operador de máquinas','Mecânico']::text[],'Itabirito','MG','Boa Vista','Operador de escavadeira e retroescavadeira. Experiência em mineradora.','31900000009','31900000009',true,'pf','whatsapp_livre',true,false,null,false,false,(now() - interval '47 years')::date,'feminino',150000,false,'mes',true,false,false,false,now() - interval '9 days'),
  ('eeee0000-0000-4000-8000-c00000000010','eeee0000-0000-4000-8000-a00000000010','Priscila Ramos','saude',array['Técnica de enfermagem']::text[],array['Técnica de enfermagem']::text[],'Itabirito','MG','Centro','COREN ativo. Experiência em pronto atendimento e home care.','31900000010','31900000010',true,'pf','whatsapp_livre',true,false,null,false,false,(now() - interval '50 years')::date,'masculino',null,true,'mes',false,false,false,true,now() - interval '10 days'),
  ('eeee0000-0000-4000-8000-c00000000011','eeee0000-0000-4000-8000-a00000000011','Diego Alves','construcao',array['Pintor','Gesseiro']::text[],array['Pintor','Gesseiro']::text[],'Itabirito','MG','Praia','','31900000011','31900000011',true,'pf','whatsapp_livre',true,false,null,false,false,(now() - interval '53 years')::date,'outro',200000,false,'mes',false,false,false,false,now() - interval '11 days'),
  ('eeee0000-0000-4000-8000-c00000000012','eeee0000-0000-4000-8000-a00000000012','Camila Duarte','educacao',array['Professora','Monitora']::text[],array['Professora','Monitora']::text[],'Itabirito','MG','Vila Rica','Licenciatura em Pedagogia. Reforço escolar do 1º ao 5º ano.','31900000012','31900000012',true,'pf','whatsapp_livre',true,false,null,true,false,(now() - interval '56 years')::date,'feminino',225000,false,'mes',true,true,true,false,now() - interval '12 days'),
  ('eeee0000-0000-4000-8000-c00000000013','eeee0000-0000-4000-8000-a00000000013','Jonas Ribeiro','seguranca',array['Porteiro','Vigia']::text[],array['Porteiro','Vigia']::text[],'Itabirito','MG','Nossa Senhora do Carmo','Curso de vigilante atualizado. Aceito escala 12x36.','31900000013','31900000013',true,'pf','whatsapp_livre',true,true,now() + interval '20 days',false,false,(now() - interval '59 years')::date,'masculino',250000,false,'mes',false,false,false,false,now() - interval '13 days'),
  ('eeee0000-0000-4000-8000-c00000000014','eeee0000-0000-4000-8000-a00000000014','Tatiane Moreira','limpeza',array['Camareira','Auxiliar de limpeza']::text[],array['Camareira','Auxiliar de limpeza']::text[],'Itabirito','MG','Santa Efigênia','Trabalhei em pousada por 4 anos. Organização e arrumação.','31900000014','31900000014',true,'pf','whatsapp_livre',false,false,null,false,false,(now() - interval '22 years')::date,'outro',275000,false,'mes',false,false,false,false,now() - interval '14 days'),
  ('eeee0000-0000-4000-8000-c00000000015','eeee0000-0000-4000-8000-a00000000015','Gustavo Lima','automotivo',array['Mecânico','Lanterneiro','Auxiliar de mecânico']::text[],array['Mecânico','Lanterneiro','Auxiliar de mecânico']::text[],'Itabirito','MG','Água Limpa','Mecânica de linha leve, injeção eletrônica e suspensão.','31900000015','31900000015',true,'pf','whatsapp_livre',true,false,null,false,false,(now() - interval '25 years')::date,'feminino',null,true,'mes',true,false,false,true,now() - interval '15 days'),
  ('eeee0000-0000-4000-8000-c00000000016','eeee0000-0000-4000-8000-a00000000016','Vanessa Cristina Gonçalves','alimentacao',array['Garçonete','Atendente']::text[],array['Garçonete','Atendente']::text[],'Itabirito','MG','São Sebastião','Atendimento em bar e restaurante, inclusive fim de semana.','31900000016','31900000016',true,'pf','whatsapp_livre',true,false,null,false,false,(now() - interval '28 years')::date,'masculino',325000,false,'mes',false,false,true,false,now() - interval '16 days'),
  ('eeee0000-0000-4000-8000-c00000000017','eeee0000-0000-4000-8000-a00000000017','Roberto Machado','construcao',array['Carpinteiro','Marceneiro']::text[],array['Carpinteiro','Marceneiro']::text[],'Itabirito','MG','Bela Vista','Móveis planejados e estrutura de telhado.','31900000017','31900000017',true,'pf','whatsapp_livre',true,false,null,false,true,(now() - interval '31 years')::date,'outro',350000,false,'mes',false,false,false,false,now() - interval '17 days'),
  ('eeee0000-0000-4000-8000-c00000000018','eeee0000-0000-4000-8000-a00000000018','Elaine Barbosa','costura',array['Costureira']::text[],array['Costureira']::text[],'Itabirito','MG','Nova Itabirito','Costura em geral, ajuste e sob medida. Máquina própria.','31900000018','31900000018',true,'pf','whatsapp_livre',true,false,null,false,false,(now() - interval '34 years')::date,'feminino',150000,false,'mes',true,true,false,false,now() - interval '18 days'),
  ('eeee0000-0000-4000-8000-c00000000019','eeee0000-0000-4000-8000-a00000000019','Thiago Nunes','tecnologia',array['Técnico de informática']::text[],array['Técnico de informática']::text[],'Itabirito','MG','Boa Vista','Manutenção de computador, rede e instalação de câmeras.','31900000019','31900000019',true,'pf','whatsapp_livre',true,false,null,false,false,(now() - interval '37 years')::date,'masculino',175000,false,'mes',false,false,false,false,now() - interval '19 days'),
  ('eeee0000-0000-4000-8000-c00000000020','eeee0000-0000-4000-8000-a00000000020','Simone Teixeira','cuidados',array['Babá','Acompanhante']::text[],array['Babá','Acompanhante']::text[],'Itabirito','MG','Centro','Experiência com criança de 0 a 6 anos. Referências.','31900000020','31900000020',true,'pf','whatsapp_livre',true,true,now() - interval '5 days',true,false,(now() - interval '40 years')::date,'outro',null,true,'mes',false,false,true,true,now() - interval '20 days'),
  ('eeee0000-0000-4000-8000-c00000000021','eeee0000-0000-4000-8000-a00000000021','Anderson Cardoso','logistica',array['Ajudante de carga','Estoquista']::text[],array['Ajudante de carga','Estoquista']::text[],'Itabirito','MG','Praia','Carga e descarga, conferência e organização de estoque.','31900000021','31900000021',true,'pf','whatsapp_livre',false,false,null,false,false,(now() - interval '43 years')::date,'feminino',225000,false,'mes',true,false,false,false,now() - interval '21 days'),
  ('eeee0000-0000-4000-8000-c00000000022','eeee0000-0000-4000-8000-a00000000022','Larissa Pereira','comercio',array['Vendedora','Promotora']::text[],array['Vendedora','Promotora']::text[],'Itabirito','MG','Vila Rica','','31900000022','31900000022',true,'pf','whatsapp_livre',true,false,null,false,false,(now() - interval '46 years')::date,'masculino',250000,false,'mes',false,false,false,false,now() - interval '22 days'),
  ('eeee0000-0000-4000-8000-c00000000023','eeee0000-0000-4000-8000-a00000000023','Michel dos Santos','jardinagem',array['Jardineiro','Ajudante geral']::text[],array['Jardineiro','Ajudante geral']::text[],'Itabirito','MG','Nossa Senhora do Carmo','Poda, corte de grama e manutenção de área verde.','31900000023','31900000023',true,'pf','whatsapp_livre',true,false,null,false,false,(now() - interval '49 years')::date,'outro',275000,false,'mes',false,false,false,false,now() - interval '23 days'),
  ('eeee0000-0000-4000-8000-c00000000024','eeee0000-0000-4000-8000-a00000000024','Kelly Fonseca','saude',array['Auxiliar de saúde bucal']::text[],array['Auxiliar de saúde bucal']::text[],'Itabirito','MG','Santa Efigênia','Trabalhei em consultório odontológico por 3 anos.','31900000024','31900000024',true,'pf','whatsapp_livre',true,false,null,false,false,(now() - interval '52 years')::date,'feminino',300000,false,'mes',true,true,true,false,now() - interval '24 days'),
  ('eeee0000-0000-4000-8000-c00000000025','eeee0000-0000-4000-8000-a00000000025','Otávio Bernardes','construcao',array['Encanador','Bombeiro hidráulico']::text[],array['Encanador','Bombeiro hidráulico']::text[],'Itabirito','MG','Água Limpa','Hidráulica residencial, caça-vazamento e desentupimento.','31900000025','31900000025',true,'pf','whatsapp_livre',true,false,null,false,false,(now() - interval '55 years')::date,'masculino',null,true,'mes',false,false,false,true,now() - interval '25 days'),
  ('eeee0000-0000-4000-8000-c00000000026','eeee0000-0000-4000-8000-a00000000026','Renata Vieira','administrativo',array['Auxiliar financeiro','Recepcionista']::text[],array['Auxiliar financeiro','Recepcionista']::text[],'Itabirito','MG','São Sebastião','Contas a pagar e receber, emissão de nota.','31900000026','31900000026',true,'pf','whatsapp_livre',true,false,null,false,false,(now() - interval '58 years')::date,'outro',350000,false,'mes',false,false,false,false,now() - interval '26 days'),
  ('eeee0000-0000-4000-8000-c00000000027','eeee0000-0000-4000-8000-a00000000027','Bruno Carvalho','alimentacao',array['Padeiro','Confeiteiro']::text[],array['Padeiro','Confeiteiro']::text[],'Itabirito','MG','Bela Vista','Pão francês, doce e salgado para festa.','31900000027','31900000027',true,'pf','whatsapp_livre',true,false,null,false,false,(now() - interval '21 years')::date,'feminino',150000,false,'mes',true,false,false,false,now() - interval '27 days'),
  ('eeee0000-0000-4000-8000-c00000000028','eeee0000-0000-4000-8000-a00000000028','Aline Rodrigues','limpeza',array['Diarista','Cozinheira']::text[],array['Diarista','Cozinheira']::text[],'Itabirito','MG','Nova Itabirito','Faço faxina e cozinho. Segunda a sexta.','31900000028','31900000028',true,'pf','whatsapp_livre',false,false,null,true,false,(now() - interval '24 years')::date,'masculino',175000,false,'mes',false,false,true,false,now() - interval '28 days'),
  ('eeee0000-0000-4000-8000-c00000000029','eeee0000-0000-4000-8000-a00000000029','José Ferreira da Costa Neto','seguranca',array['Vigia','Porteiro']::text[],array['Vigia','Porteiro']::text[],'Itabirito','MG','Boa Vista','Aposentado, procuro portaria noturna.','31900000029','31900000029',true,'pf','whatsapp_livre',true,false,null,false,false,(now() - interval '27 years')::date,'outro',200000,false,'mes',false,false,false,false,now() - interval '29 days')
on conflict (id) do nothing;

-- ── 2b. Marcar o telefone como confirmado ──────────────────────────────
-- O gatilho da 0024 FORÇA `whatsapp_verified = false` em todo insert, e
-- por um bom motivo: sem isso qualquer um gravaria o próprio cadastro já
-- com o selo de número confirmado. A confirmação de verdade passa por uma
-- função que só roda com esta chave de sessão ligada.
--
-- Sem este passo, os 30 cadastros existem e NÃO APARECEM em lugar nenhum:
-- a view `professionals_public` esconde quem não confirmou (0076/0117), e
-- o aviso de vaga é recusado pelo gatilho da 0076.
select set_config('app.confirmando_whatsapp', 'sim', false);

update public.professionals
   set whatsapp_verified = true,
       whatsapp_verified_at = now()
 where id::text like 'eeee0000%';

select set_config('app.confirmando_whatsapp', '', false);


-- ── 3. As empresas ─────────────────────────────────────────────────────
insert into public.companies (id, owner_id, company_name, city, uf, neighborhood, phone, responsible_name, description, phone_verified, plano, plano_ate, plano_desde, plano_recorrente, contrata_pcd, created_at)
values
  ('eeee0000-0000-4000-8000-d00000000000','eeee0000-0000-4000-8000-b00000000000','Supermercado Boa Compra','Itabirito','MG','Praia','31900001000','Responsável Supermercado','Supermercado com 4 caixas e entrega no bairro.',true,'cinco',now() + interval '60 days',now() - interval '30 days',false,true,now() - interval '40 days'),
  ('eeee0000-0000-4000-8000-d00000000001','eeee0000-0000-4000-8000-b00000000001','Padaria Pão de Minas','Itabirito','MG','Centro','31900001001','Responsável Padaria','Padaria de bairro, aberta desde 1998.',true,'tres',now() + interval '60 days',now() - interval '30 days',false,false,now() - interval '39 days'),
  ('eeee0000-0000-4000-8000-d00000000002','eeee0000-0000-4000-8000-b00000000002','Construtora Serra Alta','Itabirito','MG','Nova Itabirito','31900001002','Responsável Construtora','Obras residenciais e reformas em Itabirito e região.',true,'dez',now() + interval '60 days',now() - interval '30 days',false,false,now() - interval '38 days'),
  ('eeee0000-0000-4000-8000-d00000000003','eeee0000-0000-4000-8000-b00000000003','Pousada Recanto da Serra','Itabirito','MG','Vila Rica','31900001003','Responsável Pousada','Pousada com 14 quartos, aberta o ano todo.',true,'tres',now() + interval '60 days',now() - interval '30 days',false,true,now() - interval '37 days'),
  ('eeee0000-0000-4000-8000-d00000000004','eeee0000-0000-4000-8000-b00000000004','Clínica Vida Itabirito','Itabirito','MG','Centro','31900001004','Responsável Clínica','Clínica de atendimento em várias especialidades.',true,'tres',now() + interval '60 days',now() - interval '30 days',false,false,now() - interval '36 days'),
  ('eeee0000-0000-4000-8000-d00000000005','eeee0000-0000-4000-8000-b00000000005','Auto Center Rocha','Itabirito','MG','Água Limpa','31900001005','Responsável Auto','Oficina mecânica e centro automotivo.',true,'tres',now() + interval '60 days',now() - interval '30 days',false,false,now() - interval '35 days'),
  ('eeee0000-0000-4000-8000-d00000000006','eeee0000-0000-4000-8000-b00000000006','Restaurante Sabor Mineiro','Itabirito','MG','Centro','31900001006','Responsável Restaurante','Comida caseira, almoço executivo e marmitex.',true,'cinco',now() + interval '60 days',now() - interval '30 days',false,true,now() - interval '34 days'),
  ('eeee0000-0000-4000-8000-d00000000007','eeee0000-0000-4000-8000-b00000000007','Transportadora Caminho Certo','Itabirito','MG','Santa Efigênia','31900001007','Responsável Transportadora','Transporte de carga na região metropolitana.',true,'ilimitado',now() + interval '60 days',now() - interval '30 days',false,false,now() - interval '33 days')
on conflict (id) do nothing;

-- ── 4. As vagas ────────────────────────────────────────────────────────
-- O gatilho da 0073 recusa vaga sem plano ativo; por isso as empresas
-- acima já nascem com plano. Os tetos (0120) foram respeitados: nenhuma
-- empresa aqui tem mais vagas ativas do que o plano dela permite.
insert into public.job_listings (id, company_id, title, profession, description, required_experience, skills, work_modality, available_immediately, salary_range_min, salary_range_max, salario_a_combinar, salario_periodo, city, uf, neighborhood, status, tipo_contrato, jornada, beneficios, quantidade_vagas, escolaridade_minima, aceita_primeiro_emprego, vaga_para_pcd, aceita_outras_cidades, destaque_ate, anunciada_ate, created_at)
values
  ('eeee0000-0000-4000-8000-e00000000000','eeee0000-0000-4000-8000-d00000000000','Repositor de mercadorias','Repositor','Reposição de gôndolas, controle de validade e organização do estoque.','1 ano','{}','presencial',true,1518,1800,false,'mes','Itabirito','MG','Centro','active','clt','integral',array['Vale-transporte','Vale-alimentação']::text[],3,'fundamental',false,false,true,now() + interval '10 days',now() + interval '25 days',now() - interval '0 days'),
  ('eeee0000-0000-4000-8000-e00000000001','eeee0000-0000-4000-8000-d00000000000','Operador de caixa','Operador de caixa','Atendimento no caixa, abertura e fechamento, conferência de valores.',null,'{}','presencial',false,1518,1650,false,'mes','Itabirito','MG','Praia','active','clt','integral',array['Vale-transporte']::text[],2,'medio',true,false,false,null,now() + interval '25 days',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-e00000000002','eeee0000-0000-4000-8000-d00000000000','Auxiliar de limpeza para o setor de hortifruti do supermercado','Auxiliar de limpeza','Limpeza do salão de vendas e do setor de hortifruti.',null,'{}','presencial',false,null,null,true,'mes','Itabirito','MG','Vila Rica','active','clt','integral',array['Vale-transporte','Cesta básica']::text[],1,null,true,true,false,null,now() + interval '25 days',now() - interval '2 days'),
  ('eeee0000-0000-4000-8000-e00000000003','eeee0000-0000-4000-8000-d00000000001','Padeiro','Padeiro','Produção de pão francês, doces e salgados. Início às 4h.','1 ano','{}','presencial',false,2200,2800,false,'mes','Itabirito','MG','Nossa Senhora do Carmo','active','clt','integral',array['Vale-transporte','Vale-alimentação']::text[],1,'fundamental',false,false,false,null,now() + interval '25 days',now() - interval '3 days'),
  ('eeee0000-0000-4000-8000-e00000000004','eeee0000-0000-4000-8000-d00000000001','Atendente de balcão','Atendente','Atendimento no balcão, montagem de vitrine e caixa.',null,'{}','presencial',true,1100,null,false,'mes','Itabirito','MG','Santa Efigênia','active','clt','meio_periodo',array['Vale-transporte']::text[],2,'medio',true,false,false,null,now() + interval '25 days',now() - interval '4 days'),
  ('eeee0000-0000-4000-8000-e00000000005','eeee0000-0000-4000-8000-d00000000002','Pedreiro de acabamento','Pedreiro','Assentamento de piso, revestimento e reboco em obra no Centro.','6 meses','{}','presencial',false,180,250,false,'dia','Itabirito','MG','Água Limpa','active','diaria','integral',array['Vale-transporte','Alimentação no local']::text[],4,null,false,false,true,null,now() + interval '25 days',now() - interval '5 days'),
  ('eeee0000-0000-4000-8000-e00000000006','eeee0000-0000-4000-8000-d00000000002','Servente de obra','Servente','Apoio geral em obra, carga de material e limpeza do canteiro.',null,'{}','presencial',false,150,null,false,'dia','Itabirito','MG','São Sebastião','active','diaria','integral',array['Alimentação no local']::text[],6,null,true,false,false,null,now() + interval '25 days',now() - interval '6 days'),
  ('eeee0000-0000-4000-8000-e00000000007','eeee0000-0000-4000-8000-d00000000002','Eletricista predial','Eletricista','Instalação elétrica em prédio residencial de 4 andares. NR-10 exigida.','2 anos','{}','presencial',false,3200,4000,false,'mes','Itabirito','MG','Bela Vista','active','freelance','integral','{}',1,'medio',false,false,false,null,now() + interval '25 days',now() - interval '7 days'),
  ('eeee0000-0000-4000-8000-e00000000008','eeee0000-0000-4000-8000-d00000000003','Camareira','Camareira','Arrumação de quartos, rouparia e apoio ao café da manhã.',null,'{}','presencial',true,1518,null,false,'mes','Itabirito','MG','Nova Itabirito','active','clt','turnos',array['Vale-transporte','Alimentação no local','Gorjeta']::text[],2,'fundamental',true,false,false,now() - interval '3 days',now() + interval '25 days',now() - interval '8 days'),
  ('eeee0000-0000-4000-8000-e00000000009','eeee0000-0000-4000-8000-d00000000003','Recepcionista de pousada','Recepcionista','Check-in, check-out, reservas por telefone e WhatsApp.','1 ano','{}','presencial',false,1700,2000,false,'mes','Itabirito','MG','Boa Vista','active','clt','turnos',array['Vale-transporte','Alimentação no local']::text[],1,'medio',false,false,false,null,now() + interval '25 days',now() - interval '9 days'),
  ('eeee0000-0000-4000-8000-e00000000010','eeee0000-0000-4000-8000-d00000000004','Técnico de enfermagem','Técnico de enfermagem','Atendimento em consultório, triagem e curativos. COREN ativo.','2 anos','{}','presencial',false,2400,2900,false,'mes','Itabirito','MG','Centro','active','clt','turnos',array['Vale-transporte','Plano de saúde']::text[],2,'tecnico',false,false,true,null,now() + interval '25 days',now() - interval '10 days'),
  ('eeee0000-0000-4000-8000-e00000000011','eeee0000-0000-4000-8000-d00000000004','Recepcionista de clínica','Recepcionista','Agendamento, convênios e organização de prontuário.','6 meses','{}','presencial',false,1600,1900,false,'mes','Itabirito','MG','Praia','active','clt','integral',array['Vale-transporte','Plano de saúde']::text[],1,'medio',false,true,false,null,now() + interval '25 days',now() - interval '11 days'),
  ('eeee0000-0000-4000-8000-e00000000012','eeee0000-0000-4000-8000-d00000000005','Mecânico de linha leve','Mecânico','Manutenção preventiva e corretiva, injeção eletrônica e suspensão.','1 ano','{}','presencial',true,2800,3600,false,'mes','Itabirito','MG','Vila Rica','active','clt','integral',array['Vale-transporte','Vale-alimentação']::text[],1,'medio',false,false,false,null,now() + interval '25 days',now() - interval '12 days'),
  ('eeee0000-0000-4000-8000-e00000000013','eeee0000-0000-4000-8000-d00000000005','Lavador de carros','Lavador','Lavagem simples e completa, higienização interna.',null,'{}','presencial',false,null,null,true,'dia','Itabirito','MG','Nossa Senhora do Carmo','active','diaria','integral','{}',2,null,true,false,false,null,now() + interval '25 days',now() - interval '13 days'),
  ('eeee0000-0000-4000-8000-e00000000014','eeee0000-0000-4000-8000-d00000000006','Cozinheira','Cozinheira','Preparo do almoço executivo e das marmitas. De segunda a sábado.','6 meses','{}','presencial',false,2100,2500,false,'mes','Itabirito','MG','Santa Efigênia','active','clt','integral',array['Vale-transporte','Alimentação no local']::text[],1,'fundamental',false,false,false,null,now() + interval '25 days',now() - interval '14 days'),
  ('eeee0000-0000-4000-8000-e00000000015','eeee0000-0000-4000-8000-d00000000006','Garçom / garçonete','Garçom','Atendimento no salão no horário do almoço e em eventos.',null,'{}','presencial',false,1200,null,false,'mes','Itabirito','MG','Água Limpa','active','clt','meio_periodo',array['Vale-transporte','Alimentação no local','Gorjeta']::text[],3,null,true,false,true,null,now() + interval '25 days',now() - interval '15 days'),
  ('eeee0000-0000-4000-8000-e00000000016','eeee0000-0000-4000-8000-d00000000006','Auxiliar de cozinha','Auxiliar de cozinha','Pré-preparo, higienização e apoio na produção.',null,'{}','presencial',true,1518,null,false,'mes','Itabirito','MG','São Sebastião','active','clt','integral',array['Vale-transporte','Alimentação no local']::text[],2,null,true,true,false,null,now() + interval '25 days',now() - interval '16 days'),
  ('eeee0000-0000-4000-8000-e00000000017','eeee0000-0000-4000-8000-d00000000007','Motorista entregador','Motorista','Entrega de carga na região metropolitana. CNH D obrigatória.','6 meses','{}','presencial',false,2600,3200,false,'mes','Itabirito','MG','Bela Vista','active','clt','integral',array['Vale-transporte','Vale-alimentação','Seguro de vida']::text[],2,'medio',false,false,false,now() + interval '10 days',now() + interval '25 days',now() - interval '17 days'),
  ('eeee0000-0000-4000-8000-e00000000018','eeee0000-0000-4000-8000-d00000000007','Ajudante de carga e descarga','Ajudante','Carga, descarga e conferência de mercadoria no galpão.',null,'{}','presencial',false,1518,null,false,'mes','Itabirito','MG','Nova Itabirito','active','clt','integral',array['Vale-transporte','Cesta básica']::text[],4,null,true,false,false,null,now() + interval '25 days',now() - interval '18 days'),
  ('eeee0000-0000-4000-8000-e00000000019','eeee0000-0000-4000-8000-d00000000007','Auxiliar administrativo para o setor de logística e roteirização de entregas','Auxiliar administrativo','Emissão de nota, roteirização e apoio ao setor de logística.','2 anos','{}','presencial',false,1900,2300,false,'mes','Itabirito','MG','Boa Vista','active','clt','integral',array['Vale-transporte','Plano de saúde']::text[],1,'medio',false,true,false,null,now() + interval '25 days',now() - interval '19 days')
on conflict (id) do nothing;

-- ── 4b. Duas vagas em destaque, e uma com destaque vencido ─────────────
-- `destaque_ate` é protegida por gatilho: só a administração pode
-- escrevê-la, e no editor do painel `auth.uid()` é vazio — ou seja, nem
-- você é "administração" aqui. O gatilho apagaria a data em silêncio.
--
-- Por isso ele é desligado por um instante, e RELIGADO logo abaixo. Se
-- algum dia esta parte falhar no meio, rode só a linha do `enable`: sem
-- ela, qualquer empresa passaria a poder se destacar de graça.
alter table public.job_listings disable trigger job_listings_protege_destaque;

update public.job_listings set destaque_ate = now() + interval '10 days'
 where id in ('eeee0000-0000-4000-8000-e00000000000',
              'eeee0000-0000-4000-8000-e00000000017');
-- Uma com o destaque JÁ VENCIDO: ela tem de sair da área "Em destaque"
-- sozinha, sem ninguém mexer. É o teste da regra que a dona pediu
-- ("quando a pessoa destaca ele já tem que ir sozinho e sumir sozinho").
update public.job_listings set destaque_ate = now() - interval '3 days'
 where id = 'eeee0000-0000-4000-8000-e00000000008';

alter table public.job_listings enable trigger job_listings_protege_destaque;


-- ── 5. Quem já se candidatou ───────────────────────────────────────────
-- Sem isto a tela de interessados da empresa abre vazia, e é justamente
-- ela que a dona precisa ver cheia para conferir o layout.
insert into public.job_responses (id, job_listing_id, professional_id, interessado, status, created_at)
values
  ('eeee0000-0000-4000-8000-f00000000000','eeee0000-0000-4000-8000-e00000000001','eeee0000-0000-4000-8000-a00000000003',true,'read',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000000001','eeee0000-0000-4000-8000-e00000000002','eeee0000-0000-4000-8000-a00000000006',true,'accepted',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000000002','eeee0000-0000-4000-8000-e00000000002','eeee0000-0000-4000-8000-a00000000013',true,'rejected',now() - interval '2 days'),
  ('eeee0000-0000-4000-8000-f00000000003','eeee0000-0000-4000-8000-e00000000003','eeee0000-0000-4000-8000-a00000000009',true,'rejected',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000000004','eeee0000-0000-4000-8000-e00000000003','eeee0000-0000-4000-8000-a00000000016',true,'new',now() - interval '2 days'),
  ('eeee0000-0000-4000-8000-f00000000005','eeee0000-0000-4000-8000-e00000000003','eeee0000-0000-4000-8000-a00000000023',true,'read',now() - interval '3 days'),
  ('eeee0000-0000-4000-8000-f00000000006','eeee0000-0000-4000-8000-e00000000004','eeee0000-0000-4000-8000-a00000000012',true,'new',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000000007','eeee0000-0000-4000-8000-e00000000004','eeee0000-0000-4000-8000-a00000000019',true,'read',now() - interval '2 days'),
  ('eeee0000-0000-4000-8000-f00000000008','eeee0000-0000-4000-8000-e00000000004','eeee0000-0000-4000-8000-a00000000026',true,'accepted',now() - interval '3 days'),
  ('eeee0000-0000-4000-8000-f00000000009','eeee0000-0000-4000-8000-e00000000004','eeee0000-0000-4000-8000-a00000000003',false,'rejected',now() - interval '4 days'),
  ('eeee0000-0000-4000-8000-f00000000010','eeee0000-0000-4000-8000-e00000000004','eeee0000-0000-4000-8000-a00000000010',true,'new',now() - interval '5 days'),
  ('eeee0000-0000-4000-8000-f00000000011','eeee0000-0000-4000-8000-e00000000005','eeee0000-0000-4000-8000-a00000000015',true,'read',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000000012','eeee0000-0000-4000-8000-e00000000005','eeee0000-0000-4000-8000-a00000000022',true,'accepted',now() - interval '2 days'),
  ('eeee0000-0000-4000-8000-f00000000013','eeee0000-0000-4000-8000-e00000000005','eeee0000-0000-4000-8000-a00000000029',true,'rejected',now() - interval '3 days'),
  ('eeee0000-0000-4000-8000-f00000000014','eeee0000-0000-4000-8000-e00000000005','eeee0000-0000-4000-8000-a00000000006',false,'new',now() - interval '4 days'),
  ('eeee0000-0000-4000-8000-f00000000015','eeee0000-0000-4000-8000-e00000000005','eeee0000-0000-4000-8000-a00000000013',true,'read',now() - interval '5 days'),
  ('eeee0000-0000-4000-8000-f00000000016','eeee0000-0000-4000-8000-e00000000005','eeee0000-0000-4000-8000-a00000000020',true,'accepted',now() - interval '6 days'),
  ('eeee0000-0000-4000-8000-f00000000017','eeee0000-0000-4000-8000-e00000000005','eeee0000-0000-4000-8000-a00000000027',true,'rejected',now() - interval '7 days'),
  ('eeee0000-0000-4000-8000-f00000000018','eeee0000-0000-4000-8000-e00000000005','eeee0000-0000-4000-8000-a00000000004',false,'new',now() - interval '8 days'),
  ('eeee0000-0000-4000-8000-f00000000019','eeee0000-0000-4000-8000-e00000000007','eeee0000-0000-4000-8000-a00000000021',true,'rejected',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000000020','eeee0000-0000-4000-8000-e00000000008','eeee0000-0000-4000-8000-a00000000024',true,'new',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000000021','eeee0000-0000-4000-8000-e00000000008','eeee0000-0000-4000-8000-a00000000001',true,'read',now() - interval '2 days'),
  ('eeee0000-0000-4000-8000-f00000000022','eeee0000-0000-4000-8000-e00000000009','eeee0000-0000-4000-8000-a00000000027',true,'read',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000000023','eeee0000-0000-4000-8000-e00000000009','eeee0000-0000-4000-8000-a00000000004',true,'accepted',now() - interval '2 days'),
  ('eeee0000-0000-4000-8000-f00000000024','eeee0000-0000-4000-8000-e00000000009','eeee0000-0000-4000-8000-a00000000011',true,'rejected',now() - interval '3 days'),
  ('eeee0000-0000-4000-8000-f00000000025','eeee0000-0000-4000-8000-e00000000010','eeee0000-0000-4000-8000-a00000000000',true,'accepted',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000000026','eeee0000-0000-4000-8000-e00000000010','eeee0000-0000-4000-8000-a00000000007',true,'rejected',now() - interval '2 days'),
  ('eeee0000-0000-4000-8000-f00000000027','eeee0000-0000-4000-8000-e00000000010','eeee0000-0000-4000-8000-a00000000014',true,'new',now() - interval '3 days'),
  ('eeee0000-0000-4000-8000-f00000000028','eeee0000-0000-4000-8000-e00000000010','eeee0000-0000-4000-8000-a00000000021',false,'read',now() - interval '4 days'),
  ('eeee0000-0000-4000-8000-f00000000029','eeee0000-0000-4000-8000-e00000000010','eeee0000-0000-4000-8000-a00000000028',true,'accepted',now() - interval '5 days'),
  ('eeee0000-0000-4000-8000-f00000000030','eeee0000-0000-4000-8000-e00000000011','eeee0000-0000-4000-8000-a00000000003',true,'rejected',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000000031','eeee0000-0000-4000-8000-e00000000011','eeee0000-0000-4000-8000-a00000000010',true,'new',now() - interval '2 days'),
  ('eeee0000-0000-4000-8000-f00000000032','eeee0000-0000-4000-8000-e00000000011','eeee0000-0000-4000-8000-a00000000017',true,'read',now() - interval '3 days'),
  ('eeee0000-0000-4000-8000-f00000000033','eeee0000-0000-4000-8000-e00000000011','eeee0000-0000-4000-8000-a00000000024',false,'accepted',now() - interval '4 days'),
  ('eeee0000-0000-4000-8000-f00000000034','eeee0000-0000-4000-8000-e00000000011','eeee0000-0000-4000-8000-a00000000001',true,'rejected',now() - interval '5 days'),
  ('eeee0000-0000-4000-8000-f00000000035','eeee0000-0000-4000-8000-e00000000011','eeee0000-0000-4000-8000-a00000000008',true,'new',now() - interval '6 days'),
  ('eeee0000-0000-4000-8000-f00000000036','eeee0000-0000-4000-8000-e00000000011','eeee0000-0000-4000-8000-a00000000015',true,'read',now() - interval '7 days'),
  ('eeee0000-0000-4000-8000-f00000000037','eeee0000-0000-4000-8000-e00000000011','eeee0000-0000-4000-8000-a00000000022',false,'accepted',now() - interval '8 days'),
  ('eeee0000-0000-4000-8000-f00000000038','eeee0000-0000-4000-8000-e00000000013','eeee0000-0000-4000-8000-a00000000009',true,'read',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000000039','eeee0000-0000-4000-8000-e00000000014','eeee0000-0000-4000-8000-a00000000012',true,'accepted',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000000040','eeee0000-0000-4000-8000-e00000000014','eeee0000-0000-4000-8000-a00000000019',true,'rejected',now() - interval '2 days'),
  ('eeee0000-0000-4000-8000-f00000000041','eeee0000-0000-4000-8000-e00000000015','eeee0000-0000-4000-8000-a00000000015',true,'rejected',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000000042','eeee0000-0000-4000-8000-e00000000015','eeee0000-0000-4000-8000-a00000000022',true,'new',now() - interval '2 days'),
  ('eeee0000-0000-4000-8000-f00000000043','eeee0000-0000-4000-8000-e00000000015','eeee0000-0000-4000-8000-a00000000029',true,'read',now() - interval '3 days'),
  ('eeee0000-0000-4000-8000-f00000000044','eeee0000-0000-4000-8000-e00000000016','eeee0000-0000-4000-8000-a00000000018',true,'new',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000000045','eeee0000-0000-4000-8000-e00000000016','eeee0000-0000-4000-8000-a00000000025',true,'read',now() - interval '2 days'),
  ('eeee0000-0000-4000-8000-f00000000046','eeee0000-0000-4000-8000-e00000000016','eeee0000-0000-4000-8000-a00000000002',true,'accepted',now() - interval '3 days'),
  ('eeee0000-0000-4000-8000-f00000000047','eeee0000-0000-4000-8000-e00000000016','eeee0000-0000-4000-8000-a00000000009',false,'rejected',now() - interval '4 days'),
  ('eeee0000-0000-4000-8000-f00000000048','eeee0000-0000-4000-8000-e00000000016','eeee0000-0000-4000-8000-a00000000016',true,'new',now() - interval '5 days'),
  ('eeee0000-0000-4000-8000-f00000000049','eeee0000-0000-4000-8000-e00000000017','eeee0000-0000-4000-8000-a00000000021',true,'read',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000000050','eeee0000-0000-4000-8000-e00000000017','eeee0000-0000-4000-8000-a00000000028',true,'accepted',now() - interval '2 days'),
  ('eeee0000-0000-4000-8000-f00000000051','eeee0000-0000-4000-8000-e00000000017','eeee0000-0000-4000-8000-a00000000005',true,'rejected',now() - interval '3 days'),
  ('eeee0000-0000-4000-8000-f00000000052','eeee0000-0000-4000-8000-e00000000017','eeee0000-0000-4000-8000-a00000000012',false,'new',now() - interval '4 days'),
  ('eeee0000-0000-4000-8000-f00000000053','eeee0000-0000-4000-8000-e00000000017','eeee0000-0000-4000-8000-a00000000019',true,'read',now() - interval '5 days'),
  ('eeee0000-0000-4000-8000-f00000000054','eeee0000-0000-4000-8000-e00000000017','eeee0000-0000-4000-8000-a00000000026',true,'accepted',now() - interval '6 days'),
  ('eeee0000-0000-4000-8000-f00000000055','eeee0000-0000-4000-8000-e00000000017','eeee0000-0000-4000-8000-a00000000003',true,'rejected',now() - interval '7 days'),
  ('eeee0000-0000-4000-8000-f00000000056','eeee0000-0000-4000-8000-e00000000017','eeee0000-0000-4000-8000-a00000000010',false,'new',now() - interval '8 days'),
  ('eeee0000-0000-4000-8000-f00000000057','eeee0000-0000-4000-8000-e00000000019','eeee0000-0000-4000-8000-a00000000027',true,'rejected',now() - interval '1 days')
on conflict do nothing;

-- ── 6. Avisos que chegaram ─────────────────────────────────────────────
-- Inclui um de 40 dias: ele NÃO deve aparecer na tela de avisos, e é a
-- prova de que a regra dos 15 dias (0122) está valendo.
insert into public.job_notifications (id, job_listing_id, professional_id, wave, enviado_em, criado_em)
values
  ('eeee0000-0000-4000-8000-f00000100000','eeee0000-0000-4000-8000-e00000000000','eeee0000-0000-4000-8000-a00000000000',1,now() - interval '40 days',now() - interval '40 days'),
  ('eeee0000-0000-4000-8000-f00000100001','eeee0000-0000-4000-8000-e00000000000','eeee0000-0000-4000-8000-a00000000005',1,now() - interval '4 days',now() - interval '4 days'),
  ('eeee0000-0000-4000-8000-f00000100002','eeee0000-0000-4000-8000-e00000000000','eeee0000-0000-4000-8000-a00000000010',1,now() - interval '7 days',now() - interval '7 days'),
  ('eeee0000-0000-4000-8000-f00000100003','eeee0000-0000-4000-8000-e00000000000','eeee0000-0000-4000-8000-a00000000015',1,now() - interval '10 days',now() - interval '10 days'),
  ('eeee0000-0000-4000-8000-f00000100004','eeee0000-0000-4000-8000-e00000000001','eeee0000-0000-4000-8000-a00000000001',1,now() - interval '1 days',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000100005','eeee0000-0000-4000-8000-e00000000001','eeee0000-0000-4000-8000-a00000000006',1,now() - interval '4 days',now() - interval '4 days'),
  ('eeee0000-0000-4000-8000-f00000100006','eeee0000-0000-4000-8000-e00000000001','eeee0000-0000-4000-8000-a00000000011',1,now() - interval '7 days',now() - interval '7 days'),
  ('eeee0000-0000-4000-8000-f00000100007','eeee0000-0000-4000-8000-e00000000001','eeee0000-0000-4000-8000-a00000000016',1,now() - interval '10 days',now() - interval '10 days'),
  ('eeee0000-0000-4000-8000-f00000100008','eeee0000-0000-4000-8000-e00000000003','eeee0000-0000-4000-8000-a00000000003',1,now() - interval '1 days',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000100009','eeee0000-0000-4000-8000-e00000000003','eeee0000-0000-4000-8000-a00000000008',1,now() - interval '4 days',now() - interval '4 days'),
  ('eeee0000-0000-4000-8000-f00000100010','eeee0000-0000-4000-8000-e00000000003','eeee0000-0000-4000-8000-a00000000013',1,now() - interval '7 days',now() - interval '7 days'),
  ('eeee0000-0000-4000-8000-f00000100011','eeee0000-0000-4000-8000-e00000000003','eeee0000-0000-4000-8000-a00000000018',1,now() - interval '10 days',now() - interval '10 days'),
  ('eeee0000-0000-4000-8000-f00000100012','eeee0000-0000-4000-8000-e00000000005','eeee0000-0000-4000-8000-a00000000005',1,now() - interval '1 days',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000100013','eeee0000-0000-4000-8000-e00000000005','eeee0000-0000-4000-8000-a00000000010',1,now() - interval '4 days',now() - interval '4 days'),
  ('eeee0000-0000-4000-8000-f00000100014','eeee0000-0000-4000-8000-e00000000005','eeee0000-0000-4000-8000-a00000000015',1,now() - interval '7 days',now() - interval '7 days'),
  ('eeee0000-0000-4000-8000-f00000100015','eeee0000-0000-4000-8000-e00000000005','eeee0000-0000-4000-8000-a00000000020',1,now() - interval '10 days',now() - interval '10 days'),
  ('eeee0000-0000-4000-8000-f00000100016','eeee0000-0000-4000-8000-e00000000008','eeee0000-0000-4000-8000-a00000000008',1,now() - interval '1 days',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000100017','eeee0000-0000-4000-8000-e00000000008','eeee0000-0000-4000-8000-a00000000013',1,now() - interval '4 days',now() - interval '4 days'),
  ('eeee0000-0000-4000-8000-f00000100018','eeee0000-0000-4000-8000-e00000000008','eeee0000-0000-4000-8000-a00000000018',1,now() - interval '7 days',now() - interval '7 days'),
  ('eeee0000-0000-4000-8000-f00000100019','eeee0000-0000-4000-8000-e00000000008','eeee0000-0000-4000-8000-a00000000023',1,now() - interval '10 days',now() - interval '10 days'),
  ('eeee0000-0000-4000-8000-f00000100020','eeee0000-0000-4000-8000-e00000000011','eeee0000-0000-4000-8000-a00000000011',1,now() - interval '1 days',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000100021','eeee0000-0000-4000-8000-e00000000011','eeee0000-0000-4000-8000-a00000000016',1,now() - interval '4 days',now() - interval '4 days'),
  ('eeee0000-0000-4000-8000-f00000100022','eeee0000-0000-4000-8000-e00000000011','eeee0000-0000-4000-8000-a00000000021',1,now() - interval '7 days',now() - interval '7 days'),
  ('eeee0000-0000-4000-8000-f00000100023','eeee0000-0000-4000-8000-e00000000011','eeee0000-0000-4000-8000-a00000000026',1,now() - interval '10 days',now() - interval '10 days'),
  ('eeee0000-0000-4000-8000-f00000100024','eeee0000-0000-4000-8000-e00000000015','eeee0000-0000-4000-8000-a00000000015',1,now() - interval '1 days',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000100025','eeee0000-0000-4000-8000-e00000000015','eeee0000-0000-4000-8000-a00000000020',1,now() - interval '4 days',now() - interval '4 days'),
  ('eeee0000-0000-4000-8000-f00000100026','eeee0000-0000-4000-8000-e00000000015','eeee0000-0000-4000-8000-a00000000025',1,now() - interval '7 days',now() - interval '7 days'),
  ('eeee0000-0000-4000-8000-f00000100027','eeee0000-0000-4000-8000-e00000000015','eeee0000-0000-4000-8000-a00000000000',1,now() - interval '10 days',now() - interval '10 days'),
  ('eeee0000-0000-4000-8000-f00000100028','eeee0000-0000-4000-8000-e00000000017','eeee0000-0000-4000-8000-a00000000017',1,now() - interval '1 days',now() - interval '1 days'),
  ('eeee0000-0000-4000-8000-f00000100029','eeee0000-0000-4000-8000-e00000000017','eeee0000-0000-4000-8000-a00000000022',1,now() - interval '4 days',now() - interval '4 days'),
  ('eeee0000-0000-4000-8000-f00000100030','eeee0000-0000-4000-8000-e00000000017','eeee0000-0000-4000-8000-a00000000027',1,now() - interval '7 days',now() - interval '7 days'),
  ('eeee0000-0000-4000-8000-f00000100031','eeee0000-0000-4000-8000-e00000000017','eeee0000-0000-4000-8000-a00000000002',1,now() - interval '10 days',now() - interval '10 days')
on conflict do nothing;

-- ── 7. Uma pausada e uma encerrada ─────────────────────────────────────
-- Por último, de propósito: enquanto elas estavam ativas foi possível
-- gravar as candidaturas acima. Assim a dona vê como fica uma vaga com
-- gente dentro que depois saiu do ar.
update public.job_listings set status = 'paused'
 where id = 'eeee0000-0000-4000-8000-e00000000004';
update public.job_listings set status = 'closed', closed_at = now() - interval '2 days'
 where id = 'eeee0000-0000-4000-8000-e00000000014';

-- ── Confere a si mesma ─────────────────────────────────────────────────
select case
  when (select count(*) from public.professionals where id::text like 'eeee0000%') >= 30
   and (select count(*) from public.companies     where id::text like 'eeee0000%') >= 8
   and (select count(*) from public.job_listings  where id::text like 'eeee0000%') >= 20
  then 'PRONTO — ' ||
       (select count(*) from public.professionals where id::text like 'eeee0000%')::text || ' candidatos, ' ||
       (select count(*) from public.companies     where id::text like 'eeee0000%')::text || ' empresas e ' ||
       (select count(*) from public.job_listings  where id::text like 'eeee0000%')::text || ' vagas de teste no app'
  else 'AINDA FALTA — confira os comandos acima'
  end as resultado;
