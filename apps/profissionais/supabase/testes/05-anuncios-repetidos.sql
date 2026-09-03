-- Testa as travas de anúncio repetido (migration 0029).

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values ('eeeeeeee-0000-0000-0000-000000000001', 'multi@teste.com');

create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'eeeeeeee-0000-0000-0000-000000000001'::uuid $$;

-- Primeiro anúncio: fotógrafo em Itabirito.
insert into public.professionals (id, owner_id, name, category, categories, city, uf, bio, phone, entity_type)
values ('eeeeeeee-0000-0000-0000-000000000010', 'eeeeeeee-0000-0000-0000-000000000001',
        'Estúdio Lemos', 'Fotógrafo', array['Fotógrafo','Filmagem'], 'Itabirito', 'MG', 'Casamentos', '(31) 90000-0001', 'pf');

-- 1. Segundo anúncio com serviço diferente: permitido (é o caso legítimo).
insert into public.professionals (id, owner_id, name, category, categories, city, uf, bio, phone, entity_type)
values ('eeeeeeee-0000-0000-0000-000000000011', 'eeeeeeee-0000-0000-0000-000000000001',
        'Aulas com Léo', 'Professor de música', array['Professor de música'], 'Itabirito', 'MG', 'Violão', '(31) 90000-0002', 'pf');

-- 2. Repetir um serviço que já existe: barrado.
do $$
begin
  begin
    insert into public.professionals (owner_id, name, category, categories, city, uf, bio, phone, entity_type)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'Fotos Lemos 2', 'Fotógrafo',
            array['Fotógrafo'], 'Itabirito', 'MG', 'Mais fotos', '(31) 90000-0003', 'pf');
    raise exception 'FALHOU: permitiu repetir o serviço na mesma cidade';
  exception when others then
    if position('já tem um anúncio' in sqlerrm) = 0 then raise; end if;
  end;
end $$;

-- 3. Mesmo serviço em OUTRA cidade: permitido.
insert into public.professionals (owner_id, name, category, categories, city, uf, bio, phone, entity_type)
values ('eeeeeeee-0000-0000-0000-000000000001', 'Estúdio Lemos Ouro Preto', 'Fotógrafo',
        array['Fotógrafo'], 'Ouro Preto', 'MG', 'Casamentos', '(31) 90000-0004', 'pf');

-- 4. Editar o próprio anúncio sem mudar nada continua funcionando (o trigger
--    não pode confundir a linha com ela mesma).
update public.professionals set bio = 'Casamentos e ensaios'
 where id = 'eeeeeeee-0000-0000-0000-000000000010';

-- 5. Teto de 5 anúncios por conta.
insert into public.professionals (owner_id, name, category, categories, city, uf, bio, phone, entity_type)
values ('eeeeeeee-0000-0000-0000-000000000001', 'Marido de aluguel', 'Marido de aluguel',
        array['Marido de aluguel'], 'Itabirito', 'MG', 'Reparos', '(31) 90000-0005', 'pf'),
       ('eeeeeeee-0000-0000-0000-000000000001', 'Jardins', 'Jardineiro',
        array['Jardineiro'], 'Itabirito', 'MG', 'Jardins', '(31) 90000-0006', 'pf');

do $$
begin
  begin
    insert into public.professionals (owner_id, name, category, categories, city, uf, bio, phone, entity_type)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'Sexto', 'Chaveiro',
            array['Chaveiro'], 'Itabirito', 'MG', 'Chaves', '(31) 90000-0007', 'pf');
    raise exception 'FALHOU: passou do teto de 5 anúncios';
  exception when others then
    if position('limite por conta' in sqlerrm) = 0 then raise; end if;
  end;
end $$;

rollback;

\echo 'OK: anúncios repetidos e teto por conta'
