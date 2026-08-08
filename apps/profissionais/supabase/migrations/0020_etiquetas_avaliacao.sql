-- Etiquetas rápidas na avaliação (modelo 99/Uber): a pessoa avalia tocando
-- em estrelas e em algumas etiquetas prontas, sem precisar escrever nada. O
-- comentário em texto livre continua existindo, mas passa a ser opcional.
--
-- As etiquetas são texto livre no banco de propósito: o conjunto oferecido
-- na UI vive em `src/types/domain.ts` (POSITIVE_REVIEW_TAGS /
-- NEGATIVE_REVIEW_TAGS / MIXED_REVIEW_TAGS) e pode ser ajustado sem
-- migração. O `check` abaixo só limita a quantidade, para o campo não virar
-- vetor de lixo via API direta.

alter table public.reviews
  add column if not exists tags text[] not null default '{}';

alter table public.reviews
  drop constraint if exists reviews_tags_max;

alter table public.reviews
  add constraint reviews_tags_max
  check (coalesce(array_length(tags, 1), 0) <= 12);

-- O trigger de 0011_trigger_reviews_campo_restrito.sql valida campo a campo
-- QUEM pode mudar O QUÊ num update de `reviews`. Como ele lista os campos
-- explicitamente, a coluna nova precisa entrar nessa conta:
--
--   - autor da avaliação: pode mudar `rating`, `comment` e agora `tags`
--     (é ele quem escolhe as etiquetas ao editar a própria avaliação);
--   - dono do anúncio: continua podendo mudar só `reply`/`replied_at` —
--     `tags` entra na lista de campos que ele não pode reescrever, junto
--     com `rating`/`comment`.
--
-- Sem isso, editar uma avaliação com etiquetas falharia (o dono) ou o dono
-- conseguiria apagar as etiquetas recebidas (brecha equivalente à que a
-- 0011 fechou para nota/comentário). O resto do comportamento é idêntico ao
-- da 0011.

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
    -- Autor pode mudar rating/comment/tags, mas não a resposta do dono.
    if new.reply is distinct from old.reply or new.replied_at is distinct from old.replied_at then
      raise exception 'Autor da avaliação não pode alterar a resposta do profissional.';
    end if;
    -- Autor não deve conseguir se auto-declarar dono via update; mantém os
    -- demais campos imutáveis por segurança extra.
    new.professional_id := old.professional_id;
    new.user_id := old.user_id;
  elsif eh_dono then
    -- Dono do anúncio só pode mudar a resposta, nunca a nota, o comentário
    -- ou as etiquetas escolhidas pelo autor.
    if new.rating is distinct from old.rating
      or new.comment is distinct from old.comment
      or new.tags is distinct from old.tags then
      raise exception 'Dono do anúncio não pode alterar nota, comentário ou etiquetas da avaliação.';
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

-- O trigger em si (nome e ponto de disparo) continua o mesmo da 0011; só a
-- função foi trocada acima, então não é preciso recriá-lo.
