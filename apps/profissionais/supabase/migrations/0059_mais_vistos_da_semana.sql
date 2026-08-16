-- --------------------------------------------------------------------
-- "Em alta em Itabirito": quem foi mais procurado nos últimos dias.
--
-- A tela inicial passou a mostrar gente antes de a pessoa pedir — em vez
-- de só oferecer categorias e esperar. Para isso precisa de uma ordem que
-- signifique alguma coisa, e a que existe hoje não serve: nota alta com uma
-- avaliação só não diz nada, e "mais recente" é o oposto de popular.
--
-- Quem foi visto é o sinal honesto disponível: não depende de ninguém
-- escrever avaliação, e acompanha o que a cidade está de fato procurando
-- nesta semana.
--
-- O problema é que `profile_views` não é pública, e por bons motivos. A
-- 0012 restringiu a leitura ao dono de cada cadastro, e a 0042 explicou por
-- quê ao criar `contagem_de_visitas()`: o total somado da cidade não é o
-- mesmo dado que a linha individual, mesmo saindo da mesma tabela.
--
-- Esta função segue o mesmo raciocínio, com três cuidados:
--
-- 1. **Devolve a ordem, não os números.** Nenhuma contagem sai daqui. Dizer
--    "fulano teve 47 visitas" entregaria de graça exatamente o número que o
--    Empresa Plus vende, e contaria ao concorrente da rua de baixo quanto
--    movimento cada um tem. A tela precisa saber quem vem primeiro; não
--    precisa saber por quanto.
--
-- 2. **Junta com `professionals_public`**, que já esconde suspenso e
--    pausado (0053). Sem essa junção, um cadastro tirado do ar pela
--    administração reapareceria em destaque na primeira tela do app — o
--    lugar mais visível que existe.
--
-- 3. **Exige um mínimo de acessos.** Com um acesso só, "em alta" é mentira.
--    Numa cidade pequena, sem esse piso, a prateleira viraria uma lista
--    aleatória de quem teve uma visita solta — e uma tela que promete
--    movimento e entrega acaso é pior que uma tela sem a prateleira.
-- --------------------------------------------------------------------
create or replace function public.mais_vistos(dias int default 7, quantos int default 12)
returns table (professional_id uuid)
language sql
stable
security definer set search_path = public
as $$
  select v.professional_id
    from public.profile_views v
    join public.professionals_public p on p.id = v.professional_id
   where v.viewed_at > now() - make_interval(days => dias)
   group by v.professional_id
  having count(*) >= 3
   order by count(*) desc, v.professional_id
   limit quantos;
$$;

grant execute on function public.mais_vistos(int, int) to anon, authenticated;

-- Índice pelo que a função filtra e agrupa. Sem ele, a consulta varre a
-- tabela de visitas inteira — que é a que mais cresce no banco — a cada
-- abertura da tela inicial, que é a tela mais aberta do app.
create index if not exists profile_views_recentes_idx
  on public.profile_views (viewed_at desc, professional_id);
