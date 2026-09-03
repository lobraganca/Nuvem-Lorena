-- ═══════════════════════════════════════════════════════════════════════
-- 0113 — As ondas passam a ser faixas de compatibilidade
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "onda 1 — 80% a 100% de compatibilidade; onda 2 — 40% a 79%;
--          onda 3 — 0 a 39."
--
-- Até aqui as ondas eram três recortes de OFÍCIO: exatamente a
-- especialidade, depois o mesmo ofício, depois o grupo vizinho. Funciona,
-- mas ignora tudo o que a vaga passou a saber desde a 0105 — escolaridade,
-- CNH, horário, pretensão, viagem — e trata igual quem bate em tudo e quem
-- bate só no nome da profissão.
--
-- A conta de compatibilidade já existe no app (`compatibilidade.ts`), e é
-- a mesma que a tela de quem procura mostra em cada vaga. Agora ela decide
-- também quem a onda avisa: a mesma nota nos dois lados, para a pessoa que
-- vê "85%" ser exatamente a que a onda 1 alcança.
--
-- ── O que esta migration faz ──────────────────────────────────────────
--
-- Uma função nova que devolve, para uma cidade, os CANDIDATOS possíveis
-- com os campos que a conta precisa. A `candidatos_da_onda` (0077)
-- continua existindo: ela devolve id e mais nada, e é o que sobra quando
-- a conta não puder ser feita.
--
-- ── O que ela NÃO devolve, de propósito ───────────────────────────────
--
-- Nome, telefone, e-mail, endereço. A empresa não precisa de nada disso
-- para saber QUANTAS pessoas a onda alcança — e uma função que devolvesse
-- a lista de gente da cidade seria um jeito de baixar a base inteira
-- perguntando "quantos pedreiros existem?" vaga após vaga.
--
-- Continua valendo, como na 0077: suspenso não entra; sem telefone
-- confirmado não entra (o aviso é uma mensagem no número da pessoa); e
-- quem está PAUSADO entra — a tela promete "pode se esconder da lista e
-- continuar recebendo vaga", e essa promessa é a migration 0077 inteira.

create or replace function public.candidatos_para_compatibilidade(
  p_cidade text,
  p_uf text default null
)
returns table (
  id uuid,
  owner_id uuid,
  categories text[],
  areas_de_interesse text[],
  city text,
  especialidade text,
  modo_trabalho text,
  cnh boolean,
  cnh_categorias text[],
  aceita_viajar boolean,
  inicio_imediato boolean,
  fim_de_semana boolean,
  pretensao_centavos integer,
  pretensao_combinar boolean,
  disponibilidade text[],
  escolaridade text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Mesma porta da 0077: só empresa cadastrada conta onda. Sem ela,
  -- qualquer conta varreria a cidade para montar um retrato do banco.
  if not exists (select 1 from public.companies c where c.owner_id = auth.uid()) then
    raise exception 'Só empresa cadastrada pode contar a onda.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select p.id,
         p.owner_id,
         coalesce(p.categories, '{}')::text[],
         coalesce(p.areas_de_interesse, '{}')::text[],
         p.city,
         p.especialidade,
         p.modo_trabalho,
         coalesce(p.cnh, false),
         coalesce(p.cnh_categorias, '{}')::text[],
         coalesce(p.aceita_viajar, false),
         coalesce(p.inicio_imediato, false),
         coalesce(p.fim_de_semana, false),
         p.pretensao_centavos,
         coalesce(p.pretensao_combinar, false),
         coalesce(p.disponibilidade, '{}')::text[],
         -- A escolaridade não é coluna: é o maior NÍVEL entre as linhas de
         -- formação (0104). A ordem é escrita aqui porque "superior" não é
         -- maior que "medio" em ordem alfabética.
         (
           select c.nivel
             from public.professional_courses c
            where c.professional_id = p.id
              and c.tipo = 'formacao'
              and c.nivel is not null
            order by case c.nivel
                       when 'doutorado' then 7
                       when 'mestrado' then 6
                       when 'pos' then 5
                       when 'superior' then 4
                       when 'tecnico' then 3
                       when 'medio' then 2
                       when 'fundamental' then 1
                       else 0
                     end desc
            limit 1
         )
    from public.professionals p
   where p.city = p_cidade
     -- O estado anda junto com a cidade, sempre: há "Bom Jesus" em mais de
     -- vinte estados, e filtrar só pelo nome mistura cidades distantes numa
     -- lista que chega cheia, sem erro nenhum.
     and (p_uf is null or p.uf = p_uf)
     and p.suspended = false
     and p.whatsapp_verified = true;
end;
$$;

revoke all on function public.candidatos_para_compatibilidade(text, text) from public;
grant execute on function public.candidatos_para_compatibilidade(text, text) to authenticated;

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema.
select case
  when (select count(*) from pg_proc
         where pronamespace = 'public'::regnamespace
           and proname = 'candidatos_para_compatibilidade') = 1
  then 'PRONTO — as ondas passam a ser calculadas por faixa de compatibilidade'
  else 'AINDA FALTA — a função não foi criada'
  end as resultado;
