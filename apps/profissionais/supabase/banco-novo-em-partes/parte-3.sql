-- Ei Itabirito — banco NOVO, PARTE 3 de 7
-- Projeto: ahigenhenzmsjxlmrzhz (o do Ei Itabirito)
-- Cole tudo, clique uma vez fora do texto (para não ficar nada selecionado) e toque em Run.
-- Migrations desta parte: 0029 a 0040

-- ───── 0029_limite_de_anuncios.sql ─────
-- Vários anúncios por pessoa, sem virar terra de ninguém.
--
-- Ter mais de um anúncio é legítimo: quem é fotógrafo e também dá aula de
-- violão tem duas vitrines diferentes, com fotos, textos e reputações
-- separadas — e amontoar isso num anúncio só piora para quem procura.
--
-- O que não pode é o mesmo serviço repetido. Cinco anúncios de "Eletricista"
-- na mesma cidade não informam nada a mais: só empurram os concorrentes para
-- baixo e transformam a busca numa disputa de quem cadastra mais vezes. Quem
-- perde é quem procura, que vê a mesma pessoa cinco vezes e desiste.
--
-- Duas travas, ambas no servidor:
--   1. Nenhum serviço repetido entre os anúncios da mesma pessoa na mesma
--      cidade.
--   2. Teto de anúncios por conta.

alter table public.professionals
  add column if not exists paused boolean not null default false;

create or replace function public.professionals_evita_repetidos()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  quantos int;
  conflito text;
begin
  -- 1. Serviço repetido na mesma cidade, entre anúncios do mesmo dono.
  select c into conflito
    from public.professionals p, unnest(p.categories) as c
   where p.owner_id = new.owner_id
     and p.id is distinct from new.id
     and lower(p.city) = lower(new.city)
     and c = any(new.categories)
   limit 1;

  if conflito is not null then
    raise exception 'Você já tem um anúncio de "%" em %. Edite o que existe em vez de criar outro igual.',
      conflito, new.city;
  end if;

  -- 2. Teto por conta. Cinco cobre com folga quem realmente faz coisas
  --    diferentes, e barra quem quer ocupar a busca.
  if tg_op = 'INSERT' then
    select count(*) into quantos from public.professionals where owner_id = new.owner_id;
    if quantos >= 5 then
      raise exception 'Você já tem 5 anúncios, que é o limite por conta.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists professionals_evita_repetidos_trigger on public.professionals;
create trigger professionals_evita_repetidos_trigger
  before insert or update on public.professionals
  for each row execute function public.professionals_evita_repetidos();


-- ───── 0030_reembolso_e_cancelamento.sql ─────
-- Guarda a que assinatura cada pagamento pertence.
--
-- `processed_payments` nasceu só para impedir que o mesmo aviso do Mercado
-- Pago fosse processado duas vezes: bastava o número do pagamento. Agora ela
-- precisa responder a outra pergunta — "qual foi o último pagamento desta
-- assinatura?" —, que é o que permite devolver o dinheiro de quem desiste
-- dentro dos 7 dias do direito de arrependimento.
--
-- Sem esta coluna, o reembolso teria de sair da conversa com o Mercado Pago a
-- cada pedido, e um cancelamento que depende de uma consulta a mais é um
-- cancelamento que falha na hora errada.

alter table public.processed_payments
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null;

create index if not exists processed_payments_subscription_idx
  on public.processed_payments (subscription_id, processed_at desc);


-- ───── 0031_limite_destaques.sql ─────
-- Teto de 5 destaques por categoria e cidade, com lista de espera.
--
-- Destaque só destaca enquanto é escasso. Se metade dos eletricistas de
-- Itabirito turbinar, todo mundo pagou para ficar igual — e o produto morre
-- de sucesso: ninguém renova algo que não muda nada. O limite protege quem
-- comprou, não a plataforma.
--
-- Quando esgota, o pedido vira lista de espera em vez de venda perdida. Isso
-- também é o melhor termômetro de preço que existe: categoria com fila é
-- categoria onde o destaque está barato demais.

create table if not exists public.destaque_espera (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  category text not null,
  city text not null,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (professional_id, category, city)
);

