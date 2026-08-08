-- Corrige uma brecha de integridade: a policy de update do dono do anúncio
-- (0010_resposta_favoritos.sql) permite, no papel, atualizar a linha inteira
-- de `reviews` — então hoje nada impede o dono de reescrever `rating`/
-- `comment` de uma avaliação recebida via API direta (só via `reply`, não
-- via UI, mas RLS não protegia isso). E o autor da review, via a policy dele,
-- também poderia em tese setar `reply`/`replied_at` direto.
--
-- RLS decide QUEM pode dar update (policies existentes, mantidas como
-- estão); este trigger decide O QUE cada um pode mudar nessa mesma
-- operação, validando campo a campo.

create or replace function public.reviews_valida_campos_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  eh_autor boolean;
  eh_dono boolean;
begin
  eh_autor := auth.uid() = old.user_id;
  eh_dono := exists (
    select 1 from public.professionals p
    where p.id = old.professional_id
      and p.owner_id = auth.uid()
  );

  if eh_autor then
    -- Autor pode mudar rating/comment, mas não a resposta do dono.
    if new.reply is distinct from old.reply or new.replied_at is distinct from old.replied_at then
      raise exception 'Autor da avaliação não pode alterar a resposta do profissional.';
    end if;
    -- Autor não deve conseguir se auto-declarar dono via update; mantém os
    -- demais campos imutáveis por segurança extra.
    new.professional_id := old.professional_id;
    new.user_id := old.user_id;
  elsif eh_dono then
    -- Dono do anúncio só pode mudar a resposta, nunca a nota/comentário do
    -- autor.
    if new.rating is distinct from old.rating or new.comment is distinct from old.comment then
      raise exception 'Dono do anúncio não pode alterar nota ou comentário da avaliação.';
    end if;
    new.professional_id := old.professional_id;
    new.user_id := old.user_id;
    if new.reply is distinct from old.reply then
      new.replied_at := now();
    end if;
  else
    -- Nem autor nem dono: não deveria nem passar pelas policies de RLS,
    -- mas por segurança em profundidade, barra qualquer mudança.
    raise exception 'Sem permissão para atualizar esta avaliação.';
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_valida_campos_update_trigger on public.reviews;
create trigger reviews_valida_campos_update_trigger
  before update on public.reviews
  for each row execute function public.reviews_valida_campos_update();
