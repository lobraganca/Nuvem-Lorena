-- --------------------------------------------------------------------
-- Cada pessoa pode descobrir se ela mesma é admin.
--
-- A tabela `admins` foi criada (0008) com RLS ligada e sem nenhuma policy
-- de select — de propósito, para ninguém se auto-promover. Só que o app
-- descobre quem é admin justamente lendo esta tabela (`isAdmin`), do
-- navegador, com o papel `authenticated`. Sem policy de leitura, essa
-- consulta volta vazia mesmo para quem tem a linha, e o painel responde
-- "Acesso restrito." para todo mundo — inclusive para a dona do app.
--
-- A falha ficou invisível porque `isAdmin` trata erro e vazio da mesma
-- forma ("não é admin"), que é o certo para a tela e péssimo para
-- diagnosticar: não havia diferença entre "não tem permissão" e "não é
-- admin".
--
-- A policy abaixo é a menor que resolve: cada um lê a PRÓPRIA linha e
-- nada mais. Não devolve a lista de admins a ninguém, e continua não
-- existindo insert/update/delete — promover alguém segue sendo coisa de
-- dentro do Supabase, como era a intenção da 0008.
-- --------------------------------------------------------------------

-- Nome sem acento, sem espaço e sem aspas, ao contrário do resto do
-- projeto: este bloco precisou ser colado à mão várias vezes no SQL
-- Editor até funcionar, e nome entre aspas é frágil no caminho até lá —
-- basta um aplicativo trocar as aspas retas por curvas para o Postgres
-- recusar. Aqui vale mais colar certo de primeira do que ler bonito.
drop policy if exists "cada um enxerga se é admin" on public.admins;
drop policy if exists cada_um_enxerga_se_e_admin on public.admins;
create policy cada_um_enxerga_se_e_admin
  on public.admins for select
  to authenticated
  using (user_id = auth.uid());

-- O Supabase já concede isto por padrão nas tabelas de `public`; repetido
-- aqui para o caso de a concessão ter sido revogada em algum momento — sem
-- ela, a policy sozinha não bastaria.
grant select on public.admins to authenticated;
