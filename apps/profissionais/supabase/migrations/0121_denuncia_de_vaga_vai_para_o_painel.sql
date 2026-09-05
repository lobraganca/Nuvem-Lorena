-- ═══════════════════════════════════════════════════════════════════════
-- 0121 — A denúncia chega no painel, e a vaga também pode ser denunciada
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "a situação de denunciar o perfil deve ser direcionado ao painel
-- administrativo, com a solicitação e descrição para que eu veja e tenha a
-- possibilidade de tirar a vaga ou o usuário do ar."
--
-- ── O que estava acontecendo ──────────────────────────────────────────
--
-- Os dois botões de denunciar do app — o da tela da vaga e o do perfil de
-- uma pessoa — abriam o WHATSAPP com um texto pronto. A tabela `reports`
-- existe desde a 0007 e a seção "Denúncias" existe no painel desde a
-- 0008; só que nada no app escrevia nela. O painel mostrava, e continua
-- mostrando até hoje, "Nenhuma denúncia recebida ainda" — não porque
-- ninguém denunciou, mas porque a denúncia ia para outro lugar.
--
-- Quem denunciava dependia de a mensagem não se perder no meio da
-- conversa, e a administração não tinha lista, não tinha data, não tinha
-- estado (apurada? descartada?) e não tinha o botão de tirar do ar do
-- lado do caso. Denúncia sem fila é denúncia que se perde.
--
-- ── O que falta no banco ──────────────────────────────────────────────
--
-- `reports` só sabe denunciar PESSOA (`professional_id`, obrigatório). A
-- vaga não cabe nela. É o que esta migration acrescenta:
--
--   . `job_id` — a vaga denunciada;
--   . `professional_id` passa a poder ficar vazio;
--   . uma trava para a linha apontar para EXATAMENTE UMA das duas coisas
--     (uma denúncia que não diz do que é não serve para nada, e uma que
--     aponta para as duas ao mesmo tempo é duas denúncias mal contadas).
--
-- Tirar do ar já é possível dos dois lados e não precisa de nada novo:
-- pessoa é `professionals.suspended` (0008) e vaga é `job_listings.status`
-- (a administração já pode mudar, pela 0112). E as duas coisas se
-- desfazem — nenhuma denúncia apaga o trabalho de ninguém.
--
-- ── O que NÃO muda ────────────────────────────────────────────────────
--
-- Quem pode denunciar continua sendo quem está logado E confirmou o
-- número (0035 e 0045), pelo motivo escrito lá: denúncia anônima é a
-- ferramenta mais barata que existe para tirar um concorrente do ar, e do
-- outro lado tem alguém cujo anúncio é o ganha-pão.

-- ── 1. A vaga denunciada ───────────────────────────────────────────────

alter table public.reports
  add column if not exists job_id uuid references public.job_listings (id) on delete cascade;

-- Vazio quando a denúncia é de uma vaga.
alter table public.reports
  alter column professional_id drop not null;

-- Uma coisa, e só uma. `is not null` conta como 1 em soma booleana no
-- Postgres via `::int` — escrito assim para o erro do banco ser claro se
-- alguém tentar gravar uma linha solta.
alter table public.reports
  drop constraint if exists reports_uma_coisa_so;
alter table public.reports
  add constraint reports_uma_coisa_so check (
    (professional_id is not null)::int + (job_id is not null)::int = 1
  );

-- ── 2. Uma denúncia em aberto por vaga, por pessoa ─────────────────────
-- O mesmo que a 0013 já fazia para cadastro: enquanto está pendente, a
-- mesma pessoa não abre duas. Depois de apurada ou descartada, pode de
-- novo (reincidência é caso novo).
create unique index if not exists reports_reporter_job_pending_uidx
  on public.reports (job_id, reporter_id)
  where job_id is not null and reporter_id is not null and status = 'pending';

-- ── 3. A regra de quem grava, agora aceitando vaga ─────────────────────
-- A policy da 0045 não precisa mudar de conteúdo (ela fala de
-- `reporter_id` e do telefone confirmado, não da coluna denunciada), mas é
-- reescrita aqui para o arquivo ser autossuficiente: quem montar um banco
-- do zero com estes arquivos tem a regra final num lugar só.
drop policy if exists so_quem_confirmou_o_numero_pode_denunciar on public.reports;
create policy so_quem_confirmou_o_numero_pode_denunciar
  on public.reports for insert
  to authenticated
  with check (
    reporter_id = auth.uid()
    and public.tem_telefone_confirmado()
  );

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema (que já respondeu cinco
-- vezes que uma coluna existente não existia — ver o CLAUDE.md).
select case
  when (select count(*) from pg_attribute
          where attrelid = 'public.reports'::regclass
            and attname = 'job_id' and not attisdropped) = 1
   and (select attnotnull from pg_attribute
          where attrelid = 'public.reports'::regclass
            and attname = 'professional_id') = false
   and (select count(*) from pg_constraint
          where conrelid = 'public.reports'::regclass
            and conname = 'reports_uma_coisa_so') = 1
  then 'PRONTO — a denúncia de vaga já pode ser gravada, e ela aparece no painel em Denúncias'
  else 'AINDA FALTA — confira os comandos acima'
  end as resultado;
