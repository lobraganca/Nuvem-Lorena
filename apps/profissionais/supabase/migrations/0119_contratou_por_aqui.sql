-- ══════════════════════════════════════════════════════════════════════
-- 0119 — "CONTRATOU POR AQUI?"
-- ══════════════════════════════════════════════════════════════════════
--
-- ── POR QUE ISTO EXISTE ───────────────────────────────────────────────
--
-- Hoje o app sabe quantas vagas foram publicadas, quantas pessoas se
-- interessaram e quantas abriram cada ficha. Não sabe a única coisa que
-- importa de verdade: SE ALGUÉM FOI CONTRATADO.
--
-- Sem esse número:
--
--   * não dá para dizer a uma empresa nova por que vale pagar — só se
--     promete movimento, não resultado;
--   * não dá para saber se o app está funcionando ou só parecendo
--     funcionar (lista cheia e ninguém empregado é o fracasso silencioso
--     mais fácil de não enxergar);
--   * não dá para responder à prefeitura, a um patrocinador ou a uma
--     entrevista quantos empregos saíram daqui.
--
-- A pergunta é feita no momento certo: quando a empresa toca em
-- "Já contratei — encerrar". Ela já está dizendo que contratou; falta só
-- perguntar se foi por aqui, e quantas pessoas.
--
-- ── DE PROPÓSITO, RESPONDER É OPCIONAL ────────────────────────────────
--
-- As duas colunas nascem NULAS e continuam nulas se a empresa fechar a
-- pergunta. Nulo quer dizer "não respondeu", que é diferente de "não
-- contratou" (`false`) — e misturar as duas coisas estragaria justamente
-- a conta que a coluna existe para permitir.
--
-- Obrigar a responder para encerrar a vaga seria pior: a empresa
-- responderia qualquer coisa para se livrar da tela, e o número viraria
-- lixo com aparência de dado.
--
-- ── ISTO NÃO ALCANÇA O PROCURÔ ────────────────────────────────────────
--
-- Bancos diferentes desde a separação: o Ei é o `ahigenhenzmsjxlmrzhz`,
-- o procurô é o `dfdinrimxqoqjedemjbw`. Esta SQL roda só no do Ei.
--
-- ══════════════════════════════════════════════════════════════════════

-- ── Parte única — as duas colunas ─────────────────────────────────────
--
-- `if not exists` para a SQL poder ser rodada duas vezes sem erro. Um
-- erro no meio desfaz o bloco inteiro no editor do painel, inclusive o
-- que já tinha passado — então nenhum comando aqui pode falhar por já
-- ter sido aplicado antes.

alter table public.job_listings
  add column if not exists contratou_por_aqui boolean,
  add column if not exists quantos_contratados smallint;

comment on column public.job_listings.contratou_por_aqui is
  'A empresa contratou alguém que veio do Ei Emprego? Nulo = não respondeu.';
comment on column public.job_listings.quantos_contratados is
  'Quantas pessoas foram contratadas por esta vaga. Nulo = não respondeu.';

-- Ninguém contrata menos que ninguém, e um número absurdo aqui estraga
-- qualquer soma. O teto é folgado de propósito: existe para barrar
-- digitação errada, não para julgar o tamanho da empresa.
alter table public.job_listings
  drop constraint if exists job_listings_quantos_contratados_check;
alter table public.job_listings
  add constraint job_listings_quantos_contratados_check
  check (quantos_contratados is null or (quantos_contratados >= 0 and quantos_contratados <= 999));

-- ── Confere a si mesma ────────────────────────────────────────────────
-- Lê `pg_catalog`, nunca `information_schema`: o `information_schema`
-- filtra por privilégio do papel corrente e o editor do painel não roda
-- como dono — ele já respondeu "não existe" cinco vezes para uma coluna
-- que estava lá.

select case
  when (
    select count(*)
      from pg_attribute
     where attrelid = 'public.job_listings'::regclass
       and attname in ('contratou_por_aqui', 'quantos_contratados')
       and not attisdropped
  ) = 2
  then 'PRONTO — o app já pode perguntar se a contratação saiu daqui.'
  else 'AINDA FALTA — uma das duas colunas não entrou. Rode o bloco de novo.'
end as resultado;
