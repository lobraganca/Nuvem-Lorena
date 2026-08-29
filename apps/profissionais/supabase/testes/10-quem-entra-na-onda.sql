-- Quem uma vaga alcança, e quem ela NÃO alcança.
--
-- As ondas são o coração do app de emprego, e cada linha errada aqui é uma
-- pessoa incomodada à toa ou uma pessoa que perdeu a vaga dela sem saber.
-- Este teste fixa as quatro regras que valem:
--
--   1. Sem telefone confirmado, ninguém entra em onda nenhuma.
--   2. Cadastro pausado ou suspenso não entra (a view já filtra).
--   3. "Onde quero trabalhar" alcança igual ao que a pessoa oferece.
--   4. A onda 3 para no ramo — vaga de pedreiro não chega em manicure.
--
-- Roda depois do banco-completo e das migrations, contra o Postgres local.

begin;

-- ── As pessoas do teste ────────────────────────────────────────────────
-- O telefone já confirmado no Auth (é o que a confirmação do app confere).
-- A Carla entra sem `phone_confirmed_at` de propósito: é ela que precisa
-- ficar de fora das ondas.
insert into auth.users (id, phone, phone_confirmed_at) values
  ('aaaa0000-0000-0000-0000-00000000000a', '5531999990001', now()),
  ('aaaa0000-0000-0000-0000-00000000000b', '5531999990002', now()),
  ('aaaa0000-0000-0000-0000-00000000000c', '5531999990003', null),
  ('aaaa0000-0000-0000-0000-00000000000d', '5531999990004', now()),
  ('aaaa0000-0000-0000-0000-00000000000e', '5531999990005', now()),
  ('aaaa0000-0000-0000-0000-00000000000f', '5531999990006', now())
on conflict do nothing;

insert into public.professionals
  (id, owner_id, name, category, categories, especialidade, city, uf, bio, phone, whatsapp, entity_type, areas_de_interesse)
values
  -- Encanador confirmado, especialidade bate: onda 1.
  ('e0000000-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-00000000000a',
   'Ana Confirmada', 'Encanador', '{Encanador}', 'Caça-vazamento', 'Itabirito', 'MG',
   'x', '(31) 99999-0001', '(31) 99999-0001', 'pf', '{}'),
  -- Encanador confirmado, sem a especialidade: onda 2.
  ('e0000000-0000-0000-0000-000000000002', 'aaaa0000-0000-0000-0000-00000000000b',
   'Bruno Encanador', 'Encanador', '{Encanador}', null, 'Itabirito', 'MG',
   'x', '(31) 99999-0002', '(31) 99999-0002', 'pf', '{}'),
  -- Encanador que NÃO confirmou o telefone: fora de tudo.
  ('e0000000-0000-0000-0000-000000000003', 'aaaa0000-0000-0000-0000-00000000000c',
   'Carla Sem Confirmar', 'Encanador', '{Encanador}', 'Caça-vazamento', 'Itabirito', 'MG',
   'x', '(31) 99999-0003', '(31) 99999-0003', 'pf', '{}'),
  -- Pedreiro confirmado: mesmo ramo do encanador, então onda 3.
  ('e0000000-0000-0000-0000-000000000004', 'aaaa0000-0000-0000-0000-00000000000d',
   'Davi Pedreiro', 'Pedreiro', '{Pedreiro}', null, 'Itabirito', 'MG',
   'x', '(31) 99999-0004', '(31) 99999-0004', 'pf', '{}'),
  -- Manicure confirmada: outro ramo, não pode ser alcançada NUNCA.
  ('e0000000-0000-0000-0000-000000000005', 'aaaa0000-0000-0000-0000-00000000000e',
   'Elis Manicure', 'Manicure', '{Manicure}', null, 'Itabirito', 'MG',
   'x', '(31) 99999-0005', '(31) 99999-0005', 'pf', '{}'),
  -- Manicure que ACEITARIA vaga de encanador: entra pela área de interesse.
  ('e0000000-0000-0000-0000-000000000006', 'aaaa0000-0000-0000-0000-00000000000f',
   'Fabi Quer Mudar', 'Manicure', '{Manicure}', null, 'Itabirito', 'MG',
   'x', '(31) 99999-0006', '(31) 99999-0006', 'pf', '{Encanador}');

