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
