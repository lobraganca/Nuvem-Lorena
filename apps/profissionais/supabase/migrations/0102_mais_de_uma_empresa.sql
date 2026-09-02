-- ═══════════════════════════════════════════════════════════════════════
-- 0102 — A mesma pessoa passa a poder ter mais de uma empresa
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "ter opção de cadastrar mais de uma empresa."
--
-- ── O QUE IMPEDIA ─────────────────────────────────────────────────────
--
-- Uma palavra na 0066:
--
--     owner_id uuid not null unique references auth.users ...
--
-- O `unique` diz "uma empresa por conta", e o banco cumpre à risca: a
-- segunda gravação volta com `23505 duplicate key`. Em Itabirito isso é
-- errado na prática — quem tem a padaria e a lanchonete é a mesma pessoa,
-- com o mesmo telefone, e hoje precisaria de dois números de celular para
-- anunciar as duas.
--
-- ── E POR QUE ISSO NÃO É SÓ APAGAR UMA PALAVRA ────────────────────────
--
-- O `unique` não estava só barrando: ele era o ALVO do `upsert`. O app
-- grava a empresa com `on conflict (owner_id)`, e é esse índice único que
-- o PostgREST procura pelo nome das colunas. Sem ele, a gravação passa a
-- responder `42P10: there is no unique or exclusion constraint matching
-- the ON CONFLICT specification` — ou seja, tirar o limite aqui QUEBRA o
-- cadastro de empresa até o app parar de usar upsert e passar a usar
-- insert (nova) e update (existente).
--
-- Por isso esta migration vem antes do código, e o código só sobe depois
-- que ela estiver aplicada. É a mesma ordem que faltou na 0060, quando o
-- app mandou a coluna `uf` quinze horas antes de ela existir e ninguém
-- conseguiu se cadastrar no dia inteiro.
--
-- ── E A EXCLUSÃO ──────────────────────────────────────────────────────
--
-- Com uma empresa só, apagar era assunto de suporte. Com várias, quem
-- cadastrou a errada precisa poder desfazer sozinho — senão a lista de
-- escolha enche de lixo que ninguém tira. A policy de `delete` faltava
-- desde a 0066 e entra aqui.
--
-- As vagas caem junto pelo `on delete cascade` da 0067, o que é o
-- comportamento certo: vaga de empresa que não existe mais não é vaga.

-- ── Parte 1 de 1 ───────────────────────────────────────────────────────

alter table public.companies
  drop constraint if exists companies_owner_id_key;

-- O índice continua existindo (`idx_companies_owner`, da 0066), agora sem
-- ser único: a busca "as empresas desta conta" é a consulta mais quente do
-- lado de quem contrata, e é ela que a tela de escolher empresa faz.
create index if not exists idx_companies_owner
  on public.companies(owner_id);

drop policy if exists "Empresa apaga seu próprio cadastro" on public.companies;
create policy "Empresa apaga seu próprio cadastro" on public.companies
  for delete using (auth.uid() = owner_id);

comment on column public.companies.owner_id is
  'De quem é a empresa. NÃO é único desde a 0102: a mesma pessoa pode ter
   a padaria e a lanchonete. Quem grava usa insert (nova) ou update por id
   (existente) — upsert com on conflict (owner_id) não funciona mais.';

-- ═══════════════════════════════════════════════════════════════════════
-- A CONFERÊNCIA. É a resposta desta janela que vale.
-- ═══════════════════════════════════════════════════════════════════════
-- Lê o pg_catalog, nunca o information_schema.
select case
  when (select count(*) from pg_constraint
         where conrelid = 'public.companies'::regclass
           and contype = 'u'
           and conkey = array[(select attnum from pg_attribute
                                where attrelid = 'public.companies'::regclass
                                  and attname = 'owner_id')]::int2[]) = 0
   and (select count(*) from pg_index i
         join pg_class c on c.oid = i.indexrelid
        where i.indrelid = 'public.companies'::regclass
          and i.indisunique
          and i.indkey::text = (select attnum::text from pg_attribute
                                 where attrelid = 'public.companies'::regclass
                                   and attname = 'owner_id')) = 0
   and (select count(*) from pg_policy
         where polrelid = 'public.companies'::regclass
           and polcmd = 'd') = 1
  then 'PRONTO — a mesma conta ja pode ter varias empresas, e apagar as que nao quer'
  else 'AINDA FALTA — me mande o que apareceu'
  end as resultado;
