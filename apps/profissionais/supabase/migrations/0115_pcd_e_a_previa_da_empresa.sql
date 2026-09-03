-- ═══════════════════════════════════════════════════════════════════════
-- 0115 — PCD, e a prévia da empresa que estava quebrada
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "colocar no cadastro da empresa e do empregado a opção de PCD."
--
-- E, achado ao escrever isto: a tela da vaga pede uma coluna que a view
-- pública da empresa não tem — o que faz o nome e a foto da empresa
-- SUMIREM da tela, em produção, desde 04/09. Ver a Parte 2.

-- ═══════════════════════════════════════════════════════════════════════
-- Parte 1 de 2 — PCD
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── Três colunas, e não uma ───────────────────────────────────────────
--
--   professionals.pcd            "sou PCD"
--   job_listings.vaga_para_pcd   "esta vaga aceita PCD"
--   companies.contrata_pcd       "esta empresa contrata PCD"
--
-- A da vaga é a que faz diferença para quem procura: é ela que vira selo
-- e filtro na lista, porque é a vaga que a pessoa abre. A da empresa é o
-- que a dona pediu com todas as letras ("no cadastro da empresa"), e vale
-- para a empresa que ainda não publicou vaga nenhuma — ela aparece no
-- perfil público.
--
-- ── Por que a informação da pessoa é pública ──────────────────────────
--
-- Ela entra na view que a busca de talentos lê, senão o selo não teria
-- como aparecer para a empresa — e é exatamente para isso que a pessoa
-- marcaria. Quem não quiser declarar simplesmente não marca: o padrão é
-- não, e a tela diz, do lado da chave, que a marcação aparece para as
-- empresas. Declaração de deficiência é da pessoa; o app não deduz, não
-- pede laudo e não mostra tipo nenhum de deficiência.

alter table public.professionals
  add column if not exists pcd boolean not null default false;

alter table public.job_listings
  add column if not exists vaga_para_pcd boolean not null default false;

alter table public.companies
  add column if not exists contrata_pcd boolean not null default false;

-- A view pública dos cadastros, de novo por inteiro (a lista de colunas
-- muda no meio, então é drop + create) e com o `where` escrito à mão —
-- view roda com os direitos de quem a criou e ignora o RLS. Sem ele,
-- cadastro suspenso e pausado voltam a aparecer para todo mundo, que foi
-- o defeito da 0049.
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
  suspended, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, disponivel, atributos,
  areas_de_interesse,
  pretensao_centavos, pretensao_combinar, pretensao_periodo,
  disponibilidade, aceita_viajar,
  case when data_nascimento is not null
       then extract(year from age(data_nascimento))::int end as idade,
  cnh, cnh_categorias, telefones_extra,
  modo_trabalho, fim_de_semana, inicio_imediato,
  primeiro_emprego, aceita_freela, pcd,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- Parte 2 de 2 — A PRÉVIA DA EMPRESA NA TELA DA VAGA
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── O defeito ─────────────────────────────────────────────────────────
--
-- Em 04/09 a tela da vaga passou a mostrar uma prévia do perfil da
-- empresa — a dona: "em cima pode ter um prévia da empresa". A tela pede
-- `description` (a frase que a empresa escreveu sobre si) na view
-- `companies_public`.
--
-- Só que essa coluna nunca entrou na view: ela foi criada na 0100 com
-- seis colunas, e `description` não é uma delas. O PostgREST recusa a
-- consulta INTEIRA quando uma coluna pedida não existe — então não é a
-- frase que some, é a empresa: nome, foto e endereço saem da tela junto,
-- e a vaga aparece com "Empresa" escrito no lugar do nome.
--
-- Não deu erro em teste nenhum porque o Supabase de mentira que roda o
-- app nesta máquina devolve o objeto inteiro e ignora a lista de colunas.
--
-- `contrata_pcd` entra junto pelo mesmo motivo de sempre: coluna que não
-- está na view chega indefinida no app, sem erro para avisar.

drop view if exists public.companies_public;
create view public.companies_public as
  select
    c.id,
    c.company_name,
    c.photo_url,
    c.city,
    c.uf,
    c.neighborhood,
    -- A frase que a empresa escreveu sobre si. Pública de propósito: é o
    -- que responde "que empresa é essa?" para quem lê a vaga numa cidade
    -- pequena, e é a própria empresa quem escreve.
    c.description,
    c.contrata_pcd
  from public.companies c
  -- O `where` da view, que é o que substitui a RLS que ela não tem.
  -- Só aparece a empresa que tem pelo menos UMA vaga no ar. Empresa que
  -- nunca publicou, ou que fechou tudo, não vira diretório de CNPJ.
  where exists (
    select 1 from public.job_listings v
     where v.company_id = c.id
       and v.status = 'active'
  );

grant select on public.companies_public to anon, authenticated;

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema (ver a 0060 no CLAUDE.md).
select case
  when (select count(*) from pg_attribute
         where attrelid = 'public.professionals'::regclass
           and attname = 'pcd' and not attisdropped) = 1
   and (select count(*) from pg_attribute
         where attrelid = 'public.job_listings'::regclass
           and attname = 'vaga_para_pcd' and not attisdropped) = 1
   and (select count(*) from pg_attribute
         where attrelid = 'public.companies'::regclass
           and attname = 'contrata_pcd' and not attisdropped) = 1
   and (select count(*) from pg_attribute
         where attrelid = 'public.professionals_public'::regclass
           and attname = 'pcd' and not attisdropped) = 1
   and (select count(*) from pg_attribute
         where attrelid = 'public.companies_public'::regclass
           and attname in ('description', 'contrata_pcd')
           and not attisdropped) = 2
  then 'PRONTO — PCD no banco, e o nome da empresa volta a aparecer na vaga'
  else 'AINDA FALTA — confira os comandos acima'
  end as resultado;
