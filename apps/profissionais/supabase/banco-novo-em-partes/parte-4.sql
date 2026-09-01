-- Ei Itabirito — banco NOVO, PARTE 4 de 7
-- Projeto: ahigenhenzmsjxlmrzhz (o do Ei Itabirito)
-- Cole tudo, clique uma vez fora do texto (para não ficar nada selecionado) e toque em Run.
-- Migrations desta parte: 0041 a 0055

-- ───── 0041_limpar_cobrancas_abandonadas.sql ─────
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


-- ───── 0042_estatisticas_publicas.sql ─────
-- --------------------------------------------------------------------
-- Números reais para a tela de boas-vindas: "já são N profissionais",
-- "N avaliações", "N visitas a anúncios".
--
-- Profissionais e avaliações já dão para contar direto da tela, porque
-- `professionals_public` e `reviews` já são de leitura pública. Visitas
-- não: `profile_views` só é legível pelo dono de cada anúncio (é o dado
-- que alimenta o analytics do Empresa Plus), e está certo que continue
-- assim — o que a tela de boas-vindas precisa não é "quem viu o quê", é
-- só o total somado, sem apontar para nenhum anúncio específico.
--
-- Esta function devolve exatamente isso: um número, sem professional_id,
-- sem data, sem nada que identifique um anúncio. É o mesmo raciocínio já
-- usado em banner_contar_exibicao — contagem agregada não é o mesmo dado
-- que a linha individual, mesmo vindo da mesma tabela.
-- --------------------------------------------------------------------
create or replace function public.contagem_de_visitas()
returns bigint
language sql
security definer set search_path = public
as $$
  select count(*) from public.profile_views;
$$;

grant execute on function public.contagem_de_visitas() to anon, authenticated;


-- ───── 0043_banners_boas_vindas.sql ─────
-- --------------------------------------------------------------------
-- Onde o banner aparece.
--
-- Até aqui só existia um lugar para vender: a faixa de publicidade na
-- busca. Esta coluna abre um segundo — cartões dentro da lista "Tem gente
-- boa aqui do lado" da tela de boas-vindas —, sem duplicar tabela nem
-- política. É o mesmo inventário, o mesmo cadastro no admin, só um filtro
-- a mais.
--
-- 'busca' continua sendo o padrão: todo banner cadastrado antes desta
-- migração já era da busca, e não pode virar outra coisa sozinho.
-- --------------------------------------------------------------------
alter table public.banners
  add column if not exists local text not null default 'busca'
    check (local in ('busca', 'boas_vindas'));

create index if not exists banners_local_idx on public.banners (local, ativo, inicio, fim);


-- ───── 0044_pedidos_de_anuncio.sql ─────
-- --------------------------------------------------------------------
-- Pedidos de anúncio ("quero aparecer aqui").
--
-- Diferente de `suggestions`: uma sugestão é opinião sobre o app e não
-- precisa de resposta; isto é alguém querendo comprar, e sem o telefone
-- junto o pedido não vira venda nenhuma — a conversa de banner nesta
-- cidade acontece por WhatsApp, não por e-mail.
--
-- Mesmo padrão de segurança de `suggestions` e `reports`: qualquer um
-- envia (inclusive sem login), só admin lê.
-- --------------------------------------------------------------------
create table if not exists public.banner_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  nome text not null,
  contato text not null,
  -- Onde a pessoa quer aparecer. 'tanto_faz' é resposta legítima e comum:
  -- quem nunca anunciou não sabe a diferença entre os dois lugares, e
  -- obrigar a escolher só faria perder o pedido.
  local text not null default 'tanto_faz'
    check (local in ('busca', 'boas_vindas', 'tanto_faz')),
  cidade text,
  mensagem text,
  status text not null default 'novo'
    check (status in ('novo', 'em_conversa', 'fechado', 'sem_interesse')),
  created_at timestamptz not null default now()
);

alter table public.banner_leads enable row level security;

drop policy if exists "qualquer um pede para anunciar" on public.banner_leads;
create policy "qualquer um pede para anunciar"
  on public.banner_leads for insert
  with check (true);

-- Sem select público de propósito: são nome e telefone de comerciantes da
-- cidade. Uma lista dessas aberta na API é lista de contatos pronta para
-- quem quiser copiar.
drop policy if exists "admin vê os pedidos de anúncio" on public.banner_leads;
create policy "admin vê os pedidos de anúncio"
  on public.banner_leads for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "admin atualiza o pedido de anúncio" on public.banner_leads;
create policy "admin atualiza o pedido de anúncio"
  on public.banner_leads for update
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "admin apaga o pedido de anúncio" on public.banner_leads;
create policy "admin apaga o pedido de anúncio"
  on public.banner_leads for delete
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

