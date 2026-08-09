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

insert into storage.buckets (id, name, public)
  values ('banners', 'banners', true)
  on conflict (id) do nothing;

drop policy if exists "banners: leitura publica" on storage.objects;
create policy "banners: leitura publica"
  on storage.objects for select
  using (bucket_id = 'banners');

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
