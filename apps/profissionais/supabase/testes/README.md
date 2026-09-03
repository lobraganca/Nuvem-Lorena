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

## O modo estrito de colunas (no navegador)

O Supabase de mentira (`scripts/teste-navegador/supabase-falso.ts`) sempre
ignorou a lista de colunas do `select()` e devolveu o objeto inteiro. Isso
escondeu um defeito que estava em produção: a tela da vaga pedia
`description` na view `companies_public`, que não tem essa coluna — e o
PostgREST recusa a consulta INTEIRA quando falta uma coluna pedida, então
o nome e a foto da empresa sumiam da tela para todo mundo. Aqui tudo
aparecia bonitinho.

Agora o falso sabe conferir, e a conferência vale para os dois lados:

- **leitura** — coluna pedida no `select()` que não existe na linha;
- **gravação** — chave mandada no `insert`/`update` que não existe na
  tabela. É o caso da coluna `uf` (0060), que derrubou o cadastro da
  cidade por catorze horas.

Ela é **opcional**, e o motivo importa: os dados de mentira não têm todas
as colunas do banco de verdade, então ligada por padrão ela acusaria falta
onde não há. Use como pista, não como veredito — e, ao achar um alarme
falso, acrescente a coluna aos dados do falso (foi assim que `email`,
`primeiro_emprego` e `aceita_freela` entraram lá).

```js
// no navegador, antes de abrir o app
localStorage.setItem("falso-colunas-estrito", "1");
// ou ?colunas=estrito na URL; ?colunas=solto desliga
```

O falso também anota as gravações em `globalThis.__falsoGravacoes`
(`[{tabela, chaves}]`), que é como um teste sabe se a tela salvou de
verdade — procurar a mensagem na tela falha quando ela some sozinha antes
da foto.

Do outro lado, o app tolera o intervalo entre o código e a SQL: ver
`src/lib/colunasNovas.ts`.
