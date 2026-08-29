-- 0071 — a empresa também confirma o telefone, e a vaga pode ser anunciada.
--
-- Três coisas, todas do lado de quem contrata:
--
-- 1. Empresa confirma o telefone, igual ao profissional. A regra passou a
--    valer para todo mundo: quem publica vaga é procurado de volta, e um
--    número não confirmado do lado de quem contrata é o mesmo problema do
--    outro lado — com o agravante de que aqui há dinheiro envolvido.
--
-- 2. A vaga pode ficar anunciada na área de anúncios, por 30 dias.
--
-- 3. Um teto de vagas com disparo por mês, para o aviso não virar enxurrada.
--
-- Vai em 3 partes numeradas. O editor do painel desfaz o bloco inteiro
-- quando um comando falha no meio, então cada parte é rodada sozinha.

-- ── Parte 1 ────────────────────────────────────────────────────────────
-- O telefone confirmado da empresa.
--
-- Colunas próprias em vez de reaproveitar `professionals`: uma empresa
-- contratante não tem cadastro de profissional, e criar um só para guardar
-- um booleano faria ela aparecer na busca de quem procura encanador.

alter table public.companies
  add column if not exists phone_verified boolean not null default false;
alter table public.companies
  add column if not exists phone_verified_at timestamp with time zone;

-- Ninguém se declara confirmado — o mesmo gatilho da 0024, aplicado à
-- empresa. Sem ele, um `update` direto do navegador ligaria o selo, e o
-- selo é justamente o que diz que o número foi provado.
--
-- Um gatilho só cuida das duas regras (não ligar por fora, e perder o selo
-- ao trocar de número): separados, a ordem entre eles passa a importar, e
-- ordem de gatilho no Postgres é o nome em ordem alfabética — uma armadilha
-- que só aparece quando alguém renomeia um deles.
create or replace function public.companies_protege_telefone_confirmado()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    -- Nenhuma empresa nasce confirmada.
    new.phone_verified := false;
    new.phone_verified_at := null;
    return new;
  end if;

  if new.phone_verified is distinct from old.phone_verified
     or new.phone_verified_at is distinct from old.phone_verified_at then
    /* `current_setting` com o segundo argumento true devolve null em vez de
       estourar quando a variável não existe — é assim que a função de
       confirmação se identifica, igual à 0024. */
    if coalesce(current_setting('app.confirmando_telefone_empresa', true), '') <> 'sim' then
      raise exception 'O telefone confirmado só pode ser alterado pela confirmação por código.';
    end if;
  end if;

  /* Trocar o número derruba a confirmação: o selo vale para o número que
     foi confirmado, não para a empresa em geral. Sem isto bastaria
     confirmar o próprio celular e depois trocar pelo número do golpe.

     Compara só os dígitos, senão "(31) 99999-0001" e "31999990001" — o
     mesmo número — derrubariam o selo a cada vez que alguém salvasse o
     cadastro sem mexer no telefone. */
  if regexp_replace(coalesce(new.phone, ''), '\D', '', 'g')
     is distinct from regexp_replace(coalesce(old.phone, ''), '\D', '', 'g') then
    new.phone_verified := false;
    new.phone_verified_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists companies_protege_telefone_confirmado_trigger on public.companies;
create trigger companies_protege_telefone_confirmado_trigger
  before insert or update on public.companies
  for each row execute function public.companies_protege_telefone_confirmado();

-- A função que confirma de verdade. Mesma lógica da `confirmar_whatsapp`
-- da 0024: só o dono, e só se o Auth já confirmou AQUELE número.
-- O `security definer` é o que permite gravar a coluna protegida.
create or replace function public.confirmar_telefone_empresa(p_company_id uuid)
returns boolean
language plpgsql
security definer set search_path = public, pg_catalog
as $$
declare
  v_dono uuid;
  v_phone text;
  v_auth_phone text;
  v_confirmado timestamptz;
  v_digitos_empresa text;
  v_digitos_auth text;
