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
