-- Ei Itabirito — banco NOVO, PARTE 2 de 7
-- Projeto: ahigenhenzmsjxlmrzhz (o do Ei Itabirito)
-- Cole tudo, clique uma vez fora do texto (para não ficar nada selecionado) e toque em Run.
-- Migrations desta parte: 0017 a 0028

-- ───── 0017_assinatura_anual.sql ─────
-- Fonte de renda: alternativa "plano anual à vista" para as 3 assinaturas
-- recorrentes (selo de verificação, turbinar anúncio e Empresa Plus), com
-- 20% de desconto sobre 12x o valor mensal. Diferente do plano mensal (que
-- usa `/preapproval` e só aceita cartão), o plano anual é um pagamento
-- avulso via `checkout/preferences` (aceita Pix, cartão e boleto
-- automaticamente, sem configuração extra) — não renova sozinho, o dono do
-- anúncio precisa comprar de novo ao expirar.

alter table public.subscriptions
  add column if not exists billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'annual'));


-- ───── 0018_sugestoes.sql ─────
-- Canal de sugestões gerais sobre a plataforma (feedback de produto, ideias
-- como "poderia ter tal categoria" etc) — diferente de `reports`, que é
-- denúncia sobre um anúncio específico. Mesmo padrão de leitura restrita a
-- admin (reaproveita a tabela `admins` de 0008_admins.sql).

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  message text not null,
  created_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'reviewed'))
);

alter table public.suggestions enable row level security;

-- Qualquer um pode enviar uma sugestão, inclusive sem estar logado. Quando
-- logado, o client captura o user_id automaticamente (não é obrigatório).
drop policy if exists "qualquer um pode enviar uma sugestão" on public.suggestions;
create policy "qualquer um pode enviar uma sugestão"
  on public.suggestions for insert
  with check (true);

-- Sem policy de select pública de propósito — só admin lê (mesmo padrão de
-- `reports`).
drop policy if exists "admin vê as sugestões" on public.suggestions;
create policy "admin vê as sugestões"
  on public.suggestions for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "admin atualiza o status da sugestão" on public.suggestions;
create policy "admin atualiza o status da sugestão"
  on public.suggestions for update
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );


-- ───── 0019_renovacao_anual.sql ─────
-- Torna o plano anual realmente recorrente, em dois caminhos diferentes
-- (porque a API do Mercado Pago só faz débito automático com cartão):
--
--   a) Anual no CARTÃO — `/preapproval` com `auto_recurring.frequency = 12`
--      / `frequency_type = 'months'`: o Mercado Pago cobra o cartão sozinho a
--      cada 12 meses. Renova de verdade, sem ação do dono do anúncio.
--   b) Anual no PIX/BOLETO — continua sendo pagamento único
--      (`checkout/preferences`), porque Pix/boleto não têm débito automático.
--      A "recorrência" aqui é operacional: a Edge Function agendada
--      `renew-annual-plans` roda 1x/dia, acha os planos perto de vencer, já
--      gera a nova cobrança e manda o link por e-mail ao dono.
--
-- Colunas novas em `subscriptions`:
--   - `auto_renew`  — true quando a linha é cobrada automaticamente pelo
--     Mercado Pago (mensal via preapproval, ou anual via preapproval de 12
--     meses); false quando é pagamento único que depende de o dono pagar de
--     novo (anual no Pix/boleto). É o que separa quem recebe o e-mail de
--     aviso de quem não precisa receber.
--   - `renewal_notified_at` — quando o aviso de renovação deste ciclo foi
--     enviado, para o cron não reenviar o e-mail todo dia. É zerado
--     (`null`) pelo webhook quando o pagamento da renovação é confirmado,
--     liberando o aviso do ciclo seguinte.

alter table public.subscriptions
  add column if not exists auto_renew boolean not null default true,
  add column if not exists renewal_notified_at timestamptz;

-- Backfill: antes desta migration, TODA linha anual era o plano à vista
-- (pagamento único via checkout/preferences) — nenhuma renovava sozinha.
update public.subscriptions
  set auto_renew = false
  where billing_cycle = 'annual';

-- Índice para a varredura diária do cron (planos anuais à vista ativos,
-- ainda sem aviso enviado neste ciclo).
create index if not exists subscriptions_renovacao_idx
  on public.subscriptions (billing_cycle, auto_renew, status, current_period_end);


-- ───── 0020_etiquetas_avaliacao.sql ─────
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


-- ───── 0021_idempotencia_pagamentos.sql ─────
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


-- ───── 0022_contatos_e_pedidos.sql ─────
-- Mais formas de contato, e o caminho inverso: o cliente pedir que o
-- profissional ligue para ele.

