-- --------------------------------------------------------------------
-- Onde o banner aparece.
--
-- Até aqui só existia um lugar para vender: a faixa de publicidade na
-- busca. Esta coluna abre um segundo — cartões dentro da lista "Tem gente
-- boa aqui do lado" da tela de boas-vindas —, sem duplicar tabela nem
-- política. É o mesmo inventário, o mesmo cadastro no admin, só um filtro
-- a mais.
--
-- 'busca' continua sendo o padrão: todo banner cadastrado antes desta
-- migração já era da busca, e não pode virar outra coisa sozinho.
-- --------------------------------------------------------------------
alter table public.banners
  add column if not exists local text not null default 'busca'
    check (local in ('busca', 'boas_vindas'));

create index if not exists banners_local_idx on public.banners (local, ativo, inicio, fim);
