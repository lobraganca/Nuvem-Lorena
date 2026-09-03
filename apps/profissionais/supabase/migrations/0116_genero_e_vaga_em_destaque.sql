-- ═══════════════════════════════════════════════════════════════════════
-- 0116 — Gênero no cadastro, e a vaga em destaque
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "colocar opção no cadastro de feminino ou masculino ou outro" e
-- "também opção de dar destaque a uma vaga".

-- ═══════════════════════════════════════════════════════════════════════
-- Parte 1 de 2 — GÊNERO
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── Texto com `check`, e não booleano nem número ──────────────────────
--
-- Três respostas possíveis e nulo para "não quis dizer". O `check` é o
-- que impede o quarto valor de aparecer com o tempo — um "F" digitado
-- numa correção pelo painel do Supabase, e a contagem passa a ter duas
-- categorias femininas sem ninguém ver.
--
-- ── E por que ele NÃO entra na view pública ───────────────────────────
--
-- Esta é a decisão mais importante desta migration, e ela é de lei, não
-- de gosto: o art. 373-A da CLT proíbe publicar anúncio de emprego que
-- faça referência a sexo, e proíbe usar o sexo como critério para
-- admissão — salvo quando a natureza da atividade exigir, o que aqui não
-- é o caso de nenhuma vaga.
--
-- Fora da `professionals_public`, o campo não tem como virar filtro na
-- busca de talentos nem selo na lista: é impossível a empresa peneirar a
-- cidade por sexo, porque o dado não chega até ela. Ele fica na tabela,
-- onde a própria pessoa lê e escreve o dela, e onde a administração
-- consegue contar quantas mulheres e quantos homens usam o app — que é
-- para o que este campo serve.

alter table public.professionals
  add column if not exists genero text;

alter table public.professionals drop constraint if exists professionals_genero_check;
alter table public.professionals add constraint professionals_genero_check
  check (genero is null or genero in ('feminino', 'masculino', 'outro'));

-- ═══════════════════════════════════════════════════════════════════════
-- Parte 2 de 2 — A VAGA EM DESTAQUE
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── Uma data, e não um "sim/não" ──────────────────────────────────────
--
-- `destaque_ate` guarda ATÉ QUANDO a vaga fica no topo. Com um booleano,
-- alguém teria de desligar na mão no dia certo — e o que acontece na
-- prática é que ninguém desliga, e a vaga de uma semana atrás continua em
-- primeiro lugar para sempre. Nulo é "não tem destaque", e a data no
-- passado se apaga sozinha, sem nenhuma rotina.

alter table public.job_listings
  add column if not exists destaque_ate timestamptz;

create index if not exists job_listings_destaque_idx
  on public.job_listings (destaque_ate desc nulls last)
  where destaque_ate is not null;

-- ── A empresa NÃO se destaca sozinha ──────────────────────────────────
--
-- A empresa tem permissão de `update` na própria vaga (é assim que ela
-- edita, pausa e encerra), e essa permissão vale para a linha inteira —
-- inclusive para uma coluna que é PAGA. Sem esta trava, bastaria uma
-- requisição escrita à mão para pôr a própria vaga no topo de graça, e
-- não haveria como saber que aconteceu.
--
-- O gatilho DEVOLVE o valor antigo em vez de recusar a gravação. Recusar
-- derrubaria a edição inteira da vaga com um erro técnico — e o
-- formulário manda a linha toda de uma vez, então quem só quis corrigir o
-- salário levaria a culpa por um campo que a tela nem mostra. É a mesma
-- escolha do telefone confirmado (0076): o campo protegido volta ao que
-- era, o resto grava.
create or replace function public.job_listings_protege_destaque()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  eh_admin boolean;
begin
  select exists (select 1 from public.admins a where a.user_id = auth.uid()) into eh_admin;
  if eh_admin then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.destaque_ate := null;
  else
    new.destaque_ate := old.destaque_ate;
  end if;
  return new;
end;
$$;

drop trigger if exists job_listings_protege_destaque on public.job_listings;
create trigger job_listings_protege_destaque
  before insert or update on public.job_listings
  for each row execute function public.job_listings_protege_destaque();

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema (ver a 0060 no CLAUDE.md).
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.professionals'::regclass
           and attname = 'genero' and not attisdropped) = 1
   and (select count(*) from pg_attribute
         where attrelid = 'public.job_listings'::regclass
           and attname = 'destaque_ate' and not attisdropped) = 1
   and (select count(*) from pg_attribute
         where attrelid = 'public.professionals_public'::regclass
           and attname = 'genero' and not attisdropped) = 0
   and (select count(*) from pg_trigger
         where tgrelid = 'public.job_listings'::regclass
           and tgname = 'job_listings_protege_destaque') = 1
  then 'PRONTO — gênero no cadastro (fora da lista pública) e vaga em destaque'
  else 'AINDA FALTA — confira os comandos acima'
  end as resultado;