alter table public.destaque_espera enable row level security;

drop policy if exists "dono entra na fila do proprio anuncio" on public.destaque_espera;
create policy "dono entra na fila do proprio anuncio"
  on public.destaque_espera for insert
  to authenticated
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "dono ve a propria fila" on public.destaque_espera;
create policy "dono ve a propria fila"
  on public.destaque_espera for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "dono sai da fila" on public.destaque_espera;
create policy "dono sai da fila"
  on public.destaque_espera for delete
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.owner_id = auth.uid()
    )
  );

-- Admin lê a fila inteira: é dali que sai a decisão de preço.
drop policy if exists "admin ve toda a fila" on public.destaque_espera;
create policy "admin ve toda a fila"
  on public.destaque_espera for select
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

/**
 * Quantas vagas de destaque restam numa categoria/cidade.
 *
 * `security definer` porque a contagem precisa enxergar todos os anúncios,
 * inclusive os que a pessoa não veria — e o que ela recebe de volta é só um
 * número, nunca a lista de quem são.
 */
create or replace function public.vagas_de_destaque(p_category text, p_city text)
returns int
language sql
security definer set search_path = public
stable
as $$
  select greatest(
    0,
    5 - (
      select count(*)
        from public.professionals p
       where lower(p.city) = lower(p_city)
         and p_category = any(p.categories)
         and p.suspended = false
         and p.paused = false
         and p.boosted = true
         and (p.boosted_until is null or p.boosted_until > now())
    )
  )::int
$$;

grant execute on function public.vagas_de_destaque(text, text) to authenticated, anon;


-- ───── 0032_indicacoes.sql ─────
-- Indicações: quem a cidade procurou e não achou.
--
-- Busca vazia é o momento mais informativo do app e o mais desperdiçado. A
-- pessoa acabou de dizer exatamente o que precisa, não encontrou, e vai
-- embora — e essa demanda, que é a lista do que falta em Itabirito, se perde.
--
-- Aqui ela vira duas coisas: a lista de quem prospectar (com nome e telefone
-- de gente real, indicada por quem confia nela) e o termômetro do que a
-- cidade procura sem oferta.
--
-- O termo buscado é gravado junto mesmo quando ninguém indica ninguém: saber
-- que 40 pessoas procuraram "soldador" e não acharam já vale sozinho.

create table if not exists public.indicacoes (
  id uuid primary key default gen_random_uuid(),
  /** O que a pessoa procurava quando não achou. */
  servico_buscado text,
  cidade text,
  /** Quem ela indica — tudo opcional: às vezes só se lembra do apelido. */
  nome_indicado text,
  contato_indicado text,
  mensagem text,
  /** Quem indicou, se estava logada. Vira null se a conta for apagada. */
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'nova' check (status in ('nova','contatada','descartada')),
  created_at timestamptz not null default now()
);

alter table public.indicacoes enable row level security;

-- Qualquer pessoa indica, com ou sem conta: exigir login aqui perderia
-- justamente a indicação de quem passou uma vez pelo app.
drop policy if exists "qualquer pessoa indica" on public.indicacoes;
create policy "qualquer pessoa indica"
  on public.indicacoes for insert
  with check (true);

drop policy if exists "so admin le indicacoes" on public.indicacoes;
create policy "so admin le indicacoes"
  on public.indicacoes for select
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "so admin atualiza indicacoes" on public.indicacoes;
create policy "so admin atualiza indicacoes"
  on public.indicacoes for update
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create index if not exists indicacoes_status_idx on public.indicacoes (status, created_at desc);

-- Mesmo freio das outras tabelas abertas: sem login não pode significar sem
-- limite. 10 por hora entre anônimos cobre uso real com folga.
create or replace function public.indicacoes_freia_abuso()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recentes int;
begin
  select count(*) into recentes
    from public.indicacoes
   where created_at > now() - interval '1 hour'
     and (user_id is not distinct from new.user_id);
  if recentes >= 10 then
    raise exception 'Muitas indicações seguidas. Tente novamente mais tarde.';
  end if;
  return new;
end;
$$;

