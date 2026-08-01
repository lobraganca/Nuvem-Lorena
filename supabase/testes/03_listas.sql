-- As listas do app cabem nas travas do banco?
--
-- Este teste existe por causa de um erro real. O app oferecia "Temporada" como
-- tipo de empresa e a trava do banco listava só outros cinco. Quem cadastrou
-- uma casa de temporada teve a gravação recusada em silêncio: a empresa
-- aparecia na tela, porque a tela mostra o que está na memória, e no banco não
-- havia nada. Sumia ao trocar de aparelho, e nenhuma viajante a encontraria.
--
-- Uma opção a mais no app nunca dá erro de compilação, nunca aparece em revisão
-- de código e nunca quebra um teste de tela. Só quebra a gravação de quem
-- escolheu justamente aquela opção.
--
-- Ao acrescentar uma opção em src/types.ts, acrescente aqui também. As duas
-- colunas de cada linha têm de ser iguais.

\set ON_ERROR_STOP on

create or replace function pg_temp.confere(
  rotulo text, tabela text, coluna text, valores text[]
) returns table(caso text, r text, esperado text) language plpgsql as $$
declare
  regra text;
  v text;
  ruins text[] := '{}';
begin
  select pg_get_constraintdef(c.oid) into regra
  from pg_constraint c
  where c.conrelid = ('public.' || tabela)::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%' || coluna || '%'
    and pg_get_constraintdef(c.oid) like '%ANY%';

  if regra is null then
    return query select rotulo, 'SEM TRAVA NO BANCO', 'TODOS ACEITOS';
    return;
  end if;

  foreach v in array valores loop
    if position(quote_literal(v) in regra) = 0 then
      ruins := ruins || v;
    end if;
  end loop;

  return query select rotulo,
    case when cardinality(ruins) = 0 then 'TODOS ACEITOS'
         else 'FALTAM: ' || array_to_string(ruins, ', ') end,
    'TODOS ACEITOS';
end $$;

select * from pg_temp.confere('tipos de empresa', 'businesses', 'type',
  array['Agência', 'Guia', 'Experiência', 'Temporada', 'Restaurante', 'Hotel']);

select * from pg_temp.confere('planos', 'businesses', 'plan_tier',
  array['Básico', 'Pro', 'Avançado']);

select * from pg_temp.confere('situação da empresa', 'businesses', 'status',
  array['ativa', 'suspensa']);

select * from pg_temp.confere('reivindicação', 'businesses', 'claim_status',
  array['reivindicada', 'nao-reivindicada']);

select * from pg_temp.confere('situação da reserva', 'bookings', 'status',
  array['aguardando-pagamento', 'confirmada', 'expirada', 'cancelada']);

select * from pg_temp.confere('cobrança da reserva', 'bookings', 'pricing_unit',
  array['pessoa', 'diaria']);

select * from pg_temp.confere('cancelamento', 'tours', 'cancellation_policy',
  array['flexivel', 'moderada', 'rigida']);

select * from pg_temp.confere('dificuldade', 'tours', 'difficulty',
  array['Leve', 'Moderada', 'Pesada']);

select * from pg_temp.confere('cobrança do passeio', 'tours', 'pricing_unit',
  array['pessoa', 'diaria']);

select * from pg_temp.confere('lugar do anúncio', 'boosts', 'placement',
  array['cidade', 'inicio']);