begin
  select owner_id, phone into v_dono, v_phone
    from public.companies where id = p_company_id;

  if v_dono is null then
    raise exception 'Empresa não encontrada.';
  end if;
  if v_dono <> auth.uid() then
    raise exception 'Só o dono da empresa pode confirmar o telefone dela.';
  end if;

  select phone, phone_confirmed_at into v_auth_phone, v_confirmado
    from auth.users where id = auth.uid();

  if v_confirmado is null then
    raise exception 'O número ainda não foi confirmado por código.';
  end if;

  -- O "55" do começo sai dos dois lados: o Auth guarda em formato
  -- internacional e o cadastro guarda como a pessoa digitou.
  v_digitos_empresa := regexp_replace(regexp_replace(coalesce(v_phone, ''), '\D', '', 'g'), '^55', '');
  v_digitos_auth := regexp_replace(regexp_replace(coalesce(v_auth_phone, ''), '\D', '', 'g'), '^55', '');

  if v_digitos_empresa = '' or v_digitos_empresa <> v_digitos_auth then
    raise exception 'O número confirmado é diferente do que está no cadastro da empresa.';
  end if;

  /* A senha que o gatilho reconhece. `set local` vale só até o fim desta
     transação, então ela não fica valendo para nada depois. */
  perform set_config('app.confirmando_telefone_empresa', 'sim', true);

  update public.companies
     set phone_verified = true, phone_verified_at = now()
   where id = p_company_id;

  perform set_config('app.confirmando_telefone_empresa', '', true);

  return true;
end;
$$;

-- ── Parte 2 ────────────────────────────────────────────────────────────
-- A vaga anunciada na área de anúncios.
--
-- `anunciada_ate` guarda até quando, e não "está anunciada agora": data
-- vence sozinha, booleano precisa de alguém para desligar — e esse alguém
-- é sempre uma rotina que um dia falha em silêncio.

alter table public.job_listings
  add column if not exists anunciada_ate timestamp with time zone;

-- Sem telefone confirmado, a empresa NÃO publica vaga.
--
-- A tela já avisa e já trava, mas trava de tela é trava que se contorna:
-- basta uma chamada feita por fora do app. Aqui a recusa é do banco, que é
-- o único lugar onde ela vale para todo mundo.
--
-- Substitui a policy de INSERT criada na 0067, acrescentando a condição.
drop policy if exists "Empresa escreve vaga própria" on public.job_listings;
create policy "Empresa escreve vaga própria" on public.job_listings
  for insert with check (
    exists (
      select 1 from public.companies c
       where c.id = company_id
         and c.owner_id = auth.uid()
         and c.phone_verified
    )
  );

create index if not exists idx_job_listings_anunciadas
  on public.job_listings (anunciada_ate)
  where anunciada_ate is not null;

-- ── Parte 3 ────────────────────────────────────────────────────────────
-- Quantas vagas cada empresa já disparou no mês.
--
-- É uma função, e não uma coluna de contador: contador precisa ser zerado
-- todo dia 1º por alguém, e "alguém" é uma rotina agendada que, quando
-- falha, deixa a empresa sem disparar sem que nada explique por quê.
-- Contar as vagas do mês responde sozinho, sempre certo, e não tem o que
-- desligar.
--
-- Conta VAGAS com onda aberta, não ondas abertas. Alargar a busca de uma
-- vaga que não deu resposta é a mesma vaga procurando gente — cobrar por
-- isso faria a empresa hesitar justamente quando precisa alargar.
create or replace function public.vagas_disparadas_no_mes(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select count(distinct v.id)::integer
    from public.job_listings v
    join public.job_dispatches d on d.job_listing_id = v.id
   where v.company_id = p_company_id
     and d.sent_at >= date_trunc('month', now());
$$;

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.companies'::regclass
           and attname in ('phone_verified','phone_verified_at') and not attisdropped) = 2
   and (select count(*) from pg_attribute
         where attrelid = 'public.job_listings'::regclass
           and attname = 'anunciada_ate' and not attisdropped) = 1
   and (select count(*) from pg_proc
         where proname = 'confirmar_telefone_empresa') = 1
   and (select count(*) from pg_proc
         where proname = 'vagas_disparadas_no_mes') = 1
  then 'PRONTO — empresa confirma telefone, vaga pode ser anunciada, cota do mes conta sozinha'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;
