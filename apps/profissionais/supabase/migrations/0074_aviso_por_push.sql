-- 0074 — o aviso da vaga, por notificação push.
--
-- Até aqui a onda guardava só um NÚMERO: "a onda 1 alcançou 12 pessoas".
-- Com isso não dá para avisar ninguém — não se sabe quem são — nem para
-- responder depois "esta vaga chegou em mim?". Aqui entram as duas tabelas
-- que faltavam: os aparelhos que podem receber aviso, e o registro de quem
-- foi avisado de qual vaga.
--
-- POR QUE PUSH, E O QUE ELE CUSTA
--
-- SMS chega em qualquer celular e é cobrado por mensagem, da dona do app.
-- Push é de graça e ilimitado — mas só alcança quem INSTALOU o app e
-- ACEITOU receber aviso. Quem usa pelo navegador sem instalar não recebe; no
-- iPhone, só recebe quem adicionou o app à tela de início.
--
-- Isso não é detalhe técnico, é o produto: uma empresa paga acreditando que
-- a vaga chega nas pessoas. Se metade da onda não tem como receber, ela
-- comprou um número que não existe. Por isso a coluna
-- `podiam_receber` existe em `job_dispatches` — a tela mostra os dois
-- números, e a diferença entre eles é a verdade.
--
-- Vai em 4 partes numeradas. O editor do painel desfaz o bloco inteiro
-- quando um comando falha no meio, então cada parte é rodada sozinha.

-- ── Parte 1 ────────────────────────────────────────────────────────────
-- Os aparelhos que podem receber aviso.
--
-- Uma pessoa tem vários: o celular, o tablet, o computador. Todos recebem,
-- porque não dá para saber qual está na mão dela agora.
--
-- Duas plataformas, dois formatos de endereço, e é por isso que as colunas
-- são frouxas: no app da loja o Firebase entrega um `token`; no navegador o
-- Web Push entrega um `endpoint` mais duas chaves. Uma tabela para os dois
-- evita duplicar toda a lógica de "quem avisar" só porque o transporte
-- muda.

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  -- 'android' = token do Firebase; 'web' = inscrição do navegador.
  plataforma text not null check (plataforma in ('android', 'ios', 'web')),
  -- Firebase: o token vai aqui e os três de baixo ficam nulos.
  token text,
  -- Web Push: endereço e as duas chaves da inscrição do navegador.
  endpoint text,
  p256dh text,
  auth text,
  criado_em timestamp with time zone default now(),
  -- Atualizado a cada vez que o app abre. Aparelho que não aparece há
  -- meses provavelmente foi trocado, e mandar aviso para ele é gastar
  -- tentativa à toa.
  visto_em timestamp with time zone default now()
);

-- Um aparelho é o mesmo aparelho: reinstalar o app devolve o mesmo token, e
-- sem isto a pessoa acumularia uma linha por instalação e receberia o mesmo
-- aviso cinco vezes.
create unique index if not exists idx_push_devices_token
  on public.push_devices (token) where token is not null;
create unique index if not exists idx_push_devices_endpoint
  on public.push_devices (endpoint) where endpoint is not null;
create index if not exists idx_push_devices_user on public.push_devices (user_id);

alter table public.push_devices enable row level security;

-- Cada um cuida dos próprios aparelhos, e só. A lista de aparelhos de
-- alguém diz em quantos lugares a pessoa usa o app — não é da conta de
-- ninguém.
create policy "Dono lê seus aparelhos" on public.push_devices
  for select using (auth.uid() = user_id);
create policy "Dono cadastra seu aparelho" on public.push_devices
  for insert with check (auth.uid() = user_id);
create policy "Dono atualiza seu aparelho" on public.push_devices
  for update using (auth.uid() = user_id);
create policy "Dono apaga seu aparelho" on public.push_devices
  for delete using (auth.uid() = user_id);

-- ── Parte 2 ────────────────────────────────────────────────────────────
-- Quem foi avisado de qual vaga.
--
-- É o que faltava para o aviso existir, e também o que permite ao
-- profissional abrir o app e ver "vagas para você" — que é o caminho de
-- quem NÃO tem push ligado. O push é o empurrão; esta tabela é o recado, e
-- o recado fica aqui mesmo que o empurrão não chegue.

