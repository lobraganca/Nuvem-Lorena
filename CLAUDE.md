# O que uma sessão nova precisa saber

Este arquivo é lido no começo de toda sessão. Ele existe porque as coisas
abaixo já custaram horas — cada item aqui é um erro que aconteceu de
verdade, não uma precaução hipotética.

---

## São dois apps neste repositório

| Onde | Qual | Site |
|---|---|---|
| **raiz** (`src/`, `supabase/`) | Avena — turismo, reservas, passeios | outro |
| **`apps/profissionais/`** | **procurô** — busca de profissionais em Itabirito, MG | procuroapp.com.br |

**Quase todo o trabalho é no `apps/profissionais/`.** A raiz tem outro app,
com outro banco, outras migrations e outra dona da decisão.

Duas armadilhas que já pegaram, as duas pelo mesmo motivo — comando rodado
da pasta errada:

- `supabase/migrations/*.sql` na raiz é do **Avena**. Aplicá-las num banco
  do procurô cria tabelas de reserva de passeio por cima do schema certo.
- `npm run build` na raiz constrói o Avena.

Comece toda sequência de comandos com o caminho explícito:
`cd /home/user/Nuvem-Lorena/apps/profissionais`. O `cd` não sobrevive entre
chamadas de ferramenta.

---

## Branches

| Branch | Para quê |
|---|---|
| `claude/professional-search-app-vuryc8` | onde o trabalho é feito |
| `claude/professional-search-app-duqnk8` | **é ela que publica** — o workflow só escuta esta |
| branch padrão do repositório | é do Avena, não do procurô |

O fluxo é: commitar na `vuryc8`, empurrar as duas.

```bash
git push -u origin claude/professional-search-app-vuryc8
git push origin claude/professional-search-app-vuryc8:claude/professional-search-app-duqnk8
```

Nunca empurrar para outra branch sem a dona pedir.

---

## Publicação — e por que "check verde" não bastava

O workflow `.github/workflows/publicar-busca-itabirito.yml` dispara em push
na `duqnk8` que toque `apps/profissionais/**`, e chama um Deploy Hook da
Vercel (`secrets.VERCEL_DEPLOY_HOOK`).

**Durante um dia inteiro o check ficou verde sem o site mudar.** Chamar o
gatilho só prova que a Vercel *recebeu* o pedido: as builds estavam indo
para **Preview**, e a **Production** continuava num commit antigo. Nada na
tela do GitHub nem na da Vercel apontava a diferença — as duas diziam
sucesso.

Por isso o `vite.config.ts` publica um `versao.json` com o commit, e o
workflow tem um segundo passo que fica batendo em
`procuroapp.com.br/versao.json` até o site devolver aquele commit exato.
**Hoje verde quer dizer no ar.** Se esse passo falhar, ele imprime o
caminho: Vercel > Deployments > "Promote to Production", e
Settings > Git > Production Branch para não repetir.

Do container da sessão **não dá para abrir o site** — a política de rede
bloqueia o domínio (`403` no CONNECT do proxy). Quem confere é o workflow.
Não conclua que o deploy falhou por causa desse bloqueio.

Outros workflows: `verificar-app.yml` (tipos + build a cada push),
`publicar-functions.yml` (Edge Functions, disparado ao salvar
`PUBLICAR-FUNCTIONS.txt`), `rotina-diaria.yml` (avisos de vencimento).

---

## Supabase

**As migrations não são aplicadas por nenhum automatismo.** Nenhum
workflow, nenhum CLI. A dona cola o SQL à mão no SQL Editor do painel.
Então: escrever o arquivo em `supabase/migrations/`, **e mandar o SQL no
chat para ela colar**. Um arquivo commitado não é uma migration aplicada —
e o app novo pode depender dela.

- Numeração sequencial: a última hoje é a `0058`.
- `supabase/banco-completo.sql` **está desatualizado** (para na 0051). Serve
  para montar um banco do zero até ali, não como retrato do que está no ar.
- Edge Functions ficam em `supabase/functions/` e sobem pelo workflow.
- O bucket `professional-photos` é criado à mão no painel (migration não
  cria bucket).
- Confirmação de número por SMS usa Twilio Verify, configurado no Auth.

### Três pegadinhas do Postgres/Supabase que já geraram bug em produção

1. **View ignora RLS.** Uma view roda com os direitos de quem a criou. Toda
   view pública precisa do próprio `where` escrito no arquivo — a 0049
   tirou o `where` da `professionals_public` e cadastros suspensos voltaram
   a aparecer; a `profiles_public` entregava a lista de todas as contas.
2. **`upsert` do PostgREST é `insert ... on conflict`**, então quem manda
   passa pela policy de **INSERT** mesmo editando linha que já existe. Foi
   o que impedia a administração de salvar cadastro de outra pessoa. Para
   editar linha existente, use `update`.
3. **Erro do Supabase não é um `Error`** — é objeto solto com `message` e
   `code`. `err instanceof Error ? err.message : "..."` cai sempre no texto
   genérico. Use `mensagemDeErro(err, "...")` de `src/lib/erros.ts`. Esse
   padrão escondeu por semanas o fato de que ninguém conseguia avaliar.

E a regra que sai dos três: **função de dados que falha nunca deve devolver
lista vazia.** "Nenhum resultado" é uma mentira calma — a tela parece
normal e o defeito não aparece em lugar nenhum.

### Testar SQL antes de mandar para ela

Existe Postgres 16 no container e um arranjo pronto em
`supabase/testes/` (veja o README de lá). Vale sempre: aplicar as 58
migrations num banco descartável e exercitar o comportamento novo. Foi
assim que se descobriu que um conserto de limite de telefone ainda deixava
passar `+55 31 99999-8888`.

`initdb` recusa rodar como root — crie o diretório em `/var/tmp` e use
`su postgres -s /bin/bash -c "..."`.

---

## Comandos

```bash
cd /home/user/Nuvem-Lorena/apps/profissionais
npx tsc --noEmit     # tipos
npm run build        # montagem (é o que o CI roda)
```

Não há `npm run lint` nem testes de tela. O que existe de teste é o de
banco, em `supabase/testes/`.

---

## Como a dona trabalha

Lorena usa celular ou tablet, escreve em português, manda print e pede
curto. O que ela espera de volta:

- **Português**, sem jargão. "A policy do RLS barrou o insert" não diz
  nada; "o banco não deixou salvar porque esta conta não tem permissão"
  diz.
- **O SQL colado no chat** quando houver migration — ela não abre o
  repositório para copiar arquivo.
- **Dizer quando algo não foi verificado.** Ela já foi informada doze vezes
  num dia que estava "no ar" quando não estava. Se a prova não existe,
  diga que não existe.

O código do app é comentado em português, explicando *por que* cada decisão
existe — muitos comentários citam o defeito que a motivou. Ao mexer, mantenha
esse padrão: o comentário que sobrevive é o que conta a história, não o que
descreve a linha.
