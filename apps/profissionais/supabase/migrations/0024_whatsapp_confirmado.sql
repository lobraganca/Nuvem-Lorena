-- Confirmação do WhatsApp por código.
--
-- Até aqui, qualquer pessoa podia cadastrar o telefone de outra: bastava
-- digitar. Isso permite dois abusos que ferem exatamente quem a plataforma
-- existe para ajudar — anunciar em nome de um profissional real (que passa a
-- receber ligações de trabalhos que não combinou) e publicar um número de
-- golpe com o nome de alguém conhecido na cidade.
--
-- O código enviado ao WhatsApp resolve o caso comum: quem não tem o aparelho
-- na mão não conclui o cadastro. Não é prova de identidade — é prova de posse
-- do número, que é o que o contratante usa para chegar na pessoa.
--
-- A confirmação em si é feita pelo Supabase Auth (`auth.users.phone` +
-- `phone_confirmed_at`), que fala com o provedor de mensagens. Este arquivo
-- cuida de trazer esse fato para o anúncio, e de garantir que ele não possa
-- ser forjado pelo navegador.

alter table public.professionals
  add column if not exists whatsapp_verified boolean not null default false,
  add column if not exists whatsapp_verified_at timestamptz;

-- O cliente escreve na tabela `professionals` com a chave anon. Se a coluna
-- fosse gravável por ele, "verificado" seria só mais um campo de formulário:
-- um `update` direto pela API marcaria o selo sem nenhum código enviado.
-- Este trigger é o que torna a coluna não-falsificável — só a função abaixo,
-- que confere o Auth, consegue mudá-la.
create or replace function public.professionals_protege_whatsapp_verificado()
returns trigger
language plpgsql
as $$
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

  -- Trocar o número derruba a confirmação: o selo vale para o número que foi
  -- confirmado, não para o anúncio em geral. Sem isto, bastaria confirmar o
  -- próprio celular e depois trocar pelo número do golpe.
  if new.whatsapp is distinct from old.whatsapp
     and coalesce(current_setting('app.confirmando_whatsapp', true), '') <> 'sim' then
    new.whatsapp_verified := false;
    new.whatsapp_verified_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists professionals_protege_whatsapp_verificado_trigger on public.professionals;
create trigger professionals_protege_whatsapp_verificado_trigger
  before insert or update on public.professionals
  for each row execute function public.professionals_protege_whatsapp_verificado();

-- Marca o anúncio como confirmado, mas só se o Auth concordar.
--
-- Três condições, todas conferidas no servidor: quem chama é o dono do
-- anúncio, o telefone daquela conta está confirmado no Auth
-- (`phone_confirmed_at`), e o número confirmado é o mesmo que está no
-- anúncio. A comparação usa só os dígitos, e ignora o 55 do país, porque o
-- Auth guarda em formato internacional e o formulário guarda como se escreve
-- aqui.
create or replace function public.confirmar_whatsapp(p_professional_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_dono uuid;
  v_whatsapp text;
  v_auth_phone text;
  v_confirmado timestamptz;
  v_digitos_anuncio text;
  v_digitos_auth text;
begin
  select owner_id, coalesce(nullif(whatsapp, ''), phone)
    into v_dono, v_whatsapp
    from public.professionals
   where id = p_professional_id;

  if v_dono is null then
    raise exception 'Anúncio não encontrado.';
  end if;
  if v_dono <> auth.uid() then
    raise exception 'Só o dono do anúncio pode confirmar o WhatsApp dele.';
  end if;

  select phone, phone_confirmed_at
    into v_auth_phone, v_confirmado
    from auth.users
   where id = auth.uid();

  if v_confirmado is null then
    raise exception 'O número ainda não foi confirmado por código.';
  end if;

  v_digitos_anuncio := regexp_replace(coalesce(v_whatsapp, ''), '\D', '', 'g');
  v_digitos_auth := regexp_replace(coalesce(v_auth_phone, ''), '\D', '', 'g');
  v_digitos_anuncio := regexp_replace(v_digitos_anuncio, '^55', '');
  v_digitos_auth := regexp_replace(v_digitos_auth, '^55', '');

  if v_digitos_anuncio = '' or v_digitos_anuncio <> v_digitos_auth then
    raise exception 'O número confirmado é diferente do que está no anúncio.';
  end if;

  perform set_config('app.confirmando_whatsapp', 'sim', true);
  update public.professionals
     set whatsapp_verified = true,
         whatsapp_verified_at = now()
   where id = p_professional_id;
  perform set_config('app.confirmando_whatsapp', '', true);

  return true;
end;
$$;

revoke all on function public.confirmar_whatsapp(uuid) from public;
grant execute on function public.confirmar_whatsapp(uuid) to authenticated;

-- A view pública lista colunas uma a uma, então precisa ser recriada para
-- enxergar as colunas novas. Quem busca vê que o número foi confirmado —
-- é justamente para quem contrata que essa informação serve.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, created_at
from public.professionals
where suspended = false;

grant select on public.professionals_public to anon, authenticated;