-- A confirmação vai pelo caminho de verdade — `confirmar_whatsapp`, a mesma
-- função que o app chama. Um `update whatsapp_verified = true` seria
-- recusado pelo gatilho da 0024, e é bom que seja: o selo tem que ser
-- consequência de um código conferido, nunca de alguém se declarar
-- confirmado. Testar pelo caminho real também prova que ele funciona.
do $$
declare
  par record;
begin
  for par in
    select * from (values
      ('aaaa0000-0000-0000-0000-00000000000a'::uuid, 'e0000000-0000-0000-0000-000000000001'::uuid),
      ('aaaa0000-0000-0000-0000-00000000000b',       'e0000000-0000-0000-0000-000000000002'),
      ('aaaa0000-0000-0000-0000-00000000000d',       'e0000000-0000-0000-0000-000000000004'),
      ('aaaa0000-0000-0000-0000-00000000000e',       'e0000000-0000-0000-0000-000000000005'),
      ('aaaa0000-0000-0000-0000-00000000000f',       'e0000000-0000-0000-0000-000000000006')
    ) as t(dono, anuncio)
  loop
    execute format(
      'create or replace function auth.uid() returns uuid language sql stable as $f$ select %L::uuid $f$',
      par.dono
    );
    perform public.confirmar_whatsapp(par.anuncio);
  end loop;
end $$;

-- A Carla tenta confirmar e o banco recusa, porque o Auth dela não tem
-- número confirmado. É o estado dela no resto do teste.
create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'aaaa0000-0000-0000-0000-00000000000c'::uuid $$;
do $$
begin
  begin
    perform public.confirmar_whatsapp('e0000000-0000-0000-0000-000000000003');
    raise exception 'FALHOU: confirmou sem o Auth ter confirmado o numero';
  exception when others then
    if position('ainda não foi confirmado' in sqlerrm) = 0 then raise; end if;
  end;
end $$;

-- ── As consultas, iguais às de src/lib/company.ts ───────────────────────
create or replace function pg_temp.onda(n int) returns setof text
language sql stable as $$
  select name from public.professionals_public
   where city = 'Itabirito' and uf = 'MG'
     and whatsapp_verified = true
     and (
       case n
         -- Onda 1 e 2: faz esse serviço, ou aceitaria vaga dele.
         when 1 then (categories @> '{Encanador}' or areas_de_interesse @> '{Encanador}')
         when 2 then (categories @> '{Encanador}' or areas_de_interesse @> '{Encanador}')
         -- Onda 3: ofícios vizinhos, o grupo "Casa e obra".
         else (categories && '{Encanador,Pedreiro,Pintor,Marceneiro}'
               or areas_de_interesse && '{Encanador,Pedreiro,Pintor,Marceneiro}')
       end
     )
     -- Só a onda 1 olha especialidade.
     and (n <> 1 or especialidade ilike '%Caça-vazamento%');
$$;

-- ── As conferências ────────────────────────────────────────────────────
do $$
declare faltou text;
begin
  -- 1. Quem não confirmou o telefone não aparece em onda nenhuma.
  if exists (select 1 from pg_temp.onda(1) where onda = 'Carla Sem Confirmar')
  or exists (select 1 from pg_temp.onda(2) where onda = 'Carla Sem Confirmar')
  or exists (select 1 from pg_temp.onda(3) where onda = 'Carla Sem Confirmar') then
    raise exception 'FALHOU: quem nao confirmou o telefone entrou na onda';
  end if;

  -- 2. A onda 1 é a exata: só quem tem a especialidade.
  if (select count(*) from pg_temp.onda(1)) <> 1
  or not exists (select 1 from pg_temp.onda(1) where onda = 'Ana Confirmada') then
    raise exception 'FALHOU: onda 1 nao trouxe exatamente a Ana';
  end if;

  -- 3. A onda 2 traz o encanador sem especialidade e quem aceitaria a vaga.
  if not exists (select 1 from pg_temp.onda(2) where onda = 'Bruno Encanador')
  or not exists (select 1 from pg_temp.onda(2) where onda = 'Fabi Quer Mudar') then
    raise exception 'FALHOU: onda 2 deixou de fora quem faz ou aceitaria';
  end if;

  -- 4. A onda 3 alcança o ramo, e PARA nele.
  if not exists (select 1 from pg_temp.onda(3) where onda = 'Davi Pedreiro') then
    raise exception 'FALHOU: onda 3 nao alcancou o mesmo ramo';
  end if;
  if exists (select 1 from pg_temp.onda(3) where onda = 'Elis Manicure') then
    raise exception 'FALHOU: vaga de encanador chegou na manicure';
  end if;

  -- 5. Cadastro pausado sai de todas as ondas.
  update public.professionals set paused = true
   where id = 'e0000000-0000-0000-0000-000000000001';
  if exists (select 1 from pg_temp.onda(1) where onda = 'Ana Confirmada') then
    raise exception 'FALHOU: cadastro pausado continuou recebendo vaga';
  end if;
  update public.professionals set paused = false
   where id = 'e0000000-0000-0000-0000-000000000001';

  raise notice 'PASSOU: pausado, sem confirmacao e ramo errado ficam fora';
