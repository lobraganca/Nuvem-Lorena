-- ═══════════════════════════════════════════════════════════════════════
-- 0077 — Quem está oculto CONTINUA recebendo vaga pelas ondas
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "a pessoa que cadastra deve ter opção de ter o perfil público ou
--          oculto. Público ele pode ser buscado pelas empresas, oculto ele
--          recebe oportunidades pelas ondas de disparos."
--
-- ── O QUE ESTAVA ACONTECENDO ──────────────────────────────────────────
--
-- A chave existe na tela ("Não aparecer na lista") e grava direito na
-- coluna `paused`. O que não funcionava era a segunda metade da regra: quem
-- se escondia parava de receber TUDO.
--
-- A consulta da onda lê `professionals_public`, e essa view filtra
-- `paused = false`. Então esconder-se da busca escondia a pessoa também das
-- ondas — o oposto do que a chave promete.
--
-- E a tela promete por escrito, com estas palavras:
--
--   "Quem está empregado e não quer ser encontrado pelo patrão pode se
--    esconder da lista e CONTINUAR RECEBENDO VAGA."
--
-- É o pior tipo de defeito deste projeto: silencioso e do lado de quem tem
-- menos como perceber. A pessoa se esconde para o patrão não ver, acha que
-- continua na fila das oportunidades, e some do app sem nunca receber uma.
-- Ninguém reclama de vaga que não chegou — não dá para sentir falta do que
-- você não sabe que existiu.
--
-- ── POR QUE UMA FUNÇÃO, E NÃO OUTRA VIEW ──────────────────────────────
--
-- A saída óbvia — uma view que inclua os pausados — é justamente a errada:
-- view precisa de `grant`, e quem recebesse o `grant` poderia LISTAR quem
-- está escondido. Seria desfazer o esconderijo para consertar o esconderijo.
--
-- Aqui a função devolve `id` e `owner_id` e MAIS NADA. Sem nome, sem
-- telefone, sem bairro. A empresa recebe códigos que ela já teria de usar
-- para gravar os avisos, e que não abrem em lugar nenhum: a página de perfil
-- lê a view pública, e lá o pausado não está. Contar quantas pessoas a onda
-- alcança nunca precisou saber quem elas são.
--
-- ── AS TRÊS CONDIÇÕES QUE CONTINUAM VALENDO ───────────────────────────
--
--   suspended = false          quem foi suspenso não recebe nada
--   whatsapp_verified = true   sem telefone confirmado não entra em onda
--   paused                     NÃO filtra — é exatamente a mudança
--
-- ── ESTA MIGRATION NÃO MEXE NA BUSCA ──────────────────────────────────
--
-- `professionals_public` fica exatamente como está, com o `paused = false`.
-- Quem se escondeu continua fora da lista que as empresas procuram. As duas
-- metades da regra passam a existir de verdade, cada uma no seu lugar.

create or replace function public.candidatos_da_onda(
  p_cidade text,
  p_uf text,
  p_oficios text[],
  -- Onde procurar o ofício: `categories` é o que a pessoa FAZ,
  -- `areas_de_interesse` é onde ela ACEITARIA trabalhar. A onda alcança
  -- pelas duas, e quem chama pede uma de cada vez, como já fazia.
  p_coluna text,
  -- Só a onda 1 usa, e só quando a vaga pediu especialidade.
  p_especialidade text default null
)
returns table (id uuid, owner_id uuid)
language plpgsql
security definer set search_path = public
as $$
begin
  -- Só empresa cadastrada conta onda. Sem esta porta, qualquer conta
  -- poderia varrer a cidade inteira perguntando "quantos pedreiros existem"
  -- — e, repetindo por ofício, montar um retrato do banco.
  if not exists (select 1 from public.companies c where c.owner_id = auth.uid()) then
    raise exception 'Só empresa cadastrada pode contar a onda.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Nome de coluna não entra por texto em consulta montada: são duas
  -- consultas escritas por extenso, e qualquer outro valor é recusado.
  if p_coluna not in ('categories', 'areas_de_interesse') then
    raise exception 'Coluna inválida: %', p_coluna using errcode = 'invalid_parameter_value';
  end if;

  return query
  select p.id, p.owner_id
    from public.professionals p
   where p.city = p_cidade
     and (p_uf is null or p.uf = p_uf)
     and p.suspended = false
     and p.whatsapp_verified = true
     -- `paused` de fora de propósito. É a migration inteira.
     and (
       (p_coluna = 'categories' and p.categories && p_oficios)
       or (p_coluna = 'areas_de_interesse' and p.areas_de_interesse && p_oficios)
     )
     and (
       p_especialidade is null
       or p_especialidade = ''
       or p.especialidade ilike '%' || p_especialidade || '%'
     );
end;
$$;

revoke all on function public.candidatos_da_onda(text, text, text[], text, text) from public;
grant execute on function public.candidatos_da_onda(text, text, text[], text, text) to authenticated;

-- O índice que faz isto não varrer a tabela quando a cidade crescer.
create index if not exists idx_professionals_onda
  on public.professionals (city, uf)
  where suspended = false and whatsapp_verified = true;

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema. E confere o que importa: que
-- a função existe, que ela roda com os direitos de quem a criou (sem isso
-- ela não enxerga o pausado), e que a view da busca continua escondendo
-- quem se escondeu — as duas metades da regra, cada uma no seu lugar.
select case
  when (select count(*) from pg_proc
         where pronamespace = 'public'::regnamespace
           and proname = 'candidatos_da_onda'
           and prosecdef) = 1
   and (select pg_get_viewdef('public.professionals_public'::regclass)) like '%paused%'
  then 'PRONTO — quem está oculto volta a receber vaga pelas ondas, e continua fora da busca'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;