drop trigger if exists indicacoes_freia_abuso_trigger on public.indicacoes;
create trigger indicacoes_freia_abuso_trigger
  before insert on public.indicacoes
  for each row execute function public.indicacoes_freia_abuso();


-- ───── 0033_avaliacao_sem_cpf.sql ─────
-- Avaliação sem CPF, com prova de contato.
--
-- Pedir CPF para avaliar não impedia avaliação falsa: o número nunca foi
-- conferido contra a Receita, e qualquer gerador na internet produz um CPF
-- válido. Barrava só quem não pensou em burlar — e cobrava de todo mundo o
-- preço da desconfiança, num app onde a avaliação já é o passo mais frágil.
--
-- Pior: guardar CPF para liberar um comentário é coleta excessiva (LGPD,
-- art. 6º, III). Aumenta muito a gravidade de um vazamento para resolver um
-- problema que ele não resolvia.
--
-- O que substitui é mais barato e mais verdadeiro: registrar quando alguém
-- realmente pediu o contato do profissional, e marcar a avaliação de quem
-- fez isso. Quem procura passa a distinguir "avaliação de quem chamou" de
-- opinião solta — que é a única distinção que importa para confiar.
--
-- Não é trava, é etiqueta. Travar avaliação a quem chamou pelo app deixaria
-- de fora quem achou o número aqui e ligou pelo telefone — e no começo, com
-- pouca gente, uma trava dessas seca a reputação antes de ela existir.

create table if not exists public.contatos_registrados (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  /** whatsapp | telefone | pedido */
  tipo text not null,
  created_at timestamptz not null default now()
);

create index if not exists contatos_registrados_par_idx
  on public.contatos_registrados (professional_id, user_id);

alter table public.contatos_registrados enable row level security;

-- Qualquer visitante registra o próprio contato; ninguém lê a tabela pelo
-- app (ela só alimenta a etiqueta, calculada no gatilho abaixo).
drop policy if exists "qualquer pessoa registra contato" on public.contatos_registrados;
create policy "qualquer pessoa registra contato"
  on public.contatos_registrados for insert
  with check (true);

drop policy if exists "dono ve os contatos do proprio anuncio" on public.contatos_registrados;
create policy "dono ve os contatos do proprio anuncio"
  on public.contatos_registrados for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.owner_id = auth.uid()
    )
  );

alter table public.reviews
  add column if not exists contato_confirmado boolean not null default false;

/**
 * Marca a avaliação de quem realmente pediu o contato.
 *
 * Calculado no servidor, no momento da gravação: se viesse do navegador,
 * seria só mais um campo que qualquer um manda como quiser — e uma etiqueta
 * de confiança que se pode forjar é pior do que nenhuma.
 */
create or replace function public.reviews_marca_contato()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.contato_confirmado := exists (
    select 1 from public.contatos_registrados c
     where c.professional_id = new.professional_id
       and c.user_id = new.user_id
  );
  return new;
end;
$$;

drop trigger if exists reviews_marca_contato_trigger on public.reviews;
create trigger reviews_marca_contato_trigger
  before insert on public.reviews
  for each row execute function public.reviews_marca_contato();

-- O CPF deixa de ser exigido. A coluna continua existindo para não apagar
-- dado de quem já preencheu sem aviso — quem quiser sumir com o seu usa
-- "Excluir minha conta", e a limpeza geral fica para uma migração própria,
-- decidida com calma.
comment on column public.profiles.cpf is
  'Legado: não é mais pedido para avaliar (ver migration 0033).';


-- ───── 0034_etiquetas_do_anuncio.sql ─────
-- Etiquetas de atendimento no anúncio.
--
-- Hoje o anúncio diz o que a pessoa faz e onde. Não diz *quando* nem *como* —
-- e é justamente isso que quem procura pergunta primeiro no WhatsApp:
-- "atende sábado?", "vai até o Praia?", "é urgente, dá pra hoje?". Cada uma
-- dessas perguntas é uma conversa que só existe porque o anúncio não
-- respondeu antes, e boa parte delas termina sem contratação.
--
-- Texto livre em vez de uma tabela de opções porque a lista vai mudar
-- (bairro, forma de pagamento, atendimento a idosos), e uma lista que muda
-- não merece uma migração por item. O que a tela oferece é fechado; a coluna
-- só guarda.
alter table public.professionals
  add column if not exists atributos text[] not null default '{}';