end $$;

-- 6. Cadastro suspenso pela administração também sai das ondas.
--    Fora do bloco acima porque suspender exige ser admin, e o banco
--    recusa qualquer outra pessoa — inclusive num teste. Trocar de papel no
--    meio de um `do $$` não dá: `auth.uid()` é função, e recriá-la ali
--    dentro não vale para a consulta que já está rodando.
insert into public.admins (user_id) values ('aaaa0000-0000-0000-0000-00000000000a')
on conflict do nothing;
create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'aaaa0000-0000-0000-0000-00000000000a'::uuid $$;

update public.professionals set suspended = true
 where id = 'e0000000-0000-0000-0000-000000000001';

do $$
begin
  if exists (select 1 from pg_temp.onda(1) where onda = 'Ana Confirmada') then
    raise exception 'FALHOU: cadastro suspenso continuou recebendo vaga';
  end if;
  raise notice 'PASSOU: suspenso tambem fica fora — as seis regras valem';
end $$;

-- ── 7. As experiências são de quem escreveu ────────────────────────────
-- A RLS é a única coisa entre a experiência de alguém e qualquer pessoa
-- logada. Aqui a conferência é feita como `authenticated`, porque o dono do
-- banco ignora RLS e o teste passaria sem provar nada.
-- O Supabase concede acesso às tabelas novas de `public` por default
-- privileges do projeto, e nenhuma migration deste repositório escreve
-- `grant` para tabela — é assim desde a 0001. O Postgres pelado do teste não
-- tem esse padrão, então a concessão é feita aqui: sem ela o teste falharia
-- por permissão de TABELA e não chegaria a exercitar a RLS, que é o que ele
-- veio conferir.
grant select, insert, update, delete on public.professional_experiences to authenticated;
-- `professionals` entra junto porque a policy da experiência pergunta a ele
-- de quem é o cadastro — e essa pergunta roda com os direitos de quem está
-- escrevendo. Serve também de conferência: se a RLS de `professionals`
-- escondesse do dono o próprio cadastro, a policy recusaria a gravação e o
-- teste acusaria aqui.
grant select on public.professionals to authenticated;

-- Trocar o papel vem DEPOIS de redefinir `auth.uid()`: `authenticated` não
-- escreve no schema `auth`, então na ordem inversa o teste morre antes de
-- testar qualquer coisa.
create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'aaaa0000-0000-0000-0000-00000000000b'::uuid $$;

set local role authenticated;

do $$
begin
  -- O dono escreve a própria.
  insert into public.professional_experiences (professional_id, cargo, onde, periodo)
  values ('e0000000-0000-0000-0000-000000000002', 'Ajudante de pedreiro', 'Construções Silva', '2 anos');

  -- E não escreve na de outra pessoa.
  begin
    insert into public.professional_experiences (professional_id, cargo)
    values ('e0000000-0000-0000-0000-000000000004', 'Diretor inventado');
    raise exception 'FALHOU: escreveu experiencia no cadastro de outra pessoa';
  exception when insufficient_privilege then
    null; -- é o esperado: a policy recusou
  end;

  -- Nem apaga a dos outros.
  if (select count(*) from public.professional_experiences
       where professional_id = 'e0000000-0000-0000-0000-000000000002') <> 1 then
    raise exception 'FALHOU: a experiencia do proprio dono nao foi gravada';
  end if;

  raise notice 'PASSOU: experiencia so e escrita pelo dono do cadastro';
end $$;

reset role;

rollback;
