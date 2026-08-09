-- Catálogo de serviços do anúncio.
--
-- Até aqui o anúncio dizia o ofício ("Eletricista") e um texto livre. Serve
-- para o autônomo; não serve para quem oferece uma lista de coisas
-- diferentes — o hotel com hospedagem, salão de eventos e day use; o
-- laboratório com trinta exames; a loja com ajuste e customização. Essas
-- pessoas hoje precisariam escrever tudo na descrição, onde ninguém acha
-- nada e nada pode ser filtrado.
--
-- É tabela, e não um campo de texto ou um jsonb, por causa do que vem depois:
-- buscar por "exame de sangue" e achar o laboratório. Isso não se faz dentro
-- de um parágrafo, e migrar texto livre para tabela depois é bem mais caro
-- do que começar assim.
--
-- Sem preço, de propósito. O app direciona: mostra quem faz o quê e entrega
-- o contato. Preço na tela envelhece sozinho — a tabela muda e o anúncio
-- fica prometendo o valor do ano passado —, vira reclamação contra a
-- plataforma quando o cobrado é outro, e empurra todo mundo para a briga de
-- quem cobra menos, que é o oposto do que uma boa avaliação constrói.

-- Se este arquivo já foi rodado numa versão que tinha preço, as colunas
-- saem aqui — rodar de novo é seguro.
alter table if exists public.servicos_oferecidos
  drop column if exists preco_centavos;
alter table if exists public.servicos_oferecidos
  drop column if exists unidade;

create table if not exists public.servicos_oferecidos (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  nome text not null,
  descricao text not null default '',
  /** Ordem escolhida pelo dono; empate desempata pela data. */
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists servicos_oferecidos_anuncio_idx
  on public.servicos_oferecidos (professional_id, ordem);

alter table public.servicos_oferecidos enable row level security;

-- Leitura pública: é catálogo, existe para ser visto.
drop policy if exists "catalogo é público para leitura" on public.servicos_oferecidos;
create policy "catalogo é público para leitura"
  on public.servicos_oferecidos for select
  using (true);

-- Escrita só do dono do anúncio, conferida no banco. A tela esconder o botão
-- não impede ninguém de chamar a API com o id de um anúncio alheio.
drop policy if exists "dono edita o catálogo do próprio anúncio" on public.servicos_oferecidos;
create policy "dono edita o catálogo do próprio anúncio"
  on public.servicos_oferecidos for all
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.owner_id = auth.uid()
    )
  );

-- Teto por anúncio. Sem ele, um catálogo de mil linhas transforma a página
-- do anúncio numa rolagem infinita e a busca numa consulta cara — e ninguém
-- lê mil linhas de preço.
create or replace function public.limita_catalogo()
returns trigger
language plpgsql
as $$
declare
  quantos integer;
begin
  select count(*) into quantos
    from public.servicos_oferecidos
   where professional_id = new.professional_id;
  if quantos >= 40 then
    raise exception 'Cada anúncio pode ter até 40 serviços no catálogo.';
  end if;
  return new;
end;
$$;

drop trigger if exists limita_catalogo_trigger on public.servicos_oferecidos;
create trigger limita_catalogo_trigger
  before insert on public.servicos_oferecidos
  for each row execute function public.limita_catalogo();

-- Nome vazio vira linha invisível no catálogo, que a pessoa não entende por
-- que está lá e não consegue apagar sem adivinhar.
alter table public.servicos_oferecidos
  drop constraint if exists servicos_oferecidos_nome_nao_vazio;
alter table public.servicos_oferecidos
  add constraint servicos_oferecidos_nome_nao_vazio
  check (length(btrim(nome)) between 2 and 80);
