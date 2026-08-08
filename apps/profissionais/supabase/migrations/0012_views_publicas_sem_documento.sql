-- Fecha exposição de dados sensíveis (LGPD): CPF/CNPJ do anunciante
-- (`professionals.document`) e CPF do avaliador (`profiles.cpf`) hoje vazam
-- para qualquer leitura pública via `select("*")`, porque a policy de select
-- é `using (true)`/`using (suspended = false)` na tabela inteira.
--
-- A partir daqui: leitura pública passa a usar views que omitem essas
-- colunas; a tabela crua só é lida diretamente por quem tem o próprio dado
-- (RLS `auth.uid() = id`/`owner_id`) ou é admin.

-- professionals_public: todas as colunas exceto `document`.
create or replace view public.professionals_public as
select
  id, owner_id, name, category, city, bio, phone, entity_type,
  company_name, photo_url, responsible_name,
  verified, verified_until, boosted, boosted_until,
  suspended, suspended_reason, created_at
from public.professionals;

grant select on public.professionals_public to anon, authenticated;

-- profiles_public: id, full_name, avatar_url, created_at — sem `cpf`.
create or replace view public.profiles_public as
select id, full_name, avatar_url, created_at
from public.profiles;

grant select on public.profiles_public to anon, authenticated;

-- profiles: a policy pública antiga (`using (true)`) devolvia a linha
-- inteira, inclusive `cpf`. Troca por uma policy que só permite ao próprio
-- dono ler a própria linha via select direto na tabela; leitura de
-- nome/avatar de outros usuários passa a ser feita via `profiles_public`.
drop policy if exists "profiles são públicos para leitura" on public.profiles;

create policy "usuário lê o próprio profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);
