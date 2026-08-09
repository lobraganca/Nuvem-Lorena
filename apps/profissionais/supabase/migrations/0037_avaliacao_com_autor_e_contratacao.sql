-- Três coisas que faltavam na avaliação, e o endereço opcional no anúncio.
--
-- 1) QUEM AVALIOU. A avaliação aparecia solta: estrelas, etiquetas e texto,
--    sem nome, sem foto e sem data. Opinião sem rosto vale pouco — é o mesmo
--    comentário anônimo que ninguém leva a sério na internet — e ainda deixa
--    o profissional sem saber de quem foi.
--
-- 2) SE CONTRATOU MESMO. Havia `contato_confirmado`, calculado sozinho a
--    partir de quem pediu o contato pelo app. Não cobre quem achou o número
--    aqui e ligou pelo telefone, e o app não tem como saber isso — só a
--    pessoa sabe. Passa a existir a declaração dela: `contratou`.
--
-- 3) MOSTRAR OU NÃO O ENDEREÇO. Endereço é dado sensível para quem trabalha
--    em casa — e boa parte de quem anuncia aqui é manicure, confeiteira,
--    costureira, gente que atende na própria sala. O campo era preenchido
--    para o CEP achar a cidade e o bairro, e o endereço inteiro ia parar no
--    anúncio sem ninguém ter escolhido isso.

-- ── 2) "Confirmo que contratei" ───────────────────────────────────────────
--
-- Declaração da pessoa, não dedução do sistema. Fica separada de
-- `contato_confirmado` de propósito: uma é o que o app viu acontecer, a
-- outra é o que a pessoa afirma. Quando as duas batem, a avaliação é o mais
-- forte que este app consegue oferecer.
alter table public.reviews
  add column if not exists contratou boolean not null default false;

comment on column public.reviews.contratou is
  'Declarado por quem avaliou: contratou de fato o serviço. Diferente de contato_confirmado, que é observado pelo app.';

-- ── 3) Endereço só se a pessoa quiser ─────────────────────────────────────
--
-- Padrão `false`: quem já preencheu o endereço para o CEP completar a cidade
-- nunca disse que queria a rua e o número no anúncio, e assumir que sim é
-- decidir por ela sobre onde ela mora. Quem tem ponto fixo e quer ser
-- achado liga a chave — e aí é escolha, não descuido.
alter table public.professionals
  add column if not exists mostrar_endereco boolean not null default false;

-- A view pública não pode *entregar* o endereço de quem não marcou a caixa.
-- Esconder na tela não esconde na API, e é a API que qualquer um consulta:
-- se a coluna sair daqui preenchida, basta abrir o endereço do banco no
-- navegador para ler a rua e o número de todo mundo.
--
-- Bairro continua saindo sempre: ele situa a região sem dizer onde é a
-- porta, que é a diferença entre "atende no Centro" e "moro na rua tal, 10".
-- O CEP entra no mesmo balde da rua — CEP de rua, em cidade pequena, é
-- endereço.
drop view if exists public.professionals_public;
create view public.professionals_public as
select
  id, owner_id, name, category, categories, city, bio, phone,
  whatsapp, email, instagram, linkedin,
  case when mostrar_endereco then cep end as cep,
  case when mostrar_endereco then street end as street,
  case when mostrar_endereco then street_number end as street_number,
  neighborhood,
  entity_type, company_name, photo_url, responsible_name,
  verified, verified_until, verified_since, boosted, boosted_until,
  suspended, suspended_reason, contact_mode,
  plus_active, plus_until, whatsapp_verified, paused, atributos,
  mostrar_endereco, created_at
from public.professionals
where suspended = false and paused = false;

grant select on public.professionals_public to anon, authenticated;

-- ── 1) Avaliação com autor ────────────────────────────────────────────────
--
-- View em vez de join no cliente: sem ela o app precisaria de uma consulta a
-- mais por avaliação, e a página de um profissional bem avaliado faria trinta
-- idas ao banco para montar uma lista.
--
-- Junta com `profiles_public`, não com `profiles`. A tabela só é legível
-- pelo próprio dono desde a migration 0012 (é o que impede o CPF de vazar),
-- então um join direto devolveria nome nulo para todo mundo menos você — a
-- avaliação dos outros continuaria anônima, que é exatamente o defeito que
-- esta migration existe para corrigir.
--
-- Sem `security_invoker`: a view roda como dona e é isso que faz o nome
-- público chegar a quem lê. O que ela expõe já é público por definição —
-- avaliação (policy de leitura pública) e nome/foto (profiles_public).
drop view if exists public.reviews_public;
create view public.reviews_public as
select
  r.id, r.professional_id, r.user_id, r.rating, r.tags, r.comment,
  r.contato_confirmado, r.contratou, r.reply, r.replied_at, r.created_at,
  p.full_name as autor_nome,
  p.avatar_url as autor_foto
from public.reviews r
left join public.profiles_public p on p.id = r.user_id;

grant select on public.reviews_public to anon, authenticated;
