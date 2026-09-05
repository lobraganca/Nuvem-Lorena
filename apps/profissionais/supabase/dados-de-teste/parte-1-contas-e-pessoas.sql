-- PARTE 1 de 3 — as contas e as 24 pessoas
-- Cole tudo, sem selecionar nada antes de clicar em Run.

insert into auth.users (id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data,
                        phone, phone_confirmed_at)
select ('eeee0000-0000-4000-8000-a000000000' || lpad(i::text, 2, '0'))::uuid,
       'authenticated', 'authenticated', 'teste' || i || '@eiemprego.teste', '',
       now(), now(), now(), '{"provider":"phone"}'::jsonb, '{}'::jsonb,
       '+55319000000' || lpad(i::text, 2, '0'), now()
from generate_series(1, 30) i
on conflict (id) do nothing;

insert into public.profiles (id)
select id from auth.users where id::text like 'eeee0000%'
on conflict (id) do nothing;

insert into public.professionals
  (id, owner_id, name, category, categories, areas_de_interesse, bio,
   city, uf, neighborhood, phone, whatsapp, entity_type, contact_mode,
   disponivel, primeiro_emprego, pcd, pretensao_centavos, pretensao_periodo,
   inicio_imediato, fim_de_semana, cnh, created_at)
select ('eeee0000-0000-4000-8000-c000000000' || lpad(i::text, 2, '0'))::uuid,
       ('eeee0000-0000-4000-8000-a000000000' || lpad(i::text, 2, '0'))::uuid,
       nome, cat, array[f1, f2], array[f1, f2], resumo,
       cidade, 'MG', bairro,
       '31900000' || lpad(i::text, 3, '0'),
       '31900000' || lpad(i::text, 3, '0'),
       'pf', 'whatsapp_livre',
       true, i in (7, 19), i in (5, 16),
       case when i % 4 = 0 then null else 150000 + i * 12000 end, 'mes',
       i % 3 = 0, i % 4 = 0, i % 5 = 0,
       now() - (i || ' days')::interval
from (values
 ( 1,'Ana Cláudia Ferreira','limpeza','Diarista','Passadeira','Limpeza residencial há 12 anos. Tenho referências no Centro.','Itabirito','Centro'),
 ( 2,'Marcos Vinícius de Oliveira Santana Nascimento','construcao','Pedreiro','Azulejista','Pedreiro de acabamento: reboco, piso e revestimento.','Itabirito','Praia'),
 ( 3,'Joana Silva','cuidados','Cuidadora de idosos','Babá','Curso de primeiros socorros. Disponível para plantão noturno.','Itabirito','Vila Rica'),
 ( 4,'Rafael Andrade','logistica','Motorista','Entregador','CNH categoria D. Seis anos com entrega de carga na região.','Itabirito','Centro'),
 ( 5,'Beatriz Nogueira','alimentacao','Cozinheira','Confeiteira','Cozinho para restaurante e evento. Curso de manipulação.','Itabirito','Água Limpa'),
 ( 6,'Carlos Eduardo Pinto','comercio','Vendedor','Operador de caixa','Vendas em loja de material de construção.','Itabirito','Centro'),
 ( 7,'Luana Martins','beleza','Manicure','Cabeleireira','Atendo em salão e a domicílio. Alongamento em gel.','Itabirito','Praia'),
 ( 8,'Pedro Henrique Rocha','construcao','Eletricista','Ajudante geral','Instalação elétrica residencial e predial. NR-10 em dia.','Itabirito','Bela Vista'),
 ( 9,'Fernanda Costa','administrativo','Recepcionista','Auxiliar administrativo','Pacote Office. Trabalhei em clínica e escritório contábil.','Itabirito','Centro'),
 (10,'Wesley Aparecido de Souza','mineracao','Operador de máquinas','Mecânico','Operador de escavadeira. Experiência em mineradora.','Itabirito','Nova Itabirito'),
 (11,'Priscila Ramos','saude','Técnica de enfermagem','Cuidadora de idosos','COREN ativo. Pronto atendimento e home care.','Itabirito','Centro'),
 (12,'Diego Alves','construcao','Pintor','Gesseiro','Pintura residencial, textura e massa corrida.','Itabirito','Santa Efigênia'),
 (13,'Camila Duarte','educacao','Professora','Monitora','Licenciatura em Pedagogia. Reforço do 1º ao 5º ano.','Itabirito','Centro'),
 (14,'Jonas Ribeiro','seguranca','Porteiro','Vigia','Curso de vigilante atualizado. Aceito escala 12x36.','Itabirito','Praia'),
 (15,'Tatiane Moreira','limpeza','Camareira','Auxiliar de limpeza','Trabalhei em pousada por 4 anos.','Itabirito','Vila Rica'),
 (16,'Gustavo Lima','automotivo','Mecânico','Lanterneiro','Mecânica de linha leve, injeção e suspensão.','Itabirito','Água Limpa'),
 (17,'Vanessa Cristina Gonçalves','alimentacao','Garçonete','Atendente','Atendimento em bar e restaurante, inclusive fim de semana.','Itabirito','Centro'),
 (18,'Roberto Machado','construcao','Carpinteiro','Marceneiro','Móveis planejados e estrutura de telhado.','Itabirito','Bela Vista'),
 (19,'Elaine Barbosa','costura','Costureira','Passadeira','Costura em geral e sob medida. Máquina própria.','Itabirito','Centro'),
 (20,'Thiago Nunes','tecnologia','Técnico de informática','Ajudante geral','Manutenção de computador, rede e câmeras.','Itabirito','Praia'),
 (21,'Simone Teixeira','cuidados','Babá','Cuidadora de idosos','Experiência com criança de 0 a 6 anos. Referências.','Ouro Preto','Centro'),
 (22,'Anderson Cardoso','logistica','Ajudante de carga','Estoquista','Carga, descarga e organização de estoque.','Ouro Preto','Bauxita'),
 (23,'Larissa Pereira','comercio','Vendedora','Promotora','Loja de roupa e perfumaria. Metas batidas todo mês.','Congonhas','Centro'),
 (24,'Michel dos Santos','jardinagem','Jardineiro','Ajudante geral','Poda, corte de grama e manutenção de área verde.','Itabirito','Nova Itabirito')
) as p(i, nome, cat, f1, f2, resumo, cidade, bairro)
on conflict (id) do nothing;

-- O gatilho da 0024 força `whatsapp_verified = false` em todo insert, e é
-- o que faz os cadastros aparecerem na busca. Sem este passo, as 24
-- pessoas existem e NÃO aparecem em lugar nenhum.
select set_config('app.confirmando_whatsapp', 'sim', false);
update public.professionals
   set whatsapp_verified = true, whatsapp_verified_at = now()
 where id::text like 'eeee0000%';
select set_config('app.confirmando_whatsapp', '', false);

-- Três em destaque (a área "Em alta"), e uma com o destaque já vencido,
-- que tem de sumir de lá sozinha.
update public.professionals set boosted = true, boosted_until = now() + interval '20 days'
 where id::text like 'eeee0000-0000-4000-8000-c00000000%' and right(id::text, 2) in ('02','07','14');
update public.professionals set boosted = true, boosted_until = now() - interval '3 days'
 where right(id::text, 2) = '21' and id::text like 'eeee0000%';

select 'PRONTO — Parte 1: ' ||
       (select count(*) from public.professionals where id::text like 'eeee0000%')::text ||
       ' pessoas no banco de talentos' as resultado;
