# O que uma sessão nova precisa saber

Este arquivo é lido no começo de toda sessão. Ele existe porque as coisas
abaixo já custaram horas — cada item aqui é um erro que aconteceu de
verdade, não uma precaução hipotética.

---

# ⚠️ VOCÊ ESTÁ NA RAMIFICAÇÃO DA PLAY STORE

Se você está lendo isto, a ramificação é a `claude/app-play-store`, e ela
existe para uma coisa só: **transformar o procurô num aplicativo Android
para a Play Store.**

## A regra que não se quebra

**Nada daqui vai para o ar.** O site é publicado pela `duqnk8`, e esta
ramificação nunca é empurrada para lá. Trabalho de app que vazasse para a
`duqnk8` publicaria no site coisas que só fazem sentido dentro do
aplicativo instalado.

| Ramificação | Para quê |
|---|---|
| `claude/professional-search-app-vuryc8` | o app que está no ar — **outra sessão cuida dela** |
| `claude/professional-search-app-duqnk8` | publica o site |
| **`claude/app-play-store`** | **esta — o aplicativo da loja** |

Correção de defeito do app **não se faz aqui**: faz-se na `vuryc8`, e
depois esta ramificação recebe por merge. Consertar dos dois lados cria
duas versões que se afastam — é o erro que este repositório já cometeu com
o mesmo cartão escrito quatro vezes.

## O que já está pronto

- **Capacitor instalado**, com o projeto Android gerado em
  `apps/profissionais/android/`. É a pasta que o Android Studio abre.
- **Identidade do app:** `br.com.procuroapp.app` — o domínio ao contrário.
  **Isto é definitivo depois da primeira publicação**: trocar cria outro
  aplicativo aos olhos da loja, e quem já instalou para de receber
  atualização. Enquanto nada foi enviado, ainda dá para mudar.
- **74 ícones e telas de abertura** gerados do ícone do procurô, sobre o
  navy da marca.
- **Nome na tela do celular:** procurô.

## Duas armadilhas desta ramificação

**1. `npx cap sync` depois de TODA mudança no app.** Os arquivos do
procurô ficam DENTRO do aplicativo, em
`android/app/src/main/assets/public`. Esquecer o sync faz o app da loja
sair com o desenho de dias atrás — e nada, em tela nenhuma, diz isso. É a
mesma família do "check verde sem o site mudar".

```bash
cd /home/user/Nuvem-Lorena/apps/profissionais
npm run build && npx cap sync android
```

**2. Aquela pasta está versionada de propósito**, contra o padrão do
Capacitor (que a ignora por ser saída de build). O motivo: a dona baixa o
ZIP pelo GitHub e abre no Android Studio, **de um tablet, sem terminal e
sem Node**. Ignorada, ela não vem no ZIP e o app abre em branco, sem erro
nenhum explicando por quê. Não volte a ignorá-la sem trocar esse fluxo
antes.

## O que falta, em ordem

**1. Esconder o que não faz sentido no app instalado.** "Instalar App" no
topo, "Adicionar à tela do celular" e "Fechar o app" no Perfil. Hoje eles
se escondem por `display-mode: standalone`, teste que **não funciona
dentro do Capacitor** — o app da loja mostraria "Instalar App" para quem
acabou de instalar pela loja. Detectar com
`window.Capacitor?.isNativePlatform?.()`.

**2. Os pagamentos.** É o item que reprova na revisão. Selo, destaque e
banner são produtos digitais dentro do app, e a Google exige a cobrança
dela. Duas saídas, e a escolha é da dona:
   - o app da loja não vende nada (o profissional assina pelo site) —
     rápido, sem taxa, sem risco;
   - cobrança da Google — cerca de 15% das assinaturas, precisa de
     servidor escutando quem pagou, e é a parte que mais dá errado quando
     apressada.

**3. Tela de "sem internet".** Dentro do Capacitor o app abre (os arquivos
são locais), mas a busca precisa de rede. Sem uma tela própria, a pessoa
vê uma lista vazia sem explicação.

**4. Localização pedida cedo demais.** Na tela de boas-vindas, antes de a
pessoa entender por quê. No Android vira caixa do sistema na primeira
abertura: recusa quase certa e uma estrela a menos.

**5. Ficha da loja:** prints, capa 1024×500, textos, classificação
indicativa e o formulário de Segurança de Dados. A política de
privacidade já está no ar.

## O que a dona precisa fazer, e ninguém faz por ela

- **Conta no Google Play Console** (US$ 25). É o passo mais lento —
  documento e alguns dias de espera.
- **Guardar a chave de assinatura.** Perdida, não existe atualização do
  app: só publicar outro, com outro endereço, e pedir para todos
  instalarem de novo.

## Como ela trabalha

Está descrito no fim deste arquivo, e vale igual aqui: português simples,
sem jargão, e **dizer quando algo não foi verificado**. Do container não
dá para abrir o site nem compilar Android (não há SDK instalado) — quem
compila é o Android Studio na máquina dela, ou um workflow.

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

