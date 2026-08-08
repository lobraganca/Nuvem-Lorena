-- Regras de RLS — leitura pública, escrita restrita ao dono/usuário autenticado.

alter table public.profiles enable row level security;
alter table public.professionals enable row level security;
alter table public.reviews enable row level security;
alter table public.subscriptions enable row level security;

-- profiles: qualquer um lê (nome/avatar são públicos), só o dono edita o seu.
drop policy if exists "profiles são públicos para leitura" on public.profiles;
create policy "profiles são públicos para leitura"
  on public.profiles for select
  using (true);

drop policy if exists "usuário edita o próprio profile" on public.profiles;
create policy "usuário edita o próprio profile"
  on public.profiles for update
  using (auth.uid() = id);

-- professionals: leitura pública (é um marketplace de busca); só o dono
-- autenticado cria/edita/apaga o seu próprio anúncio.
drop policy if exists "profissionais são públicos para leitura" on public.professionals;
create policy "profissionais são públicos para leitura"
  on public.professionals for select
  using (true);

drop policy if exists "usuário cria seu próprio anúncio" on public.professionals;
create policy "usuário cria seu próprio anúncio"
  on public.professionals for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "dono edita o próprio anúncio" on public.professionals;
create policy "dono edita o próprio anúncio"
  on public.professionals for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "dono apaga o próprio anúncio" on public.professionals;
create policy "dono apaga o próprio anúncio"
  on public.professionals for delete
  to authenticated
  using (auth.uid() = owner_id);

-- reviews: leitura pública; só usuário autenticado cria a sua própria
-- avaliação (um review por usuário por profissional, ver unique no schema);
-- só o autor edita/apaga a própria avaliação.
drop policy if exists "avaliações são públicas para leitura" on public.reviews;
create policy "avaliações são públicas para leitura"
  on public.reviews for select
  using (true);

drop policy if exists "usuário autenticado avalia" on public.reviews;
create policy "usuário autenticado avalia"
  on public.reviews for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "autor edita a própria avaliação" on public.reviews;
create policy "autor edita a própria avaliação"
  on public.reviews for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "autor apaga a própria avaliação" on public.reviews;
create policy "autor apaga a própria avaliação"
  on public.reviews for delete
  to authenticated
  using (auth.uid() = user_id);

-- subscriptions: só o dono do profissional enxerga/gerencia as assinaturas
-- dele. Escritas de confirmação de pagamento (marcar active/verified/boosted)
-- são feitas pela Edge Function do webhook usando a service_role key, que
-- ignora RLS — por isso não existe policy pública de update aqui.
drop policy if exists "dono vê as assinaturas do seu anúncio" on public.subscriptions;
create policy "dono vê as assinaturas do seu anúncio"
  on public.subscriptions for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = subscriptions.professional_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "dono inicia assinatura para o seu anúncio" on public.subscriptions;
create policy "dono inicia assinatura para o seu anúncio"
  on public.subscriptions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = subscriptions.professional_id
        and p.owner_id = auth.uid()
    )
  );
