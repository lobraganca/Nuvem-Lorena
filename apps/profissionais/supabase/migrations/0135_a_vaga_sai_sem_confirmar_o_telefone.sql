-- ═══════════════════════════════════════════════════════════════════════
-- 0135 — A vaga sai sem a empresa confirmar o telefone
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona, em 08/09: "tirar a confirmação do telefone da empresa dentro do
-- cadastro da vaga."
--
-- ── ONDE A TRAVA MORAVA ───────────────────────────────────────────────
--
-- Em dois lugares, e tirar de um só não adiantaria nada:
--
--   1. na tela de criar vaga, que recusava antes de tentar (já saiu);
--   2. AQUI, na policy de INSERT de `job_listings`, que é quem recusa de
--      verdade — e recusa com "new row violates row-level security
--      policy", um texto que não diz a ninguém o que fazer.
--
-- A exigência entrou na 0071 e foi reescrita pela 0107, quando o plano
-- passou a ser da conta. O `and c.phone_verified` atravessou as duas.
--
-- ── O QUE SAI E O QUE FICA ────────────────────────────────────────────
--
-- Sai APENAS o `and c.phone_verified`. Continuam de pé, na mesma policy:
--
--   · a empresa tem de ser da conta que está publicando (`c.owner_id =
--     auth.uid()`) — sem isso qualquer conta publicaria vaga em nome de
--     qualquer empresa da cidade;
--   · a conta tem de ter plano dentro do prazo.
--
-- E a coluna `phone_verified` NÃO é apagada: a empresa continua podendo
-- confirmar pelo painel, a administração continua vendo quem confirmou
-- (a peneira "Telefone não confirmado" do painel administrativo lê essa
-- coluna), e o dia em que a trava tiver de voltar, ela volta com uma
-- linha. Apagar a coluna seria jogar fora o dado por causa da regra.
--
-- ── O QUE SE PERDE, ESCRITO AQUI PARA NÃO SER ESQUECIDO ───────────────
--
-- A exigência não era à toa: quem se candidata a uma vaga procura a
-- empresa de volta, e um número não provado do lado de quem contrata é o
-- insumo do golpe do falso emprego. Isso continua verdade.
--
-- O que mudou foi o preço. Numa cidade que está começando, cada vaga que
-- não sai é uma vaga a menos na tela — e a empresa que desiste na hora de
-- publicar não volta. A prova do telefone passou a ser um convite no
-- painel, não um portão.
--
-- Se um dia a cidade tiver vaga sobrando e golpe aparecendo, a conta se
-- inverte, e o caminho de volta é recriar esta policy com a linha do
-- `phone_verified` de novo.

begin;

drop policy if exists "Empresa escreve vaga própria" on public.job_listings;
create policy "Empresa escreve vaga própria" on public.job_listings
  for insert with check (
    exists (
      select 1 from public.companies c
       where c.id = company_id
         and c.owner_id = auth.uid()
         -- O `and c.phone_verified` saiu daqui em 08/09. Ver o cabeçalho.
         and exists (
           select 1 from public.companies plano
            where plano.owner_id = c.owner_id
              and plano.plano_ate is not null
              and plano.plano_ate > now()
         )
    )
  );

commit;

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o `pg_catalog`, nunca o `information_schema` — este responde por
-- privilégio do papel corrente e já mentiu cinco vezes neste projeto.
--
-- As três perguntas de uma vez: o telefone saiu, a dona da empresa
-- continua sendo conferida, e o plano também. Uma só das três respondendo
-- errado reprova o bloco inteiro.
select case
  when pg_get_expr(pol.polwithcheck, pol.polrelid) like '%phone_verified%'
    then 'AINDA FALTA — a trava do telefone continua na regra da vaga.'
  when pg_get_expr(pol.polwithcheck, pol.polrelid) not like '%owner_id%'
    then 'AINDA FALTA — a regra parou de conferir de quem é a empresa. NÃO USE.'
  when pg_get_expr(pol.polwithcheck, pol.polrelid) not like '%plano_ate%'
    then 'AINDA FALTA — a regra parou de conferir o plano. NÃO USE.'
  else 'PRONTO — a vaga sai sem confirmar o telefone, e o resto continua trancado.'
  end as resultado
  from pg_policy pol
 where pol.polrelid = 'public.job_listings'::regclass
   and pol.polname = 'Empresa escreve vaga própria';
