-- 0127 — "Ainda está disponível?": saber quando alguém sumiu.
--
-- A dona: "uma pessoa ficou 1 mês sem abrir o app. O Ei manda: 👋 ainda
-- está disponível? Encontramos 4 oportunidades que combinam com seu
-- perfil. [Sim, estou disponível]"
--
-- ── O QUE FALTAVA ERA UMA DATA ────────────────────────────────────────
--
-- O app não sabia quando alguém abriu pela última vez. Existe
-- `push_devices.visto_em` desde a 0074, mas ela é do APARELHO e só existe
-- para quem instalou e aceitou receber aviso — que é uma parte pequena de
-- quem se cadastra. Perguntar "sumiu?" só para quem instalou o app
-- deixaria de fora justamente quem usa pelo navegador e some mais.
--
-- Uma coluna no cadastro responde para todo mundo.
--
-- ── POR QUE `default now()` E NÃO NULO ────────────────────────────────
--
-- Todo cadastro que já existe ganha a data de hoje. É mentira? Um pouco:
-- alguns desses cadastros estão parados há meses. Mas a alternativa é
-- pior — com a coluna nula, TODO MUNDO que já está no app receberia a
-- pergunta na primeira vez que abrisse depois desta SQL, inclusive quem
-- entrou ontem. Centenas de pessoas perguntadas de uma vez, sem motivo, é
-- o tipo de coisa que faz desinstalar.
--
-- Começando de hoje, a pergunta chega a quem realmente passar 30 dias sem
-- aparecer, a partir de agora. Custa um mês de espera e não custa a
-- confiança de ninguém.
--
-- ── O QUE NÃO ESTÁ AQUI ───────────────────────────────────────────────
--
-- A CONTA de quantas vagas combinam não é feita no banco, de propósito. A
-- compatibilidade mora em `compatibilidade.ts` e é a mesma nas três telas
-- do app; escrevê-la de novo em SQL criaria uma segunda fórmula, e o dia
-- em que as duas discordassem a pergunta prometeria "4 vagas" e a lista
-- mostraria outra coisa. Quem conta é o app, com a conta de sempre, na
-- hora em que a pessoa abre.

alter table public.professionals
  add column if not exists visto_em timestamptz not null default now();

-- Para achar quem sumiu sem varrer a tabela inteira. Numa cidade pequena
-- ainda não faz diferença; em dois anos faz, e criar índice depois com a
-- tabela cheia trava a tabela.
create index if not exists idx_professionals_visto_em
  on public.professionals (visto_em);

-- A pessoa grava a PRÓPRIA data ao abrir o app. A policy "Profissional
-- atualiza seu cadastro" (0008) já permite — esta coluna entra nela como
-- qualquer outra do cadastro, e não há o que abrir a mais.
--
-- Não há gatilho carimbando `visto_em` sozinho: `updated_at` já muda a
-- cada edição do cadastro, e "editou o perfil" não é "abriu o app". São
-- perguntas diferentes e é por isso que são duas colunas.

-- ── Confere a si mesma ────────────────────────────────────────────────
-- Lê o `pg_catalog`, nunca o `information_schema`. É o último comando do
-- arquivo de propósito: a dona lê o resultado do último.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.professionals'::regclass
           and attname = 'visto_em' and not attisdropped) = 1
  then 'PRONTO — o app ja sabe quando cada pessoa apareceu pela ultima vez'
  else 'AINDA FALTA — a coluna nao foi criada'
end as resultado;
