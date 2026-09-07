-- ═══════════════════════════════════════════════════════════════════════
-- 0133 — 30 dias de 1 vaga grátis, por tempo limitado
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "quero liberar 30 dias de 1 vaga grátis. Escrever que é por
-- tempo limitado."
--
-- O teste grátis já existia desde a 0123, mas só a administração podia
-- dar, uma empresa por vez, à mão. Isto abre a mesma coisa para a
-- empresa pegar sozinha, com um toque — e a decisão de a quem dar
-- continua sendo do banco, não da tela.
--
-- ── POR QUE ISTO NÃO PODE SER UM `update` DO APP ──────────────────────
--
-- A 0123 pôs um gatilho que devolve `plano`, `plano_ate`, `plano_desde` e
-- `plano_cortesia` ao valor antigo para quem não é administração. Ele
-- existe por um motivo que não mudou: sem ele, quem tem empresa
-- cadastrada e souber usar a chave pública do app se dá o Ei Infinit
-- sozinho.
--
-- Então a promoção não pode ser o app gravando o plano — tem de ser uma
-- função `security definer`, que confere as regras e grava por dentro. A
-- tela pede; quem decide é aqui.
--
-- ── O QUE ESTA MIGRATION CRIA ─────────────────────────────────────────
--
--   1. `public.ofertas` — o interruptor. A promoção fica ligada enquanto
--      a linha disser que sim, e a dona desliga com UMA linha de SQL.
--   2. `public.ativar_teste_gratis()` — a função que a empresa chama.
--   3. `public.teste_gratis_disponivel()` — a pergunta que a tela faz
--      antes de oferecer, para não mostrar um botão que vai recusar.

-- ══ PARTE 1: O INTERRUPTOR ════════════════════════════════════════════
--
-- "Por tempo limitado" tem de ser VERDADE, e verdade que se desfaz sem
-- publicar código: a promoção acaba num dia que ninguém sabe hoje, e
-- esperar uma sessão de programação para desligá-la é o jeito de ela
-- ficar ligada para sempre.
--
-- Duas formas de acabar, e as duas param a oferta:
--   . `ligada = false` — a dona desliga na hora que quiser;
--   . `ate` — uma data, se ela quiser marcar o fim desde já. Fica nula
--     por padrão: data inventada aqui mataria a promoção num dia que
--     ninguém escolheu.
--
-- Tabela, e não uma constante dentro da função: trocar um valor é um
-- `update` de uma linha, que ela cola sem medo. Trocar uma função é
-- recriar a função inteira — o tipo de coisa que dá errado no celular.
create table if not exists public.ofertas (
  chave text primary key,
  ligada boolean not null default false,
  ate timestamptz,
  criada_em timestamptz not null default now()
);

insert into public.ofertas (chave, ligada)
values ('teste_gratis_30_dias', true)
on conflict (chave) do nothing;

alter table public.ofertas enable row level security;

/* Qualquer um LÊ: a tela precisa saber se oferece o botão, e quem ainda
   não entrou também vê a chamada. Não há nada de sigiloso numa promoção
   — o objetivo dela é justamente ser vista. */
drop policy if exists oferta_e_publica on public.ofertas;
create policy oferta_e_publica
  on public.ofertas for select
  to anon, authenticated
  using (true);

/* E NINGUÉM escreve pelo app. Não há policy de insert/update/delete de
   propósito: sem policy, o PostgREST recusa. Quem liga e desliga é a dona
   pelo editor SQL do painel, que não passa por RLS.

   Sem esta ausência, a promoção seria um `update` de uma linha ao alcance
   de qualquer pessoa com a chave pública — e ela é o que decide se o
   plano pago é obrigatório ou não. */

grant select on public.ofertas to anon, authenticated;

-- ══ PARTE 2: A PERGUNTA QUE A TELA FAZ ════════════════════════════════
--
-- Responde se ESTA conta pode pegar a promoção agora. A tela chama antes
-- de desenhar o botão: oferecer e depois recusar é pior que não oferecer.
--
-- `security definer` porque ela olha TODAS as empresas do dono, e não só
-- a que está aberta na tela. Sem isso, a resposta dependeria do que a RLS
-- deixa a pessoa enxergar, e quem tem duas lojas veria uma resposta
-- diferente em cada uma.
create or replace function public.teste_gratis_disponivel()
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  quem uuid := auth.uid();
  aberta boolean;
begin
  if quem is null then
    return false;
  end if;

  select o.ligada and (o.ate is null or o.ate > now())
    into aberta
    from public.ofertas o
   where o.chave = 'teste_gratis_30_dias';

  if not coalesce(aberta, false) then
    return false;
  end if;

  -- ── UMA VEZ POR CONTA, E NÃO POR EMPRESA ──────────────────────────
  -- O teto de vagas é somado entre as lojas do mesmo dono (0107), então
  -- a promoção também é da conta. Fosse por empresa, bastaria cadastrar
  -- "Padaria 2" para ganhar mais 30 dias, e outra vez, e outra.
  --
  -- "Já teve plano" inclui o vencido de propósito: `plano_cortesia`
  -- continua ligado depois que a cortesia acaba, e é justamente esse
  -- rastro que impede a segunda rodada. Quem já pagou também não pega —
  -- não faria sentido dar teste a quem já é cliente.
  return not exists (
    select 1 from public.companies c
     where c.owner_id = quem
       and (c.plano is not null or c.plano_cortesia = true)
  );
