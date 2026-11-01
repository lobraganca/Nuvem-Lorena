-- Banco do site lorenabraganca.com.br — projeto Supabase PRÓPRIO, não o do Ei
-- (ahigenhenzmsjxlmrzhz) nem o do procurô: "tudo dos apps tem que ser separado".
--
-- Quem lê e grava aqui é só o servidor do site (sites/lorenabraganca/api), com a
-- chave de serviço, que fica nas variáveis da Vercel. Por isso as três tabelas têm
-- RLS ligado e NENHUMA regra: a chave pública (anon), que qualquer página do
-- projeto carrega, não lê nem grava nada — nem se alguém a encontrar.

-- Cada diagnóstico feito no site. Nasce sem nome (a pessoa chegou ao resultado)
-- e ganha nome e WhatsApp quando ela toca em "Receber minha análise".
create table if not exists public.diagnosticos (
  id           uuid primary key,                 -- gerado no navegador: as duas etapas caem na mesma linha
  criado_em    timestamptz not null default now(),
  respostas    jsonb not null,                   -- { "Ramo": "Comércio ou loja", ... }
  indice       smallint not null check (indice between 0 and 100),
  nivel        text not null check (char_length(nivel) <= 40),
  nome         text check (char_length(nome) between 1 and 80),
  whatsapp     text check (whatsapp ~ '^55[0-9]{10,11}$'),
  empresa      text check (char_length(empresa) <= 80),
  contato_em   timestamptz,                      -- quando deixou o contato
  contatado_em timestamptz                       -- quando a Lorena marcou "já falei"
);
create index if not exists diagnosticos_criado_em on public.diagnosticos (criado_em desc);

-- Os celulares que recebem o aviso de diagnóstico novo.
create table if not exists public.inscricoes_push (
  endpoint  text primary key,
  inscricao jsonb not null,
  criado_em timestamptz not null default now()
);

-- O par de chaves das notificações. A parte privada nasce no servidor e só sai dali para cá.
create table if not exists public.configuracao (
  chave text primary key,
  valor jsonb not null
);

alter table public.diagnosticos    enable row level security;
alter table public.inscricoes_push enable row level security;
alter table public.configuracao    enable row level security;

-- O Supabase dá acesso de leitura a anon/authenticated em toda tabela nova de public.
-- Aqui ninguém além do servidor entra: tira o acesso deles e garante o da chave de serviço
-- (em projeto com "expor tabelas novas automaticamente" desligado, ela não viria sozinha).
revoke all on public.diagnosticos, public.inscricoes_push, public.configuracao from anon, authenticated;
grant all on public.diagnosticos, public.inscricoes_push, public.configuracao to service_role;

-- Conferência: a resposta é a última linha, em português.
select case
  when (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname in ('diagnosticos', 'inscricoes_push', 'configuracao')
           and c.relrowsecurity) = 3
   and not has_table_privilege('anon', 'public.diagnosticos', 'select')
   and has_table_privilege('service_role', 'public.diagnosticos', 'insert')
  then 'PRONTO — as três tabelas existem, protegidas, e só o servidor do site entra nelas.'
  else 'AINDA FALTA — alguma tabela não foi criada ou ficou aberta. Me mande um print deste resultado.'
end as resultado;
