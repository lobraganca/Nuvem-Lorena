-- ═══════════════════════════════════════════════════════════════════════
-- SÓ CONTA. NÃO APAGA NADA.
-- ═══════════════════════════════════════════════════════════════════════
-- Cole no SQL Editor do Supabase (projeto dfdinrimxqoqjedemjbw) e rode.
-- O resultado diz o que existe hoje no banco, para a limpeza ser decidida
-- olhando número, e não no escuro.
--
-- Rode ISTO antes de qualquer coisa que apague. Apagar não tem desfazer.

select 'CONTAS DE LOGIN (auth.users)'        as o_que, count(*)::text as quantos from auth.users
union all select '  ├ das quais são ADMIN',        count(*)::text from public.admins
union all select '  └ com perfil preenchido',      count(*)::text from public.profiles

union all select '', ''
union all select 'CADASTROS PROFISSIONAIS',        count(*)::text from public.professionals
union all select '  ├ no ar (não pausados)',       count(*)::text from public.professionals where coalesce(paused,false) = false
union all select '  ├ com experiência escrita',    count(*)::text from public.professional_experiences
union all select '  ├ com curso escrito',          count(*)::text from public.professional_courses
union all select '  └ com avaliação recebida',     count(*)::text from public.reviews

union all select '', ''
union all select 'EMPRESAS',                       count(*)::text from public.companies
union all select '  ├ vagas publicadas',           count(*)::text from public.job_listings
union all select '  ├ avisos de vaga enviados',    count(*)::text from public.job_notifications
union all select '  └ respostas a vaga',           count(*)::text from public.job_responses

union all select '', ''
union all select 'COISAS DO PROCURÔ',              ''
union all select '  ├ pedidos de contato',         count(*)::text from public.contact_requests
union all select '  ├ contatos registrados',       count(*)::text from public.contatos_registrados
union all select '  ├ favoritos',                  count(*)::text from public.favorites
union all select '  ├ assinaturas',                count(*)::text from public.subscriptions
union all select '  ├ créditos de lead',           count(*)::text from public.lead_credits
union all select '  ├ banners',                    count(*)::text from public.banners
union all select '  └ patrocínio de categoria',    count(*)::text from public.category_sponsorships

union all select '', ''
union all select 'O MAIS ANTIGO E O MAIS NOVO',    ''
union all select '  ├ cadastro mais antigo',       coalesce(to_char(min(created_at),'DD/MM/YYYY'),'—') from public.professionals
union all select '  └ cadastro mais novo',         coalesce(to_char(max(created_at),'DD/MM/YYYY'),'—') from public.professionals;
