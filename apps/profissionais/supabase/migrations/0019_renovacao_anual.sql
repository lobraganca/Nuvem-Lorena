-- Torna o plano anual realmente recorrente, em dois caminhos diferentes
-- (porque a API do Mercado Pago só faz débito automático com cartão):
--
--   a) Anual no CARTÃO — `/preapproval` com `auto_recurring.frequency = 12`
--      / `frequency_type = 'months'`: o Mercado Pago cobra o cartão sozinho a
--      cada 12 meses. Renova de verdade, sem ação do dono do anúncio.
--   b) Anual no PIX/BOLETO — continua sendo pagamento único
--      (`checkout/preferences`), porque Pix/boleto não têm débito automático.
--      A "recorrência" aqui é operacional: a Edge Function agendada
--      `renew-annual-plans` roda 1x/dia, acha os planos perto de vencer, já
--      gera a nova cobrança e manda o link por e-mail ao dono.
--
-- Colunas novas em `subscriptions`:
--   - `auto_renew`  — true quando a linha é cobrada automaticamente pelo
--     Mercado Pago (mensal via preapproval, ou anual via preapproval de 12
--     meses); false quando é pagamento único que depende de o dono pagar de
--     novo (anual no Pix/boleto). É o que separa quem recebe o e-mail de
--     aviso de quem não precisa receber.
--   - `renewal_notified_at` — quando o aviso de renovação deste ciclo foi
--     enviado, para o cron não reenviar o e-mail todo dia. É zerado
--     (`null`) pelo webhook quando o pagamento da renovação é confirmado,
--     liberando o aviso do ciclo seguinte.

alter table public.subscriptions
  add column if not exists auto_renew boolean not null default true,
  add column if not exists renewal_notified_at timestamptz;

-- Backfill: antes desta migration, TODA linha anual era o plano à vista
-- (pagamento único via checkout/preferences) — nenhuma renovava sozinha.
update public.subscriptions
  set auto_renew = false
  where billing_cycle = 'annual';

-- Índice para a varredura diária do cron (planos anuais à vista ativos,
-- ainda sem aviso enviado neste ciclo).
create index if not exists subscriptions_renovacao_idx
  on public.subscriptions (billing_cycle, auto_renew, status, current_period_end);
