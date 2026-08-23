# procurô — aplicativo

App em React Native (Expo). Roda em Android, iPhone e navegador com o mesmo
código.

> Este é um app **novo**, separado do que já existe em `apps/profissionais/`.
> Nada aqui toca naquele — outra pasta, outro banco, outra publicação.

## Rodar

```bash
cd apps/procuro
cp .env.example .env      # e preencha as chaves do Supabase
npm install
npm run web               # abre no navegador
npm start                 # abre com QR code para o celular (app Expo Go)
```

## Conferir antes de commitar

```bash
npx tsc --noEmit          # tipos
```

## O banco

As migrations estão em `supabase/migrations/`, numeradas em ordem.
**Nenhum automatismo aplica elas** — o SQL é colado à mão no SQL Editor do
painel do Supabase, uma parte por vez.

A ordem que evita quebrar o app: aplicar a SQL primeiro, confirmar que
aplicou, e **só então** publicar o código que depende dela. Coluna criada
sozinha não quebra nada; código que manda coluna que não existe derruba a
gravação inteira.

| Arquivo | O que faz |
|---|---|
| `0001_fundacao.sql` | cidades, categorias, perfis, profissionais |
| `0002_planos_e_assinaturas.sql` | os três planos e a assinatura vigente |
| `0003_pedidos_e_ondas.sql` | pedidos, disparos e o motor de ondas |

### Testar a SQL antes de mandar

Existe Postgres no container e um teste de comportamento pronto:

```bash
# sobe um Postgres descartável (initdb recusa rodar como root)
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | head -1)
mkdir -p /var/tmp/pgprocuro && chown postgres:postgres /var/tmp/pgprocuro
su postgres -s /bin/bash -c "$PGBIN/initdb -D /var/tmp/pgprocuro -U postgres"
su postgres -s /bin/bash -c "$PGBIN/pg_ctl -D /var/tmp/pgprocuro -o '-k /var/tmp -p 5434' -l /var/tmp/pg.log start"
psql -h /var/tmp -p 5434 -U postgres -c 'create database procuro;'

# ambiente mínimo do Supabase (schema auth, auth.uid(), papéis)
psql -h /var/tmp -p 5434 -U postgres -d procuro \
  -f ../profissionais/supabase/testes/00-ambiente-supabase.sql

# as migrations, e depois o teste das ondas
for f in supabase/migrations/*.sql; do
  psql -h /var/tmp -p 5434 -U postgres -d procuro -v ON_ERROR_STOP=1 -f "$f"
done
psql -h /var/tmp -p 5434 -U postgres -d procuro -f supabase/testes/01-ondas-de-disparo.sql
```

O teste monta cinco eletricistas e um pedido, e confere que a oportunidade
chega em quem deve, na hora que deve. Nenhuma linha pode dizer `FALHOU`.

Ele já pegou dois defeitos que nenhuma leitura tinha encontrado:

1. Função `language sql` é validada **na criação**, então proteger uma
   referência a tabela inexistente com `to_regclass` não funciona — o
   Postgres recusa antes de chegar a rodar.
2. `get diagnostics` só aceita `variável = item`; não dá para somar na
   mesma linha.

## O motor de ondas

Quem publica um pedido não escolhe profissional: o sistema avisa sozinho,
em ondas, na ordem que o plano determina.

| Plano | Onda | Quando recebe |
|---|---|---|
| Premium | 1 | na hora |
| Pro | 2 | 1 hora depois |
| Básico | — | **não recebe** — é plano de consulta |

**A onda e o atraso são colunas da tabela `planos`, não código.** Mudar
"Pro recebe 1h depois" para "20 min depois" é um update pelo painel, sem
publicar nada. Foi a decisão mais importante do desenho: separar o que é
regra de negócio (que muda) do que é mecanismo (que não muda).

Quem chama o motor é um agendador, de minuto em minuto:

```sql
select public.processar_ondas();   -- devolve quantos disparos criou
select public.encerrar_ausencias(); -- faz as férias vencidas voltarem sozinhas
```

O motor aguenta rodar repetido: a chave única `(pedido_id, profissional_id)`
impede a mesma oportunidade de chegar duas vezes na mesma pessoa.

## O que já está de pé

- Banco: fundação, planos, pedidos, disparos, bloqueios, RLS
- Motor de ondas, testado
- Tela de oportunidades, com aceitar e recusar
- Tema da marca (azul, dourado, branco) em `src/tema/`

## O que ainda não está

- Entrar e cadastrar (hoje o app lê `EXPO_PUBLIC_PROFISSIONAL_DEMO`)
- Busca e perfil público
- Publicar pedido (lado de quem procura)
- Avisos no celular
- Chat interno, avaliações, denúncias
- Painel da administração
- Cobrança das assinaturas
