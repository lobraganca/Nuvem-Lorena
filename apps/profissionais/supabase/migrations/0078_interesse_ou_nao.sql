-- ═══════════════════════════════════════════════════════════════════════
-- 0078 — A pessoa responde SIM ou NÃO ao aviso de compatibilidade
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "ao disparar uma onda, o aviso de compatibilidade será enviado aos
--          perfis compatíveis. A pessoa escolhe se quer estar disponível ou
--          se não tem interesse. A lista de interessados aparece em um
--          painel para o anunciante."
--
-- ── O QUE FALTAVA ─────────────────────────────────────────────────────
--
-- Só existia o SIM. A tela tinha um botão, "Tenho interesse", e mais nada:
-- quem não queria aquela vaga não tinha o que tocar. E, sem o não, o app
-- não conseguia distinguir três situações completamente diferentes:
--
--   ainda não abriu  ·  abriu e não quis  ·  abriu e ainda está pensando
--
-- As três apareciam iguais. A vaga recusada continuava na lista da pessoa
-- para sempre, com o mesmo botão pedindo resposta — e "Novas" contava como
-- pendente uma decisão que já tinha sido tomada.
--
-- ── POR QUE UMA COLUNA NOVA, E NÃO MAIS UM VALOR EM `status` ──────────
--
-- `status` é a triagem da EMPRESA: new (chegou), read (li), accepted
-- (chamei), rejected (descartei). São os passos de quem contrata.
--
-- Enfiar o "não quero" da pessoa nessa mesma coluna misturaria duas
-- decisões de donos diferentes num campo só, e `rejected` (a empresa
-- descartou) viraria vizinho de `declined` (a pessoa recusou) — duas
-- palavras parecidas para coisas opostas, no mesmo lugar. Quem lesse o
-- painel um ano depois não teria como saber qual foi qual.
--
-- Aqui são dois campos, um para cada lado da mesa. `interessado` é da
-- pessoa; `status` continua sendo da empresa.
--
-- ── `default true` de propósito ───────────────────────────────────────
--
-- Toda linha que já existe foi criada por alguém tocando em "Tenho
-- interesse" — não havia outro caminho. `true` é a verdade histórica delas,
-- não um chute.

alter table public.job_responses
  add column if not exists interessado boolean not null default true;

-- O painel do anunciante filtra por esta coluna, e é a consulta mais quente
-- da tela dele.
create index if not exists idx_job_responses_interessados
  on public.job_responses (job_listing_id)
  where interessado = true;

-- ── A pessoa pode mudar de ideia ───────────────────────────────────────
--
-- Faltava: havia policy de INSERT para a pessoa e de UPDATE só para a
-- empresa. Quem recusasse ficava preso na recusa, sem nenhum caminho de
-- volta — e mudar de ideia sobre uma vaga é a coisa mais normal do mundo
-- ("não quero" na segunda-feira, desempregado na sexta).
--
-- O `with check` é o que impede a pessoa de mexer no que não é dela: sem
-- ele, ela poderia se marcar como `accepted` na triagem da empresa e
-- aparecer no painel como alguém que a empresa já escolheu.
drop policy if exists "Pessoa muda a própria resposta" on public.job_responses;
create policy "Pessoa muda a própria resposta" on public.job_responses
  for update
  using (auth.uid() = professional_id)
  with check (auth.uid() = professional_id);

create or replace function public.job_responses_pessoa_so_mexe_no_interesse()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  /* Quando quem edita é a própria pessoa, só `interessado` pode mudar.
     A triagem (`status`, `company_notes`) é da empresa, e uma policy de
     UPDATE sozinha não sabe distinguir QUAL coluna mudou. */
  if auth.uid() = new.professional_id
     and not exists (
       select 1 from public.job_listings jl
        join public.companies c on c.id = jl.company_id
       where jl.id = new.job_listing_id and c.owner_id = auth.uid()
     )
  then
    if new.status is distinct from old.status
       or new.company_notes is distinct from old.company_notes then
      raise exception 'A triagem da vaga é de quem anunciou.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists job_responses_pessoa_so_mexe_no_interesse on public.job_responses;
create trigger job_responses_pessoa_so_mexe_no_interesse
  before update on public.job_responses
  for each row execute function public.job_responses_pessoa_so_mexe_no_interesse();

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema.
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.job_responses'::regclass
           and attname = 'interessado' and not attisdropped) = 1
   and (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'job_responses'
           and policyname = 'Pessoa muda a própria resposta') = 1
   and (select count(*) from pg_trigger
         where tgrelid = 'public.job_responses'::regclass
           and tgname = 'job_responses_pessoa_so_mexe_no_interesse') = 1
  then 'PRONTO — a pessoa pode dizer que tem interesse ou que não tem, e mudar de ideia'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;
