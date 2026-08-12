-- --------------------------------------------------------------------
-- Denúncia só com número confirmado.
--
-- Estar logado já era exigido (0035), e isso resolveu o anônimo. Não
-- resolveu o barato: criar conta Google leva um minuto e não custa nada,
-- então quem quisesse derrubar um concorrente ainda podia abrir três
-- contas e mandar três denúncias. Do outro lado tem alguém cujo anúncio é
-- o ganha-pão.
--
-- Confirmar um número por código é a primeira barreira que custa algo
-- real: exige um chip, e um chip por denunciante. Não impede a denúncia
-- falsa — nada impede —, mas encarece a fábrica delas o suficiente para
-- deixar de valer a pena.
--
-- A regra vive aqui, no banco, e não só na tela: a tela some para quem
-- não confirmou, mas quem chama a API direto passaria por cima dela.
-- --------------------------------------------------------------------

-- `security definer` porque `auth.users` não é legível por quem está
-- logado — e nem deve ser. A função responde uma pergunta de sim ou não
-- sobre a *própria* pessoa (auth.uid()), sem devolver o número nem
-- qualquer outro dado de ninguém.
create or replace function public.tem_telefone_confirmado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and u.phone_confirmed_at is not null
  );
$$;

revoke all on function public.tem_telefone_confirmado() from public;
grant execute on function public.tem_telefone_confirmado() to authenticated;

drop policy if exists "quem está logado pode denunciar um anúncio" on public.reports;
drop policy if exists "só quem confirmou o número pode denunciar" on public.reports;
drop policy if exists so_quem_confirmou_o_numero_pode_denunciar on public.reports;

create policy so_quem_confirmou_o_numero_pode_denunciar
  on public.reports for insert
  to authenticated
  with check (
    -- `reporter_id` tem que ser quem está de fato pedindo: sem isto daria
    -- para estar logado e gravar a denúncia no nome de outra pessoa, que é
    -- pior do que o anônimo — é o anônimo com um culpado escolhido a dedo.
    reporter_id = auth.uid()
    and public.tem_telefone_confirmado()
  );
