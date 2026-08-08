-- Regras de acesso ao bucket das fotos.
--
-- Marcar o bucket como público libera a LEITURA — é o que faz a foto
-- aparecer no anúncio para quem nem tem conta. Não libera a ESCRITA: sem as
-- políticas abaixo, o envio é recusado e o anúncio de pessoa física, que
-- exige foto de rosto, não consegue ser publicado.
--
-- O caminho do arquivo é `<id do dono>/<hora>.<extensão>` (ver
-- src/lib/storage.ts), e é isso que sustenta a regra: a primeira pasta do
-- caminho tem que ser o id de quem está enviando. Assim ninguém sobrescreve
-- nem apaga a foto de outra pessoa, mesmo chamando a API direto — a
-- verificação é do servidor, não da tela.

-- Leitura: qualquer um, inclusive visitante sem conta. É uma foto de
-- anúncio; escondê-la de quem procura anularia o propósito dela.
drop policy if exists "fotos de anuncio: leitura publica" on storage.objects;
create policy "fotos de anuncio: leitura publica"
  on storage.objects for select
  using (bucket_id = 'professional-photos');

-- Envio: só logado, e só dentro da própria pasta.
drop policy if exists "fotos de anuncio: envio do dono" on storage.objects;
create policy "fotos de anuncio: envio do dono"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'professional-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Substituir a própria foto (trocar a imagem do anúncio).
drop policy if exists "fotos de anuncio: troca do dono" on storage.objects;
create policy "fotos de anuncio: troca do dono"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'professional-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'professional-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Apagar a própria foto.
drop policy if exists "fotos de anuncio: exclusao do dono" on storage.objects;
create policy "fotos de anuncio: exclusao do dono"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'professional-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