-- Teto por anúncio: quem marca tudo não está informando nada, e a etiqueta
-- perde exatamente o valor que a torna útil — ser um recorte.
alter table public.professionals
  drop constraint if exists professionals_atributos_limite;
alter table public.professionals
  add constraint professionals_atributos_limite
  check (array_length(atributos, 1) is null or array_length(atributos, 1) <= 8);

-- Índice GIN pelo mesmo motivo de `categories`: a busca por etiqueta é
-- "contém", e sem ele vira varredura da tabela inteira a cada filtro.
create index if not exists professionals_atributos_idx
  on public.professionals using gin (atributos);

-- A view precisa ser recriada para a coluna aparecer para quem procura: sem
-- isto a etiqueta existe no banco, é salva pelo painel e não chega à busca.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  cep, street, street_number, neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;


-- ───── 0035_denuncia_com_identificacao.sql ─────
-- Denúncia só de quem está identificado.
--
-- Até aqui qualquer pessoa denunciava sem login, e o raciocínio original era
-- defensável: o golpe pode atingir quem nem conta tem. Na prática, o que essa
-- porta aberta produz é outra coisa — denúncia anônima é a ferramenta mais
-- barata que existe para tirar um concorrente do ar. Custa um clique, não tem
-- dono, e do outro lado tem uma pessoa cujo anúncio é o ganha-pão dela.
--
-- Exigir login não impede a denúncia legítima: quem foi vítima de golpe tem
-- todo o interesse em se identificar, e entrar leva o tempo de um toque no
-- Google. Impede a denúncia gratuita, que é o que se quer impedir.
--
-- Vale também como consequência jurídica: comunicar falsamente crime é o
-- art. 340 do Código Penal, e denunciação caluniosa é o art. 339 — nenhum dos
-- dois significa nada se não houver a quem imputar a comunicação. Sem autor,
-- o aviso na tela é só decoração.
drop policy if exists "qualquer um pode denunciar um anúncio" on public.reports;
-- Também a nova, para esta migration poder rodar duas vezes sem erro (é o
-- que o arquivo único faz quando alguém o cola de novo).
drop policy if exists "quem está logado pode denunciar um anúncio" on public.reports;

create policy "quem está logado pode denunciar um anúncio"
  on public.reports for insert
  to authenticated
  -- `reporter_id` tem que ser quem está de fato pedindo: sem isto daria para
  -- estar logado e gravar a denúncia no nome de outra pessoa, que é pior do
  -- que o anônimo — é o anônimo com um culpado escolhido a dedo.
  with check (reporter_id = auth.uid());


-- ───── 0036_desde_quando.sql ─────
-- "Está no app desde…" e "tem selo desde…".
--
-- Tempo é a prova social que ninguém consegue comprar num dia. Um anúncio de
-- dois anos com selo mantido há um ano e meio diz algo que nota nenhuma diz:
-- essa pessoa continua aqui, continua pagando para ser conferida, e ninguém
-- a tirou do ar nesse tempo todo. É o sinal que mais protege quem procura
-- contra o anúncio criado ontem para aplicar um golpe amanhã.
--
-- `created_at` já existia e serve para o primeiro. Faltava o segundo:
-- `verified_until` só diz até quando vale, e é reescrito a cada renovação —
-- ele nunca soube dizer desde quando.
alter table public.professionals
  add column if not exists verified_since timestamptz;

-- Quem já tem selo hoje não pode aparecer sem data: sem isto, o app diria
-- "com selo desde —" para toda a base atual. A aproximação usa a data do
-- cadastro, que é o mais próximo da verdade que este banco consegue provar.
update public.professionals
  set verified_since = created_at
  where verified = true and verified_since is null;