create index if not exists banner_leads_status_idx
  on public.banner_leads (status, created_at desc);


-- ───── 0045_denuncia_exige_telefone_confirmado.sql ─────
-- --------------------------------------------------------------------
-- Denúncia só com número confirmado.
--
-- Estar logado já era exigido (0035), e isso resolveu o anônimo. Não
-- resolveu o barato: criar conta Google leva um minuto e não custa nada,
-- então quem quisesse derrubar um concorrente ainda podia abrir três
-- contas e mandar três denúncias. Do outro lado tem alguém cujo anúncio é
-- o ganha-pão.
--
-- Confirmar um número por código é a primeira barreira que custa algo
-- real: exige um chip, e um chip por denunciante. Não impede a denúncia
-- falsa — nada impede —, mas encarece a fábrica delas o suficiente para
-- deixar de valer a pena.
--
-- A regra vive aqui, no banco, e não só na tela: a tela some para quem
-- não confirmou, mas quem chama a API direto passaria por cima dela.
-- --------------------------------------------------------------------

-- `security definer` porque `auth.users` não é legível por quem está
-- logado — e nem deve ser. A função responde uma pergunta de sim ou não
-- sobre a *própria* pessoa (auth.uid()), sem devolver o número nem
-- qualquer outro dado de ninguém.
create or replace function public.tem_telefone_confirmado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and u.phone_confirmed_at is not null
  );
$$;

revoke all on function public.tem_telefone_confirmado() from public;
grant execute on function public.tem_telefone_confirmado() to authenticated;

drop policy if exists "quem está logado pode denunciar um anúncio" on public.reports;
drop policy if exists "só quem confirmou o número pode denunciar" on public.reports;
drop policy if exists so_quem_confirmou_o_numero_pode_denunciar on public.reports;

create policy so_quem_confirmou_o_numero_pode_denunciar
  on public.reports for insert
  to authenticated
  with check (
    -- `reporter_id` tem que ser quem está de fato pedindo: sem isto daria
    -- para estar logado e gravar a denúncia no nome de outra pessoa, que é
    -- pior do que o anônimo — é o anônimo com um culpado escolhido a dedo.
    reporter_id = auth.uid()
    and public.tem_telefone_confirmado()
  );


-- ───── 0046_admin_enxerga_a_propria_linha.sql ─────
-- --------------------------------------------------------------------
-- Cada pessoa pode descobrir se ela mesma é admin.
--
-- A tabela `admins` foi criada (0008) com RLS ligada e sem nenhuma policy
-- de select — de propósito, para ninguém se auto-promover. Só que o app
-- descobre quem é admin justamente lendo esta tabela (`isAdmin`), do
-- navegador, com o papel `authenticated`. Sem policy de leitura, essa
-- consulta volta vazia mesmo para quem tem a linha, e o painel responde
-- "Acesso restrito." para todo mundo — inclusive para a dona do app.
--
-- A falha ficou invisível porque `isAdmin` trata erro e vazio da mesma
-- forma ("não é admin"), que é o certo para a tela e péssimo para
-- diagnosticar: não havia diferença entre "não tem permissão" e "não é
-- admin".
--
-- A policy abaixo é a menor que resolve: cada um lê a PRÓPRIA linha e
-- nada mais. Não devolve a lista de admins a ninguém, e continua não
-- existindo insert/update/delete — promover alguém segue sendo coisa de
-- dentro do Supabase, como era a intenção da 0008.
-- --------------------------------------------------------------------

-- Nome sem acento, sem espaço e sem aspas, ao contrário do resto do
-- projeto: este bloco precisou ser colado à mão várias vezes no SQL
-- Editor até funcionar, e nome entre aspas é frágil no caminho até lá —
-- basta um aplicativo trocar as aspas retas por curvas para o Postgres
-- recusar. Aqui vale mais colar certo de primeira do que ler bonito.
drop policy if exists "cada um enxerga se é admin" on public.admins;
drop policy if exists cada_um_enxerga_se_e_admin on public.admins;
create policy cada_um_enxerga_se_e_admin
  on public.admins for select
  to authenticated
  using (user_id = auth.uid());

-- O Supabase já concede isto por padrão nas tabelas de `public`; repetido
-- aqui para o caso de a concessão ter sido revogada em algum momento — sem
-- ela, a policy sozinha não bastaria.
grant select on public.admins to authenticated;


-- ───── 0047_valor_dos_pagamentos.sql ─────
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


