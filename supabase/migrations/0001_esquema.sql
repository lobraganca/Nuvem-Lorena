-- Avena — esquema inicial
--
-- As tabelas saem direto de src/types.ts. O que muda em relação ao navegador:
-- cada linha passa a ter um dono, e é o dono que decide quem lê.
--
-- Convenções:
--   * ids são uuid gerados pelo banco, não pelo navegador;
--   * datas de calendário são `date`, instantes são `timestamptz`;
--   * dinheiro é `numeric(10,2)` — nunca `float`, que erra centavos;
--   * tudo em snake_case, que é o costume do Postgres.
--
-- As políticas de acesso ficam em 0002_seguranca.sql. Este arquivo só cria a
-- estrutura; sozinho, ele deixa tudo trancado, porque RLS sem política nega.

-- ---------------------------------------------------------------------------
-- Pessoas
-- ---------------------------------------------------------------------------

-- Quem é cada conta. O id é o mesmo de auth.users: o Supabase cuida de e-mail,
-- senha e confirmação por SMS, e esta tabela guarda só o que é do Avena.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  username text unique,
  bio text not null default '',
  avatar_url text,
  avatar_color text not null default '#2f4131',
  is_private boolean not null default false,
  account_type text not null default 'turista'
    check (account_type in ('turista', 'profissional')),

  -- Papel de administradora. NUNCA pode ser editado pelo próprio dono da
  -- linha: a política em 0002 impede, e é a única coisa que separa a Lorena
  -- de qualquer pessoa que se cadastre.
  role text not null default 'usuario' check (role in ('usuario', 'admin')),

  accepted_legal_version text,
  accepted_legal_at timestamptz,
  created_at timestamptz not null default now()
);

comment on column public.profiles.role is
  'Só a administradora pode mudar. Ver a política em 0002_seguranca.sql.';

-- Cria o perfil no instante em que a conta nasce, para não existir usuário
-- autenticado sem perfil — estado que quebraria toda consulta com join.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Quem segue quem. Duas linhas separadas em vez de um array: assim dá para
-- perguntar "quem me segue" sem varrer a tabela inteira.
create table public.follows (
  follower_id uuid not null references public.profiles on delete cascade,
  followed_id uuid not null references public.profiles on delete cascade,
  -- Perfil privado aceita o seguidor depois; público já nasce aceito.
  accepted boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create index on public.follows (followed_id);

-- ---------------------------------------------------------------------------
-- Empresas e o que elas vendem
-- ---------------------------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles on delete set null,
  name text not null,
  type text not null
    check (type in ('Agência', 'Guia', 'Experiência', 'Restaurante', 'Hotel')),
  plan_tier text not null default 'Básico'
    check (plan_tier in ('Básico', 'Pro', 'Avançado')),
  description text not null default '',
  city text not null,
  state text,
  country text not null default 'Brasil',
  email text not null,
  phone text,
  website text,
  cadastur text,

  -- Só a administradora escreve estes dois. O selo de verificado vale
  -- exatamente o quanto for difícil de obter.
  status text not null default 'ativa' check (status in ('ativa', 'suspensa')),
  verified boolean not null default false,

  claim_status text not null default 'reivindicada'
    check (claim_status in ('reivindicada', 'nao-reivindicada')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index on public.businesses (city);
create index on public.businesses (owner_id);

-- Os dados legais ficam em tabela separada da empresa, e não ao lado dela, por
-- um motivo: a empresa é pública e isto não é. Duas tabelas permitem duas
-- políticas; uma tabela só obrigaria a esconder colunas, que o Postgres faz
-- pior e é mais fácil de errar.
create table public.business_legal (
  business_id uuid primary key references public.businesses on delete cascade,
  kind text not null check (kind in ('juridica', 'fisica')),
  legal_name text not null,
  document text not null,
  state_registration text,
  trade_name text,
  cep text not null,
  address text not null,
  address_extra text,
  district text not null,
  city text not null,
  state text not null,
  representative text not null,
  representative_cpf text not null,
  business_email text not null,
  business_phone text not null,
  updated_at timestamptz not null default now()
);

create table public.tours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  title text not null,
  description text,
  price_from numeric(10,2),
  duration_hours numeric(4,1),
  difficulty text check (difficulty in ('Leve', 'Moderada', 'Pesada')),
  accessibility text[] not null default '{}',
  season_months smallint[] not null default '{}',
  cancellation_policy text not null default 'moderada'
    check (cancellation_policy in ('flexivel', 'moderada', 'rigida')),
  capacity_per_day integer check (capacity_per_day is null or capacity_per_day > 0),
  photos text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index on public.tours (business_id);

-- ---------------------------------------------------------------------------
-- Reservas
-- ---------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null references public.profiles on delete cascade,
  business_id uuid not null references public.businesses on delete restrict,
  tour_id uuid not null references public.tours on delete restrict,

  -- Copiados no momento da compra: se o passeio mudar de nome ou de preço
  -- amanhã, o comprovante de hoje continua contando a verdade de hoje.
  business_name text not null,
  tour_title text not null,
  unit_price numeric(10,2) not null,

  travel_date date not null,
  travelers integer not null check (travelers > 0),

  subtotal numeric(10,2) not null,
  service_fee_rate numeric(5,4) not null,
  service_fee numeric(10,2) not null,
  total_price numeric(10,2) not null,
  business_payout numeric(10,2) not null,

  status text not null default 'aguardando-pagamento'
    check (status in ('aguardando-pagamento', 'confirmada', 'expirada', 'cancelada')),
  cancellation_policy text not null,
  payment_due_at timestamptz,
  cancelled_at timestamptz,
  refund_amount numeric(10,2),
  reviewed boolean not null default false,
  created_at timestamptz not null default now()
);

create index on public.bookings (traveler_id);
create index on public.bookings (business_id);
create index on public.bookings (tour_id, travel_date);

-- Quem vai no passeio. Fora da reserva porque é a linha mais sensível do
-- banco: nome e documento de gente que nem sempre tem conta aqui. Hoje o app
-- não coleta documento (ver src/lib/dataCollection.ts); a coluna existe para
-- quando a lista de embarque for obrigatória, e nasce separada para poder ser
-- apagada sozinha.
create table public.booking_participants (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings on delete cascade,
  name text not null,
  document_type text check (document_type in ('CPF', 'RG', 'Passaporte')),
  document text,
  birth_date date
);

create index on public.booking_participants (booking_id);

-- O pagamento é escrito só pelo servidor, ao receber a confirmação do Mercado
-- Pago. Nenhuma política dá insert ou update a quem quer que seja: quem grava
-- aqui é a função com service_role, do lado de fora do RLS. Um navegador que
-- pudesse escrever nesta tabela poderia declarar-se pago.
create table public.payments (
  booking_id uuid primary key references public.bookings on delete cascade,
  method text not null check (method in ('pix', 'cartao')),
  paid_at timestamptz not null,
  reference text not null,
  provider_payment_id text unique,
  amount numeric(10,2) not null
);

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null references public.profiles on delete cascade,
  tour_id uuid not null references public.tours on delete cascade,
  business_id uuid not null references public.businesses on delete cascade,
  date date not null,
  people integer not null check (people > 0),
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (traveler_id, tour_id, date)
);