-- Carimba na virada de "sem selo" para "com selo", e só nela: a renovação
-- mensal reescreve `verified_until` toda vez, e recarimbar aqui zeraria
-- justamente o tempo que a coluna existe para acumular. Quem deixa o selo
-- cair e volta meses depois recomeça a contagem — porque foi isso mesmo que
-- aconteceu, e a data precisa dizer a verdade.
create or replace function public.professionals_carimba_selo()
returns trigger
language plpgsql
as $$
begin
  if new.verified = true and coalesce(old.verified, false) = false then
    new.verified_since := now();
  elsif new.verified = false then
    new.verified_since := null;
  end if;
  return new;
end;
$$;

drop trigger if exists professionals_carimba_selo_trigger on public.professionals;
create trigger professionals_carimba_selo_trigger
  before update on public.professionals
  for each row execute function public.professionals_carimba_selo();

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  cep, street, street_number, neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;


-- ───── 0037_avaliacao_com_autor_e_contratacao.sql ─────
-- Três coisas que faltavam na avaliação, e o endereço opcional no anúncio.
--
-- 1) QUEM AVALIOU. A avaliação aparecia solta: estrelas, etiquetas e texto,
--    sem nome, sem foto e sem data. Opinião sem rosto vale pouco — é o mesmo
--    comentário anônimo que ninguém leva a sério na internet — e ainda deixa
--    o profissional sem saber de quem foi.
--
-- 2) SE CONTRATOU MESMO. Havia `contato_confirmado`, calculado sozinho a
--    partir de quem pediu o contato pelo app. Não cobre quem achou o número
--    aqui e ligou pelo telefone, e o app não tem como saber isso — só a
--    pessoa sabe. Passa a existir a declaração dela: `contratou`.
--
-- 3) MOSTRAR OU NÃO O ENDEREÇO. Endereço é dado sensível para quem trabalha
--    em casa — e boa parte de quem anuncia aqui é manicure, confeiteira,
--    costureira, gente que atende na própria sala. O campo era preenchido
--    para o CEP achar a cidade e o bairro, e o endereço inteiro ia parar no
--    anúncio sem ninguém ter escolhido isso.

-- ── 2) "Confirmo que contratei" ───────────────────────────────────────────
--
-- Declaração da pessoa, não dedução do sistema. Fica separada de
-- `contato_confirmado` de propósito: uma é o que o app viu acontecer, a
-- outra é o que a pessoa afirma. Quando as duas batem, a avaliação é o mais
-- forte que este app consegue oferecer.
alter table public.reviews
  add column if not exists contratou boolean not null default false;

comment on column public.reviews.contratou is
  'Declarado por quem avaliou: contratou de fato o serviço. Diferente de contato_confirmado, que é observado pelo app.';

-- ── 3) Endereço só se a pessoa quiser ─────────────────────────────────────
--
-- Padrão `false`: quem já preencheu o endereço para o CEP completar a cidade
-- nunca disse que queria a rua e o número no anúncio, e assumir que sim é
-- decidir por ela sobre onde ela mora. Quem tem ponto fixo e quer ser
-- achado liga a chave — e aí é escolha, não descuido.
alter table public.professionals
  add column if not exists mostrar_endereco boolean not null default false;

-- A view pública não pode *entregar* o endereço de quem não marcou a caixa.
-- Esconder na tela não esconde na API, e é a API que qualquer um consulta:
-- se a coluna sair daqui preenchida, basta abrir o endereço do banco no
-- navegador para ler a rua e o número de todo mundo.
--
-- Bairro continua saindo sempre: ele situa a região sem dizer onde é a
-- porta, que é a diferença entre "atende no Centro" e "moro na rua tal, 10".
-- O CEP entra no mesmo balde da rua — CEP de rua, em cidade pequena, é
-- endereço.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

-- ── 1) Avaliação com autor ────────────────────────────────────────────────
--
-- View em vez de join no cliente: sem ela o app precisaria de uma consulta a
-- mais por avaliação, e a página de um profissional bem avaliado faria trinta
-- idas ao banco para montar uma lista.
--
-- Junta com `profiles_public`, não com `profiles`. A tabela só é legível
-- pelo próprio dono desde a migration 0012 (é o que impede o CPF de vazar),
-- então um join direto devolveria nome nulo para todo mundo menos você — a
-- avaliação dos outros continuaria anônima, que é exatamente o defeito que
-- esta migration existe para corrigir.
--
-- Sem `security_invoker`: a view roda como dona e é isso que faz o nome
-- público chegar a quem lê. O que ela expõe já é público por definição —
-- avaliação (policy de leitura pública) e nome/foto (profiles_public).
drop view if exists public.reviews_public;
create view public.reviews_public as
select
  r.id, r.professional_id, r.user_id, r.rating, r.tags, r.comment,
  r.contato_confirmado, r.contratou, r.reply, r.replied_at, r.created_at,
  p.full_name as autor_nome,
  p.avatar_url as autor_foto
