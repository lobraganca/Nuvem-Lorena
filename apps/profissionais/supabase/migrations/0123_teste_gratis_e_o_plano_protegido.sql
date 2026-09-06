-- 0123 — Teste grátis para empresa, e o plano deixa de ser editável pela
-- própria empresa.
--
-- ── PARTE 1: A MARCA DO TESTE ─────────────────────────────────────────
--
-- A dona: "vou dar 5 dias do plano de 1 vaga."
--
-- Dar teste hoje já era possível — a administração liga um plano e não
-- cobra, porque a cobrança é manual. O que faltava era DIZER que é teste,
-- e isso quebrava em três lugares:
--
--   . a empresa lia "Plano Ei Conecta até 11/09", igual a quem pagou, e no
--     dia do vencimento perdia a vaga sem entender — podendo até achar que
--     tinha pago;
--   . a administração não distinguia teste de cliente na própria lista;
--   . "quantas empresas assinaram?" passaria a contar os testes junto, e
--     essa é a pergunta que a dona faz todo dia.
--
-- Uma coluna resolve as três. `false` como padrão porque todo plano que
-- existe hoje foi combinado com ela — nenhum é teste.

alter table public.companies
  add column if not exists plano_cortesia boolean not null default false;

-- ── PARTE 2: O PLANO NÃO É DA EMPRESA ─────────────────────────────────
--
-- Isto não estava no pedido, e é o motivo de esta migration existir agora.
--
-- A política "Empresa atualiza seu próprio cadastro" (0066) deixa a dona
-- da empresa gravar QUALQUER coluna da própria linha — e `plano`,
-- `plano_ate` e agora `plano_cortesia` estão nessa linha. Ou seja: quem
-- tem uma empresa cadastrada e souber usar a chave pública do app pode se
-- dar o Ei Infinit. Nada no banco impedia.
--
-- O app nunca faz isso (o formulário de empresa nem manda essas colunas),
-- e por isso passou despercebido: o buraco não é do app, é do banco, e
-- quem entra por ele não usa o app.
--
-- O remédio é o mesmo que a 0116 já usa para o destaque da vaga: um
-- gatilho que devolve as colunas ao valor antigo para quem não é
-- administração. Não recusa a gravação com erro — devolve o valor e deixa
-- o resto passar, senão a empresa não conseguiria mais editar o próprio
-- telefone.
--
-- `plano_desde` entra na lista porque o gatilho da 0110 o carimba a partir
-- de `plano`: sem devolvê-lo também, uma tentativa recusada deixaria a
-- data de início mentindo sobre uma mudança que não aconteceu.

create or replace function public.companies_protege_o_plano()
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

  -- ── SÓ VALE PARA QUEM ENTRA PELO APP ──────────────────────────────
  -- `role` é o papel que o PostgREST assume ao atender uma chamada do
  -- app: `authenticated` para quem entrou, `anon` para quem não entrou.
  -- Qualquer outra coisa quer dizer que a gravação NÃO veio pelo app —
  -- veio do editor SQL do painel, de uma migration ou dos testes do
  -- banco, todos com acesso total, para quem gatilho não é barreira
  -- nenhuma.
  --
  -- Medido antes de escrever: `current_setting('role')` responde `none`
  -- numa sessão comum e `authenticated` depois de um `set role`, e o
  -- valor ATRAVESSA a fronteira do `security definer` (dentro dele
  -- `current_user` já é o dono da função, e por isso não serviria).
  --
  -- A 0116 (o destaque da vaga) não tem esta saída, e o preço está nos
  -- dados de teste: eles desligam o gatilho e religam depois, e um erro
  -- no meio deixa a proteção desligada.
  if coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.plano := null;
    new.plano_ate := null;
    new.plano_desde := null;
    new.plano_cortesia := false;
  else
    new.plano := old.plano;
    new.plano_ate := old.plano_ate;
    new.plano_desde := old.plano_desde;
    new.plano_cortesia := old.plano_cortesia;
  end if;
  return new;
end;
$$;

drop trigger if exists companies_protege_o_plano on public.companies;
create trigger companies_protege_o_plano
  before insert or update on public.companies
  for each row execute function public.companies_protege_o_plano();

-- ── Confere a si mesma ────────────────────────────────────────────────
-- Lê o `pg_catalog`, nunca o `information_schema`: ele filtra por
-- privilégio do papel corrente, e o editor do painel não roda como dono —
-- já respondeu "não existe" cinco vezes para uma coluna que estava lá.
--
-- E é o ÚLTIMO comando do arquivo de propósito: a dona lê o resultado do
-- último, e qualquer coisa depois disto engoliria a resposta.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.companies'::regclass
           and attname = 'plano_cortesia' and not attisdropped) = 1
   and (select count(*) from pg_trigger
         where tgrelid = 'public.companies'::regclass
           and tgname = 'companies_protege_o_plano') = 1
  then 'PRONTO — dá para marcar teste grátis, e só a administração muda plano'
  else 'AINDA FALTA — confira as partes acima'
end as resultado;
