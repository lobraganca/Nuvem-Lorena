-- ═══════════════════════════════════════════════════════════════════════
-- 0132 — A VITRINE: quem não tem conta vê os candidatos, sem contato
-- ═══════════════════════════════════════════════════════════════════════
--
-- A dona: "ao entrar no site a pessoa tem que ter uma tela bonita pra ver
-- as vagas e os candidatos. Sem ter que fazer login. Se quiser abrir uma
-- vaga ou se candidatar tem que fazer login."
--
-- ── AS VAGAS JÁ ABREM SEM CONTA. OS CANDIDATOS NÃO ────────────────────
--
-- `job_listings` tem a policy "Qualquer um lê vaga ativa" desde a 0067, e
-- `companies_public` está liberada para quem não tem conta desde a 0100.
-- Metade do pedido já funciona no banco — falta só o app parar de exigir
-- login na frente dela.
--
-- A outra metade estava fechada, E POR UM BOM MOTIVO. A 0118 tirou o
-- `anon` da `professionals_public` porque aquela view carrega `phone`,
-- `whatsapp`, `email` e `telefones_extra`. A chave que autoriza o papel
-- `anon` vai dentro do JavaScript do site, à vista de qualquer um: com ela
-- e uma linha de `curl`, a lista de telefones de todos os desempregados da
-- cidade saía em segundos. É o dado mais sensível que este app guarda,
-- sobre as pessoas menos protegidas que ele atende, e é exatamente o
-- insumo do golpe de emprego falso.
--
-- Então NÃO é o caso de reabrir aquela view. Isto aqui é a Parte 2 que a
-- própria 0118 deixou escrita como pendente: uma view separada, sem
-- contato nenhum, para a lista — e a view com contato continua fechada
-- para quem não entrou.
--
-- ── O QUE ESTA VIEW NÃO TEM, E POR QUÊ ────────────────────────────────
--
--   phone, whatsapp, email, telefones_extra   é o vazamento da 0118
--   instagram, linkedin                       leva ao mesmo lugar
--   cep, street, street_number                endereço de pessoa física
--   bio                                       ← ATENÇÃO, ver abaixo
--   pretensao_*                               ninguém precisa disto na
--                                             vitrine, e o que não sai
--                                             não vaza
--
-- A `bio` merece a linha própria: é texto livre que a PESSOA escreve, e
-- gente escreve telefone ali ("me chama no 31 9..."). Uma view sem as
-- colunas de contato mas com a bio continua entregando contato — só que
-- por um caminho que ninguém audita. Fica fora.
--
-- O `neighborhood` entra com a mesma regra da view antiga: só quando a
-- pessoa marcou `mostrar_endereco`. Bairro não é endereço, e numa cidade
-- do tamanho de Itabirito é o que responde "essa pessoa mora perto de
-- mim?" — mas quem não quis mostrar continua não mostrando.
--
-- ── O `where` VAI ESCRITO AQUI, POR EXTENSO ───────────────────────────
--
-- View roda com os direitos de quem a criou e IGNORA o RLS da tabela — é
-- o defeito da 0049, que fez cadastro suspenso voltar a aparecer, e está
-- registrado no CLAUDE.md. As três regras de quem aparece (não suspenso,
-- não pausado, telefone confirmado) são copiadas da `professionals_public`
-- de propósito: repetidas, e não herdadas.

drop view if exists public.professionals_vitrine;
create view public.professionals_vitrine as
select
  id, name, especialidade, city, uf,
  case when mostrar_endereco then neighborhood end as neighborhood,
  entity_type, company_name, photo_url,
  boosted, boosted_until,
  disponivel, atributos, areas_de_interesse,
  disponibilidade, aceita_viajar,
  case when data_nascimento is not null
       then extract(year from age(data_nascimento))::int end as idade,
  cnh, cnh_categorias,
  modo_trabalho, fim_de_semana, inicio_imediato,
  primeiro_emprego, aceita_freela, pcd,
  created_at
from public.professionals
where suspended = false
  and paused = false
  and whatsapp_verified = true;

grant select on public.professionals_vitrine to anon, authenticated;

-- ── E A `professionals_public` CONTINUA FECHADA ────────────────────────
-- Repetido aqui de propósito: se alguém um dia rodar a 0117 de novo (ela
-- termina com um `grant ... to anon`), o `anon` volta a ler telefone sem
-- ninguém perceber. Esta linha é barata e desfaz isso.
revoke select on public.professionals_public from anon;
revoke select on public.profiles_public from anon;

-- ── Confere a si mesma ─────────────────────────────────────────────────
-- Lê `pg_catalog`, nunca `information_schema` — ele filtra por privilégio
-- do papel corrente e o editor do painel não roda como dono; já respondeu
-- "não existe" cinco vezes para uma coluna que estava lá (ver a 0060).
--
-- E confere as TRÊS coisas, não só que a view nasceu: que quem não tem
-- conta lê a vitrine, que continua NÃO lendo a view com telefone, e que a
-- vitrine não tem coluna de contato nenhuma. A terceira é a que pega o
-- erro de digitação que ninguém veria.

select case
  when has_table_privilege('anon', 'public.professionals_vitrine', 'SELECT')
   and not has_table_privilege('anon', 'public.professionals_public', 'SELECT')
   and (
     select count(*) from pg_attribute
      where attrelid = 'public.professionals_vitrine'::regclass
        and not attisdropped and attnum > 0
        and attname in ('phone', 'whatsapp', 'email', 'telefones_extra',
                        'instagram', 'linkedin', 'bio', 'cep', 'street',
                        'street_number')
   ) = 0
  then 'PRONTO — a vitrine abre sem conta, e sem telefone de ninguém.'
  else 'AINDA FALTA — rode o arquivo inteiro, do começo, sem nada selecionado.'
end as resultado;