- Numeração sequencial: a última hoje é a `0060`.
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

### A ordem: SQL primeiro, confirmação dela, e SÓ ENTÃO o código

Isto custou um dia inteiro com gente sem conseguir publicar cadastro, e é
o erro mais caro desta semana.

A 0060 acrescentou a coluna `uf`. O código que a envia foi publicado às
6h40; a coluna só passou a existir por volta das 21h. Nesse intervalo o
app mandava uma coluna que o banco não conhecia, e o PostgREST recusava a
gravação **inteira** — o formulário manda `{...form}` de uma vez, então
uma coluna desconhecida derruba o cadastro todo.

Escrever "sem esta SQL o cadastro não salva" na mensagem não evita nada.
O que evita é a ordem: mandar a SQL, **esperar ela confirmar que aplicou**,
e só então empurrar o código que depende dela. Coluna criada sozinha não
quebra nada — o app antigo simplesmente a ignora.

### `information_schema` mente; use `pg_catalog`

Depois de aplicada a 0060, esta consulta respondeu que a coluna não
existia — cinco vezes, em rodadas diferentes:

```sql
select 1 from information_schema.columns
 where table_schema='public' and table_name='professionals' and column_name='uf';
```

Ela estava lá o tempo todo: um `alter table ... add column uf` devolveu
`42701: column "uf" already exists`, e `pg_attribute` a listava. O motivo
exato não foi apurado (o `information_schema` filtra por privilégio do
papel corrente, e o editor do painel não roda como dono). O que importa é
a regra: **toda conferência mandada para ela lê `pg_catalog`**, nunca o
`information_schema`.

```sql
select count(*) from pg_attribute
 where attrelid = 'public.professionals'::regclass
   and attname = 'uf' and not attisdropped;
```

E toda SQL enviada deve **terminar conferindo a si mesma**, com a resposta
escrita em português ("PRONTO — ..." / "AINDA FALTA — ..."). Ela lê o
resultado do **último** comando: um `notify` no fim devolve "Success. No
rows returned" e engole a resposta da conferência.

### Duas armadilhas do editor SQL do painel

1. **Com texto selecionado, o botão Run executa só a seleção.** Roda,
   responde "Success", e não faz o que se pediu.
2. **Um erro no meio desfaz o bloco inteiro**, inclusive os comandos que
   já tinham passado. Por isso migration longa vai em partes numeradas,
   uma por vez — e o que destrava as pessoas vem na Parte 1.

### São dois projetos Supabase na conta dela

| Projeto | Qual app |
|---|---|
| `dfdinrimxqoqjedemjbw` | **procurô** |
| `wkuwwzcucsxonhsblkmc` | Avena |

O endereço do painel mostra qual está aberto. No projeto errado, uma
conferência de coluna responde "não existe" **sem erro nenhum** — porque
lá a tabela não existe. Vale confirmar o projeto antes de investigar
qualquer coisa.

### Testar SQL antes de mandar para ela

Existe Postgres 16 no container e um arranjo pronto em
`supabase/testes/` (veja o README de lá). Vale sempre: aplicar as 58
migrations num banco descartável e exercitar o comportamento novo. Foi
assim que se descobriu que um conserto de limite de telefone ainda deixava
passar `+55 31 99999-8888`.

`initdb` recusa rodar como root — crie o diretório em `/var/tmp` e use
`su postgres -s /bin/bash -c "..."`.

### Rodar o app aqui, com um Supabase de mentira

Dá para abrir o app no navegador deste container e exercitar a navegação de
verdade, sem credencial nenhuma. Foi assim que se achou que "voltar" apagava
a busca — um defeito que nenhuma leitura de código tinha pegado.

O jeito que funciona é **trocar `src/lib/supabase.ts` pelo cliente falso** e
restaurar depois com `git checkout --`. Aliás: `resolve.alias` do Vite
**não** resolve isso — o alias casa com o texto do import (`../lib/supabase`),
e tentar apontar `/src/lib/supabase` não pega. Duas horas foram embora aí.

O falso precisa implementar, além de `from().select().eq()...`, também
`channel()` (a presença chama, e sem ela a tela inteira cai no
`ErrorBoundary` — o sintoma é o teste "não achar" nem a barra nem o campo de
busca) e `overlaps()`.

**Antes de commitar, confira que `git status` não lista `src/lib/supabase.ts`.**

Para medir alinhamento, vale fotografar o elemento com `deviceScaleFactor: 8`
e calcular o centro da tinta com `pngjs`. Um visto que "parecia torto" estava
0,66px fora do centro — e foi apontado três vezes antes de alguém medir em
vez de olhar.

`playwright` está instalado na raiz do repositório, não em
`apps/profissionais`: o script de teste roda de `/home/user/Nuvem-Lorena`.
Arquivos `*.mjs` na raiz são ignorados pelo git (`.gitignore`), então dá
para deixá-los lá enquanto se trabalha.

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
