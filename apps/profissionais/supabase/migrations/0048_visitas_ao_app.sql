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
create policy "qualquer um registra a visita"
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
create policy "admin vê as visitas"
  on public.visitas_app for select
  to authenticated
  using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

grant select on public.visitas_app to authenticated;
