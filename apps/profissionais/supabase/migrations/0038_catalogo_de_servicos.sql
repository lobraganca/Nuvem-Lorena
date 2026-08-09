-- Catálogo de serviços do anúncio.
--
-- Até aqui o anúncio dizia o ofício ("Eletricista") e um texto livre. Serve
-- para o autônomo; não serve para quem vende uma lista de coisas com preços
-- diferentes — o hotel com três tipos de diária, o laboratório com trinta
-- exames, a loja com ajuste de roupa e customização. Essas pessoas hoje
-- precisariam escrever tudo na descrição, onde ninguém compara nada e nada
-- pode ser filtrado.
--
-- É tabela, e não um campo de texto ou um jsonb, por causa do que vem depois:
-- buscar por "exame de sangue" e achar o laboratório, ordenar por preço,
-- mostrar "a partir de R$ X" no cartão. Nada disso se faz dentro de um
-- parágrafo, e migrar texto livre para tabela depois é bem mais caro do que
-- começar assim.
create table if not exists public.servicos_oferecidos (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  nome text not null,
  descricao text not null default '',
  /**
   * Em centavos, e anulável de propósito.
   *
   * Centavos porque preço em ponto flutuante erra centavo, e centavo errado
   * numa tela de preço é reclamação garantida. Anulável porque boa parte
   * dos serviços daqui não tem preço de tabela — pintura de parede depende
   * da parede —, e obrigar um número faria a pessoa inventar um, que é pior
   * que não ter: número inventado vira discussão na hora de cobrar.
   */
  preco_centavos integer check (preco_centavos is null or preco_centavos >= 0),
  /** "por hora", "a diária", "por peça" — o que o preço mede. */
  unidade text not null default '',
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
