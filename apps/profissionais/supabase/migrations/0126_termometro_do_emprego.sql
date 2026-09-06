-- 0126 — O termômetro do emprego: o que a cidade está contratando.
--
-- A dona: "criar TERMÔMETRO DO EMPREGO. O app poderia mostrar: o que está
-- contratando em Itabirito? Vendas ↑, Construção ↑, Administrativo →,
-- Serviços ↑, Tecnologia ↑."
--
-- ── O QUE ESTA FUNÇÃO DEVOLVE, E O QUE ELA NÃO DEVOLVE ────────────────
--
-- Uma linha por PROFISSÃO, com dois números: quantas vagas nos últimos N
-- dias e quantas nos N dias anteriores a esses. A seta sai da comparação
-- entre os dois, e quem a calcula é o app.
--
-- Não sai daqui: id, título, empresa, salário, bairro, nem data de vaga
-- nenhuma. Só a palavra da profissão e duas contagens. É o suficiente
-- para a tela e é o mínimo que ela precisa — e a diferença importa,
-- porque este número é público e vai ser lido por quem não tem conta.
--
-- ── POR QUE PRECISA SER FUNÇÃO ────────────────────────────────────────
--
-- Pela política da 0067, quem não é dono da empresa só lê vaga ATIVA. Uma
-- vaga de 45 dias atrás já está fechada — e é justamente ela que forma a
-- metade "antes" da comparação. Sem uma porta, o termômetro só enxergaria
-- o presente, e um termômetro sem passado não tem o que comparar.
--
-- Abrir a leitura das vagas encerradas para todo mundo resolveria e
-- custaria caro demais: entregaria o texto, o salário e a empresa de cada
-- vaga que já passou pelo app.
--
-- ── OS SETORES NÃO SÃO DECIDIDOS AQUI, DE PROPÓSITO ───────────────────
--
-- "Vendas", "Construção", "Administrativo" são grupos de profissões, e o
-- app já tem esse agrupamento escrito uma vez — o dicionário de ofícios
-- de `sinonimosDeOficio.ts` (06/09), que sabe que "atendente de loja" e
-- "vendedor" são a mesma coisa.
--
-- Repetir esse agrupamento em SQL criaria duas listas para manter, e o
-- dia em que elas discordassem o termômetro diria uma coisa e a onda de
-- vagas outra, sobre os mesmos dados. Então aqui saem as profissões cruas
-- e o app agrupa, com a lista que ele já tem.
--
-- ── A JANELA ──────────────────────────────────────────────────────────
--
-- `p_dias` é metade da janela: com 30, compara os últimos 30 dias com os
-- 30 anteriores. Sai como parâmetro porque numa cidade pequena 30 dias
-- pode ser pouca vaga para dizer qualquer coisa, e trocar para 60 tem de
-- ser uma linha no app, não uma migration nova.
--
-- `created_at` e não `anunciada_ate`: a pergunta é "quando esta vaga
-- APARECEU", e não até quando ela ficou no ar. Vaga que a empresa pausou
-- no dia seguinte continua contando — ela existiu, e existir é o que o
-- termômetro mede.

create or replace function public.termometro_do_emprego(
  p_dias int default 30,
  p_cidade text default null
)
returns table (profissao text, agora int, antes int)
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select
    btrim(j.profession) as profissao,
    count(*) filter (
      where j.created_at >= now() - make_interval(days => p_dias)
    )::int as agora,
    count(*) filter (
      where j.created_at <  now() - make_interval(days => p_dias)
        and j.created_at >= now() - make_interval(days => p_dias * 2)
    )::int as antes
  from public.job_listings j
  where j.created_at >= now() - make_interval(days => p_dias * 2)
    -- Vaga sem profissão escrita não vira linha "Sem profissão" na tela:
    -- ela simplesmente não conta. Um setor chamado "sem profissão"
    -- subindo de 2 para 5 não informa nada a ninguém.
    and coalesce(btrim(j.profession), '') <> ''
    -- Cidade: nulo quer dizer "a cidade toda", e é assim que a tela
    -- chama hoje. Comparação simples porque cidade vem de uma lista
    -- fechada no formulário — não é texto que cada um escreve do seu
    -- jeito.
    and (p_cidade is null or lower(btrim(j.city)) = lower(btrim(p_cidade)))
  group by 1
$$;

-- `anon` também: o termômetro é a parte do app feita para ser vista de
-- fora, inclusive por quem nunca criou conta. É ele que dá motivo para
-- criar uma.
revoke all on function public.termometro_do_emprego(int, text) from public;
grant execute on function public.termometro_do_emprego(int, text) to anon, authenticated;

-- ── Confere a si mesma ────────────────────────────────────────────────
-- Lê o `pg_catalog`, nunca o `information_schema`. É o último comando do
-- arquivo de propósito: a dona lê o resultado do último.
select case
  when (select count(*) from pg_proc
         where proname = 'termometro_do_emprego'
           and pronamespace = 'public'::regnamespace) = 1
  then 'PRONTO — o termometro ja tem os numeros ('
       || (select coalesce(sum(agora), 0) from public.termometro_do_emprego(30))::text
       || ' vagas nos ultimos 30 dias)'
  else 'AINDA FALTA — a funcao nao foi criada'
end as resultado;
