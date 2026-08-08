-- auth.uid() passa a ler uma variavel de sessao, para simular usuarios.
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('teste.uid', true), '')::uuid $$;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001','dono@x.com'),
  ('aaaaaaaa-0000-0000-0000-000000000002','cliente@x.com') on conflict do nothing;
insert into public.profiles (id, full_name, cpf) values
  ('aaaaaaaa-0000-0000-0000-000000000001','Dono','11111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002','Cliente','22222222222') on conflict (id) do update set cpf=excluded.cpf;

insert into public.professionals (id, owner_id, name, category, phone)
values ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Loja','Pintor','319') on conflict do nothing;

insert into public.reviews (id, professional_id, user_id, rating, comment, tags)
values ('cccccccc-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002',2,'ruim',array['Atrasou'])
on conflict do nothing;

\echo '=== 1. DONO tenta reescrever a nota 2 -> 5 (DEVE FALHAR) ==='
set teste.uid = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.reviews set rating=5, comment='otimo' where id='cccccccc-0000-0000-0000-000000000001';

\echo '=== 2. DONO responde a avaliacao (DEVE FUNCIONAR) ==='
update public.reviews set reply='Desculpe, vamos melhorar' where id='cccccccc-0000-0000-0000-000000000001';
select rating, reply, replied_at is not null as marcou_data from public.reviews where id='cccccccc-0000-0000-0000-000000000001';

\echo '=== 3. AUTOR muda a propria nota (DEVE FUNCIONAR) ==='
set teste.uid = 'aaaaaaaa-0000-0000-0000-000000000002';
update public.reviews set rating=4, comment='melhorou' where id='cccccccc-0000-0000-0000-000000000001';
select rating, comment from public.reviews where id='cccccccc-0000-0000-0000-000000000001';

\echo '=== 4. AUTOR tenta apagar a resposta do profissional (DEVE FALHAR) ==='
update public.reviews set reply=null where id='cccccccc-0000-0000-0000-000000000001';

\echo '=== 5. ESTRANHO tenta mexer (DEVE FALHAR) ==='
set teste.uid = 'aaaaaaaa-0000-0000-0000-000000000001';
reset teste.uid;
update public.reviews set rating=1 where id='cccccccc-0000-0000-0000-000000000001';
