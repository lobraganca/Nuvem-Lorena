# procurô — aplicativo

App em React Native (Expo). Roda em Android, iPhone e navegador com o mesmo
código.

> Este é um app **novo**, separado do que já existe em `apps/profissionais/`.
> Outra pasta, outro banco, outra publicação, e **nenhum arquivo em comum**:
> tudo de que ele precisa está dentro desta pasta. Nada aqui lê, escreve ou
> depende do outro app.

## Rodar

```bash
cd apps/procuro
npm install
cp .env.example .env      # e preencha as chaves do Supabase
npm run web               # abre no navegador
npm start                 # abre com QR code para o celular (app Expo Go)
```

### Ver sem banco nenhum

```bash
echo 'EXPO_PUBLIC_DEMO=profissional' > .env
npm run web
```

Com `EXPO_PUBLIC_DEMO` definida, o app usa `src/lib/supabaseFalso.ts` e não
fala com o Supabase. `=1` entra como cliente; `=profissional` entra já
cadastrado, com oportunidades na caixa.

Isso existe para acabar com um hábito perigoso: trocar o `supabase.ts` por
um falso à mão e lembrar de desfazer. Funciona até a vez em que alguém
esquece — e aí o app publicado mostra dados inventados sem erro nenhum.
Não dá para esquecer de desfazer o que não foi feito.

## Abrir no Android Studio

```bash
cd apps/procuro
npm install
npx expo prebuild --platform android   # regera a pasta android/
```

Depois é só abrir a pasta `apps/procuro/android` no Android Studio.

A pasta `android/` está no repositório, mas ela é **gerada**: a fonte da
verdade é o `app.json`. Mudou nome, ícone, permissão ou pacote? Mude no
`app.json` e rode o `prebuild` de novo — editar o `AndroidManifest.xml` à
mão funciona até a próxima geração apagar a edição.

> Este container não tem o SDK do Android, então a pasta foi **gerada e
> conferida, mas nunca compilada aqui**. Quem compila é o Android Studio,
> que traz o próprio SDK.

### As permissões foram limpas para a Play Store

O modelo do React Native traz por padrão permissões que este app não usa, e
elas ficam no manifesto **principal** — o que vai para a loja:

| Permissão | Por que saiu |
|---|---|
| `SYSTEM_ALERT_WINDOW` | desenhar sobre outros apps; é do menu de desenvolvimento, e já existe no manifesto de depuração à parte |
| `READ/WRITE_EXTERNAL_STORAGE` | acesso a arquivos, que o app não faz |
| `VIBRATE` | volta quando os avisos no celular existirem |
| `ACCESS_FINE/COARSE_LOCATION` | o app ainda não pede localização; o raio é escolhido à mão no cadastro |

Sobra `INTERNET`. Permissão perigosa declarada e não usada é o que a
revisão da Play questiona, e "vamos usar depois" não é resposta que passa.
Elas voltam pelo `app.json` junto com o recurso que as justifica.

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
| `0004_entrar_e_confirmar_numero.sql` | perfil automático e a confirmação à prova de forja |
| `0005_busca.sql` | catálogo de ofícios, necessidades e a busca ordenada |
| `0006_avaliacoes_e_denuncias.sql` | avaliações verificadas, reputação e denúncias |

### Só avalia quem teve contato

Avaliação aberta a qualquer um vira duas coisas ao mesmo tempo: arma (o
concorrente derruba a nota do vizinho) e mentira (o dono cria contas e se
elogia). As duas destroem a nota como informação — e uma nota em que
ninguém acredita é pior que nota nenhuma, porque ocupa o lugar dela.

A avaliação exige um pedido em que aquele profissional **aceitou**, e o
vínculo é chave estrangeira, não conferência do app. O custo é real e vale
pagar: quem combinou por fora não consegue avaliar. Preferimos ter menos
avaliações e poder confiar em todas.

### A confirmação do número não pode vir do app

A coluna `telefone_confirmado` decide duas coisas sérias: se o telefone
aparece para quem procura, e se a pessoa entra na fila de disparo. A 0001
deixava o app escrever nela — ou seja, dava para se declarar confirmado sem
nunca ter recebido código.

