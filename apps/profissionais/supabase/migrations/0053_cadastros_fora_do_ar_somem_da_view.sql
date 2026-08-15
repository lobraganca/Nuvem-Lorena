-- --------------------------------------------------------------------
-- Cadastro suspenso ou pausado volta a sumir da busca pública.
--
-- A 0009 tirou os suspensos da leitura pública com uma policy de RLS:
-- `using (suspended = false)` em `professionals`. A policy está lá e está
-- certa — mas o app não lê a tabela, lê a view `professionals_public`. E
-- view no Postgres roda com os privilégios de quem a criou, não de quem a
-- consulta: ela passa por cima da RLS da tabela de origem. É o mesmo aviso
-- que o painel do Supabase mostra como "Security Definer View".
--
-- Por isso a 0039 carregava o filtro dentro da própria view
-- (`where suspended = false and paused = false`), compensando à mão o que
-- a RLS não conseguia aplicar ali.
--
-- A 0049 recriou a view inteira para esconder o bairro de quem não marcou
-- "mostrar endereço" — e o comentário dela diz "colunas idênticas às da
-- 0039, exceto neighborhood". As colunas eram; o `where` não veio junto.
-- Desde então:
--
--   * cadastro suspenso pela administração continuava aparecendo na busca
--     e na página pública, junto com o `suspended_reason` — que é anotação
--     interna e pode conter a acusação que motivou a suspensão;
--   * cadastro pausado pelo próprio dono continuava no ar, contrariando o
--     que a tela dele prometia.
--
-- Nenhum dos dois dava erro em lugar nenhum, porque o app pede a lista e a
-- lista vem. Só olhando a definição da view dá para ver o que sumiu.
--
-- O filtro volta para dentro da view. O painel administrativo, que precisa
-- justamente ver os suspensos, passa a ler a tabela `professionals` direto
-- — lá a RLS deixa admin ver tudo (policy da 0009) e recusa o resto, então
-- essa porta falha fechada para quem não é admin.
-- --------------------------------------------------------------------
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  case when mostrar_endereco then neighborhood end as neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;
