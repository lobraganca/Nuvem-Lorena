-- Guarda a que assinatura cada pagamento pertence.
--
-- `processed_payments` nasceu só para impedir que o mesmo aviso do Mercado
-- Pago fosse processado duas vezes: bastava o número do pagamento. Agora ela
-- precisa responder a outra pergunta — "qual foi o último pagamento desta
-- assinatura?" —, que é o que permite devolver o dinheiro de quem desiste
-- dentro dos 7 dias do direito de arrependimento.
--
-- Sem esta coluna, o reembolso teria de sair da conversa com o Mercado Pago a
-- cada pedido, e um cancelamento que depende de uma consulta a mais é um
-- cancelamento que falha na hora errada.

alter table public.processed_payments
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null;

create index if not exists processed_payments_subscription_idx
  on public.processed_payments (subscription_id, processed_at desc);
