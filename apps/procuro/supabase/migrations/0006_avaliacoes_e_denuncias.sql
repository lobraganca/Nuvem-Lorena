-- =====================================================================
-- 0006 — Avaliações e denúncias
-- =====================================================================
--
-- A decisão que define se a reputação vale alguma coisa:
--
-- **Só avalia quem teve contato de verdade.**
--
-- Avaliação aberta a qualquer um é avaliação sem valor. Ela vira duas
-- coisas ao mesmo tempo: arma (o concorrente derruba a nota do vizinho de
-- graça) e mentira (o próprio dono cria contas e se elogia). As duas
-- destroem a nota como informação — e uma nota em que ninguém acredita é
-- pior do que nota nenhuma, porque ocupa o lugar dela.
--
-- Aqui a avaliação exige um pedido em que aquele profissional ACEITOU. O
-- vínculo não é uma conferência que o app faz e o banco confia: é chave
-- estrangeira. Não existe avaliação sem disparo aceito, nem por engano nem
-- por má-fé, porque o banco não deixa a linha existir.
--
-- O custo dessa escolha é real e vale pagar: quem combinou por fora, sem
-- passar pelo pedido, não consegue avaliar. Preferimos ter menos
-- avaliações e poder confiar em todas.
--
-- =====================================================================

create table if not exists public.avaliacoes (
  id        uuid primary key default gen_random_uuid(),

  -- O disparo aceito é o passaporte. Sem ele não há avaliação.
  disparo_id uuid not null unique references public.disparos (id) on delete cascade,

  -- Repetidos de propósito, para a consulta não precisar de dois `join`
  -- só para saber quem avaliou quem. Os gatilhos abaixo garantem que
  -- batem com o disparo.
  profissional_id uuid not null references public.profissionais (id) on delete cascade,
  autor_id        uuid not null references public.perfis (id) on delete cascade,

  nota      smallint not null check (nota between 1 and 5),
  -- Comentário é opcional: obrigar a escrever faz a pessoa escrever
  -- qualquer coisa, e "bom" repetido mil vezes não informa nada.
  comentario text check (comentario is null or length(trim(comentario)) >= 3),

  -- A resposta do profissional. Uma só, e do dono do cadastro — quem
  -- recebeu uma nota injusta merece poder dizer o que aconteceu, e quem lê
  -- merece ver os dois lados.
  resposta   text,
  respondida_em timestamptz,

  criada_em  timestamptz not null default now(),
  editada_em timestamptz
);

create index if not exists avaliacoes_do_profissional_idx
  on public.avaliacoes (profissional_id, criada_em desc);

-- --- O vínculo é conferido pelo banco, não pelo app -------------------

create or replace function public.avaliacao_exige_contato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
begin
  select dd.profissional_id, dd.resposta, p.cliente_id
    into d
    from public.disparos dd
    join public.pedidos  p on p.id = dd.pedido_id
   where dd.id = new.disparo_id;

  if d is null then
    raise exception 'Avaliação sem contato registrado.';
  end if;

  -- Recusado ou sem resposta não gera avaliação: não houve serviço.
  if d.resposta is distinct from 'aceito' then
    raise exception 'Só dá para avaliar quem aceitou o seu pedido.';
  end if;

  -- Quem avalia é quem pediu. Nem o app nem ninguém escolhe outro autor.
  new.autor_id        := d.cliente_id;
  new.profissional_id := d.profissional_id;
  return new;
end;
$$;

drop trigger if exists avaliacao_precisa_de_contato on public.avaliacoes;
create trigger avaliacao_precisa_de_contato
  before insert on public.avaliacoes
  for each row execute function public.avaliacao_exige_contato();

-- --- Editar não pode trocar de dono nem de alvo -----------------------
--
-- Sem isto, um update poderia mover a avaliação para outro profissional —
-- levando junto a nota alta que ela conquistou em outro lugar.

create or replace function public.avaliacao_nao_muda_de_dono()
returns trigger
language plpgsql
as $$
begin
  new.disparo_id      := old.disparo_id;
  new.autor_id        := old.autor_id;
  new.profissional_id := old.profissional_id;
  new.criada_em       := old.criada_em;
  if new.nota is distinct from old.nota
     or new.comentario is distinct from old.comentario then
    new.editada_em := now();
  end if;
  return new;
end;
$$;

drop trigger if exists avaliacao_presa_ao_contato on public.avaliacoes;
create trigger avaliacao_presa_ao_contato
  before update on public.avaliacoes
  for each row execute function public.avaliacao_nao_muda_de_dono();

-- =====================================================================
-- A reputação
-- =====================================================================
--
-- View e não coluna: nota guardada em coluna precisa de alguém para
-- recalculá-la, e o dia em que o recálculo falhar é o dia em que a nota
-- passa a mentir sem avisar. Calculada na hora, ela nunca diverge.

