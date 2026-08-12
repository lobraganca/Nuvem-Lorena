-- --------------------------------------------------------------------
-- Quanto entrou, por pagamento.
--
-- O banco registrava QUE um pagamento foi processado (`processed_payments`,
-- criada para não creditar duas vezes o mesmo evento), mas nunca QUANTO ele
-- trouxe: `subscriptions` não tem coluna de valor, e o patrocínio de
-- categoria também não. O valor existia só no Mercado Pago.
--
-- Isso significa que o histórico anterior a esta migração não pode ser
-- reconstruído aqui — o painel diz isso na cara, em vez de somar o que tem
-- e apresentar como se fosse tudo. Para o que já passou, a fonte é o
-- extrato do Mercado Pago.
--
-- Daqui para frente o webhook grava o valor junto com o id, no mesmo insert
-- que já fazia. Não é uma chamada a mais nem um risco novo: o valor já vem
-- na resposta que o webhook consulta para saber se o pagamento foi
-- aprovado.
-- --------------------------------------------------------------------
alter table public.processed_payments
  add column if not exists valor_centavos integer,
  -- 'verification' | 'boost' | 'plus' | 'credits' | 'sponsorship' | null
  -- (null = pagamento antigo, de antes desta migração, ou tipo que o
  -- webhook não soube classificar).
  add column if not exists tipo text;

create index if not exists processed_payments_data_idx
  on public.processed_payments (processed_at desc);

-- A tabela não tinha policy nenhuma: era escrita só pelo webhook, com a
-- service_role, que ignora RLS. Agora o painel administrativo precisa
-- somar esses valores, e faz isso do navegador — daí a leitura para admin.
-- Continua sem insert/update/delete para quem está logado: quem escreve
-- aqui é o webhook, e só ele.
drop policy if exists "admin vê os pagamentos" on public.processed_payments;
drop policy if exists admin_ve_os_pagamentos on public.processed_payments;
create policy admin_ve_os_pagamentos
  on public.processed_payments for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

grant select on public.processed_payments to authenticated;

-- Idem para as assinaturas: o painel conta quantas estão ativas, e a policy
-- que existia só deixava cada dono ver as próprias.
drop policy if exists "admin vê todas as assinaturas" on public.subscriptions;
drop policy if exists admin_ve_todas_as_assinaturas on public.subscriptions;
create policy admin_ve_todas_as_assinaturas
  on public.subscriptions for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );
