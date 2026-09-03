# O que uma sessão nova precisa saber

Este arquivo é lido no começo de toda sessão. Ele existe porque as coisas
abaixo já custaram horas — cada item aqui é um erro que aconteceu de
verdade, não uma precaução hipotética.

---

## São dois apps neste repositório

| Onde | Qual | Site |
|---|---|---|
| **raiz** (`src/`, `supabase/`) | Avena — turismo, reservas, passeios | outro |
| **`apps/profissionais/`** | **Ei Itabirito** — busca de profissionais em Itabirito, MG | www.empregoitabirito.com.br |

**Quase todo o trabalho é no `apps/profissionais/`.** A raiz tem outro app,
com outro banco, outras migrations e outra dona da decisão.

Duas armadilhas que já pegaram, as duas pelo mesmo motivo — comando rodado
da pasta errada:

- `supabase/migrations/*.sql` na raiz é do **Avena**. Aplicá-las num banco
  do Ei Itabirito cria tabelas de reserva de passeio por cima do schema certo.
- `npm run build` na raiz constrói o Avena.

Comece toda sequência de comandos com o caminho explícito:
`cd /home/user/Nuvem-Lorena/apps/profissionais`. O `cd` não sobrevive entre
chamadas de ferramenta.

**E isso vale em dobro para `cp`, `rm` e `git checkout`: use caminho
absoluto sempre.** Um `cp src/lib/supabase.ts ...` rodado da raiz já
destruiu o cliente falso do Ei Itabirito, substituindo-o pelo do Avena — e
passou na conferência de tipos e no build, porque nenhum dos dois olha
`scripts/`. Só apareceu horas depois, ao usar o arquivo. Comando relativo
neste repositório acerta o app errado sem dar erro.

---

## Branches

| Branch | Para quê |
|---|---|
| `claude/professional-search-app-vuryc8` | onde o trabalho é feito |
| `claude/professional-search-app-duqnk8` | **é ela que publica** — o workflow só escuta esta |
| branch padrão do repositório | é do Avena, não do Ei Itabirito |

O fluxo é: commitar na `vuryc8`, empurrar as duas.

```bash
git push -u origin claude/professional-search-app-vuryc8
git push origin claude/professional-search-app-vuryc8:claude/professional-search-app-duqnk8
```

Nunca empurrar para outra branch sem a dona pedir.

### CONFIRA EM QUE BRANCH VOCÊ ESTÁ, NA PRIMEIRA MENSAGEM

Uma sessão inteira foi trabalhada numa branch que não publica —
`claude/local-hiring-mvp-swacej` — e ninguém percebeu por 27 commits.

O sintoma não parece um problema de branch. A dona olhava o site, via o
app ANTIGO, e dizia "está muito parecido com o procurô", "as cores estão
horríveis", "está muito quebrado". Tudo verdade: era o procurô. As
respostas foram redesenhos sucessivos — três paletas, dois sistemas de
design inteiros — todos julgados contra um site que nunca recebeu
nenhum deles.

O que teria evitado, em dez segundos, na primeira mensagem:

```bash
git fetch origin claude/professional-search-app-duqnk8
git merge-base --is-ancestor HEAD origin/claude/professional-search-app-duqnk8 \
  && echo "publica" || echo "NÃO PUBLICA — nada do que eu fizer vai aparecer"
```

E, quando a dona reclamar da aparência ou do funcionamento do site, a
primeira pergunta não é "o que mudo?" — é **"o que está no ar é o meu
código?"**. Foto de tela do ambiente local não responde isso; ela mostra
o que ainda não existe para ninguém.

A `claude/app-play-store` existiu e está **aposentada** — o app da loja
saiu da mesma base de código (ver a seção do aplicativo, abaixo). Ela ficou
4 commits atrás em um único dia; branch velha de app é pior que nenhuma,
porque ela publica.

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
`www.empregoitabirito.com.br/versao.json` até o site devolver aquele commit exato.
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

**Toda SQL mandada no chat vai com o link do SQL Editor junto** — ela
pediu isso com todas as letras (03/09). O link abre a folha em branco já no
projeto certo, e sem ele a dona tem de achar o projeto no meio da lista,
que é onde nasce o erro de aplicar no banco do Avena:

```
https://supabase.com/dashboard/project/ahigenhenzmsjxlmrzhz/sql/new
```

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

**Quarta pegadinha, da mesma família: o teto de linhas.** A 0062 pôs
`pgrst.db_max_rows = 200` para ninguém baixar a base de contatos de uma
vez — e o teto vale para TODA consulta, inclusive as do painel
administrativo, que carregavam a tabela e contavam no navegador. O total
recebido pararia no ducentésimo pagamento e nunca mais subiria, sem nada
avisando. Consulta que CONTA usa `lerTudo()` (`src/lib/lerTudo.ts`), que lê
em páginas e fica imune a qualquer teto.

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

### O app aguenta o intervalo entre o código e a SQL (04/09)

A ordem acima continua sendo a certa. Só que ela depende de alguém
lembrar, todas as vezes — e o preço de esquecer uma vez é o app parado.

Desde 04/09 existe `src/lib/colunasNovas.ts`: a gravação (ou a leitura) é
tentada com as colunas novas e, se o banco responder "não conheço essa
coluna" (42703 ou PGRST204), é refeita SEM elas, escrevendo no console
qual faltou. O cadastro salva, a vaga publica, a lista carrega — só o
campo novo não vale nada até a SQL ser aplicada, que é o mesmo que
aconteceria com o app de ontem.

Quem acrescenta coluna nova acrescenta o nome dela na lista de "novas" do
lugar que a usa (`meuPerfil.ts`, `company.ts`, `bancoDeVagas.ts`,
`compativeis.ts`). Sem isso, o defeito da `uf` volta.

E o Supabase de mentira do navegador passou a saber recusar coluna que
não existe, nos dois sentidos — ligado por `falso-colunas-estrito`, ver
`supabase/testes/README.md`. Foi o que provou que a tolerância funciona, e
é o que teria pego o `description` sumindo da tela da vaga.

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
| `ahigenhenzmsjxlmrzhz` | **Ei Emprego** — confirmado pela dona em 04/09 |
| `dfdinrimxqoqjedemjbw` | um projeto ANTIGO do mesmo app. Um link para ele em 03/09 fez a SQL responder `relation "public.companies" does not exist` — as tabelas não estão lá. Não use. |
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

## O aplicativo da Play Store

O Ei Itabirito é **um app instalável de verdade**, não um site aberto numa
janelinha — e a distinção decide entre aprovado e rejeitado. Os arquivos
ficam DENTRO do aparelho (`android/app/src/main/assets/public`), copiados
por `npx cap sync`. Nenhum endereço é aberto.

**Uma base de código só.** A branch `claude/app-play-store` existiu e está
aposentada: em um dia ela já estava 4 commits atrás e publicaria uma versão
sem as correções. O que muda entre site e app é decidido em tempo de
execução por `src/lib/plataforma.ts`.

### `podeVender()` — e por que a loja não vende nada

Regra da Google: bem digital usado dentro do app se vende pela cobrança
dela. O Ei Itabirito vende pelo Mercado Pago, o que continua certo no site.
Dentro do app da loja **as telas que vendem não existem** — que é o estado
mais conforme possível, porque quem não oferece compra não tem o que
violar.

O que fica de propósito: **"Suas assinaturas" com o botão de cancelar**
(esconder cancelamento é infração do CDC — seria trocar uma regra de loja
por uma de lei), o desempenho do cadastro, e a explicação do selo sem
preço.

**E em lugar nenhum aparece "assine no site".** Convidar a pagar fora é a
mesma violação que vender. Esconder pode; apontar o caminho não.

Ao mexer em qualquer tela com preço, **varra as rotas nos dois modos** —
foi assim que se achou um "a partir de R$ 10,90/mês" escondido no TÍTULO
de uma seção, que sobreviveu a esconder a vitrine inteira.

