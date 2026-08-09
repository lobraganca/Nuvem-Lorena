-- --------------------------------------------------------------------
-- Cobranças abandonadas somem sozinhas.
--
-- A linha de assinatura nasce como "pending" no instante em que o link de
-- pagamento é gerado, antes de qualquer dinheiro entrar. Quem abre o
-- checkout e desiste — e desistir é o desfecho mais comum de todos — deixa
-- uma linha pendente que nunca vira nada.
--
-- A tela já ignora as antigas desde hoje. O banco não: elas se acumulam
-- para sempre, sujam qualquer contagem de "quantas assinaturas eu tenho" e,
-- pior, atrapalham o próprio webhook, que procura a pendente mais recente
-- para confirmar um pagamento. Com dez pendentes velhas no meio, a chance de
-- ele confirmar a linha errada cresce.
--
-- Um dia é folga larga: Pix e boleto se resolvem em minutos, e boleto que
-- demora mais que isso já foi reemitido.
--
-- Só apaga o que não tem pagamento nenhum vinculado. Se existe registro de
-- pagamento apontando para a assinatura, ela não é abandono — é algo que
-- deu errado e precisa ser investigado, não varrido para debaixo do tapete.
-- --------------------------------------------------------------------
create or replace function public.expurgar_dados_antigos()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.contact_requests where created_at < now() - interval '12 months';
  -- Visualizações só alimentam o "últimos 30 dias"; 6 meses já é folga.
  delete from public.profile_views where viewed_at < now() - interval '6 months';

  delete from public.subscriptions s
   where s.status = 'pending'
     and s.created_at < now() - interval '1 day'
     and not exists (
       select 1 from public.processed_payments p where p.subscription_id = s.id
     );
end;
$$;

revoke all on function public.expurgar_dados_antigos() from public;
