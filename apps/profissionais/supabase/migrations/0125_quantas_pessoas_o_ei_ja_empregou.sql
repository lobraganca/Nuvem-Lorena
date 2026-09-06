-- 0125 — Quantas pessoas o Ei Emprego já colocou para trabalhar.
--
-- ── O DADO JÁ ESTAVA SENDO COLETADO, E NINGUÉM VIA ────────────────────
--
-- Ao encerrar uma vaga em "Já contratei", o app pergunta desde a 0109:
--
--     "A pessoa que você contratou veio do Ei Emprego?"
--     "Quantas pessoas você contratou por esta vaga?"
--
-- As duas respostas são gravadas em `job_listings.contratou_por_aqui` e
-- `quantos_contratados`. Só que elas nunca saíram de lá: o único lugar do
-- app que lê essas colunas é o painel da administração.
--
-- É o número mais valioso que este app tem. Para a empresa que está
-- decidindo pagar, "37 pessoas contratadas por aqui" responde a única
-- pergunta que importa — isto funciona? Para quem procura emprego, é a
-- diferença entre preencher o cadastro inteiro e desistir na metade.
--
-- ── POR QUE UMA FUNÇÃO, E NÃO UMA CONSULTA DO APP ─────────────────────
--
-- A política da 0067 diz: qualquer um lê vaga ATIVA; o resto, só o dono
-- da empresa e a administração. E uma vaga que contratou está encerrada,
-- por definição — nunca está ativa.
--
-- Então o navegador não consegue contar isso, e não deve mesmo: abrir a
-- leitura das vagas encerradas para todo mundo entregaria junto o texto,
-- o salário e a empresa de cada vaga que já passou pelo app.
--
-- Uma função `security definer` devolve os DOIS NÚMEROS e mais nada. Não
-- há linha, id, empresa nem data no que sai daqui — não dá para descobrir
-- QUEM contratou quem, só quantos foram.
--
-- ── A REGRA DE CONTAGEM É A MESMA DO PAINEL ───────────────────────────
--
-- Empresa que respondeu "sim, veio do Ei" mas não disse quantas pessoas
-- conta como 1. É o que `adminEi.ts` já faz há semanas; duas contas
-- diferentes para o mesmo número seria o jeito mais silencioso de o
-- painel e o site discordarem, e nenhum dos dois estar errado.

create or replace function public.numeros_do_ei()
returns table (contratados int, vagas_que_contrataram int)
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select
    coalesce(sum(coalesce(j.quantos_contratados, 1)), 0)::int,
    count(*)::int
  from public.job_listings j
  where j.contratou_por_aqui = true;
$$;

-- `anon` também: o número aparece na tela inicial, que é a primeira coisa
-- que se vê — antes de entrar, e é justamente para quem ainda não entrou
-- que ele precisa falar.
revoke all on function public.numeros_do_ei() from public;
grant execute on function public.numeros_do_ei() to anon, authenticated;

-- ── Confere a si mesma ────────────────────────────────────────────────
-- Lê o `pg_catalog`, nunca o `information_schema`. É o último comando do
-- arquivo de propósito: a dona lê o resultado do último.
select case
  when (select count(*) from pg_proc
         where proname = 'numeros_do_ei'
           and pronamespace = 'public'::regnamespace) = 1
  then 'PRONTO — o site já pode mostrar quantas pessoas foram contratadas ('
       || (select contratados from public.numeros_do_ei())::text || ' hoje)'
  else 'AINDA FALTA — a função nao foi criada'
end as resultado;
