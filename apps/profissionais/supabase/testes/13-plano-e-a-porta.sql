-- O plano é a porta da vaga (migration 0073).
--
-- Sem plano a empresa só olha e liga; com plano ela publica, dispara e
-- recebe. Como toda a receita de quem contrata depende disto, a regra tem
-- que ser do banco — e é isto que este teste fixa.

begin;

insert into auth.users (id, phone, phone_confirmed_at) values
  ('eeee0000-0000-0000-0000-00000000000a', '5531966660001', now())
on conflict do nothing;

insert into public.companies
  (id, owner_id, company_name, city, uf, phone, responsible_name, description)
values
  ('cbbb0000-0000-0000-0000-000000000001', 'eeee0000-0000-0000-0000-00000000000a',
   'Serralheria Central', 'Itabirito', 'MG', '(31) 96666-0001', 'Ana', 'x');

create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'eeee0000-0000-0000-0000-00000000000a'::uuid $$;
select public.confirmar_telefone_empresa('cbbb0000-0000-0000-0000-000000000001');

do $$
begin
  -- 1. Telefone confirmado mas sem plano: não publica.
  --    É o caso central do modelo — sem esta linha, a empresa faz tudo de
  --    graça e o plano não tem motivo para existir.
  begin
    insert into public.job_listings
      (id, company_id, title, profession, description, work_modality, city, uf)
    values ('33330000-0000-0000-0000-000000000001', 'cbbb0000-0000-0000-0000-000000000001',
            'Soldador', 'Serralheiro', 'x', 'presencial', 'Itabirito', 'MG');
    raise exception 'FALHOU: publicou vaga sem plano nenhum';
  exception when others then
    if position('plano ativo' in sqlerrm) = 0 then raise; end if;
  end;

  -- 2. Plano vencido é o mesmo que plano nenhum.
  update public.companies
     set plano = 'pro', plano_ate = now() - interval '1 day'
   where id = 'cbbb0000-0000-0000-0000-000000000001';
  begin
    insert into public.job_listings
      (id, company_id, title, profession, description, work_modality, city, uf)
    values ('33330000-0000-0000-0000-000000000001', 'cbbb0000-0000-0000-0000-000000000001',
            'Soldador', 'Serralheiro', 'x', 'presencial', 'Itabirito', 'MG');
    raise exception 'FALHOU: plano vencido continuou publicando';
  exception when others then
    if position('plano ativo' in sqlerrm) = 0 then raise; end if;
  end;

  -- 3. Plano Pro ativo: publica uma.
  update public.companies
     set plano = 'pro', plano_ate = now() + interval '30 days'
   where id = 'cbbb0000-0000-0000-0000-000000000001';

  insert into public.job_listings
    (id, company_id, title, profession, description, work_modality, city, uf)
  values ('33330000-0000-0000-0000-000000000001', 'cbbb0000-0000-0000-0000-000000000001',
          'Soldador', 'Serralheiro', 'x', 'presencial', 'Itabirito', 'MG');

  -- 4. E só uma: a segunda esbarra no teto do plano.
  begin
    insert into public.job_listings
      (id, company_id, title, profession, description, work_modality, city, uf)
    values ('33330000-0000-0000-0000-000000000002', 'cbbb0000-0000-0000-0000-000000000001',
            'Pintor', 'Pintor', 'x', 'presencial', 'Itabirito', 'MG');
    raise exception 'FALHOU: plano Pro abriu a segunda vaga';
  exception when others then
    if position('1 vaga' in sqlerrm) = 0 then raise; end if;
  end;

  -- 5. Fechar a primeira libera o lugar — sem falar com ninguém.
  --    É o que faz o plano de uma vaga ser usável de verdade: a empresa
  --    fecha a que encheu e abre a próxima.
  update public.job_listings set status = 'closed', closed_at = now()
   where id = '33330000-0000-0000-0000-000000000001';

  insert into public.job_listings
    (id, company_id, title, profession, description, work_modality, city, uf)
  values ('33330000-0000-0000-0000-000000000002', 'cbbb0000-0000-0000-0000-000000000001',
          'Pintor', 'Pintor', 'x', 'presencial', 'Itabirito', 'MG');

  if public.vagas_ativas_agora('cbbb0000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'FALHOU: a conta de vagas abertas saiu errada';
  end if;

  -- 6. Editar uma vaga que já está no ar não esbarra no teto. Sem isto, a
  --    empresa do plano cheio não conseguiria corrigir um erro de digitação
  --    na própria vaga.
  update public.job_listings set title = 'Pintor(a)'
   where id = '33330000-0000-0000-0000-000000000002';

  raise notice 'PASSOU: sem plano nao publica, e vaga fechada libera o lugar';
end $$;

-- ── A rede embaixo: a policy também recusa ─────────────────────────────
-- O gatilho fala com gente; a policy é para quem chama por fora do app.
grant select, insert on public.job_listings to authenticated;
grant select on public.companies to authenticated;

-- Plano vencido de novo, agora conferindo a policy e não o gatilho.
update public.companies set plano_ate = now() - interval '1 day'
 where id = 'cbbb0000-0000-0000-0000-000000000001';

set local role authenticated;

do $$
begin
  begin
    insert into public.job_listings
      (company_id, title, profession, description, work_modality, city, uf)
    values ('cbbb0000-0000-0000-0000-000000000001', 'Ajudante', 'Serralheiro', 'x',
            'presencial', 'Itabirito', 'MG');
    raise exception 'FALHOU: a policy deixou passar vaga sem plano';
  exception
    when insufficient_privilege then null;  -- a policy recusou
    when others then
      -- O gatilho pode chegar antes; as duas recusas servem.
      if position('plano ativo' in sqlerrm) = 0 then raise; end if;
  end;

  raise notice 'PASSOU: a policy tambem recusa vaga sem plano';
end $$;

reset role;

rollback;
