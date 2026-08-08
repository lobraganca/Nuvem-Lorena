# Testes do banco

Rodam contra um Postgres local, sem depender do Supabase. Existem porque o
schema inteiro foi escrito sem nunca ter sido executado — e a primeira
execução real encontrou três defeitos que nenhuma revisão de código pegou:

1. `create or replace view` não consegue inserir coluna no meio da lista (ele
   tenta renomear posicionalmente e recusa). Quebrava a migration 0014.
2. `on conflict (professional_id)` fica ambíguo quando existe um parâmetro de
   função com o mesmo nome — `add_lead_credits` falhava em tempo de execução,
   ou seja, toda compra de créditos.
3. `create or replace function` não troca o **nome** de um parâmetro, só o
   corpo — a correção do item 2 precisava de um `drop function` antes.

## Como rodar

```bash
# sobe um Postgres descartável
initdb -D /var/tmp/pg -U postgres
pg_ctl -D /var/tmp/pg -o '-k /var/tmp -p 5433' -l /var/tmp/pg.log start
psql -h /var/tmp -p 5433 -U postgres -c 'create database busca;'

# ambiente mínimo do Supabase (schema auth, auth.uid(), papéis)
psql -h /var/tmp -p 5433 -U postgres -d busca -f supabase/testes/00-ambiente-supabase.sql

# o schema completo — deve rodar sem nenhum ERROR, inclusive repetido
psql -h /var/tmp -p 5433 -U postgres -d busca -f supabase/banco-completo.sql
psql -h /var/tmp -p 5433 -U postgres -d busca -f supabase/banco-completo.sql

# os testes
psql -h /var/tmp -p 5433 -U postgres -d busca -f supabase/testes/01-gatilhos-e-creditos.sql
psql -h /var/tmp -p 5433 -U postgres -d busca -f supabase/testes/02-seguranca-avaliacoes.sql
```

## O que o 02 verifica

O gatilho que protege as avaliações, campo a campo:

| Cenário | Esperado |
|---|---|
| Dono reescreve a nota que recebeu | **Recusado** |
| Dono responde à avaliação | Permitido, com `replied_at` automático |
| Autor edita a própria nota | Permitido |
| Autor apaga a resposta do profissional | **Recusado** |
| Terceiro tenta mexer | **Recusado** |

Alguns testes **esperam** ver `ERROR` na saída — é o gatilho barrando o que
deve barrar. O que não pode aparecer é erro na execução do schema.
