-- ═══════════════════════════════════════════════════════════════════════
-- 24 — As métricas de quem procura, e o que acontece quando o plano vence
-- ═══════════════════════════════════════════════════════════════════════
--
-- Duas coisas que nunca tinham sido exercitadas:
--
--   · a contagem de "você apareceu em N buscas" (0114) — quem escreve é
--     uma função, porque quem aparece na busca não é quem está buscando;
--   · o que o banco faz com as vagas de uma empresa cujo plano VENCEU.
--     A tela de planos promete: "depois dessa data as vagas param de ser
--     publicadas". Este teste mostra o que acontece de verdade.

\set ON_ERROR_STOP on
begin;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.usuario', true), '')::uuid
$$;

insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000f2401', '5531900002401', now()),
  ('00000000-0000-4000-8000-0000000f2402', '5531900002402', now())
on conflict (id) do nothing;

insert into public.professionals (id, owner_id, name, category, city, uf, whatsapp_verified)
values
  ('00000000-0000-4000-8000-0000000f2410', '00000000-0000-4000-8000-0000000f2401',
   'Quem aparece', 'Padeiro', 'Itabirito', 'MG', true),
  ('00000000-0000-4000-8000-0000000f2411', '00000000-0000-4000-8000-0000000f2402',
   'Outra pessoa', 'Padeiro', 'Itabirito', 'MG', true)
on conflict (id) do nothing;

-- ── A contagem de buscas ──────────────────────────────────────────────

select public.registrar_aparicao_em_busca(array[
  '00000000-0000-4000-8000-0000000f2410',
  '00000000-0000-4000-8000-0000000f2411'
]::uuid[]);
select public.registrar_aparicao_em_busca(array[
  '00000000-0000-4000-8000-0000000f2410'
]::uuid[]);

select case when (select vezes from public.aparicoes_em_busca
                   where professional_id = '00000000-0000-4000-8000-0000000f2410'
                     and dia = current_date) = 2
            then 'ok 1 — duas buscas somam duas'
            else 'FALHOU 1 — a contagem de buscas não somou'
       end as resultado;

-- Id que não existe não cria linha (senão a tabela viraria lixo com
-- qualquer chamada).
select public.registrar_aparicao_em_busca(array['00000000-0000-4000-8000-00000000dead']::uuid[]);
/* Conta só as duas pessoas deste teste: a tabela pode ter linhas de
   outros testes rodados antes no mesmo banco. */
select case when (select count(*) from public.aparicoes_em_busca
                   where professional_id in (
                     '00000000-0000-4000-8000-0000000f2410',
                     '00000000-0000-4000-8000-0000000f2411')) = 2
            then 'ok 2 — id inexistente não vira linha'
            else 'FALHOU 2 — a função criou linha para gente que não existe'
       end as resultado;

-- Só o dono lê o próprio número.
/* `professionals` entra no grant porque a policy de `aparicoes_em_busca`
   consulta essa tabela para saber quem é o dono — sem o grant, a leitura
   falha com "permission denied" mesmo para quem tem direito. No Supabase
   de verdade esse grant já existe. */
grant select on public.aparicoes_em_busca, public.professionals to authenticated;
set local role authenticated;

set local teste.usuario = '00000000-0000-4000-8000-0000000f2401';
select case when count(*) = 1
            then 'ok 3 — a pessoa vê a própria contagem'
            else 'FALHOU 3 — a pessoa não vê a própria contagem'
       end as resultado
  from public.aparicoes_em_busca
 where professional_id = '00000000-0000-4000-8000-0000000f2410';

set local teste.usuario = '00000000-0000-4000-8000-0000000f2402';
select case when count(*) = 0
            then 'ok 4 — e NÃO vê a da outra pessoa'
            else 'FALHOU 4 — VAZOU: está vendo a contagem de outra pessoa'
       end as resultado
  from public.aparicoes_em_busca
 where professional_id = '00000000-0000-4000-8000-0000000f2410';

reset role;

-- ── O plano vencido ───────────────────────────────────────────────────

insert into public.companies (id, owner_id, company_name, city, uf, phone, responsible_name, plano, plano_ate)
values ('00000000-0000-4000-8000-0000000f2420', '00000000-0000-4000-8000-0000000f2401',
        'Padaria do Plano', 'Itabirito', 'MG', '5531900002401', 'Dona', 'pro',
        now() + interval '30 days')
on conflict (id) do nothing;

insert into public.job_listings
  (id, company_id, title, description, profession, city, uf, status, work_modality)
values ('00000000-0000-4000-8000-0000000f2430', '00000000-0000-4000-8000-0000000f2420',
        'Padeiro', 'Turno da manhã.', 'Padeiro', 'Itabirito', 'MG', 'active', 'presencial')
on conflict (id) do nothing;

-- O plano vence AGORA.
update public.companies
   set plano_ate = now() - interval '1 day'
 where id = '00000000-0000-4000-8000-0000000f2420';

-- 5. Publicar uma vaga NOVA com o plano vencido tem de ser recusado.
do $$
begin
  begin
    insert into public.job_listings
      (id, company_id, title, description, profession, city, uf, status, work_modality)
    values ('00000000-0000-4000-8000-0000000f2431', '00000000-0000-4000-8000-0000000f2420',
            'Ajudante', 'Segunda a sexta.', 'Ajudante', 'Itabirito', 'MG', 'active', 'presencial');
    raise notice 'FALHOU 5 — publicou vaga com o plano vencido';
  exception when others then
    raise notice 'ok 5 — com o plano vencido, publicar vaga nova é recusado';
  end;
end $$;

-- 6. E a vaga que JÁ estava no ar: continua no ar?
--    Não há gatilho que a derrube — e é uma decisão, não um esquecimento:
--    tirar do ar sozinho apagaria a vaga de quem esqueceu de renovar por
--    um dia. O teste existe para essa escolha ficar VISÍVEL: se um dia
--    alguém quiser mudá-la, é aqui que a mudança aparece.
select case when (select status from public.job_listings
                   where id = '00000000-0000-4000-8000-0000000f2430') = 'active'
            then 'PRONTO — a vaga já publicada continua no ar depois de o plano vencer'
            else 'MUDOU — agora a vaga sai do ar quando o plano vence'
       end as resultado;

rollback;
