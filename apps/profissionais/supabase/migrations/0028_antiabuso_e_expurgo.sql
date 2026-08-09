-- Freios de abuso e prazo de guarda.
--
-- Três tabelas aceitam escrita de qualquer visitante, sem login: pedidos de
-- contato, sugestões e visualizações de perfil. Isso é deliberado — exigir
-- conta para pedir um orçamento afastaria justamente quem está com um cano
-- estourado em casa. Mas "sem login" não pode significar "sem limite":
--
--   * pedidos de contato: um laço simples enche o painel de um profissional
--     com milhares de pedidos falsos, e ele perde os verdadeiros no meio.
--   * sugestões: mesma coisa, com o seu painel de administração.
--   * visualizações: dá para fingir 10.000 visitas no próprio anúncio e
--     estragar o único número que o anunciante usa para decidir se o app
--     vale a pena.
--
-- Os limites são por janela de tempo e generosos para uso humano: ninguém
-- pede contato a seis profissionais no mesmo minuto de boa-fé.

-- --------------------------------------------------------------------
-- Pedidos de contato: no máximo 5 por telefone a cada 10 minutos.
-- --------------------------------------------------------------------
create or replace function public.contact_requests_freia_abuso()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recentes int;
begin
  select count(*) into recentes
    from public.contact_requests
   where phone = new.phone
     and created_at > now() - interval '10 minutes';

  if recentes >= 5 then
    raise exception 'Muitos pedidos seguidos deste telefone. Espere alguns minutos.';
  end if;

  -- Mesmo profissional, mesmo telefone, em sequência: é dedo nervoso no
  -- botão, não pedido novo.
  if exists (
    select 1 from public.contact_requests
     where professional_id = new.professional_id
       and phone = new.phone
       and created_at > now() - interval '2 minutes'
  ) then
    raise exception 'Você já enviou um pedido para este profissional agora há pouco.';
  end if;

  return new;
end;
$$;

drop trigger if exists contact_requests_freia_abuso_trigger on public.contact_requests;
create trigger contact_requests_freia_abuso_trigger
  before insert on public.contact_requests
  for each row execute function public.contact_requests_freia_abuso();

-- --------------------------------------------------------------------
-- Sugestões: no máximo 3 por hora por usuário logado; anônimas, 20/hora no
-- total (não há de quem cobrar, então o teto é global e frouxo).
-- --------------------------------------------------------------------
create or replace function public.suggestions_freia_abuso()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recentes int;
begin
  if new.user_id is not null then
    select count(*) into recentes
      from public.suggestions
     where user_id = new.user_id
       and created_at > now() - interval '1 hour';
    if recentes >= 3 then
      raise exception 'Você já enviou várias sugestões agora há pouco. Tente mais tarde.';
    end if;
  else
    select count(*) into recentes
      from public.suggestions
     where user_id is null
       and created_at > now() - interval '1 hour';
    if recentes >= 20 then
      raise exception 'Muitas sugestões recebidas agora. Tente mais tarde.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists suggestions_freia_abuso_trigger on public.suggestions;
create trigger suggestions_freia_abuso_trigger
  before insert on public.suggestions
  for each row execute function public.suggestions_freia_abuso();

-- --------------------------------------------------------------------
-- Visualizações: uma por anúncio a cada 30 minutos por usuário logado.
--
-- Visitante sem conta continua contando sempre — não há como distingui-lo
-- sem rastrear, e rastrear visitante para inflar um contador seria trocar
-- privacidade por vaidade. O número segue aproximado, e é assim que ele é
-- apresentado ao anunciante ("pessoas viram seu anúncio").
-- --------------------------------------------------------------------
create or replace function public.profile_views_freia_abuso()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null then
    if exists (
      select 1 from public.profile_views
       where professional_id = new.professional_id
         and viewer_id = auth.uid()
         and viewed_at > now() - interval '30 minutes'
    ) then
      -- Devolver null cancela a inserção sem estourar erro: a página do
      -- profissional não pode quebrar porque a contagem foi ignorada.
      return null;
    end if;
    new.viewer_id := auth.uid();
  end if;
  return new;
end;
$$;

-- A coluna pode não existir em bases antigas.
alter table public.profile_views
  add column if not exists viewer_id uuid references auth.users(id) on delete set null;

create index if not exists profile_views_dedupe_idx
  on public.profile_views (professional_id, viewer_id, viewed_at desc);

drop trigger if exists profile_views_freia_abuso_trigger on public.profile_views;
create trigger profile_views_freia_abuso_trigger
  before insert on public.profile_views
  for each row execute function public.profile_views_freia_abuso();

-- --------------------------------------------------------------------
-- Prazo de guarda (LGPD): dados que não servem mais são apagados.
--
-- Pedidos de contato guardam nome e telefone de gente que talvez nem tenha
-- conta aqui. Guardar isso para sempre é acúmulo sem finalidade — e
-- finalidade é justamente o que a lei exige para guardar qualquer coisa.
-- Um ano cobre o uso real (reencontrar um cliente antigo) com folga.
--
-- Chame periodicamente. Com pg_cron:
--   select cron.schedule('expurgo', '0 4 * * *', 'select public.expurgar_dados_antigos()');
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
end;
$$;

revoke all on function public.expurgar_dados_antigos() from public;
