-- ═══════════════════════════════════════════════════════════════════════
-- 0128 — O ACEITE DA DIVULGAÇÃO, GUARDADO
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "sobre privacidade, ter um campo antes de salvar o cadastro onde
-- a pessoa marque e se comprometa com as regras de divulgação dos dados e
-- utilização deles para encontro de oportunidades. Que inclusive os dados
-- coletados serão divulgados, pois esse é o intuito da plataforma."
--
-- A caixinha está na tela. Isto aqui é a PROVA dela.
--
-- ── Por que a data, e não um "sim" ─────────────────────────────────────
--
-- Consentimento que não diz quando nem a que texto não prova nada. Se a
-- política mudar em dezembro, um `true` gravado hoje não responde "aceitou
-- o quê?" — e é exatamente essa a pergunta que se faz num pedido da ANPD
-- ou numa reclamação. Por isso são duas colunas: o instante e a versão do
-- documento que estava no ar naquele instante.
--
-- ── E por que ninguém é marcado em massa ───────────────────────────────
--
-- A tentação é preencher a data de todo mundo que já se cadastrou, para a
-- coluna não nascer vazia. Seria inventar consentimento: essas pessoas
-- nunca viram a caixa. Elas nascem com NULL, a caixa aparece desmarcada na
-- próxima vez que abrirem o cadastro, e o app pede o aceite antes de
-- gravar de novo. Cadastro antigo continua no ar enquanto isso — ele já
-- estava público, e sumir com ele sem aviso seria outro problema.
--
-- ── Ordem ──────────────────────────────────────────────────────────────
--
-- Esta pode ser aplicada a qualquer momento, antes ou depois do código: o
-- app grava as duas colunas tolerando a ausência delas
-- (`colunasNovas.ts`), então sem esta SQL o cadastro continua salvando e
-- só o aceite não fica registrado no banco.

alter table public.professionals
  add column if not exists consentimento_em timestamptz,
  add column if not exists consentimento_versao text;

comment on column public.professionals.consentimento_em is
  'Quando a pessoa autorizou a divulgação pública do cadastro (LGPD). NULL = ainda não aceitou.';
comment on column public.professionals.consentimento_versao is
  'Versão do documento aceito, para saber A QUE TEXTO o aceite se refere.';

-- ── A conferência, em português ────────────────────────────────────────
-- Lê `pg_catalog`, e não `information_schema`: o segundo filtra por
-- privilégio do papel corrente e já respondeu "não existe" sobre coluna
-- que estava lá (ver CLAUDE.md).
select
  case
    when count(*) = 2
      then 'PRONTO — as duas colunas do aceite existem. A caixinha de autorização já grava.'
    else 'AINDA FALTA — encontrei ' || count(*) || ' de 2 colunas. Rode o bloco de novo inteiro, sem selecionar nada.'
  end as resultado
from pg_attribute
where attrelid = 'public.professionals'::regclass
  and attname in ('consentimento_em', 'consentimento_versao')
  and not attisdropped;
