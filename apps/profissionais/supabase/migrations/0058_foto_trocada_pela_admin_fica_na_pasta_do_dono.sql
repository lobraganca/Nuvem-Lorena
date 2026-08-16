-- --------------------------------------------------------------------
-- A foto que a administração troca ficava guardada na pasta errada.
--
-- As fotos de anúncio são organizadas por dono: `<uid>/<carimbo>.jpg`, e a
-- policy da 0026 confere justamente essa primeira pasta —
-- `(storage.foldername(name))[1] = auth.uid()::text`. É o que impede uma
-- pessoa de sobrescrever a foto de outra.
--
-- O painel administrativo edita o cadastro dos outros, inclusive a foto (é
-- para isso que ele existe: enquadrar direito a foto de quem mandou torta).
-- Como a tela envia o arquivo com o id de quem está logado, a foto de um
-- pedreiro corrigida pela administração ia parar dentro da pasta da
-- administração. Funciona — o bucket é público, o cadastro aponta para a
-- URL e a imagem aparece —, mas guarda o arquivo debaixo do nome errado.
--
-- Isso importa no dia em que a pessoa pedir para sumir. A pasta é a única
-- coisa que liga um arquivo a um dono no Storage: uma limpeza por pasta
-- deixaria para trás exatamente as fotos que passaram pelo painel, e são
-- as das pessoas cujo cadastro alguém já teve que corrigir.
--
-- A tela passa a enviar na pasta do dono do cadastro. Para isso a policy
-- precisa deixar a administração escrever fora da própria pasta — e só ela.
-- --------------------------------------------------------------------
drop policy if exists "fotos de anuncio: envio do admin" on storage.objects;
create policy "fotos de anuncio: envio do admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'professional-photos'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists "fotos de anuncio: troca do admin" on storage.objects;
create policy "fotos de anuncio: troca do admin"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'professional-photos'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  )
  with check (
    bucket_id = 'professional-photos'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  );