create table public.wishlist (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null references public.profiles on delete cascade,
  tour_id uuid not null references public.tours on delete cascade,
  business_id uuid not null references public.businesses on delete cascade,
  -- Copiados para a lista continuar legível se o passeio sair do ar.
  title text not null,
  business_name text not null,
  city text,
  state text,
  price_from numeric(10,2),
  done_at timestamptz,
  created_at timestamptz not null default now(),
  unique (traveler_id, tour_id)
);

-- ---------------------------------------------------------------------------
-- Avaliações, conversas e chamados
-- ---------------------------------------------------------------------------

-- Uma avaliação por reserva, garantido pela chave: é o que sustenta a frase
-- "só avalia quem foi".
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings on delete cascade,
  business_id uuid not null references public.businesses on delete cascade,
  author_id uuid not null references public.profiles on delete cascade,
  tour_title text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '',
  recommends boolean not null default true,
  created_at timestamptz not null default now()
);

create index on public.reviews (business_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles on delete cascade,
  -- Uma conversa é com uma pessoa OU com uma empresa, nunca com as duas.
  recipient_id uuid references public.profiles on delete cascade,
  business_id uuid references public.businesses on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(recipient_id, business_id) = 1)
);

create index on public.messages (recipient_id, created_at);
create index on public.messages (business_id, created_at);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles on delete cascade,
  booking_id uuid references public.bookings on delete set null,
  subject text not null,
  message text not null,
  protocol text not null unique,
  status text not null default 'aberto'
    check (status in ('aberto', 'respondido', 'resolvido')),
  reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Anúncios e memórias
-- ---------------------------------------------------------------------------

-- A única coisa pela qual a empresa paga. Cadastrar é gratuito.
create table public.boosts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  tour_id uuid not null references public.tours on delete cascade,
  days integer not null check (days > 0),
  price_paid numeric(10,2) not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Sem pagamento confirmado, o anúncio não sobe. Escrito só pelo servidor.
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index on public.boosts (tour_id, starts_at, ends_at);

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  placement text not null,
  kind text not null check (kind in ('institucional', 'publicidade')),
  title text not null,
  body text not null default '',
  image_url text,
  link_url text,
  link_label text,
  active boolean not null default false,
  starts_at date,
  ends_at date,
  created_at timestamptz not null default now()
);

create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  booking_id uuid references public.bookings on delete set null,
  title text not null,
  category text not null default 'Outro',
  lat double precision not null,
  lng double precision not null,
  location_name text not null,
  city text not null,
  state text,
  country text not null default 'Brasil',
  date date not null,
  photos text[] not null default '{}',
  diary text,
  rating smallint check (rating between 1 and 5),
  mood text,
  notes text,
  created_at timestamptz not null default now()
);

create index on public.experiences (owner_id, date desc);

-- ---------------------------------------------------------------------------
-- RLS ligado em tudo, sem exceção.
--
-- Ligar aqui, e não junto das políticas, é de propósito: se alguém esquecer de
-- escrever a política de uma tabela nova, o resultado é ninguém enxergar nada
-- — o erro aparece na hora. O contrário, tabela aberta por esquecimento, não
-- aparece nunca até vazar.
-- ---------------------------------------------------------------------------

alter table public.profiles              enable row level security;
alter table public.follows               enable row level security;
alter table public.businesses            enable row level security;
alter table public.business_legal        enable row level security;
alter table public.tours                 enable row level security;
alter table public.bookings              enable row level security;
alter table public.booking_participants  enable row level security;
alter table public.payments              enable row level security;
alter table public.waitlist              enable row level security;
alter table public.wishlist              enable row level security;
alter table public.reviews               enable row level security;
alter table public.messages              enable row level security;
alter table public.support_tickets       enable row level security;
alter table public.boosts                enable row level security;
alter table public.banners               enable row level security;
alter table public.experiences           enable row level security;