create table if not exists public.job_notifications (
  id uuid primary key default gen_random_uuid(),
  job_listing_id uuid not null references public.job_listings on delete cascade,
  professional_id uuid not null references auth.users on delete cascade,
  wave integer not null check (wave in (1, 2, 3)),
  criado_em timestamp with time zone default now(),
  -- Quando o push saiu de fato. Nulo = ainda não saiu, ou a pessoa não tem
  -- aparelho que receba. São coisas diferentes e as duas importam: a
  -- primeira é fila, a segunda é alcance.
  enviado_em timestamp with time zone,
  -- Quando a pessoa ABRIU. É o número que diz se o aviso serve para alguma
  -- coisa — "enviado" só prova que saiu daqui.
  visto_em timestamp with time zone,
  -- A mesma vaga não avisa a mesma pessoa duas vezes, nem quando a onda 2
  -- alcança quem a onda 1 já tinha alcançado.
  unique (job_listing_id, professional_id)
);

create index if not exists idx_job_notifications_prof
  on public.job_notifications (professional_id, criado_em desc);
create index if not exists idx_job_notifications_vaga
  on public.job_notifications (job_listing_id);
create index if not exists idx_job_notifications_fila
  on public.job_notifications (enviado_em) where enviado_em is null;

alter table public.job_notifications enable row level security;

-- O profissional vê os avisos dele; a empresa vê os da vaga dela.
create policy "Vê os avisos que lhe dizem respeito" on public.job_notifications
  for select using (
    auth.uid() = professional_id
    or exists (
      select 1 from public.job_listings v
       join public.companies c on c.id = v.company_id
      where v.id = job_listing_id and c.owner_id = auth.uid()
    )
  );

-- Quem grava é a empresa dona da vaga, ao abrir a onda.
create policy "Empresa registra o aviso da sua vaga" on public.job_notifications
  for insert with check (
    exists (
      select 1 from public.job_listings v
       join public.companies c on c.id = v.company_id
      where v.id = job_listing_id and c.owner_id = auth.uid()
    )
  );

-- E o profissional marca como visto — só a própria linha, e só esse campo.
-- A garantia de que ele não mexe no resto é o gatilho da Parte 3.
create policy "Profissional marca o aviso como visto" on public.job_notifications
  for update using (auth.uid() = professional_id);

-- ── Parte 3 ────────────────────────────────────────────────────────────
-- O profissional só pode marcar "vi", nada mais.
--
-- Sem isto, a policy de UPDATE acima deixaria ele reescrever a vaga do
-- aviso ou apagar a data de envio — a policy diz QUAIS LINHAS, nunca quais
-- colunas.

create or replace function public.job_notifications_so_marca_visto()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() = old.professional_id then
    if new.job_listing_id is distinct from old.job_listing_id
       or new.professional_id is distinct from old.professional_id
       or new.wave is distinct from old.wave
       or new.enviado_em is distinct from old.enviado_em then
      raise exception 'Só a data de visualização pode ser alterada aqui.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists job_notifications_so_marca_visto_trigger on public.job_notifications;
create trigger job_notifications_so_marca_visto_trigger
  before update on public.job_notifications
  for each row execute function public.job_notifications_so_marca_visto();

-- ── Parte 4 ────────────────────────────────────────────────────────────
-- Quantos, da onda, TÊM como receber o aviso.
--
-- É a diferença entre "alcançou 12" e "12, e 3 recebem aviso no celular".
-- Sem este número a tela venderia um alcance que não existe — e a empresa
-- só descobriria pelo silêncio, que é a forma mais cara de descobrir.

alter table public.job_dispatches
  add column if not exists podiam_receber integer;

-- Quem, entre estas pessoas, tem aparelho cadastrado.
create or replace function public.quantos_recebem_push(p_users uuid[])
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select count(distinct d.user_id)::integer
    from public.push_devices d
   where d.user_id = any(p_users);
$$;

-- ── Confere a si mesma ─────────────────────────────────────────────────
select case
  when (select count(*) from pg_class
         where relname = 'push_devices' and relkind = 'r') = 1
   and (select count(*) from pg_class
         where relname = 'job_notifications' and relkind = 'r') = 1
   and (select count(*) from pg_attribute
         where attrelid = 'public.job_dispatches'::regclass
           and attname = 'podiam_receber' and not attisdropped) = 1
   and (select count(*) from pg_proc where proname = 'quantos_recebem_push') = 1
   and (select count(*) from pg_trigger
         where tgname = 'job_notifications_so_marca_visto_trigger') = 1
  then 'PRONTO — aparelhos, avisos por vaga, e a conta de quem recebe push'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;
