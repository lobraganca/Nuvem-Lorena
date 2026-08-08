-- Idempotência dos eventos de pagamento do Mercado Pago.
--
-- O Mercado Pago envia MAIS DE UMA notificação para o mesmo pagamento
-- (`payment.created` e `payment.updated`, além de reenvios automáticos), e
-- todas chegam no webhook com o mesmo `data.id`. Os fluxos que apenas
-- gravam um estado final (marcar patrocínio como 'active', calcular
-- "..._until" a partir de agora) toleram repetição sem estragar nada, mas a
-- compra de créditos de contato SOMA ao saldo — processar o mesmo pagamento
-- duas vezes daria crédito em dobro ao profissional, de graça.
--
-- Esta tabela funciona como um livro-caixa de eventos já processados: o
-- webhook "reserva" o id do pagamento antes de aplicar o efeito e ignora o
-- evento se o id já estiver reservado. Se o processamento falhar no meio, a
-- reserva é desfeita para que o reenvio do Mercado Pago possa tentar de novo.

create table if not exists public.processed_payments (
  payment_id text primary key,
  processed_at timestamptz not null default now()
);

-- Nenhuma policy: a tabela é manipulada exclusivamente pelo webhook, que usa
-- a service_role key (ignora RLS). Nenhum usuário final lê ou escreve aqui.
alter table public.processed_payments enable row level security;

-- Soma créditos de contato de forma atômica, criando a linha se ainda não
-- existir. Evita o padrão "lê o saldo, soma no client, grava de volta", que
-- perde uma das compras se dois pagamentos forem confirmados ao mesmo tempo.
-- Só o webhook (service_role) chama esta função — por isso não há grant para
-- anon/authenticated, ao contrário de `consume_lead_credit`.
-- Os parâmetros levam prefixo `p_` porque `on conflict (professional_id)` não
-- aceita qualificação de tabela: com um parâmetro de mesmo nome, o Postgres
-- não sabe se a coluna do conflito é a coluna ou a variável, e recusa a
-- chamada inteira em tempo de execução.
-- `create or replace function` não consegue trocar o NOME de um parâmetro
-- (só o corpo), então uma versão anterior já aplicada bloquearia esta. Drop
-- antes resolve, e é inofensivo: a função não guarda estado.
drop function if exists public.add_lead_credits(uuid, integer);
create function public.add_lead_credits(p_professional_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount deve ser positivo';
  end if;

  insert into public.lead_credits (professional_id, balance)
  values (p_professional_id, p_amount)
  on conflict (professional_id) do update
    set balance = public.lead_credits.balance + p_amount,
        updated_at = now();
end;
$$;

revoke execute on function public.add_lead_credits(uuid, integer) from anon, authenticated;