-- ───── 0048_visitas_ao_app.sql ─────
-- --------------------------------------------------------------------
-- Visitas ao app.
--
-- Já existia `profile_views` — quem abriu QUAL anúncio. É outra coisa:
-- aqui é quanta gente abriu o app, tenha ela procurado alguém ou não.
--
-- O que se guarda é uma linha com a hora, e mais nada. Sem IP, sem conta,
-- sem identificador de aparelho, sem página. Não dá para dizer que uma
-- visita é de fulano nem para ligar duas visitas à mesma pessoa — e é de
-- propósito: para mostrar "N visitas" na tela de início não é preciso
-- saber de quem, e o que não se guarda não vaza nem precisa de base legal
-- para ser guardado (LGPD).
--
-- Uma linha por sessão do navegador, não por página aberta: quem contasse
-- cada navegação teria um número que sobe sozinho enquanto a pessoa usa,
-- o que é vaidade, não informação. Essa parte é decidida no app (ver
-- `registrarVisita`), porque só ele sabe se a sessão é nova.
-- --------------------------------------------------------------------
create table if not exists public.visitas_app (
  id bigint generated always as identity primary key,
  criada_em timestamptz not null default now()
);

create index if not exists visitas_app_data_idx on public.visitas_app (criada_em desc);

alter table public.visitas_app enable row level security;

-- Qualquer pessoa registra a própria visita, inclusive sem login: é
-- exatamente quem abre o app pela primeira vez que precisa ser contado.
drop policy if exists "qualquer um registra a visita" on public.visitas_app;
drop policy if exists qualquer_um_registra_a_visita on public.visitas_app;
create policy qualquer_um_registra_a_visita
  on public.visitas_app for insert
  with check (true);

-- Sem select público: a tabela inteira não interessa a ninguém de fora, e
-- a tela precisa só do total. Vem pela função abaixo, no mesmo padrão de
-- `contagem_de_visitas` (0042) — um número, sem linha nenhuma junto.
create or replace function public.contagem_de_visitas_no_app()
returns bigint
language sql
security definer set search_path = public
as $$
  select count(*) from public.visitas_app;
$$;

grant execute on function public.contagem_de_visitas_no_app() to anon, authenticated;
grant insert on public.visitas_app to anon, authenticated;
grant usage, select on sequence public.visitas_app_id_seq to anon, authenticated;

-- Admin também enxerga as linhas, para poder olhar visitas por período.
drop policy if exists "admin vê as visitas" on public.visitas_app;
drop policy if exists admin_ve_as_visitas on public.visitas_app;
create policy admin_ve_as_visitas
  on public.visitas_app for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

grant select on public.visitas_app to authenticated;


-- ───── 0049_bairro_so_com_permissao.sql ─────
-- --------------------------------------------------------------------
-- O bairro passa a seguir a mesma caixa do resto do endereço.
--
-- Desde a 0037 a view escondia cep, rua e número de quem não marcou
-- "mostrar endereço" — mas devolvia o bairro para todo mundo. A intenção
-- na época era boa: bairro é o recorte que as pessoas usam para escolher
-- perto de casa, e ele sozinho não leva ninguém até a porta.
--
-- Só que a caixa no cadastro diz "mostrar endereço", e bairro é endereço.
-- Quem desmarcou entendeu que nada de onde mora seria publicado, e via o
-- bairro aparecer assim mesmo. Quando o que a tela promete e o que ela faz
-- divergem, quem decide é a promessa — ainda mais tratando-se de onde a
-- pessoa mora.
--
-- Vale para metade de quem anuncia aqui: eletricista, diarista, montador
-- trabalham na casa do cliente, e o endereço que eles têm é o de casa.
--
-- A view é recriada inteira porque `create or replace view` não aceita
-- mudar o tipo/origem de uma coluna existente. Colunas idênticas às da
-- 0039, exceto `neighborhood`.
-- --------------------------------------------------------------------
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  case when mostrar_endereco then neighborhood end as neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  mostrar_endereco, created_at
from public.professionals;

grant select on public.professionals_public to anon, authenticated;


-- ───── 0051_visitas_no_app_hoje.sql ─────
-- --------------------------------------------------------------------
-- Visitas ao app no dia de hoje.
--
-- A 0048 já conta o total acumulado. Este é o par dele na tela de início:
-- o total diz que o app existe há um tempo, e o de hoje diz que ele está
-- vivo agora — um número alto de total com zero hoje conta uma história
-- bem diferente de dois números subindo juntos.
--
-- Vem por função, e não por consulta direta, pelo mesmo motivo da 0048:
-- `visitas_app` não tem select público (só admin). A tela precisa de um
-- número, não das linhas, e é só isso que a função devolve.
--
-- O dia é o de Itabirito, não o de Greenwich. `now()` no Postgres é UTC,
-- e usar `date_trunc('day', now())` faria o contador zerar às 21h no
-- horário de quem usa o app — três horas antes da virada, todo dia.
-- --------------------------------------------------------------------
create or replace function public.contagem_de_visitas_no_app_hoje()
returns bigint
language sql
security definer set search_path = public
as $$
  select count(*) from public.visitas_app
  where criada_em >= (date_trunc('day', now() at time zone 'America/Sao_Paulo')
                      at time zone 'America/Sao_Paulo');
