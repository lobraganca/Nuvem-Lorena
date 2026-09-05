-- ═══════════════════════════════════════════════════════════════════════
-- 0122 — O aviso pode ser excluído, e some sozinho depois de 15 dias
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "os avisos chegam e ficam pra sempre. Se a pessoa quiser
-- excluir, ter um aviso que esse chamado foi feito por compatibilidade, se
-- a pessoa quer mesmo excluir. Colocar uma regra que após 15 dias o aviso
-- some."
--
-- ── Os 15 dias não precisam do banco ──────────────────────────────────
--
-- São um FILTRO na consulta (`criado_em >= agora - 15 dias`), e não uma
-- faxina agendada. Duas razões, e a segunda é a que decide:
--
--   1. Apagar de verdade destruiria o alcance das empresas. A mesma linha
--      que é "o aviso que chegou para mim" é "quantas pessoas minha vaga
--      alcançou" do outro lado — apagar por idade mudaria, para trás, um
--      número que a empresa já leu.
--   2. Rotina agendada NÃO RODA neste repositório. O GitHub dispara os
--      workflows agendados a partir da branch PADRÃO, que está 226 commits
--      atrás e não tem os arquivos do Ei (está no CLAUDE.md). Uma faxina
--      diária seria escrita, commitada, e nunca executada — e o aviso
--      continuaria lá, com todo mundo achando que a regra existe.
--
-- Filtrando na consulta, a regra vale a partir do primeiro carregamento,
-- não depende de nada rodar, e é reversível numa linha.
--
-- ── O "excluir" ESCONDE, não apaga ────────────────────────────────────
--
-- Pelo mesmo motivo 1 acima. Para a pessoa é exclusão — sai da lista dela
-- e não volta nunca. Para a empresa, o alcance que ela já pagou continua
-- valendo. Apagar a linha faria uma pessoa mexer, sem saber, no número de
-- outra.
--
-- ── Por que a tela pergunta antes ─────────────────────────────────────
--
-- A dona pediu o aviso com todas as letras, e ele diz o que a pessoa
-- talvez não saiba: aquele aviso chegou porque o cadastro dela BATE com a
-- vaga. Quem exclui achando que é propaganda está jogando fora justamente
-- a vaga da própria profissão. A frase está na tela, não aqui.

-- ── 1. A coluna ────────────────────────────────────────────────────────
alter table public.job_notifications
  add column if not exists escondido_em timestamptz;

-- ── 2. O gatilho passa a deixar esconder ───────────────────────────────
-- Ele existe desde a 0074 e trava TUDO menos `visto_em`: a policy de
-- update diz quais LINHAS a pessoa pode mexer, nunca quais colunas. Sem
-- acrescentar `escondido_em` à lista do que pode mudar, o gatilho recusaria
-- a exclusão com "Só a data de visualização pode ser alterada aqui." — um
-- erro que na tela viraria "não consegui excluir", sem dizer por quê.
--
-- Repare que ele continua listando o que NÃO pode mudar: a vaga, o dono, a
-- onda e a data de envio. Escrito assim, coluna nova nasce permitida — foi
-- de propósito na 0074 e continua sendo.
create or replace function public.job_notifications_so_marca_visto()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() = old.professional_id then
    if new.job_listing_id is distinct from old.job_listing_id
       or new.professional_id is distinct from old.professional_id
       or new.wave is distinct from old.wave
       or new.enviado_em is distinct from old.enviado_em then
      raise exception 'Só a data de visualização e a de exclusão podem ser alteradas aqui.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists job_notifications_so_marca_visto_trigger on public.job_notifications;
create trigger job_notifications_so_marca_visto_trigger
  before update on public.job_notifications
  for each row execute function public.job_notifications_so_marca_visto();

-- ── 3. O índice que a lista usa ────────────────────────────────────────
-- A consulta passa a pedir "os meus, dos últimos 15 dias, não escondidos".
-- O índice da 0074 é (professional_id, criado_em desc) e já serve os dois
-- primeiros; este cobre o terceiro sem carregar as linhas escondidas.
create index if not exists job_notifications_visiveis_idx
  on public.job_notifications (professional_id, criado_em desc)
  where escondido_em is null;

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema.
select case
  when (select count(*) from pg_attribute
          where attrelid = 'public.job_notifications'::regclass
            and attname = 'escondido_em' and not attisdropped) = 1
   and (select count(*) from pg_indexes
          where schemaname = 'public'
            and indexname = 'job_notifications_visiveis_idx') = 1
  then 'PRONTO — dá para excluir um aviso, e os de mais de 15 dias somem da lista'
  else 'AINDA FALTA — confira os comandos acima'
  end as resultado;
