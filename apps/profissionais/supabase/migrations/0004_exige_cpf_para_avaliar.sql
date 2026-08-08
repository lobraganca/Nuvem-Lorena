-- Reforça no banco (não só na UI) que só usuário com CPF confirmado no
-- profile pode inserir avaliação.

drop policy if exists "usuário autenticado avalia" on public.reviews;

drop policy if exists "usuário autenticado com CPF avalia" on public.reviews;
create policy "usuário autenticado com CPF avalia"
  on public.reviews for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.cpf is not null
    )
  );
