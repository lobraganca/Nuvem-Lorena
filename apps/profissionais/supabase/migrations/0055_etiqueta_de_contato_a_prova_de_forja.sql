-- --------------------------------------------------------------------
-- A etiqueta "avaliação de quem chamou pelo app" podia ser forjada.
--
-- A 0033 tirou o CPF de cima de quem avalia e colocou no lugar uma
-- distinção observada pelo próprio app: quem tocou no botão de contato
-- ganha `contato_confirmado` na avaliação. O texto da 0033 diz, com todas
-- as letras, por que essa marca é calculada no servidor: "seria só mais um
-- campo que qualquer um manda como quiser — e uma etiqueta de confiança
-- que se pode forjar é pior do que nenhuma".
--
-- Ela era forjável por dois caminhos.
--
-- 1) A tabela que alimenta a etiqueta aceitava qualquer linha.
--
--      create policy "qualquer pessoa registra contato"
--        on public.contatos_registrados for insert
--        with check (true);
--
--    `with check (true)` não olha o `user_id`. Com a chave pública do app
--    — que é pública por natureza, está no site — dava para gravar um
--    contato em nome de outra pessoa, para o profissional que se quisesse,
--    e a avaliação seguinte nascia etiquetada.
--
--    A correção mantém o pedido de contato anônimo funcionando: quem não
--    está logado continua registrando com `user_id` nulo (é o que alimenta
--    o contador de "quantos me chamaram" no painel). O que deixa de ser
--    possível é gravar em nome de um `user_id` que não é o seu.
--
-- 2) O gatilho que calcula a etiqueta só rodava no insert.
--
--      create trigger reviews_marca_contato_trigger
--        before insert on public.reviews
--
--    A avaliação nascia com o valor certo e depois podia ser corrigida por
--    quem a escreveu: o gatilho de update (0011/0020) protege a resposta do
--    dono e a nota do autor, mas nunca olhou `contato_confirmado`. Bastava
--    escrever a avaliação normalmente e mandar um update ligando o campo.
--
--    Agora o gatilho roda também no update, e sempre reescreve o campo a
--    partir da tabela de contatos. Não existe valor vindo do cliente que
--    sobreviva — nem no insert, nem no update, nem do autor, nem do dono.
--
-- Um terceiro campo entra junto por simetria: `contratou`. Ele é
-- declaração de quem avaliou ("contratei mesmo") e por isso o autor pode
-- mudá-lo à vontade — é a opinião dele sobre a própria experiência. O dono
-- do anúncio é que não podia mexer, e podia: o gatilho de update proíbe o
-- dono de alterar nota, comentário e etiquetas, mas `contratou` ficou de
-- fora da lista. Ou seja: o profissional podia marcar como "contratou" uma
-- avaliação em que o cliente não marcou. Fica proibido, na mesma linha das
-- outras.
-- --------------------------------------------------------------------

-- 1) Ninguém registra contato em nome de outra pessoa.
drop policy if exists "qualquer pessoa registra contato" on public.contatos_registrados;
create policy "qualquer pessoa registra contato"
  on public.contatos_registrados for insert
  with check (user_id is null or auth.uid() = user_id);

-- 2) A etiqueta é recalculada no servidor a cada gravação.
--
-- O nome do gatilho de update vem depois deste em ordem alfabética
-- (`reviews_marca_contato_trigger` < `reviews_valida_campos_update_trigger`),
-- e é essa ordem que o Postgres usa para disparar gatilhos `before` do
-- mesmo evento. Então a etiqueta já está recalculada quando a validação de
-- campos roda — o que garante que a validação nunca veja um valor forjado.
drop trigger if exists reviews_marca_contato_trigger on public.reviews;
create trigger reviews_marca_contato_trigger
  before insert or update on public.reviews
  for each row execute function public.reviews_marca_contato();

-- 3) O dono do anúncio não declara "contratou" no lugar do cliente.
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
    -- Autor pode mudar rating/comment/tags/contratou, mas não a resposta do
    -- dono. `contato_confirmado` não entra na lista porque não é decisão de
    -- ninguém: o gatilho anterior já o reescreveu a partir dos contatos
    -- registrados, e o que veio do cliente foi descartado ali.
    if new.reply is distinct from old.reply or new.replied_at is distinct from old.replied_at then
      raise exception 'Autor da avaliação não pode alterar a resposta do profissional.';
    end if;
    -- Autor não deve conseguir se auto-declarar dono via update; mantém os
    -- demais campos imutáveis por segurança extra.
    new.professional_id := old.professional_id;
    new.user_id := old.user_id;
  elsif eh_dono then
    -- Dono do anúncio só pode mudar a resposta, nunca a nota, o comentário,
    -- as etiquetas ou a declaração de contratação — tudo isso é do autor.
    if new.rating is distinct from old.rating
      or new.comment is distinct from old.comment
      or new.tags is distinct from old.tags
      or new.contratou is distinct from old.contratou then
      raise exception 'Dono do anúncio não pode alterar nota, comentário, etiquetas ou a declaração de contratação.';
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