-- 1) Canais de contato do anúncio. `phone` já existia (usado como WhatsApp);
--    agora ele volta a ser só telefone e o WhatsApp ganha campo próprio, para
--    quem atende num número e conversa em outro.
alter table public.professionals
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists instagram text,
  add column if not exists linkedin text;

-- Quem já tinha telefone cadastrado usava aquele número como WhatsApp — sem
-- este backfill, todo anúncio existente perderia o botão de WhatsApp.
update public.professionals
  set whatsapp = phone
  where whatsapp is null and coalesce(phone, '') <> '';

-- 2) Pedidos de contato: o cliente deixa o número e pede para ser chamado.
create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  -- Quem pediu, quando estava logado. Nulo para pedido feito sem conta.
  requester_id uuid references public.profiles (id) on delete set null,
  name text not null,
  phone text not null,
  message text not null default '',
  status text not null default 'new' check (status in ('new', 'contacted', 'archived')),
  created_at timestamptz not null default now(),
  contacted_at timestamptz
);

create index if not exists contact_requests_professional_idx
  on public.contact_requests (professional_id, status, created_at desc);

alter table public.contact_requests enable row level security;

-- Qualquer visitante pode pedir contato, com ou sem login: exigir conta aqui
-- só afastaria quem está com pressa de resolver um problema em casa.
drop policy if exists "qualquer pessoa pede contato" on public.contact_requests;
create policy "qualquer pessoa pede contato"
  on public.contact_requests for insert
  with check (true);

-- Só o dono do anúncio lê e atualiza os pedidos que recebeu. Não há policy de
-- leitura pública: são dados de contato de terceiros.
drop policy if exists "dono vê os pedidos do próprio anúncio" on public.contact_requests;
create policy "dono vê os pedidos do próprio anúncio"
  on public.contact_requests for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = contact_requests.professional_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "dono atualiza os pedidos do próprio anúncio" on public.contact_requests;
create policy "dono atualiza os pedidos do próprio anúncio"
  on public.contact_requests for update
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = contact_requests.professional_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = contact_requests.professional_id
        and p.owner_id = auth.uid()
    )
  );

-- 3) A view pública precisa enxergar os campos novos (ela lista colunas uma a
--    uma justamente para nunca devolver `document`).
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, created_at
from public.professionals
where suspended = false;

grant select on public.professionals_public to anon, authenticated;


-- ───── 0023_varios_servicos.sql ─────
-- Um anúncio, vários serviços.
--
-- Até aqui cada anúncio tinha UMA categoria, então quem faz encanamento e
-- elétrica precisava criar dois anúncios — dois cadastros para manter, duas
-- reputações separadas, e a pessoa aparecendo duas vezes na busca. Agora o
-- anúncio carrega uma lista.
--
-- `category` continua existindo como a categoria principal: é o que aparece
-- em destaque no card e é o que o patrocínio de categoria usa. `categories`
-- é a lista completa, e é ela que a busca consulta.

alter table public.professionals
  add column if not exists categories text[] not null default '{}';

-- Backfill: sem isto, todo anúncio existente sairia da busca no instante em
-- que ela passasse a filtrar pela lista.
update public.professionals
  set categories = array[category]
  where categories = '{}' and coalesce(category, '') <> '';

-- Índice GIN é o que faz `categories @> array['Encanador']` usar índice em
-- vez de varrer a tabela inteira.
create index if not exists professionals_categories_idx
  on public.professionals using gin (categories);

-- Garante que a categoria principal está sempre dentro da lista — a busca
-- olha só para `categories`, então uma principal fora dela sumiria da busca
-- pela própria categoria.
create or replace function public.sincroniza_categorias()
returns trigger
language plpgsql
as $$
begin
  if new.category is not null and new.category <> '' and not (new.category = any(new.categories)) then
    new.categories := array_prepend(new.category, new.categories);
  end if;
  return new;
end;
$$;

drop trigger if exists professionals_sincroniza_categorias on public.professionals;
create trigger professionals_sincroniza_categorias
  before insert or update on public.professionals
  for each row execute function public.sincroniza_categorias();

-- A view pública lista colunas uma a uma (para nunca devolver `document`),
-- então precisa ser recriada para enxergar a coluna nova.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, created_at
from public.professionals
where suspended = false;

grant select on public.professionals_public to anon, authenticated;


-- ───── 0024_whatsapp_confirmado.sql ─────
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


-- ───── 0025_endereco.sql ─────
-- Endereço de atendimento do anúncio.
--
-- É opcional de propósito. Metade de quem anuncia aqui trabalha na casa do
-- cliente — eletricista, diarista, montador — e para essa gente o endereço
-- que existe é o de casa. Obrigar a preencher seria obrigar a publicar onde
-- se mora, em troca de nada.
--
-- Para quem tem ponto fixo (salão, oficina, loja), é o contrário: sem o
-- endereço, o anúncio não serve. Daí os campos existirem, e aparecerem no
-- perfil só quando preenchidos.
--
-- Guardado em partes, e não numa linha de texto só, porque bairro é o
-- recorte que as pessoas usam de verdade para escolher perto de casa — e um
-- campo separado permite filtrar por ele depois sem migração nova.