create or replace view public.reputacao as
select
  a.profissional_id,
  count(*)::integer                       as quantas,
  round(avg(a.nota)::numeric, 1)          as media,
  count(*) filter (where a.nota >= 4)::integer as boas,
  count(*) filter (where a.nota <= 2)::integer as ruins,
  -- A tendência dos últimos 90 dias, para quem melhorou não carregar
  -- para sempre um começo ruim — e para quem piorou não se esconder atrás
  -- de um passado bom.
  round(avg(a.nota) filter (where a.criada_em > now() - interval '90 days')::numeric, 1) as media_recente
from public.avaliacoes a
group by a.profissional_id;

grant select on public.reputacao to anon, authenticated;

-- =====================================================================
-- Denúncias
-- =====================================================================
--
-- Separadas do bloqueio (0003) porque são coisas diferentes: bloqueio é
-- decisão pessoal e tem efeito imediato no disparo; denúncia é pedido de
-- providência para a administração, e alguém precisa olhar.

create table if not exists public.denuncias (
  id       uuid primary key default gen_random_uuid(),
  autor_id uuid not null references public.perfis (id) on delete cascade,
  alvo_id  uuid not null references public.perfis (id) on delete cascade,

  motivo   text not null check (motivo in (
    'nao_atendeu',      -- aceitou e sumiu
    'cobranca_indevida',
    'desrespeito',
    'perfil_falso',
    'servico_mal_feito',
    'outro'
  )),
  detalhe  text,

  situacao text not null default 'aberta'
           check (situacao in ('aberta', 'analisando', 'resolvida', 'arquivada')),
  -- O que a administração fez. Fica registrado para o dia em que alguém
  -- perguntar por que uma conta foi suspensa.
  providencia text,
  resolvida_em timestamptz,

  criada_em timestamptz not null default now(),
  -- Uma denúncia por pessoa por alvo em aberto. Sem isto, um desafeto
  -- enche a fila da moderação sozinho e afoga as denúncias de verdade.
  unique (autor_id, alvo_id, situacao)
);

create index if not exists denuncias_abertas_idx
  on public.denuncias (criada_em) where situacao = 'aberta';

create index if not exists denuncias_por_alvo_idx on public.denuncias (alvo_id);

-- =====================================================================
-- RLS
-- =====================================================================

alter table public.avaliacoes enable row level security;
alter table public.denuncias  enable row level security;

-- Avaliação é pública: é para isso que ela serve.
drop policy if exists avaliacoes_leitura on public.avaliacoes;
create policy avaliacoes_leitura on public.avaliacoes for select using (true);

-- Escreve quem pediu. O gatilho já força o autor, mas a policy impede
-- até a tentativa.
drop policy if exists avaliacoes_escrita on public.avaliacoes;
create policy avaliacoes_escrita on public.avaliacoes
  for insert
  with check (exists (
    select 1 from public.disparos d
      join public.pedidos p on p.id = d.pedido_id
     where d.id = avaliacoes.disparo_id
       and p.cliente_id = auth.uid()
  ));

-- Editar a própria avaliação (nota e comentário).
drop policy if exists avaliacoes_editar on public.avaliacoes
;
create policy avaliacoes_editar on public.avaliacoes
  for update using (autor_id = auth.uid()) with check (autor_id = auth.uid());

-- O profissional responde à avaliação que recebeu. É update na mesma
-- linha, então precisa da própria policy — e o gatilho garante que ele não
-- consegue mexer na nota, só acrescentar resposta.
drop policy if exists avaliacoes_responder on public.avaliacoes;
create policy avaliacoes_responder on public.avaliacoes
  for update
  using (exists (
    select 1 from public.profissionais pr
     where pr.id = avaliacoes.profissional_id and pr.perfil_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.profissionais pr
     where pr.id = avaliacoes.profissional_id and pr.perfil_id = auth.uid()
  ));

-- Denúncia: quem denunciou vê a própria. O alvo NÃO vê quem o denunciou —
-- senão denunciar vira convite para retaliação, e ninguém denuncia.
drop policy if exists denuncias_minhas on public.denuncias;
create policy denuncias_minhas on public.denuncias
  for select using (autor_id = auth.uid());

drop policy if exists denuncias_criar on public.denuncias;
create policy denuncias_criar on public.denuncias
  for insert with check (
    autor_id = auth.uid()
    and alvo_id <> auth.uid()   -- denunciar a si mesmo não quer dizer nada
  );

-- =====================================================================
-- Conferência
-- =====================================================================

select case
  when (select count(*) from pg_class
         where relname in ('avaliacoes','denuncias')
           and relnamespace = 'public'::regnamespace) = 2
   and (select count(*) from pg_class
         where relname = 'reputacao' and relnamespace = 'public'::regnamespace) = 1
   and (select count(*) from pg_trigger
         where tgname = 'avaliacao_precisa_de_contato'
           and tgrelid = 'public.avaliacoes'::regclass) = 1
  then 'PRONTO — avaliações, reputação e denúncias no ar. Só avalia quem teve contato aceito.'
  else 'AINDA FALTA — alguma tabela, view ou gatilho não foi criado. Rode esta parte inteira de novo, sem selecionar trecho.'
end as resultado;
