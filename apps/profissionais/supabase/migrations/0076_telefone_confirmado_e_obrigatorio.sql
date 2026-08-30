-- ═══════════════════════════════════════════════════════════════════════
-- 0076 — Sem telefone confirmado, o cadastro não vai para o ar
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "A confirmação do telefone é item obrigatório no cadastro."
--
-- Já era exigido para ENTRAR NA ONDA (a consulta filtra por
-- `whatsapp_verified`) e para a EMPRESA publicar vaga (0071). Faltava o
-- terceiro lugar, que é o que mais importa: a lista pública. Sem isto, um
-- cadastro com número inventado aparecia na busca, a empresa ligava e caía
-- em número errado — ou em ninguém.
--
-- ── Por que na VIEW, e não numa policy de escrita ─────────────────────
--
-- Barrar a gravação obrigaria a pessoa a confirmar antes de escrever
-- qualquer coisa, e ela ainda nem sabe o que o app faz. Pior: o
-- `confirmar_whatsapp` PRECISA de uma linha existente para conferir se o
-- número do cadastro bate com o número do Auth — barrar a escrita cria um
-- nó em que não dá para confirmar porque não dá para salvar, e não dá para
-- salvar porque não confirmou.
--
-- Na view, a regra é a que a dona quis, sem o nó: dá para preencher e
-- guardar; o cadastro só EXISTE para os outros depois de confirmado. É a
-- mesma forma que `suspended` e `paused` já usam.
--
-- ── Isto ESCONDE cadastros que hoje aparecem ──────────────────────────
--
-- Todo cadastro com `whatsapp_verified = false` some da busca no instante
-- em que esta migration roda. No Ei Itabirito isso é zero — nenhum
-- cadastro foi criado ainda. Dito assim, por escrito, porque uma view que
-- some com linhas é o tipo de mudança que ninguém lembra de ter feito
-- quando alguém reclama que "sumiu da busca".

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
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  areas_de_interesse, disponivel,
  mostrar_endereco, created_at
from public.professionals
-- As três condições, escritas juntas de propósito: a 0049 já perdeu o
-- `where` inteiro numa recriação de view como esta, e cadastros suspensos
-- voltaram a aparecer. View roda com os direitos de quem a criou e não
-- enxerga RLS nenhuma — aqui não há segunda linha de defesa.
where suspended = false
  and paused = false
  and whatsapp_verified = true;

grant select on public.professionals_public to anon, authenticated;

-- ── O aviso de vaga também exige ───────────────────────────────────────
-- A consulta da onda já filtra por `whatsapp_verified` no app. Aqui a
-- regra fica no banco, que é onde ela não depende de ninguém lembrar: um
-- aviso só pode ser gravado para quem confirmou.
create or replace function public.job_notifications_exige_confirmacao()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- `professional_id` aponta para a CONTA (`auth.users`), e não para a
  -- linha de `professionals` — a chave estrangeira da tabela diz isso.
  -- Comparar com `professionals.id` não casaria com ninguém, e a regra
  -- recusaria todo mundo, inclusive quem confirmou. O teste 15 pegou isto
  -- na primeira execução; lendo o código, passava.
  if not exists (
    select 1 from public.professionals
     where owner_id = new.professional_id
       and whatsapp_verified = true
  ) then
    raise exception
      'Só quem confirmou o telefone recebe aviso de vaga.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists job_notifications_exige_confirmacao on public.job_notifications;
create trigger job_notifications_exige_confirmacao
  before insert on public.job_notifications
  for each row execute function public.job_notifications_exige_confirmacao();

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê o pg_catalog, nunca o information_schema. E confere o TEXTO da view,
-- porque é justamente o `where` que já se perdeu uma vez sem ninguém ver.
select case
  when (select pg_get_viewdef('public.professionals_public'::regclass))
         like '%whatsapp_verified = true%'
   and (select pg_get_viewdef('public.professionals_public'::regclass)) like '%paused%'
   and (select pg_get_viewdef('public.professionals_public'::regclass)) like '%suspended%'
   and (select count(*) from pg_trigger
         where tgrelid = 'public.job_notifications'::regclass
           and tgname = 'job_notifications_exige_confirmacao') = 1
  then 'PRONTO — sem telefone confirmado o cadastro não aparece nem recebe vaga'
  else 'AINDA FALTA — confira as partes acima'
  end as resultado;
