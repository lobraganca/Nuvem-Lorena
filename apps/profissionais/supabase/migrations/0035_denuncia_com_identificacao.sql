-- Denúncia só de quem está identificado.
--
-- Até aqui qualquer pessoa denunciava sem login, e o raciocínio original era
-- defensável: o golpe pode atingir quem nem conta tem. Na prática, o que essa
-- porta aberta produz é outra coisa — denúncia anônima é a ferramenta mais
-- barata que existe para tirar um concorrente do ar. Custa um clique, não tem
-- dono, e do outro lado tem uma pessoa cujo anúncio é o ganha-pão dela.
--
-- Exigir login não impede a denúncia legítima: quem foi vítima de golpe tem
-- todo o interesse em se identificar, e entrar leva o tempo de um toque no
-- Google. Impede a denúncia gratuita, que é o que se quer impedir.
--
-- Vale também como consequência jurídica: comunicar falsamente crime é o
-- art. 340 do Código Penal, e denunciação caluniosa é o art. 339 — nenhum dos
-- dois significa nada se não houver a quem imputar a comunicação. Sem autor,
-- o aviso na tela é só decoração.
drop policy if exists "qualquer um pode denunciar um anúncio" on public.reports;
-- Também a nova, para esta migration poder rodar duas vezes sem erro (é o
-- que o arquivo único faz quando alguém o cola de novo).
drop policy if exists "quem está logado pode denunciar um anúncio" on public.reports;

create policy "quem está logado pode denunciar um anúncio"
  on public.reports for insert
  to authenticated
  -- `reporter_id` tem que ser quem está de fato pedindo: sem isto daria para
  -- estar logado e gravar a denúncia no nome de outra pessoa, que é pior do
  -- que o anônimo — é o anônimo com um culpado escolhido a dedo.
  with check (reporter_id = auth.uid());