$$;

grant execute on function public.contagem_de_visitas_no_app_hoje() to anon, authenticated;


-- ───── 0052_confirmacao_segue_o_numero_usado.sql ─────
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


-- ───── 0053_cadastros_fora_do_ar_somem_da_view.sql ─────
-- --------------------------------------------------------------------
-- Cadastro suspenso ou pausado volta a sumir da busca pública.
--
-- A 0009 tirou os suspensos da leitura pública com uma policy de RLS:
-- `using (suspended = false)` em `professionals`. A policy está lá e está
-- certa — mas o app não lê a tabela, lê a view `professionals_public`. E
-- view no Postgres roda com os privilégios de quem a criou, não de quem a
-- consulta: ela passa por cima da RLS da tabela de origem. É o mesmo aviso
-- que o painel do Supabase mostra como "Security Definer View".
--
-- Por isso a 0039 carregava o filtro dentro da própria view
-- (`where suspended = false and paused = false`), compensando à mão o que
-- a RLS não conseguia aplicar ali.
--
-- A 0049 recriou a view inteira para esconder o bairro de quem não marcou
-- "mostrar endereço" — e o comentário dela diz "colunas idênticas às da
-- 0039, exceto neighborhood". As colunas eram; o `where` não veio junto.
-- Desde então:
--
--   * cadastro suspenso pela administração continuava aparecendo na busca
--     e na página pública, junto com o `suspended_reason` — que é anotação
--     interna e pode conter a acusação que motivou a suspensão;
--   * cadastro pausado pelo próprio dono continuava no ar, contrariando o
--     que a tela dele prometia.
--
-- Nenhum dos dois dava erro em lugar nenhum, porque o app pede a lista e a
-- lista vem. Só olhando a definição da view dá para ver o que sumiu.
--
-- O filtro volta para dentro da view. O painel administrativo, que precisa
-- justamente ver os suspensos, passa a ler a tabela `professionals` direto
-- — lá a RLS deixa admin ver tudo (policy da 0009) e recusa o resto, então
-- essa porta falha fechada para quem não é admin.
-- --------------------------------------------------------------------
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  case when mostrar_endereco then neighborhood end as neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;


-- ───── 0054_avaliar_sem_cpf_de_verdade.sql ─────
-- --------------------------------------------------------------------
-- Ninguém consegue avaliar: o banco ainda exige o CPF que o app parou de
-- pedir.
--
-- A 0004 gravou no banco a exigência de CPF para avaliar:
--
--   with check (auth.uid() = user_id and exists (
--     select 1 from public.profiles p
--     where p.id = auth.uid() and p.cpf is not null))
--
-- A 0033 — chamada "Avaliação sem CPF, com prova de contato" — desfez essa
-- decisão: explicou que o CPF nunca foi conferido contra a Receita, que
-- qualquer gerador da internet produz um válido, que guardá-lo para
-- liberar um comentário é coleta excessiva (LGPD, art. 6º, III), e criou a
-- etiqueta de contato registrado para ficar no lugar dele. Tirou o campo
-- da tela. Não tirou a policy.
--
-- Desde então o banco recusa toda avaliação de quem não tem CPF gravado no
-- perfil — e como o app deixou de perguntar, isso é todo mundo que entrou
-- depois. A tela dizia só "Não foi possível salvar a avaliação", porque o
-- erro do Supabase não é um `Error` e caía no texto genérico: nem a pessoa
-- nem nós ficávamos sabendo o motivo.
--
-- O custo disso não é uma tela quebrada. É a reputação da plataforma: numa
-- cidade pequena, com poucos cadastros, cada avaliação escrita vale
-- semanas de divulgação — e as que foram digitadas neste período estão
-- perdidas, com quem digitou achando que o app não funciona.
--
-- A regra volta a ser a da 0002, que é o que a 0033 pretendia: pessoa
-- logada avalia, e só em nome dela mesma. Quem chamou pelo app continua
-- ganhando a etiqueta `contato_confirmado`, calculada no servidor — que é
-- a distinção que a 0033 escolheu como substituta e que de fato funciona.
-- --------------------------------------------------------------------
drop policy if exists "usuário autenticado com CPF avalia" on public.reviews;
drop policy if exists "usuário autenticado avalia" on public.reviews;

create policy "usuário autenticado avalia"
  on public.reviews for insert
  to authenticated
  with check (auth.uid() = user_id);


-- ───── 0055_etiqueta_de_contato_a_prova_de_forja.sql ─────
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


select 'PARTE 4 de 7 PRONTA' as resultado;