### Entrar no app é pelo telefone, não pelo Google

O Google recusa fazer login dentro da tela do próprio app (regra dele,
contra tela falsa), então abre no navegador do celular. Voltar de lá exige
uma ponte — endereço próprio do app registrado no Android e autorizado no
Google Cloud e no Supabase. **Essa ponte não existe.** Quem tocasse no
botão entraria no Google e ficaria no navegador, com o app ainda pedindo
login.

Por isso `googleServeAqui()` esconde o botão no app — **mas só se houver
outra porta**. Sem o login por telefone ligado, o Google fica: um caminho
ruim é melhor que nenhum, e o botão quebrado ao menos denuncia o problema.

Duas armadilhas do login por SMS, as duas descobertas em produção:

1. **Pedir um código novo invalida o anterior.** Quem pedia duas vezes e
   digitava o primeiro via "código incorreto" com o código certo na mão.
   Daí os 60 segundos de espera entre pedidos.
2. **A conferência pode falhar DEPOIS de a sessão existir.** O log mostrou
   `/otp` → `/verify` → login → um segundo `/verify` com aviso. O app agora
   pergunta se há sessão antes de acreditar no erro — sem isso, quem
   entrou lia "código incorreto" e desistia, já logado.

E o óbvio que faltava: **quem entra tem que sair da tela de login.** No
Google a troca de tela é efeito da viagem ao navegador; por telefone,
termina ali mesmo e ninguém movia a tela.

### Os seis segredos do GitHub

Em Settings > Secrets and variables > Actions:

| Segredo | Para quê |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | a chave de assinatura, em texto |
| `ANDROID_KEYSTORE_PASSWORD` | a senha dela |
| `ANDROID_KEY_ALIAS` | `eiitabirito` |
| `ANDROID_KEY_PASSWORD` | a mesma senha |
| `VITE_SUPABASE_URL` | endereço do banco |
| `VITE_SUPABASE_ANON_KEY` | chave pública do banco |

Os dois últimos entraram depois de um app ser montado, assinado, instalado
— e abrir dizendo "sem conexão com o banco". Eles moram na Vercel, que o
GitHub não conhece. O workflow agora **recusa montar sem eles** e ainda
confere se o endereço chegou aos arquivos gerados: são coisas diferentes, e
um erro de digitação no nome passaria pela primeira conferência.

**A chave de assinatura é para sempre.** Perdê-la = nunca mais atualizar o
app publicado. Ela não está no repositório; a cópia é da dona.

### O workflow

`.github/workflows/gerar-app-play-store.yml`, disparado à mão em Actions.
Devolve dois pacotes: `ei-itabirito-celular-…` (o `.apk`, que instala no
aparelho) e `ei-itabirito-loja-…` (o `.aab`, que **não** instala e só serve para
o Play Console).

Detalhes que custaram execução perdida:
- **Node 22**, não 20 — o Capacitor 8 recusa abaixo disso. O build passa em
  qualquer versão e só o `cap sync` quebra, então o log parece bom até o
  fim.
- O `versionCode` vem do número da execução. Fixo, a loja recusaria o
  segundo envio.

### Identidade do app: `br.com.eiitabirito.app`

Nos três lugares (capacitor.config.ts, namespace e applicationId).
**Definitiva** — publicada, não muda nunca: trocá-la cria outro app, com
outro endereço, sem os usuários do primeiro.

### O service worker é desligado no app

Ele guarda cópias dos arquivos para o site abrir rápido. Dentro do app
isso se inverte: a pessoa atualiza pela loja e ele continua entregando os
arquivos velhos — app novo instalado, tela velha, sem nada explicando.

### Teste fechado: 12 pessoas, 14 dias

Conta pessoal criada depois de 13/11/2023 — o caso dela. **Convidado não
conta, só quem instalou e não desinstalou.** Por isso se convida 15 ou 16.
É calendário puro: nada acelera.

As capturas de tela da loja **têm que sair do app real, com profissionais
de verdade** — captura com dado inventado é motivo de reprovação, e não há
como gerá-las aqui.


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
