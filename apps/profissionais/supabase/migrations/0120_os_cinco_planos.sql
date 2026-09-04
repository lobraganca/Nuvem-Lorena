-- ══════════════════════════════════════════════════════════════════════
-- 0120 — OS PLANOS NOVOS: EI COMEÇO, CONECTA, ONDA, IMPULSO, MÁXIMO
-- ══════════════════════════════════════════════════════════════════════
--
-- ── O QUE MUDA ────────────────────────────────────────────────────────
--
--   Ei Começo     0 vagas    R$ 0,00      (não é plano no banco: é `null`)
--   Ei Conecta    1 vaga     R$ 29,90     plano = 'pro'
--   Ei Onda       3 vagas    R$ 59,90     plano = 'tres'
--   Ei Impulso    5 vagas    R$ 89,90     plano = 'cinco'      ← novo
--   Ei Máximo    10 vagas    R$ 129,90    plano = 'dez'        ← novo
--   Ei Infinit    combinado  sob consulta plano = 'ilimitado'
--
-- ── POR QUE AS PALAVRAS DO BANCO NÃO MUDAM ────────────────────────────
--
-- 'pro', 'tres' e 'ilimitado' continuam sendo o que está gravado em
-- `companies.plano`. Renomeá-las para 'conecta', 'onda' e 'infinit'
-- obrigaria a reescrever TODAS as linhas existentes, mais o gatilho, mais
-- a política — e qualquer erro no meio desse caminho tira do ar as
-- empresas que já pagaram.
--
-- O nome que a empresa lê é do app, não do banco. O que o banco precisa
-- saber é quantas vagas cada plano permite, e é só isso que muda aqui:
-- duas palavras novas ('cinco', 'dez') e o teto de cada uma.
--
-- Quem já tem plano não é tocado por nada disto: 'pro' continua valendo
-- 1 vaga e 'tres' continua valendo 3.
--
-- ── ISTO NÃO ALCANÇA O PROCURÔ ────────────────────────────────────────
--
-- Bancos diferentes: o Ei é o `ahigenhenzmsjxlmrzhz`, o procurô é o
-- `dfdinrimxqoqjedemjbw`. Esta SQL roda só no do Ei.
--
-- ══════════════════════════════════════════════════════════════════════

-- ── Parte 1 — o banco passa a aceitar as duas palavras novas ──────────
--
-- Sem isto, ligar o Impulso ou o Máximo pelo painel administrativo é
-- recusado pela trava da 0072, com uma mensagem que não explica nada.

alter table public.companies
  drop constraint if exists companies_plano_check;

alter table public.companies
  add constraint companies_plano_check
  check (plano is null or plano in ('pro', 'tres', 'cinco', 'dez', 'ilimitado'));

-- ── Parte 2 — o teto de vagas de cada plano ───────────────────────────
--
-- Mesma função da 0107, com os dois degraus novos no meio. A ordem
-- (`max`) é a do VALOR do plano, e só depois é traduzida para o teto:
-- pegar o maior teto direto daria errado justamente no melhor plano,
-- porque o sem teto é `-1` — o MENOR número da lista.

create or replace function public.limite_de_vagas_do_plano(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select case coalesce(
           (select max(
                     case
                       when c.plano_ate is null or c.plano_ate < now() then 0
                       when c.plano = 'ilimitado' then 5
                       when c.plano = 'dez' then 4
                       when c.plano = 'cinco' then 3
                       when c.plano = 'tres' then 2
                       when c.plano = 'pro' then 1
                       else 0
                     end)
              from public.companies c
             where c.owner_id = (select owner_id from public.companies
                                  where id = p_company_id)),
           0)
         when 5 then -1   -- Ei Infinit: combinado caso a caso, sem teto
         when 4 then 10   -- Ei Máximo
         when 3 then 5    -- Ei Impulso
         when 2 then 3    -- Ei Onda
         when 1 then 1    -- Ei Conecta
         else 0           -- Ei Começo, ou plano vencido
       end;
$$;

-- ── Confere a si mesma ────────────────────────────────────────────────
-- Lê `pg_catalog`, nunca `information_schema`: o `information_schema`
-- filtra por privilégio do papel corrente e o editor do painel não roda
-- como dono — ele já respondeu "não existe" cinco vezes para uma coluna
-- que estava lá.
--
-- Confere as DUAS coisas: a trava aceitando as palavras novas, e a função
-- já reescrita com elas. Só a trava passaria com o teto antigo, e o
-- Impulso ligaria valendo zero vaga.

select case
  when (select count(*) from pg_constraint
         where conrelid = 'public.companies'::regclass
           and conname = 'companies_plano_check'
           and pg_get_constraintdef(oid) like '%cinco%'
           and pg_get_constraintdef(oid) like '%dez%') = 1
   and (select count(*) from pg_proc
         where proname = 'limite_de_vagas_do_plano'
           and prosrc like '%when 4 then 10%') = 1
  then 'PRONTO — os cinco planos valem no banco: 1, 3, 5, 10 e sem teto.'
  else 'AINDA FALTA — a trava ou o teto de vagas não entrou. Rode o bloco de novo.'
end as resultado;