from public.reviews r
left join public.profiles_public p on p.id = r.user_id;

grant select on public.reviews_public to anon, authenticated;


-- ───── 0038_catalogo_de_servicos.sql ─────
-- Catálogo de serviços do anúncio.
--
-- Até aqui o anúncio dizia o ofício ("Eletricista") e um texto livre. Serve
-- para o autônomo; não serve para quem oferece uma lista de coisas
-- diferentes — o hotel com hospedagem, salão de eventos e day use; o
-- laboratório com trinta exames; a loja com ajuste e customização. Essas
-- pessoas hoje precisariam escrever tudo na descrição, onde ninguém acha
-- nada e nada pode ser filtrado.
--
-- É tabela, e não um campo de texto ou um jsonb, por causa do que vem depois:
-- buscar por "exame de sangue" e achar o laboratório. Isso não se faz dentro
-- de um parágrafo, e migrar texto livre para tabela depois é bem mais caro
-- do que começar assim.
--
-- Sem preço, de propósito. O app direciona: mostra quem faz o quê e entrega
-- o contato. Preço na tela envelhece sozinho — a tabela muda e o anúncio
-- fica prometendo o valor do ano passado —, vira reclamação contra a
-- plataforma quando o cobrado é outro, e empurra todo mundo para a briga de
-- quem cobra menos, que é o oposto do que uma boa avaliação constrói.

-- Se este arquivo já foi rodado numa versão que tinha preço, as colunas
-- saem aqui — rodar de novo é seguro.
alter table if exists public.servicos_oferecidos
  drop column if exists preco_centavos;
alter table if exists public.servicos_oferecidos
  drop column if exists unidade;

create table if not exists public.servicos_oferecidos (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  nome text not null,
  descricao text not null default '',
  /** Ordem escolhida pelo dono; empate desempata pela data. */
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists servicos_oferecidos_anuncio_idx
  on public.servicos_oferecidos (professional_id, ordem);

alter table public.servicos_oferecidos enable row level security;

-- Leitura pública: é catálogo, existe para ser visto.
drop policy if exists "catalogo é público para leitura" on public.servicos_oferecidos;
create policy "catalogo é público para leitura"
  on public.servicos_oferecidos for select
  using (true);

-- Escrita só do dono do anúncio, conferida no banco. A tela esconder o botão
-- não impede ninguém de chamar a API com o id de um anúncio alheio.
drop policy if exists "dono edita o catálogo do próprio anúncio" on public.servicos_oferecidos;
create policy "dono edita o catálogo do próprio anúncio"
  on public.servicos_oferecidos for all
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.owner_id = auth.uid()
    )
  );

-- Teto por anúncio. Sem ele, um catálogo de mil linhas transforma a página
-- do anúncio numa rolagem infinita e a busca numa consulta cara — e ninguém
-- lê mil linhas de preço.
create or replace function public.limita_catalogo()
returns trigger
language plpgsql
as $$
declare
  quantos integer;
begin
  select count(*) into quantos
    from public.servicos_oferecidos
   where professional_id = new.professional_id;
  if quantos >= 40 then
    raise exception 'Cada anúncio pode ter até 40 serviços no catálogo.';
  end if;
  return new;
end;
$$;

drop trigger if exists limita_catalogo_trigger on public.servicos_oferecidos;
create trigger limita_catalogo_trigger
  before insert on public.servicos_oferecidos
  for each row execute function public.limita_catalogo();

-- Nome vazio vira linha invisível no catálogo, que a pessoa não entende por
-- que está lá e não consegue apagar sem adivinhar.
alter table public.servicos_oferecidos
  drop constraint if exists servicos_oferecidos_nome_nao_vazio;
