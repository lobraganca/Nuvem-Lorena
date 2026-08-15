-- --------------------------------------------------------------------
-- Visitas ao app no dia de hoje.
--
-- A 0048 já conta o total acumulado. Este é o par dele na tela de início:
-- o total diz que o app existe há um tempo, e o de hoje diz que ele está
-- vivo agora — um número alto de total com zero hoje conta uma história
-- bem diferente de dois números subindo juntos.
--
-- Vem por função, e não por consulta direta, pelo mesmo motivo da 0048:
-- `visitas_app` não tem select público (só admin). A tela precisa de um
-- número, não das linhas, e é só isso que a função devolve.
--
-- O dia é o de Itabirito, não o de Greenwich. `now()` no Postgres é UTC,
-- e usar `date_trunc('day', now())` faria o contador zerar às 21h no
-- horário de quem usa o app — três horas antes da virada, todo dia.
-- --------------------------------------------------------------------
create or replace function public.contagem_de_visitas_no_app_hoje()
returns bigint
language sql
security definer set search_path = public
as $$
  select count(*) from public.visitas_app
  where criada_em >= (date_trunc('day', now() at time zone 'America/Sao_Paulo')
                      at time zone 'America/Sao_Paulo');
$$;

grant execute on function public.contagem_de_visitas_no_app_hoje() to anon, authenticated;
