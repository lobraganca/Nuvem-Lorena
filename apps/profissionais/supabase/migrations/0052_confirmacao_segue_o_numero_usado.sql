-- --------------------------------------------------------------------
-- A confirmação cai quando muda o número que está no ar — qualquer um
-- dos dois campos.
--
-- A 0024 já derrubava o selo ao trocar o WhatsApp, e disse por quê: sem
-- isso, bastaria confirmar o próprio celular e depois trocar pelo número
-- do golpe. Só que ela olhava apenas a coluna `whatsapp`, e o número que
-- vale não é sempre esse.
--
-- Quem é o número do cadastro é decidido por `coalesce(nullif(whatsapp,
-- ''), phone)` — a mesma conta que a `confirmar_whatsapp` faz. Ou seja:
-- com o campo WhatsApp vazio, quem aparece na busca, quem recebe o código
-- e quem carrega o selo é o `phone`. E `phone` não estava sendo vigiado.
--
-- O furo, na prática: cadastra sem WhatsApp, confirma o próprio celular
-- pelo `phone`, depois edita o `phone` para outro número. O gatilho não
-- via mudança nenhuma em `whatsapp` (continuou vazio nas duas pontas), o
-- selo ficava de pé, e o cadastro passava a exibir "✓ confirmado" ao lado
-- de um número que ninguém provou ter. É exatamente o golpe que a 0024
-- existe para impedir, entrando pela porta do lado.
--
-- Agora o gatilho compara o número efetivo — o mesmo que a RPC usa —,
-- então mexer em qualquer um dos dois campos derruba o selo se o
-- resultado final mudar. Trocar só o `phone` tendo WhatsApp preenchido
-- não derruba nada, e está certo: o número que vale continua o mesmo.
-- --------------------------------------------------------------------
create or replace function public.professionals_protege_whatsapp_verificado()
returns trigger
language plpgsql
as $$
declare
  v_numero_antes text;
  v_numero_depois text;
begin
  if tg_op = 'INSERT' then
    -- Ninguém nasce verificado.
    new.whatsapp_verified := false;
    new.whatsapp_verified_at := null;
    return new;
  end if;

  if new.whatsapp_verified is distinct from old.whatsapp_verified
     or new.whatsapp_verified_at is distinct from old.whatsapp_verified_at then
    -- `current_setting` com o segundo argumento true devolve null em vez de
    -- estourar quando a variável não existe — é assim que a função de
    -- confirmação se identifica.
    if coalesce(current_setting('app.confirmando_whatsapp', true), '') <> 'sim' then
      raise exception 'O WhatsApp verificado só pode ser alterado pela confirmação por código.';
    end if;
  end if;

  -- O número que vale é o mesmo que a `confirmar_whatsapp` compara com o
  -- Auth: o WhatsApp quando existe, o telefone quando não.
  v_numero_antes := regexp_replace(
    coalesce(nullif(old.whatsapp, ''), old.phone, ''), '\D', '', 'g');
  v_numero_depois := regexp_replace(
    coalesce(nullif(new.whatsapp, ''), new.phone, ''), '\D', '', 'g');

  -- Só os dígitos entram na conta: mudar "(31) 98822-4938" para
  -- "31988224938" é a mesma pessoa com o mesmo número, e derrubar o selo
  -- por causa de pontuação faria a pessoa confirmar de novo à toa.
  if v_numero_depois is distinct from v_numero_antes
     and coalesce(current_setting('app.confirmando_whatsapp', true), '') <> 'sim' then
    new.whatsapp_verified := false;
    new.whatsapp_verified_at := null;
  end if;

  return new;
end;
$$;