Policy não resolve isso: policy decide se a **linha** pode ser escrita, não
quais **colunas**. Quem resolve é um gatilho que reescreve a coluna a partir
do `auth.users`, que só o Supabase Auth escreve depois de conferir o código
com o Twilio. O que o app mandar naquele campo é descartado.

A regra que sai daí, e vale para o sistema todo: **dado que dá poder a
alguém nunca vem do cliente** — ele é derivado, no banco, de algo que o
cliente não controla.

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
  -f supabase/testes/00-ambiente.sql

# as migrations, e depois o teste das ondas
for f in supabase/migrations/*.sql; do
  psql -h /var/tmp -p 5434 -U postgres -d procuro -v ON_ERROR_STOP=1 -f "$f"
done
psql -h /var/tmp -p 5434 -U postgres -d procuro -f supabase/testes/01-ondas-de-disparo.sql
psql -h /var/tmp -p 5434 -U postgres -d procuro -f supabase/testes/02-confirmacao-a-prova-de-forja.sql
psql -h /var/tmp -p 5434 -U postgres -d procuro -f supabase/testes/03-busca.sql
psql -h /var/tmp -p 5434 -U postgres -d procuro -f supabase/testes/04-avaliacoes.sql
```

O teste monta cinco eletricistas e um pedido, e confere que a oportunidade
chega em quem deve, na hora que deve. Nenhuma linha pode dizer `FALHOU`.

Ele já pegou dois defeitos que nenhuma leitura tinha encontrado:

1. Função `language sql` é validada **na criação**, então proteger uma
   referência a tabela inexistente com `to_regclass` não funciona — o
   Postgres recusa antes de chegar a rodar.
2. `get diagnostics` só aceita `variável = item`; não dá para somar na
   mesma linha.

## A busca aceita o problema, não só o ofício

Ninguém acorda pensando "preciso de um eletricista". Pensa "o chuveiro
parou". Uma busca que só procura pelo nome do ofício exige que a pessoa já
saiba a resposta para poder fazer a pergunta — e quem não sabe desiste.

A tabela `necessidades` liga expressões do dia a dia aos ofícios que as
resolvem. É tabela e não lista no código porque a dona precisa poder
acrescentar "meu portão travou" no dia em que perceber que alguém procurou
por isso e não achou, sem publicar app.

A expressão MAIS LONGA que casa é a que manda: "chuveiro" leva aos dois
ofícios (não esquenta é eletricista, vaza é encanador); "chuveiro vazando"
põe o encanador na frente.

A ordenação da busca vive no banco, não no app, porque "quem paga aparece
antes" é regra de negócio — espalhada pelas telas ela diverge, e a tela que
esquecer de aplicá-la vira a tela onde o plano pago não vale nada.

| Critério | Por quê |
|---|---|
| 1. Ofício mais certo | Eletricista livre não resolve vazamento |
| 2. Disponível | Quem atende hoje resolve o problema de hoje |
| 3. Destaque do plano | O que a assinatura compra |
| 4. Verificado | Desempate por confiança |
| 5. Sorteio do dia | Senão os mesmos ficam eternamente no topo |

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

**Banco** — fundação, planos com as ondas, pedidos, disparos, bloqueios,
avaliações verificadas, reputação, denúncias, RLS em tudo.

**Quem procura** — entrar por telefone, catálogo de 41 ofícios, busca pelo
problema, perfil do profissional com avaliações, contato por WhatsApp e
ligação conforme o plano, publicar pedido (mostrando quantos vão receber),
acompanhar quem se interessou.

**Quem atende** — cadastro em passos, oportunidades com aceitar e recusar,
disponibilidade em quatro estados, plano e comparação de planos.

**Provado** — 27 conferências no banco (4 arquivos de teste) e 22 passos no
app, percorridos no navegador.

## O que ainda não está

- Avisos no celular (push)
- Chat interno do Premium
- Foto no perfil e verificação de documento
- Painel da administração
- Cobrança das assinaturas (as telas mostram os planos; não há pagamento)
- O agendador que chama `processar_ondas()` de minuto em minuto
