-- Exige CPF do usuário logado antes de avaliar, para reduzir avaliações
-- falsas/anônimas. O CPF fica salvo uma vez no profile (ligado à conta
-- Google usada no login) e é reaproveitado nas próximas avaliações.

alter table public.profiles
  add column if not exists cpf text;

-- Um CPF só pode estar associado a uma conta.
create unique index if not exists profiles_cpf_key
  on public.profiles (cpf)
  where cpf is not null;
