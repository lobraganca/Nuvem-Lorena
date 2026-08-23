-- =====================================================================
-- 0004 — Entrar, e a confirmação do número à prova de forja
-- =====================================================================
--
-- Duas coisas, e a segunda conserta um buraco que a 0001 deixou aberto.
--
-- **O buraco.** A policy de `perfis` diz `for all using (id = auth.uid())`.
-- Isso deixa cada pessoa editar a própria linha — o que está certo — mas
-- "a própria linha" inclui a coluna `telefone_confirmado`. E essa coluna
-- não é um dado qualquer: é ela que decide se o telefone aparece para quem
-- procura (view `profissionais_publicos`) e se a pessoa entra na fila de
-- disparo (`candidatos_da_onda`). Ou seja, do jeito que está, qualquer um
-- manda um update dizendo que confirmou e passa a receber oportunidade sem
-- nunca ter recebido código nenhum.
--
-- Fechar isso com policy não resolve: policy decide se a LINHA pode ser
-- escrita, não quais COLUNAS. O que resolve é um gatilho que reescreve a
-- coluna a partir do `auth.users`, sempre. O que o app mandar naquele campo
-- é simplesmente descartado — não recusado com erro, descartado, porque o
-- app legítimo não tem motivo para mandar e o ilegítimo não merece resposta.
--
-- A regra que sai daí, e que vale para o resto do sistema: **dado que dá
-- poder a alguém nunca vem do cliente.** Ele é derivado, no banco, de algo
-- que o cliente não controla.
--
-- =====================================================================

-- --- O perfil nasce junto com a conta ---------------------------------
--
-- Sem isto, quem cria a conta fica com login e sem perfil, e toda tela do
-- app tem que saber lidar com "existe no auth mas não em perfis". É um
-- estado que não deveria existir, e a maneira de ele não existir é ninguém
-- precisar lembrar de criar a linha.

create or replace function public.criar_perfil_da_conta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, nome, telefone)
  values (
    new.id,
    -- O nome vem do cadastro, do login social, ou fica vazio para a tela
    -- de completar perfil pedir. Nunca nulo: `nome` é not null, e uma
    -- conta que não consegue nascer é pior que uma sem nome.
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      ''
    ),
    new.phone
  )
  on conflict (id) do nothing;  -- o gatilho pode disparar de novo; a conta é uma só
  return new;
end;
$$;

drop trigger if exists ao_criar_conta on auth.users;
create trigger ao_criar_conta
  after insert on auth.users
  for each row execute function public.criar_perfil_da_conta();

-- --- A confirmação vem do auth, sempre --------------------------------
--
-- Roda antes de toda gravação em `perfis` e reescreve as duas colunas de
-- confirmação a partir do `auth.users`, que só o Supabase Auth escreve
-- depois de conferir o código de verdade.
--
-- Guardar o NÚMERO confirmado, e não um "sim", é o que impede o truque de
-- confirmar um número e trocar por outro depois: se `telefone` mudar para
-- um número diferente do confirmado, a view compara os dois e o telefone
-- some da busca até a pessoa confirmar o novo.

create or replace function public.confirmacao_vem_do_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numero      text;
  v_confirmado  timestamptz;
begin
  select u.phone, u.phone_confirmed_at
    into v_numero, v_confirmado
    from auth.users u
   where u.id = new.id;

  if v_confirmado is not null and nullif(trim(coalesce(v_numero, '')), '') is not null then
    new.telefone_confirmado    := v_numero;
    new.telefone_confirmado_em := v_confirmado;
  else
    new.telefone_confirmado    := null;
    new.telefone_confirmado_em := null;
  end if;

  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists confirmacao_a_prova_de_forja on public.perfis;
create trigger confirmacao_a_prova_de_forja
  before insert or update on public.perfis
  for each row execute function public.confirmacao_vem_do_auth();

-- --- A view passa a comparar os dois números --------------------------
--
-- Antes ela mostrava o telefone se `telefone_confirmado` não fosse nulo.
-- Agora exige que o número confirmado seja o MESMO que está no cadastro —
-- senão, confirmar um número e depois editar o campo para outro faria o
-- app exibir como confirmado um número que ninguém conferiu.
--
-- (`create or replace view` não consegue inserir coluna no meio da lista;
-- por isso a lista inteira é repetida na mesma ordem, trocando só a
-- expressão do telefone.)

create or replace view public.profissionais_publicos as
select
  p.id,
  p.categoria_id,
  p.cidade_id,
  p.tipo,
  p.apresentacao,
  p.raio_km,
  p.latitude,
  p.longitude,
  p.situacao,
  p.ausente_ate,
  (p.documento_verificado_em is not null) as verificado,
  perf.nome,
  perf.foto_url,
  case
    when perf.telefone_confirmado is not null
     and perf.telefone_confirmado = perf.telefone
    then perf.telefone
  end as telefone,
  c.nome as categoria_nome,
  c.grupo as categoria_grupo,
  cid.nome as cidade_nome,
  cid.uf   as cidade_uf
from public.profissionais p
join public.perfis     perf on perf.id = p.perfil_id
join public.categorias c    on c.id    = p.categoria_id
join public.cidades    cid  on cid.id  = p.cidade_id
where p.suspenso_em is null
  and p.situacao <> 'oculto'
  and c.ativa
  and cid.ativa;

grant select on public.profissionais_publicos to anon, authenticated;

-- --- E a fila de disparo também ---------------------------------------
--
-- Mesma correção do outro lado: receber oportunidade exige que o número
-- confirmado seja o número do cadastro. Do outro lado da linha tem alguém
-- esperando retorno.

create or replace function public.candidatos_da_onda(
  p_pedido_id uuid,
  p_onda      smallint
) returns table (profissional_id uuid)
language sql
stable
as $$
  with pedido as (
    select * from public.pedidos where id = p_pedido_id
  )
  select pr.id
    from public.profissionais pr
    join pedido ped on true
    join public.perfis perf on perf.id = pr.perfil_id
    join lateral public.plano_vigente(pr.id) pl on true
   where pr.categoria_id = ped.categoria_id
     and pr.cidade_id    = ped.cidade_id
     and pl.onda         = p_onda
     and pr.situacao     = 'disponivel'
     and pr.suspenso_em is null
     and perf.telefone_confirmado is not null
     and perf.telefone_confirmado = perf.telefone
     and (
       ped.latitude is null or pr.latitude is null
       or public.distancia_km(pr.latitude, pr.longitude, ped.latitude, ped.longitude) <= pr.raio_km
     )
     and (
       pl.limite_oportunidades_abertas is null
       or (select count(*) from public.disparos d
            where d.profissional_id = pr.id
              and d.respondido_em is null) < pl.limite_oportunidades_abertas
     )
     and not exists (
       select 1 from public.bloqueios b
        where (b.de_id = ped.cliente_id and b.para_id = perf.id)
           or (b.de_id = perf.id and b.para_id = ped.cliente_id)
     )
$$;

-- =====================================================================
-- Conferência
-- =====================================================================

select case
  when (select count(*) from pg_trigger
         where tgname = 'confirmacao_a_prova_de_forja'
           and tgrelid = 'public.perfis'::regclass) = 1
   and (select count(*) from pg_trigger
         where tgname = 'ao_criar_conta'
           and tgrelid = 'auth.users'::regclass) = 1
  then 'PRONTO — o perfil nasce junto com a conta, e a confirmação do número só vem do Auth.'
  else 'AINDA FALTA — algum gatilho não foi criado. Rode esta parte inteira de novo, sem selecionar trecho.'
end as resultado;