alter table public.servicos_oferecidos
  add constraint servicos_oferecidos_nome_nao_vazio
  check (length(btrim(nome)) between 2 and 80);


-- ───── 0039_especialidade.sql ─────
-- Especialidade do profissional.
--
-- A categoria diz o ofício ("Dentista", "Pintor", "Advogado"); ela é fechada
-- de propósito, porque é o que a busca filtra e o que faz dois anúncios
-- serem comparáveis. Mas o ofício sozinho esconde a diferença que faz a
-- pessoa escolher: quem procura aparelho não quer qualquer dentista, quer
-- ortodontista; quem vai pintar a casa não quer o pintor de portão; quem
-- precisa de inventário não quer o advogado trabalhista.
--
-- Texto livre, e não uma segunda lista fechada, por um motivo prático: cada
-- ofício tem as suas especialidades, e manter uma lista por ofício — as da
-- medicina sozinhas passam de cinquenta — seria uma lista que nunca está
-- certa e que envelhece sem ninguém perceber. Aqui quem sabe o nome certo é
-- quem exerce.
--
-- Curto de propósito (60 caracteres): é uma especialidade, não a segunda
-- descrição do anúncio. Sem o limite, este campo viraria o lugar onde se
-- escreve "o melhor da região, atendemos 24h, faça seu orçamento" — que é
-- exatamente o que a descrição já é.
alter table public.professionals
  add column if not exists especialidade text;

alter table public.professionals
  drop constraint if exists professionals_especialidade_tamanho;
alter table public.professionals
  add constraint professionals_especialidade_tamanho
  check (especialidade is null or length(btrim(especialidade)) <= 60);

drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;


-- ───── 0040_banners.sql ─────
-- Banners de publicidade na tela de busca.
--
-- É a terceira fonte de renda, e a única que não depende de o anunciante ter
-- um anúncio no app: o selo e o destaque só servem a quem está cadastrado
-- aqui; um banner vende para a ótica, a farmácia e o supermercado da cidade,
-- que não são "profissionais" no sentido do app mas querem aparecer para
-- quem é da cidade.
--
-- Quem cadastra é a administração, não o anunciante. Isso é decisão de
-- produto, não preguiça: banner é o único lugar do app onde uma imagem de
-- terceiro ocupa a tela inteira de quem procura, e deixar isso na mão de
-- quem paga é abrir a porta para propaganda enganosa, imagem imprópria e
-- concorrente comprando espaço para difamar. Com o cadastro na mão dela, a
-- venda passa por uma conversa — que é como publicidade local funciona
-- mesmo.

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),

  /** Quem está anunciando. Aparece no rodapé do banner. */
  anunciante text not null,
  /** Texto curto sobre a imagem, para quando ela não carregar. */
  titulo text not null default '',
  imagem_url text not null,

  /**
   * Para onde o banner leva.
   *
   * Aceita link externo (site, WhatsApp, Instagram do anunciante) ou um
   * caminho interno do app (`/profissional/<id>`, quando o anunciante também
   * tem anúncio aqui). Nulo quer dizer banner sem clique — serve para aviso
   * institucional.
   */
  link text,

  /**
   * Segmentação, ambas opcionais.
   *
   * `cidade` nula = aparece em qualquer cidade. `categoria` nula = aparece
   * em qualquer busca; preenchida, só quando a pessoa filtrou por aquele
   * serviço — que é o que permite vender "quero aparecer para quem procura
   * eletricista".
   */
  cidade text,
  categoria text,

  inicio date not null default current_date,
  fim date not null,

  /**
   * ── O lado comercial ────────────────────────────────────────────────────
   *
   * O pagamento acontece fora do app: Pix, dinheiro, boleto — o que a
   * Lorena combinar com o comércio. O app não cobra e não processa; ele
   * **lembra**, que é o que falta quando a venda é de porta em porta.
   *
   * Sem estes campos, daqui a três meses ela teria dez banners no ar e
   * nenhum jeito de saber quem pagou quanto, quem já venceu e para qual
   * número ligar para renovar. É assim que dinheiro vaza numa operação
   * pequena: não por falta de cliente, por falta de anotação.
   */
  contato_anunciante text,
  valor_centavos integer check (valor_centavos is null or valor_centavos >= 0),
  pago boolean not null default false,
  observacao text,

  /** Desligar sem apagar: o histórico e os números da campanha ficam. */
  ativo boolean not null default true,

  /**
   * Contagens. Ficam na própria linha, e não numa tabela de eventos, porque
   * o que a venda precisa é do total — "seu banner apareceu 4.200 vezes e
   * teve 130 cliques". Uma tabela de eventos daria o detalhe por dia ao
   * custo de milhares de linhas por semana, e ninguém aqui vai olhar isso.
   */
  exibicoes integer not null default 0,
  cliques integer not null default 0,

  created_at timestamptz not null default now()
);