alter table public.professionals
  add column if not exists cep text,
  add column if not exists street text,
  add column if not exists street_number text,
  add column if not exists neighborhood text;

-- A view pública lista colunas uma a uma, então precisa ser recriada para
-- enxergar as novas. O endereço é público por natureza: é para ser
-- encontrado que ele foi preenchido.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  cep, street, street_number, neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, created_at
from public.professionals
where suspended = false;

grant select on public.professionals_public to anon, authenticated;


-- ───── 0026_politicas_storage_fotos.sql ─────
-- Regras de acesso ao bucket das fotos.
--
-- Marcar o bucket como público libera a LEITURA — é o que faz a foto
-- aparecer no anúncio para quem nem tem conta. Não libera a ESCRITA: sem as
-- políticas abaixo, o envio é recusado e o anúncio de pessoa física, que
-- exige foto de rosto, não consegue ser publicado.
--
-- O caminho do arquivo é `<id do dono>/<hora>.<extensão>` (ver
-- src/lib/storage.ts), e é isso que sustenta a regra: a primeira pasta do
-- caminho tem que ser o id de quem está enviando. Assim ninguém sobrescreve
-- nem apaga a foto de outra pessoa, mesmo chamando a API direto — a
-- verificação é do servidor, não da tela.

-- Leitura: qualquer um, inclusive visitante sem conta. É uma foto de
-- anúncio; escondê-la de quem procura anularia o propósito dela.
drop policy if exists "fotos de anuncio: leitura publica" on storage.objects;
create policy "fotos de anuncio: leitura publica"
  on storage.objects for select
  using (bucket_id = 'professional-photos');

-- Envio: só logado, e só dentro da própria pasta.
drop policy if exists "fotos de anuncio: envio do dono" on storage.objects;
create policy "fotos de anuncio: envio do dono"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'professional-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Substituir a própria foto (trocar a imagem do anúncio).
drop policy if exists "fotos de anuncio: troca do dono" on storage.objects;
create policy "fotos de anuncio: troca do dono"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'professional-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'professional-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Apagar a própria foto.
drop policy if exists "fotos de anuncio: exclusao do dono" on storage.objects;
create policy "fotos de anuncio: exclusao do dono"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'professional-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ───── 0027_pausar_anuncio.sql ─────
-- Pausar o próprio anúncio — e proteger a suspensão da administração.
--
-- São duas coisas que pareciam uma só e não são:
--
-- `suspended` é castigo: a administração tira o anúncio do ar por denúncia
-- procedente. `paused` é escolha: quem viajou, está sem agenda ou parou de
-- atender por um tempo tira o anúncio da busca e o traz de volta quando
-- quiser, sem perder avaliações nem ter que cadastrar tudo de novo.
--
-- Guardar as duas no mesmo campo seria dar ao anunciante suspenso o botão de
-- se reativar. E é exatamente isso que acontecia até aqui: a policy de update
-- deixa o dono mudar qualquer coluna do próprio anúncio, e `suspended` é uma
-- coluna. Quem fosse tirado do ar por golpe podia voltar sozinho chamando a
-- API — não pela tela, que não oferece o botão, mas RLS não protege o que a
-- tela esconde.

alter table public.professionals
  add column if not exists paused boolean not null default false;

-- Impede que o dono mexa no que é da administração.
--
-- Admin continua podendo tudo: a checagem só exige que quem alterou
-- `suspended` esteja em `public.admins`.
create or replace function public.professionals_protege_suspensao()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.suspended is distinct from old.suspended
     or new.suspended_reason is distinct from old.suspended_reason then
    if not exists (select 1 from public.admins a where a.user_id = auth.uid()) then
      raise exception 'Só a administração pode suspender ou reativar um anúncio.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists professionals_protege_suspensao_trigger on public.professionals;
create trigger professionals_protege_suspensao_trigger
  before update on public.professionals
  for each row execute function public.professionals_protege_suspensao();

-- A busca pública ignora tanto o suspenso quanto o pausado. Para quem
-- procura, os dois são a mesma coisa: não está atendendo agora.
--
-- O anúncio pausado continua existindo para o dono (a tela do painel lê a
-- tabela, não a view), com avaliações e histórico intactos.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  cep, street, street_number, neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;


-- ───── 0028_antiabuso_e_expurgo.sql ─────
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


select 'PARTE 2 de 7 PRONTA' as resultado;
