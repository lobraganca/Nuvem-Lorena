-- 0065 — rastreamento de tipo de usuário e conclusão do onboarding.
--
-- O procurô serve dois tipos de usuário: profissionais (prestadores de
-- serviço) e empresas (contratantes). Ao entrar, a pessoa escolhe qual é,
-- e o app marca essa escolha e o status de conclusão do onboarding.
--
-- Este registro permite ao app saber: foi ou não foi escolhido tipo?
-- Já preencheu o formulário de cadastro? E quando.

create table if not exists public.user_onboarding (
  user_id uuid primary key references auth.users on delete cascade,
  user_type text not null check (user_type in ('professional', 'company')),
  completed boolean default false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Permite que o usuário logado leia e escreva apenas seu próprio registro.
alter table public.user_onboarding enable row level security;

create policy "Usuário lê seu próprio onboarding" on public.user_onboarding
  for select using (auth.uid() = user_id);

create policy "Usuário escreve seu próprio onboarding" on public.user_onboarding
  for insert with check (auth.uid() = user_id);

create policy "Usuário atualiza seu próprio onboarding" on public.user_onboarding
  for update using (auth.uid() = user_id);

-- Index para buscar tipo de usuário rapidamente.
create index if not exists idx_user_onboarding_type on public.user_onboarding(user_id, user_type);

-- Trigger para atualizar updated_at automaticamente.
create or replace function update_user_onboarding_timestamp()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger update_user_onboarding_timestamp_trigger
  before update on public.user_onboarding
  for each row
  execute function update_user_onboarding_timestamp();

-- Confere a si mesma.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.user_onboarding'::regclass
           and attname in ('user_id', 'user_type', 'completed', 'completed_at')
           and not attisdropped) = 4
  then 'PRONTO — user_onboarding foi criada com todas as colunas'
  else 'AINDA FALTA — as colunas nao foram criadas'
  end as resultado;
