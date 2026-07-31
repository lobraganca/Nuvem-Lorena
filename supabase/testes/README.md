# Testes das regras de acesso

O que este teste responde: **as regras barram mesmo quem deve barrar?**

Vale a pena rodar porque as políticas do Postgres falham de um jeito
traiçoeiro. Uma regra errada raramente dá erro — ela ou deixa passar quem não
devia (e ninguém percebe até vazar), ou barra quem devia passar. Foi o segundo
caso que este teste pegou: a regra do perfil entrava em recursão e, de quebra,
impedia qualquer pessoa de trocar o próprio nome.

## Rodando

Precisa de um Postgres local — não use o banco de produção.

```sh
createdb avena_teste
psql -v ON_ERROR_STOP=1 -d avena_teste -f supabase/testes/00_ambiente_local.sql
psql -v ON_ERROR_STOP=1 -d avena_teste -f supabase/migrations/0001_esquema.sql
psql -v ON_ERROR_STOP=1 -d avena_teste -f supabase/migrations/0002_seguranca.sql
psql -d avena_teste -f supabase/testes/01_dados.sql
psql -d avena_teste -c "grant usage on schema auth to autenticado;
                        grant select on auth.users to autenticado;"
psql -d avena_teste -f supabase/testes/02_verifica.sql
```

O `00_ambiente_local.sql` recria o mínimo que o Supabase já traz de fábrica
(o schema `auth` e a função `auth.uid()`), para o mesmo SQL rodar nos dois
lugares.

## Como ler o resultado

Cada linha traz o que aconteceu e o que deveria acontecer. **As duas colunas
têm de ser iguais.** Se alguma diferir, a regra correspondente em
`0002_seguranca.sql` está errada — e não adianta corrigir no app, porque quem
chamar a API direto não passa pelo app.

Os dezesseis casos cobrem as travas que sustentam promessas feitas na tela:
quem pode virar administradora, quem vê os documentos de uma empresa, quem
consegue se dar o selo de verificado, quem avalia, e quem pode declarar um
pagamento como recebido.
