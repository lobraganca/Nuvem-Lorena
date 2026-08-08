-- Resposta do profissional à avaliação + favoritos do usuário.

-- Resposta do dono do anúncio a uma avaliação recebida.
alter table public.reviews
  add column if not exists reply text,
  add column if not exists replied_at timestamptz;

-- O dono do anúncio pode atualizar (só) o campo de resposta de reviews do
-- seu profissional. A policy de update já existente ("autor edita a própria
-- avaliação") continua valendo para o autor editar rating/comment; esta é
-- adicional, para o dono responder.
create policy "dono do anúncio responde a avaliação"
  on public.reviews for update
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = reviews.professional_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = reviews.professional_id
        and p.owner_id = auth.uid()
    )
  );

-- Favoritos: usuário autenticado favorita profissionais para achar depois.
create table if not exists public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, professional_id)
);

create index if not exists favorites_professional_idx on public.favorites (professional_id);

alter table public.favorites enable row level security;

create policy "usuário vê os próprios favoritos"
  on public.favorites for select
  to authenticated
  using (auth.uid() = user_id);

create policy "usuário favorita um profissional"
  on public.favorites for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "usuário remove o próprio favorito"
  on public.favorites for delete
  to authenticated
  using (auth.uid() = user_id);
