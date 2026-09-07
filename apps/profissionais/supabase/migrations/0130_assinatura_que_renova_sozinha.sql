-- ═══════════════════════════════════════════════════════════════════════
-- 0130 — A assinatura que renova sozinha
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "quero a assinatura que renova sozinha."
--
-- A 0129 montou a cobrança de uma vez só (Pix, boleto ou cartão, 30 dias).
-- Esta acrescenta o que falta para a mensalidade automática do Mercado
-- Pago — que eles chamam de "preapproval".
--
-- ── O QUE MUDA, E O QUE JÁ EXISTIA ────────────────────────────────────
--
-- `companies.plano_recorrente` existe desde a 0072 e já quer dizer
-- exatamente isto: "se renova sozinho até alguém cancelar". A 0124, do
-- reembolso, já o desliga quando alguém desiste. Ou seja, o app inteiro já
-- sabe o que é uma assinatura recorrente — ele só não tinha como
-- CANCELAR uma no Mercado Pago, porque não guardava o número dela em
-- lugar nenhum.
--
-- Sem esse número, "cancele quando quiser" seria uma frase na tela sem
-- nada atrás. E esconder o cancelamento não é opção: é infração do Código
-- de Defesa do Consumidor, não uma escolha de produto.
--
-- ── UMA ASSINATURA POR EMPRESA ────────────────────────────────────────
--
-- Por isso a coluna mora em `companies`, e não numa tabela nova.
-- `companies.owner_id` é único (0066) — uma conta, uma empresa — e uma
-- empresa não assina dois planos ao mesmo tempo: trocar de plano é trocar
-- a assinatura, não somar outra.

-- ── 1. O número da assinatura no Mercado Pago ─────────────────────────
alter table public.companies
  add column if not exists mp_preapproval_id text;

/* O webhook chega dizendo "a assinatura X foi cobrada" e precisa achar a
   empresa por esse número. Sem índice, isso vira uma varredura da tabela
   inteira a cada cobrança mensal de cada assinante. */
create index if not exists companies_preapproval_idx
  on public.companies (mp_preapproval_id)
  where mp_preapproval_id is not null;

-- ── 2. O pedido também pode ser uma assinatura ────────────────────────
-- A 0129 previa dois tipos de compra. Agora são três, e o `check` precisa
-- deixar o novo entrar — senão o servidor tenta gravar e o banco recusa,
-- com a pessoa já a caminho da tela de pagamento.
--
-- `drop` antes de `add`: `add constraint` com nome que já existe falha, e
-- um erro no meio desfaz o bloco inteiro no editor do painel.
alter table public.pedidos drop constraint if exists pedidos_tipo_check;
alter table public.pedidos add constraint pedidos_tipo_check
  check (tipo in ('plano_empresa', 'destaque_profissional', 'assinatura_empresa'));

/* O número da assinatura também no pedido: é por ele que se sabe qual
   compra deu origem a qual mensalidade. */
alter table public.pedidos
  add column if not exists mp_preapproval_id text;

-- ── 3. A conferência ───────────────────────────────────────────────────
-- `pg_catalog`, nunca `information_schema` — ver o CLAUDE.md e a 0060.
-- Último comando do arquivo de propósito: o painel mostra o resultado do
-- último, e qualquer coisa depois disto engoliria a resposta.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.companies'::regclass
           and attname = 'mp_preapproval_id' and not attisdropped) = 1
   and (select count(*) from pg_attribute
         where attrelid = 'public.pedidos'::regclass
           and attname = 'mp_preapproval_id' and not attisdropped) = 1
   and (select count(*) from pg_constraint
         where conrelid = 'public.pedidos'::regclass
           and conname = 'pedidos_tipo_check'
           and pg_get_constraintdef(oid) like '%assinatura_empresa%') = 1
  then 'PRONTO — a assinatura que renova sozinha já tem onde ser guardada.'
  else 'AINDA FALTA — rode o arquivo inteiro, do começo, sem nada selecionado.'
end as resultado;
