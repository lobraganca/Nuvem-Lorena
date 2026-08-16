-- --------------------------------------------------------------------
-- O limite de pedidos de contato existia e dava para passar por cima dele
-- mudando a pontuação do telefone.
--
-- A 0028 já freia o abuso: 5 pedidos por telefone a cada 10 minutos, e
-- nenhum repetido para o mesmo profissional dentro de 2 minutos. O
-- raciocínio dela continua certo. O que não funciona é a comparação:
--
--   where phone = new.phone
--
-- `phone` é texto livre, digitado por quem pede. "31999998888",
-- "(31) 99999-8888" e "31 99999 8888" são o mesmo telefone e três textos
-- diferentes — então quem quisesse mandar cinquenta pedidos não precisava
-- de cinquenta números, precisava de cinquenta jeitos de escrever o mesmo.
-- O limite pegava exatamente quem ele não precisava pegar: a pessoa de
-- boa-fé que apertou o botão duas vezes, sempre com o campo preenchido
-- igual.
--
-- Duas mudanças, então.
--
-- 1) A comparação passa a ser por dígitos, dos dois lados. É o mesmo
--    critério que o app já usa para casar o número confirmado com o do
--    anúncio (migration 0052) — a regra fica igual no banco inteiro.
--
-- 2) Entra um teto por anúncio, que não existia. Todos os limites da 0028
--    são por telefone; quem gira números falsos passa por todos eles e
--    ainda enche o painel de um profissional. 40 pedidos numa hora para o
--    mesmo anúncio é muito acima de qualquer dia real em Itabirito e bem
--    abaixo do que um envio automatizado faz em um minuto.
--
-- As frases de recusa são escritas para quem levar a recusa sem merecer.
-- --------------------------------------------------------------------

-- --------------------------------------------------------------------
-- Os dígitos de um telefone, do jeito que o app já os compara.
--
-- Só tirar a pontuação não basta: "+55 31 99999-8888" e "31 99999-8888"
-- são o mesmo telefone e continuam dois textos diferentes depois da
-- limpeza. Esse detalhe não é hipótese — foi assim que o primeiro teste
-- deste conserto passou por cima do limite recém-escrito.
--
-- O 55 sai quando o que sobra tem 12 ou 13 dígitos, que é o tamanho de um
-- número brasileiro com código do país (55 + DDD + 8 ou 9 dígitos). Sem
-- essa condição, um fixo de São Paulo começando com 55 perderia os dois
-- primeiros dígitos e viraria outro número.
--
-- É a mesma regra que `whatsappVerify.ts` usa no app para casar o número
-- confirmado com o do anúncio. Escrita aqui para o banco poder aplicá-la
-- sozinho.
-- --------------------------------------------------------------------
create or replace function public.telefone_digitos(bruto text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when length(so_numeros) in (12, 13) and left(so_numeros, 2) = '55'
      then substr(so_numeros, 3)
    else so_numeros
  end
  from (select regexp_replace(coalesce(bruto, ''), '\D', '', 'g') as so_numeros) t;
$$;

-- Índice pelos dígitos: sem ele, cada pedido novo varre a tabela inteira
-- para contar os anteriores — e agora são duas contagens.
create index if not exists contact_requests_telefone_idx
  on public.contact_requests ((public.telefone_digitos(phone)), created_at desc);

create index if not exists contact_requests_recentes_idx
  on public.contact_requests (professional_id, created_at desc);

create or replace function public.contact_requests_freia_abuso()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  digitos text;
  recentes int;
  no_anuncio int;
begin
  digitos := public.telefone_digitos(new.phone);

  if digitos <> '' then
    select count(*) into recentes
      from public.contact_requests
     where public.telefone_digitos(phone) = digitos
       and created_at > now() - interval '10 minutes';

    if recentes >= 5 then
      raise exception 'Muitos pedidos seguidos deste telefone. Espere alguns minutos.';
    end if;

    -- Mesmo profissional, mesmo telefone, em sequência: é dedo nervoso no
    -- botão, não pedido novo.
    if exists (
      select 1 from public.contact_requests
       where professional_id = new.professional_id
         and public.telefone_digitos(phone) = digitos
         and created_at > now() - interval '2 minutes'
    ) then
      raise exception 'Você já enviou um pedido para este profissional agora há pouco.';
    end if;
  end if;

  -- Teto por anúncio, independente de telefone: é o que sobra quando quem
  -- abusa troca de número a cada envio.
  select count(*) into no_anuncio
    from public.contact_requests
   where professional_id = new.professional_id
     and created_at > now() - interval '1 hour';

  if no_anuncio >= 40 then
    raise exception 'Este profissional recebeu muitos pedidos agora há pouco. Tente de novo em alguns minutos ou chame direto no WhatsApp.';
  end if;

  return new;
end;
$$;

-- O gatilho (nome e ponto de disparo) continua o da 0028; só a função
-- mudou, e `create or replace` já a substituiu acima.
