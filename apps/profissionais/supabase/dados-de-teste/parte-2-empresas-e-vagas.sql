-- PARTE 2 de 3 — 6 empresas e 12 vagas
-- Rode a Parte 1 antes desta.

insert into public.companies
  (id, owner_id, company_name, city, uf, neighborhood, phone,
   responsible_name, description, phone_verified,
   plano, plano_ate, plano_desde, contrata_pcd, created_at)
select ('eeee0000-0000-4000-8000-d000000000' || lpad(i::text, 2, '0'))::uuid,
       ('eeee0000-0000-4000-8000-a000000000' || lpad((24 + i)::text, 2, '0'))::uuid,
       nome, cidade, 'MG', bairro, '3190000' || lpad((100 + i)::text, 4, '0'),
       'Responsável ' || split_part(nome, ' ', 1), sobre, true,
       plano, now() + interval '60 days', now() - interval '30 days',
       i % 2 = 0, now() - ((40 - i) || ' days')::interval
from (values
 (1,'Supermercado Boa Compra','Praia','Supermercado com 4 caixas e entrega no bairro.','cinco','Itabirito'),
 (2,'Padaria Pão de Minas','Centro','Padaria de bairro, aberta desde 1998.','tres','Itabirito'),
 (3,'Construtora Serra Alta','Nova Itabirito','Obras residenciais e reformas na região.','dez','Itabirito'),
 (4,'Pousada Recanto da Serra','Vila Rica','Pousada com 14 quartos, aberta o ano todo.','tres','Itabirito'),
 (5,'Restaurante Sabor Mineiro','Centro','Comida caseira, almoço executivo e marmitex.','cinco','Itabirito'),
 (6,'Transportadora Caminho Certo','Centro','Transporte de carga na região metropolitana.','ilimitado','Ouro Preto')
) as e(i, nome, bairro, sobre, plano, cidade)
on conflict (id) do nothing;

-- As vagas nascem TODAS ativas: o gatilho da 0073 confere o teto do plano
-- na criação, e o da 0080 recusa candidatura em vaga que não está ativa.
-- Pausar e encerrar é o último passo da Parte 3.
insert into public.job_listings
  (id, company_id, title, profession, description, required_experience,
   work_modality, city, uf, neighborhood, status, tipo_contrato, jornada,
   beneficios, quantidade_vagas, escolaridade_minima,
   salary_range_min, salary_range_max, salario_a_combinar, salario_periodo,
   aceita_primeiro_emprego, vaga_para_pcd, available_immediately,
   anunciada_ate, created_at)
select ('eeee0000-0000-4000-8000-e000000000' || lpad(i::text, 2, '0'))::uuid,
       ('eeee0000-0000-4000-8000-d000000000' || lpad(emp::text, 2, '0'))::uuid,
       titulo, prof, texto,
       case when prim then null else '1 ano' end,
       'presencial', cidade, 'MG', bairro, 'active', contrato, jornada,
       benef, qtd, escol,
       smin, smax, smin is null, per,
       prim, pcd, i % 4 = 0,
       now() + interval '25 days', now() - (i || ' days')::interval
from (values
 ( 1,1,'Repositor de mercadorias','Repositor','Reposição de gôndolas, validade e organização do estoque.','clt','integral',array['Vale-transporte','Vale-alimentação'],3,'fundamental',1518::numeric,1800::numeric,'mes',false,false,'Itabirito','Praia'),
 ( 2,1,'Operador de caixa','Operador de caixa','Atendimento no caixa, abertura, fechamento e conferência.','clt','integral',array['Vale-transporte'],2,'medio',1518::numeric,1650::numeric,'mes',true,false,'Itabirito','Praia'),
 ( 3,1,'Auxiliar de limpeza para o setor de hortifruti do supermercado','Auxiliar de limpeza','Limpeza do salão de vendas e do setor de hortifruti.','clt','integral',array['Vale-transporte','Cesta básica'],1,null,1518::numeric,null::numeric,'mes',true,true,'Itabirito','Praia'),
 ( 4,2,'Padeiro','Padeiro','Produção de pão francês, doces e salgados. Início às 4h.','clt','integral',array['Vale-transporte','Vale-alimentação'],1,'fundamental',2200::numeric,2800::numeric,'mes',false,false,'Itabirito','Centro'),
 ( 5,2,'Atendente de balcão','Atendente','Atendimento no balcão, montagem de vitrine e caixa.','clt','meio_periodo',array['Vale-transporte'],2,'medio',1100::numeric,null::numeric,'mes',true,false,'Itabirito','Centro'),
 ( 6,3,'Pedreiro de acabamento','Pedreiro','Assentamento de piso, revestimento e reboco em obra no Centro.','diaria','integral',array['Vale-transporte','Almoço no local'],4,null,180::numeric,250::numeric,'dia',false,false,'Itabirito','Centro'),
 ( 7,3,'Servente de obra','Servente','Apoio geral em obra, carga de material e limpeza do canteiro.','diaria','integral',array['Almoço no local'],6,null,150::numeric,null::numeric,'dia',true,false,'Itabirito','Centro'),
 ( 8,3,'Eletricista predial','Eletricista','Instalação elétrica em prédio de 4 andares. NR-10 exigida.','freelance','integral',array[]::text[],1,'medio',3200::numeric,4000::numeric,'mes',false,false,'Itabirito','Nova Itabirito'),
 ( 9,4,'Camareira','Camareira','Arrumação de quartos, rouparia e apoio ao café da manhã.','clt','turnos',array['Vale-transporte','Almoço no local'],2,'fundamental',1518::numeric,null::numeric,'mes',true,false,'Itabirito','Vila Rica'),
 (10,5,'Cozinheira','Cozinheira','Preparo do almoço executivo e das marmitas, de segunda a sábado.','clt','integral',array['Vale-transporte','Almoço no local'],1,'fundamental',2100::numeric,2500::numeric,'mes',false,false,'Itabirito','Centro'),
 (11,5,'Garçom / garçonete','Garçom','Atendimento no salão no horário do almoço e em eventos.','clt','meio_periodo',array['Vale-transporte','Gorjeta'],3,null,1200::numeric,null::numeric,'mes',true,false,'Itabirito','Centro'),
 (12,6,'Motorista entregador','Motorista','Entrega de carga na região metropolitana. CNH D obrigatória.','clt','integral',array['Vale-transporte','Seguro de vida'],2,'medio',2600::numeric,3200::numeric,'mes',false,false,'Ouro Preto','Centro')
) as v(i, emp, titulo, prof, texto, contrato, jornada, benef, qtd, escol,
       smin, smax, per, prim, pcd, cidade, bairro)
on conflict (id) do nothing;

select 'PRONTO — Parte 2: ' ||
       (select count(*) from public.companies where id::text like 'eeee0000%')::text ||
       ' empresas e ' ||
       (select count(*) from public.job_listings where id::text like 'eeee0000%')::text ||
       ' vagas' as resultado;
