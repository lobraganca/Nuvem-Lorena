-- --------------------------------------------------------------------
-- Números reais para a tela de boas-vindas: "já são N profissionais",
-- "N avaliações", "N visitas a anúncios".
--
-- Profissionais e avaliações já dão para contar direto da tela, porque
-- `professionals_public` e `reviews` já são de leitura pública. Visitas
-- não: `profile_views` só é legível pelo dono de cada anúncio (é o dado
-- que alimenta o analytics do Empresa Plus), e está certo que continue
-- assim — o que a tela de boas-vindas precisa não é "quem viu o quê", é
-- só o total somado, sem apontar para nenhum anúncio específico.
--
-- Esta function devolve exatamente isso: um número, sem professional_id,
-- sem data, sem nada que identifique um anúncio. É o mesmo raciocínio já
-- usado em banner_contar_exibicao — contagem agregada não é o mesmo dado
-- que a linha individual, mesmo vindo da mesma tabela.
-- --------------------------------------------------------------------
create or replace function public.contagem_de_visitas()
returns bigint
language sql
security definer set search_path = public
as $$
  select count(*) from public.profile_views;
$$;

grant execute on function public.contagem_de_visitas() to anon, authenticated;
