-- Aluguel de temporada é um tipo de empresa, e o banco não sabia disso.
--
-- O app oferece seis tipos: Agência, Guia, Experiência, Temporada, Restaurante
-- e Hotel. A trava criada em 0001 listava cinco — "Temporada" ficou de fora.
--
-- A consequência apareceu no primeiro uso real: quem cadastrou uma casa de
-- temporada teve a gravação recusada pelo Postgres, e não ficou sabendo. A
-- empresa aparecia na tela porque a tela mostra o que está na memória, mas no
-- banco não existia nada — some ao trocar de aparelho, e nenhuma viajante
-- jamais a encontraria na busca.
--
-- É o pior tipo de falha: silenciosa e do lado de quem confiou.

alter table public.businesses drop constraint if exists businesses_type_check;

alter table public.businesses
  add constraint businesses_type_check
  check (type in ('Agência', 'Guia', 'Experiência', 'Temporada', 'Restaurante', 'Hotel'));
