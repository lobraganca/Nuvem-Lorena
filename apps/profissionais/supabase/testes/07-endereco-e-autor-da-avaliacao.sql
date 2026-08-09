-- Endereço só de quem marcou, e avaliação com autor.
--
-- O primeiro é o teste que importa: esconder o endereço na tela não esconde
-- nada, porque a API é pública e é ela que qualquer um consulta. Se a view
-- devolver a rua de quem não marcou a caixa, o app está entregando onde a
-- pessoa mora para quem souber abrir o endereço do banco no navegador.
--
-- Rode depois de supabase/banco-completo.sql.

insert into auth.users (id, email)
  values ('ffffffff-0000-0000-0000-000000000001', 'autor@teste.com')
  on conflict do nothing;
insert into public.profiles (id, full_name, avatar_url, cpf)
  values ('ffffffff-0000-0000-0000-000000000001', 'Joana Avaliadora',
          'https://exemplo.com/foto.jpg', '12345678901')
  on conflict (id) do update
    set full_name = excluded.full_name, avatar_url = excluded.avatar_url;

delete from public.professionals where id = 'ffffffff-0000-0000-0000-0000000000aa';
insert into public.professionals
  (id, owner_id, name, category, city, phone, cep, street, street_number, neighborhood)
values ('ffffffff-0000-0000-0000-0000000000aa', 'ffffffff-0000-0000-0000-000000000001',
        'Casa do Bolo', 'Confeiteira', 'Itabirito', '31999990000',
        '35450000', 'Rua Secreta', '42', 'Centro');

\echo '1) sem marcar: cep/rua/numero nulos, bairro presente'
select cep, street, street_number, neighborhood
  from public.professionals_public where id = 'ffffffff-0000-0000-0000-0000000000aa';

update public.professionals set mostrar_endereco = true
 where id = 'ffffffff-0000-0000-0000-0000000000aa';
\echo '2) depois de marcar: endereco completo'
select cep, street, street_number, neighborhood
  from public.professionals_public where id = 'ffffffff-0000-0000-0000-0000000000aa';

insert into public.reviews (professional_id, user_id, rating, tags, comment, contratou)
values ('ffffffff-0000-0000-0000-0000000000aa', 'ffffffff-0000-0000-0000-000000000001',
        5, array['Caprichoso'], 'Bolo maravilhoso', true);
\echo '3) avaliacao traz autor, foto, declaracao e data: esperado tudo t'
select autor_nome, autor_foto is not null as tem_foto, contratou,
       created_at is not null as tem_data
  from public.reviews_public where professional_id = 'ffffffff-0000-0000-0000-0000000000aa';

\echo '4) a view de avaliacoes nao pode expor cpf: esperado 0'
select count(*) as colunas_cpf from information_schema.columns
 where table_name = 'reviews_public' and column_name like '%cpf%';

delete from public.professionals where id = 'ffffffff-0000-0000-0000-0000000000aa';
