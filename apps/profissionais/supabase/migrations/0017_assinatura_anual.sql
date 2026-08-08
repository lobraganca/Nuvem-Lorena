-- Fonte de renda: alternativa "plano anual à vista" para as 3 assinaturas
-- recorrentes (selo de verificação, turbinar anúncio e Empresa Plus), com
-- 20% de desconto sobre 12x o valor mensal. Diferente do plano mensal (que
-- usa `/preapproval` e só aceita cartão), o plano anual é um pagamento
-- avulso via `checkout/preferences` (aceita Pix, cartão e boleto
-- automaticamente, sem configuração extra) — não renova sozinho, o dono do
-- anúncio precisa comprar de novo ao expirar.

alter table public.subscriptions
  add column billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'annual'));
