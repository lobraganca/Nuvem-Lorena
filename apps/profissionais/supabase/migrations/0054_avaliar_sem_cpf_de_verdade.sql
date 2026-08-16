-- --------------------------------------------------------------------
-- Ninguém consegue avaliar: o banco ainda exige o CPF que o app parou de
-- pedir.
--
-- A 0004 gravou no banco a exigência de CPF para avaliar:
--
--   with check (auth.uid() = user_id and exists (
--     select 1 from public.profiles p
--     where p.id = auth.uid() and p.cpf is not null))
--
-- A 0033 — chamada "Avaliação sem CPF, com prova de contato" — desfez essa
-- decisão: explicou que o CPF nunca foi conferido contra a Receita, que
-- qualquer gerador da internet produz um válido, que guardá-lo para
-- liberar um comentário é coleta excessiva (LGPD, art. 6º, III), e criou a
-- etiqueta de contato registrado para ficar no lugar dele. Tirou o campo
-- da tela. Não tirou a policy.
--
-- Desde então o banco recusa toda avaliação de quem não tem CPF gravado no
-- perfil — e como o app deixou de perguntar, isso é todo mundo que entrou
-- depois. A tela dizia só "Não foi possível salvar a avaliação", porque o
-- erro do Supabase não é um `Error` e caía no texto genérico: nem a pessoa
-- nem nós ficávamos sabendo o motivo.
--
-- O custo disso não é uma tela quebrada. É a reputação da plataforma: numa
-- cidade pequena, com poucos cadastros, cada avaliação escrita vale
-- semanas de divulgação — e as que foram digitadas neste período estão
-- perdidas, com quem digitou achando que o app não funciona.
--
-- A regra volta a ser a da 0002, que é o que a 0033 pretendia: pessoa
-- logada avalia, e só em nome dela mesma. Quem chamou pelo app continua
-- ganhando a etiqueta `contato_confirmado`, calculada no servidor — que é
-- a distinção que a 0033 escolheu como substituta e que de fato funciona.
-- --------------------------------------------------------------------
drop policy if exists "usuário autenticado com CPF avalia" on public.reviews;
drop policy if exists "usuário autenticado avalia" on public.reviews;

create policy "usuário autenticado avalia"
  on public.reviews for insert
  to authenticated
  with check (auth.uid() = user_id);
