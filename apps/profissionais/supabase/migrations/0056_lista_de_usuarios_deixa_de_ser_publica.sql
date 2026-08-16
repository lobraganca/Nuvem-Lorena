-- --------------------------------------------------------------------
-- `profiles_public` entregava a lista de todo mundo que tem conta.
--
-- A 0012 criou esta view para um fim estreito: mostrar o nome e a foto de
-- quem escreveu uma avaliação, sem expor o CPF que a tabela `profiles`
-- guardava. Ela resolveu o vazamento do CPF e deixou outro no lugar, menor
-- e mais silencioso:
--
--   create or replace view public.profiles_public as
--     select id, full_name, avatar_url, created_at from public.profiles;
--   grant select on public.profiles_public to anon, authenticated;
--
-- Sem `where`, com grant para `anon`. View não obedece RLS — roda com os
-- direitos de quem a criou. Então qualquer pessoa com a chave pública do
-- app baixava, numa consulta, o nome completo e a foto de **todas** as
-- contas: inclusive de quem só entrou para procurar um eletricista e nunca
-- se cadastrou como profissional. Numa cidade onde as pessoas se conhecem,
-- essa lista é mais sensível do que parece — ela diz quem usa o app.
--
-- Ninguém precisava desse acesso direto. O único consumidor é a view
-- `reviews_public` (0037), que junta perfil com avaliação. E ela também
-- roda com os direitos da dona, de propósito e documentado lá: é isso que
-- faz o nome do autor chegar a quem lê a página de um profissional. Ou
-- seja, tirar o grant não muda nada na tela — as avaliações continuam
-- aparecendo com nome e foto, porque nunca foi por aqui que elas passavam.
--
-- O que deixa de ser possível é pedir a lista inteira.
-- --------------------------------------------------------------------
revoke select on public.profiles_public from anon, authenticated;

comment on view public.profiles_public is
  'Uso interno: alimenta reviews_public (que roda com direitos da dona). Não conceder select a anon/authenticated — sem where, a view devolve todas as contas.';
