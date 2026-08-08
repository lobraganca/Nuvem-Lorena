-- Permite que empresas (pessoa jurídica) anunciem, além de profissionais
-- autônomos (pessoa física), no mesmo cadastro/busca. `document` guarda o
-- CPF ou CNPJ do anunciante — dado diferente do CPF de avaliação, que fica
-- em profiles.cpf. `company_name` é a razão social/nome fantasia, só
-- relevante quando entity_type = 'pj'.

alter table public.professionals
  add column if not exists entity_type text not null default 'pf' check (entity_type in ('pf', 'pj'));

alter table public.professionals
  add column if not exists document text;

alter table public.professionals
  add column if not exists company_name text;
