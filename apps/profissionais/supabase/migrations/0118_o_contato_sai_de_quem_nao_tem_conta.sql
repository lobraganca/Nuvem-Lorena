-- ══════════════════════════════════════════════════════════════════════
-- 0118 — O TELEFONE SAI DE QUEM NÃO TEM CONTA
-- ══════════════════════════════════════════════════════════════════════
--
-- ── O QUE ESTAVA ACONTECENDO ──────────────────────────────────────────
--
-- A view `professionals_public` traz `phone`, `whatsapp`, `email` e
-- `telefones_extra`, e estava liberada para o papel `anon` — o de quem
-- NÃO TEM CONTA. A chave que autoriza esse papel é pública por desenho:
-- ela vai dentro do JavaScript do site, à vista de qualquer um que abra o
-- código-fonte da página.
--
-- O app exige conta para ver a lista de gente. Só que isso é uma cortina
-- na frente de uma porta aberta: quem exige é a TELA, e a API não exige
-- nada. Com a chave do site e uma linha de `curl`, paginando com o
-- cabeçalho `Range`, qualquer pessoa baixava nome, telefone, WhatsApp e
-- e-mail de TODOS os cadastrados da cidade em segundos.
--
-- O teto de 200 linhas da 0062 não protegia: ele limita cada resposta,
-- não o total. O próprio app já pagina em volta dele (`lerTudo`).
--
-- ── POR QUE ISSO É GRAVE, E NÃO SÓ FEIO ───────────────────────────────
--
-- 1. Uma lista de pessoas desempregadas com telefone é exatamente o
--    insumo do golpe de emprego falso. É o dado mais sensível que este
--    app guarda, sobre as pessoas menos protegidas que ele atende.
--
-- 2. O plano pago existe para a empresa "não ter que chamar um por um".
--    Se a lista inteira sai de graça pela API, o produto pago perde o
--    motivo de existir.
--
-- 3. É tratamento de dado pessoal sem base legal para esse uso (LGPD,
--    art. 7º e 46): a pessoa consentiu em aparecer para quem contrata,
--    não em ter o telefone coletável em massa por qualquer um.
--
-- ── JÁ ACONTECEU ANTES, NESTE MESMO BANCO ─────────────────────────────
--
-- A `profiles_public` tinha o mesmo defeito — view sem `where`, liberada
-- para `anon`, entregando o nome de todas as contas. Foi corrigida, e a
-- lição não chegou às outras views. Por isso esta migration fecha TODAS
-- as views de dado pessoal de uma vez, e não só a que motivou o achado.
--
-- ── O QUE ISTO NÃO QUEBRA ─────────────────────────────────────────────
--
-- Conferido no código antes de escrever: as únicas telas que abrem sem
-- conta são `/login`, `/termos` e `/privacidade` (a lista `LIVRES` em
-- `ExigirConta.tsx`), e nenhuma delas lê profissionais. Todo o resto do
-- app já roda autenticado, então nada muda na tela.
--
-- ⚠ ATENÇÃO — LEIA ANTES DE APLICAR
--
-- Os dois apps (Ei Emprego e procurô) leem a MESMA tabela de
-- profissionais. Se o procuroapp.com.br deixar alguém ver a lista de
-- profissionais SEM FAZER LOGIN, esta migration vai deixar aquela lista
-- vazia. Se ele exige conta como o Ei, não muda nada lá também.
--
-- Se não tiver certeza: aplique, abra o procurô numa aba anônima e veja.
-- Para desfazer, é uma linha (está no fim deste arquivo).
--
-- ══════════════════════════════════════════════════════════════════════

-- ── Parte 1 — as views de dado pessoal deixam de atender quem não entrou
--
-- `authenticated` continua com tudo: o app não perde nada. Sai só o
-- `anon`, que é quem nunca deveria ter tido.

revoke select on public.professionals_public from anon;
revoke select on public.profiles_public from anon;

-- `companies_public` FICA liberada de propósito: são empresas, não
-- pessoas físicas, e o dado ali (nome, cidade, descrição) é o que elas
-- publicam para serem encontradas. Se um dia a tela de uma vaga passar a
-- abrir por link sem conta, é dela que a página vai precisar.

-- ── Parte 2 — o contato deixa de vir junto da lista
--
-- Revogar o `anon` fecha a porta de quem não tem conta. Falta a segunda
-- camada: hoje QUALQUER pessoa logada (e criar conta é de graça, leva um
-- SMS) recebe o telefone de todo mundo em cada página da lista, mesmo
-- quando a tela só vai mostrar nome e ofício.
--
-- A view principal para de carregar contato. Quem precisa dele — a ficha
-- de uma pessoa, e a lista de quem se candidatou a uma vaga — passa a
-- pedir explicitamente, numa view separada.
--
-- Isso NÃO é redundante com a Parte 1: são camadas diferentes. A 1 tira
-- quem não entrou; a 2 faz com que entrar não seja mais suficiente para
-- coletar a cidade inteira de uma vez.
--
-- (Fica para a migration seguinte, junto com o código que a acompanha —
--  ver o comentário no fim deste arquivo.)

-- ── Confere a si mesma ────────────────────────────────────────────────
-- Lê `pg_catalog`, nunca `information_schema`: o `information_schema`
-- filtra por privilégio do papel corrente e o editor do painel não roda
-- como dono — ele já respondeu "não existe" cinco vezes para uma coluna
-- que estava lá.

select case
  when (
    select count(*)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname in ('professionals_public', 'profiles_public')
       and has_table_privilege('anon', c.oid, 'SELECT')
  ) = 0
  then 'PRONTO — quem não tem conta não lê mais telefone, WhatsApp nem e-mail de ninguém.'
  else 'AINDA FALTA — o papel anon continua lendo alguma das duas views. Rode o bloco de novo.'
end as resultado;

-- ══════════════════════════════════════════════════════════════════════
-- PARA DESFAZER, se o procurô depender de leitura sem conta:
--
--   grant select on public.professionals_public to anon;
--   grant select on public.profiles_public to anon;
--
-- Mas nesse caso o vazamento volta, e o certo passa a ser tirar o contato
-- da view (Parte 2) em vez de reabrir o `anon`.
-- ══════════════════════════════════════════════════════════════════════