alter table public.banners
  drop constraint if exists banners_periodo_valido;
alter table public.banners
  add constraint banners_periodo_valido check (fim >= inicio);

create index if not exists banners_ativos_idx
  on public.banners (ativo, inicio, fim);

alter table public.banners enable row level security;

-- Leitura pública, mas só do que está no ar hoje. Um banner fora do período
-- ou desligado não pode ser lido nem chamando a API direto: se a filtragem
-- fosse só na tela, quem soubesse consultar veria as campanhas encerradas e
-- as futuras — inclusive de concorrentes.
drop policy if exists "banners no ar são públicos" on public.banners;
create policy "banners no ar são públicos"
  on public.banners for select
  using (ativo = true and current_date between inicio and fim);

drop policy if exists "admin vê todos os banners" on public.banners;
create policy "admin vê todos os banners"
  on public.banners for select
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "admin cria banner" on public.banners;
create policy "admin cria banner"
  on public.banners for insert
  to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "admin edita banner" on public.banners;
create policy "admin edita banner"
  on public.banners for update
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "admin apaga banner" on public.banners;
create policy "admin apaga banner"
  on public.banners for delete
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- ── Contagem ──────────────────────────────────────────────────────────────
--
-- Funções, e não um `update` direto do app: a policy de update é só de
-- admin, e tem que continuar sendo — senão qualquer visitante poderia
-- reescrever o link do banner. `security definer` deixa a função somar o
-- contador sem abrir a tabela para escrita.
--
-- `where` repetindo a condição de estar no ar: sem isso, dava para inflar os
-- números de uma campanha encerrada, e número inflado numa venda é o tipo de
-- coisa que destrói a confiança de um cliente pequeno.
create or replace function public.banner_contar_exibicao(p_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.banners
     set exibicoes = exibicoes + 1
   where id = p_id and ativo = true and current_date between inicio and fim;
$$;

create or replace function public.banner_contar_clique(p_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.banners
     set cliques = cliques + 1
   where id = p_id and ativo = true and current_date between inicio and fim;
$$;

grant execute on function public.banner_contar_exibicao(uuid) to anon, authenticated;
grant execute on function public.banner_contar_clique(uuid) to anon, authenticated;

-- ── Onde ficam as imagens ─────────────────────────────────────────────────
--
-- Bucket criado por SQL de propósito: criar à mão no painel é um passo a
-- mais para errar, e um bucket com nome trocado só dá erro quando alguém
-- tenta enviar a primeira imagem — longe daqui, e sem dizer o motivo.
insert into storage.buckets (id, name, public)
  values ('banners', 'banners', true)
  on conflict (id) do nothing;

drop policy if exists "banners: leitura publica" on storage.objects;
create policy "banners: leitura publica"
  on storage.objects for select
  using (bucket_id = 'banners');

-- Escrita só de admin. Ao contrário das fotos de anúncio, aqui não há "pasta
-- do dono": quem envia é sempre a administração.
drop policy if exists "banners: envio do admin" on storage.objects;
create policy "banners: envio do admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'banners'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "banners: troca do admin" on storage.objects;
create policy "banners: troca do admin"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'banners'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "banners: remocao do admin" on storage.objects;
create policy "banners: remocao do admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'banners'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  );


select 'PARTE 3 de 7 PRONTA' as resultado;
