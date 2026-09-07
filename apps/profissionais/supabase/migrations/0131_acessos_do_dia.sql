-- ═══════════════════════════════════════════════════════════════════════
-- 0131 — Os acessos do dia, e por qual porta
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "quero ter no painel bem claramente 3 coisas: quantidade total
-- de acessos do dia; quantidade de pessoas que entraram em empresa e em
-- candidatos."
--
-- ── O QUE HAVIA, E POR QUE NÃO SERVIA ─────────────────────────────────
--
-- `visitas_app` existe desde a 0048, com RLS, policy e até uma função de
-- contagem. E está vazia: ninguém no Ei escreve nela. Ela veio do outro
-- produto e nunca foi ligada aqui.
--
-- Então o número "acessos de hoje" não existia — não é ligar um contador,
-- é passar a contar.
--
-- ── O QUE CONTA COMO UM ACESSO ────────────────────────────────────────
--
-- Uma ABERTURA do app, e não cada tela aberta. Quem entra e navega por
-- dez telas é uma pessoa que entrou uma vez, e é isso que a pergunta
-- "quantos acessos hoje" quer saber. Contando telas, o número vira
-- "quanto o app foi usado", que é outra pergunta e infla sozinho quando
-- alguém fica rolando a lista.
--
-- Quem decide isso é o navegador, com a mesma técnica que o app já usa
-- para saber que foi aberto (`aberturaDoApp.ts`): uma marca que vive
-- enquanto a aba existe e some quando ela fecha. Aqui essa marca é um
-- número sorteado, e ele é a identidade da visita.
--
-- ── POR QUE A MARCA, E NÃO SÓ UM INSERT ───────────────────────────────
--
-- Porque a porta é escolhida DEPOIS da abertura. A pessoa abre o app (um
-- acesso), lê, e só então toca em "procuro emprego". São dois momentos, e
-- uma linha só.
--
-- Com dois inserts, o total seria o dobro do real. Com um insert no fim,
-- quem abre e desiste na porta não seria contado — e essa é justamente a
-- pessoa que a dona precisa enxergar, porque ela é o vazamento.
--
-- Então: insere na abertura, atualiza a MESMA linha quando a porta é
-- escolhida. `sem_escolha`, na função de leitura, é quanta gente abriu e
-- não entrou por nenhuma das duas.
--
-- ── SEM DADO DE PESSOA ────────────────────────────────────────────────
--
-- A linha tem data, porta e uma marca sorteada. Não tem quem, não tem
-- telefone, não tem endereço de rede. Isso é de propósito: para responder
-- "quantos entraram hoje" não é preciso saber quem, e o que não se guarda
-- não vaza nem precisa ser explicado na Política de Privacidade.

-- ── 1. As duas colunas ─────────────────────────────────────────────────
alter table public.visitas_app
  add column if not exists marca uuid,
  /* 'empresa' e 'candidato' são as palavras da DONA, e não as do banco
     ('company'/'professional'). Este número é para ela ler no painel; a
     tradução acontece no app, uma vez, e não na cabeça de quem lê. */
  add column if not exists lado text
    check (lado is null or lado in ('empresa', 'candidato'));

/* Linhas antigas (do outro produto) ganham marca própria para o índice
   único abaixo poder existir sem exceção. */
update public.visitas_app set marca = gen_random_uuid() where marca is null;

alter table public.visitas_app alter column marca set default gen_random_uuid();
alter table public.visitas_app alter column marca set not null;

create unique index if not exists visitas_app_marca_idx on public.visitas_app (marca);
create index if not exists visitas_app_dia_lado_idx on public.visitas_app (criada_em desc, lado);

-- ── 2. Registrar (a mesma função para os dois momentos) ────────────────
-- `security definer` porque quem chama pode não ter conta nenhuma — e é
-- justamente quem abre o app pela primeira vez que mais interessa contar.
--
-- `coalesce` no update: a segunda chamada só ACRESCENTA a porta. Uma
-- chamada posterior sem porta (outra tela do mesmo acesso) não apaga a
-- escolha que já estava lá.
create or replace function public.registrar_acesso(p_marca uuid, p_lado text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  /* Qualquer coisa fora das duas palavras vira nulo, em silêncio. Quem
     chama é o navegador, e o navegador é de quem quiser mexer nele: o
     `check` da coluna recusaria a linha inteira e o acesso deixaria de
     ser contado por causa de um valor torto. */
  if p_lado is not null and p_lado not in ('empresa', 'candidato') then
    p_lado := null;
  end if;

  insert into public.visitas_app (marca, lado)
  values (p_marca, p_lado)
  on conflict (marca) do update
    set lado = coalesce(excluded.lado, public.visitas_app.lado);
end;
$$;

grant execute on function public.registrar_acesso(uuid, text) to anon, authenticated;

-- ── 3. Ler (só a administração) ────────────────────────────────────────
-- O dia é o de Itabirito, e não o de Greenwich: `now()` no Postgres é
-- UTC, e contar por ele faria o número zerar às 21h para quem usa o app —
-- três horas antes da virada, todo dia. É a mesma conta da 0051.
create or replace function public.acessos_de_hoje()
returns table (total bigint, empresa bigint, candidato bigint, sem_escolha bigint)
language sql
security definer
set search_path = public
as $$
  select count(*),
         count(*) filter (where lado = 'empresa'),
         count(*) filter (where lado = 'candidato'),
         count(*) filter (where lado is null)
    from public.visitas_app
   where criada_em >= (date_trunc('day', now() at time zone 'America/Sao_Paulo')
                       at time zone 'America/Sao_Paulo')
     /* A função ignora RLS (é `security definer`), então a portaria é
        esta linha. Sem ela, qualquer pessoa logada leria o movimento do
        app inteiro. Devolve zeros para quem não é admin, em vez de erro:
        a tela de quem não deveria ver isso não precisa saber que existe. */
     and exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

grant execute on function public.acessos_de_hoje() to authenticated;

-- ── 4. A conferência ───────────────────────────────────────────────────
-- `pg_catalog`, nunca `information_schema` (ver o CLAUDE.md e a 0060). E é
-- o último comando do arquivo de propósito: o painel mostra o resultado do
-- último, e qualquer coisa depois disto engoliria a resposta.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.visitas_app'::regclass
           and attname in ('marca', 'lado') and not attisdropped) = 2
   and (select count(*) from pg_proc
         where pronamespace = 'public'::regnamespace
           and proname in ('registrar_acesso', 'acessos_de_hoje')) = 2
  then 'PRONTO — o app já pode contar os acessos do dia, por porta.'
  else 'AINDA FALTA — rode o arquivo inteiro, do começo, sem nada selecionado.'
end as resultado;