end;
$$;

grant execute on function public.teste_gratis_disponivel() to authenticated;

-- ══ PARTE 3: ATIVAR ═══════════════════════════════════════════════════
--
-- Devolve a data em que a cortesia termina, para a tela dizer "até
-- 07/10" sem ter de ler a empresa de novo. `null` quer dizer que não
-- deu — e a tela trata isso como "recarregue e veja", nunca como sucesso.
--
-- Confere TUDO de novo aqui dentro, e não confia no que a Parte 2
-- respondeu: entre a tela desenhar o botão e a pessoa tocar nele podem
-- passar minutos, e a promoção pode ter sido desligada no meio. Além
-- disso, qualquer um pode chamar esta função direto, sem passar pela
-- tela.
create or replace function public.ativar_teste_gratis(p_company_id uuid)
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare
  quem uuid := auth.uid();
  ate timestamptz;
begin
  if quem is null then
    return null;
  end if;

  -- A empresa é de quem está pedindo? Sem esta linha, qualquer pessoa
  -- logada daria a promoção à empresa de outra — e a de outra é quem
  -- ficaria sem poder pegar a dela depois.
  if not exists (
    select 1 from public.companies c
     where c.id = p_company_id and c.owner_id = quem
  ) then
    return null;
  end if;

  if not public.teste_gratis_disponivel() then
    return null;
  end if;

  ate := now() + interval '30 days';

  -- ── A MARCA QUE O GATILHO DA 0123 RECONHECE ───────────────────────
  -- Sem esta linha a função roda inteira, devolve a data, e NÃO GRAVA
  -- NADA: o gatilho da 0123 devolve as colunas de plano ao valor antigo
  -- e a empresa continua sem plano, sem nenhum erro em lugar nenhum. Foi
  -- o que o teste 31 pegou na primeira execução.
  --
  -- A armadilha é que ele é `security definer` e mesmo assim vê o papel
  -- do app: `current_setting('role')` ATRAVESSA essa fronteira e continua
  -- respondendo `authenticated`. Está escrito no comentário da própria
  -- 0123 — e mesmo assim é o tipo de coisa que só a execução mostra.
  --
  -- A marca é a mesma que a 0124 já usa no reembolso, e não uma nova: uma
  -- segunda marca com outro nome seria uma segunda porta para manter
  -- fechada. `true` no terceiro argumento — vale só dentro desta
  -- transação e some sozinha quando ela acaba.
  --
  -- E ela não vira porta dos fundos: pelo app só se chega ao banco por
  -- consultas de tabela e por funções expostas de propósito; não há como
  -- mandar um `set_config` daqui de fora.
  perform set_config('ei.mexendo_no_plano', 'sim', true);

  -- `pro` é o Ei Conecta, o plano de 1 vaga (ver PLANOS_EMPRESA no app).
  -- Escrito aqui porque é o que a dona liberou: "30 dias de 1 vaga".
  update public.companies
     set plano = 'pro',
         plano_ate = ate,
         plano_desde = now(),
         plano_cortesia = true,
         -- Não renova sozinho: teste que vira cobrança sem ninguém pedir
         -- é o que faz a pessoa desconfiar do app inteiro.
         plano_recorrente = false
   where id = p_company_id;

  -- Apaga a marca antes de sair. Ela morreria sozinha no fim da
  -- transação, mas o PostgREST atende várias chamadas numa transação só:
  -- deixá-la ligada abriria a proteção do plano para o que vier depois,
  -- na mesma chamada.
  perform set_config('ei.mexendo_no_plano', '', true);

  return ate;
end;
$$;

grant execute on function public.ativar_teste_gratis(uuid) to authenticated;

-- ── Confere a si mesma ────────────────────────────────────────────────
-- Lê o `pg_catalog`, nunca o `information_schema`: ele filtra por
-- privilégio do papel corrente, e o editor do painel não roda como dono —
-- já respondeu "não existe" cinco vezes para uma coluna que estava lá.
--
-- É o ÚLTIMO comando do arquivo de propósito: a dona lê o resultado do
-- último, e qualquer coisa depois disto engoliria a resposta.
select case
  when (select count(*) from pg_class
         where relname = 'ofertas' and relnamespace = 'public'::regnamespace) = 1
   and (select ligada from public.ofertas where chave = 'teste_gratis_30_dias') = true
   and (select count(*) from pg_proc
         where proname = 'ativar_teste_gratis'
           and pronamespace = 'public'::regnamespace) = 1
   and (select count(*) from pg_proc
         where proname = 'teste_gratis_disponivel'
           and pronamespace = 'public'::regnamespace) = 1
  then 'PRONTO — a promocao de 30 dias esta LIGADA e as empresas ja podem ativar'
  else 'AINDA FALTA — confira as partes acima'
end as resultado;
