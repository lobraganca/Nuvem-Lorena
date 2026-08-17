-- --------------------------------------------------------------------
-- Cidade passa a ter estado, porque o procurô vai para o Brasil inteiro.
--
-- Até aqui o app atendia quatro cidades, todas em Minas, e `city` sozinho
-- bastava. Nacionalmente ele deixa de bastar — e o modo como deixa é
-- silencioso, que é o que torna isto urgente.
--
-- Existem 5.570 municípios no Brasil e centenas de nomes repetidos. Há
-- "Bom Jesus" em mais de vinte estados; há "Santa Maria", "Bela Vista",
-- "Boa Vista", "Santa Luzia" espalhadas pelo país. Sem o estado, o
-- eletricista de Bom Jesus/PI e o de Bom Jesus/RS caem na mesma busca, e
-- quem procura recebe o telefone de alguém a dois mil quilômetros. Não dá
-- erro em lugar nenhum: a lista vem, com gente dentro.
--
-- Esta é a razão de a coluna entrar AGORA e não quando doer. Depois de
-- existirem cadastros de várias cidades sem estado, não há como descobrir
-- de qual "Bom Jesus" cada um é — só perguntando a cada pessoa, uma por
-- uma.
--
-- O `default 'MG'` preenche os cadastros que já existem (as quatro cidades
-- atendidas até hoje são todas mineiras) e sai logo em seguida: com o app
-- aberto ao país, um estado presumido é exatamente o erro que esta
-- migration existe para impedir. Sem default e com `not null`, um cadastro
-- que chegue sem estado é recusado na hora, em vez de entrar como mineiro.
-- --------------------------------------------------------------------

alter table public.professionals
  add column if not exists uf text not null default 'MG';

alter table public.professionals
  alter column uf drop default;

-- Só as 27 siglas existentes, em maiúsculas. Um "mg" minúsculo ou um "MGG"
-- digitado errado viram uma cidade paralela que ninguém encontra.
alter table public.professionals
  drop constraint if exists professionals_uf_valida;
alter table public.professionals
  add constraint professionals_uf_valida check (uf in (
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
    'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
  ));

-- A busca filtra por cidade e estado juntos; o índice acompanha o par.
create index if not exists professionals_cidade_estado_idx
  on public.professionals (uf, city);

-- --------------------------------------------------------------------
-- A view pública precisa devolver a coluna nova.
--
-- ATENÇÃO ao recriar esta view: o `where` no fim é obrigatório e já foi
-- perdido uma vez. View no Postgres roda com os privilégios de quem a
-- criou, então ela passa por cima da RLS da tabela — o filtro de suspenso
-- e pausado precisa estar escrito aqui dentro. A 0049 recriou a view
-- copiando as colunas e deixando o `where` para trás, e durante semanas
-- cadastro suspenso pela administração continuou aparecendo na busca,
-- junto com a anotação interna que motivou a suspensão.
-- --------------------------------------------------------------------
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, especialidade, city, uf, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  case when mostrar_endereco then neighborhood end as neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

comment on column public.professionals.uf is
  'Sigla do estado, sempre em maiúsculas. Vem junto com a cidade — separá-las faz "Bom Jesus" de estados diferentes virarem a mesma busca.';
