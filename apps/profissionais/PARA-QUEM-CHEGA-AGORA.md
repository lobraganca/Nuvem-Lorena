# Ei Itabirito — tudo que você precisa saber para assumir o app

Este arquivo é para quem está entrando no projeto agora. Ele conta o estado
real do app, o que está pronto, o que não está, e os erros que já custaram
horas — para não custarem de novo.

A dona do produto é a **Lorena** (lobraganca no GitHub). Ela decide tudo:
funcionalidade, texto, cor, preço. Escreva em português com ela, sem jargão.

---

## 1. O que o app é

**Ei Itabirito** — busca de trabalho e contratação em **Itabirito, MG**.

São dois lados:

- **Quem procura trabalho** cria um perfil (ofícios, experiência, cidade).
  Pode ser **público** (aparece na busca das empresas) ou **oculto** (não
  aparece, mas continua recebendo oportunidades pelos disparos).
- **Quem contrata** cadastra a empresa, publica uma vaga e **dispara uma
  onda**: um aviso vai para os perfis compatíveis. Cada pessoa responde
  "tenho interesse" ou "não é para mim", e a empresa vê a lista de
  interessados no painel dela.

O "disparo por onda" é o coração do produto. Não é um mural de vagas onde
a pessoa procura — é a vaga que vai atrás da pessoa certa.

---

## 2. ATENÇÃO: são dois apps neste repositório

| Onde | Qual app | Site |
|---|---|---|
| **raiz** (`src/`, `supabase/`) | **Avena** — turismo, reservas, passeios | outro |
| **`apps/profissionais/`** | **Ei Itabirito** | www.empregoitabirito.com.br |

**Todo o seu trabalho é em `apps/profissionais/`.**

Isto já deu errado várias vezes, sempre pelo mesmo motivo: comando rodado
da pasta errada.

- `supabase/migrations/*.sql` **na raiz** é do Avena. Aplicar essas no banco
  do Ei Itabirito cria tabelas de reserva de passeio por cima do schema certo.
- `npm run build` na raiz constrói o Avena.
- Um `cp src/lib/supabase.ts ...` rodado da raiz já destruiu um arquivo do
  Ei Itabirito — e passou na conferência de tipos e no build, porque nenhum
  dos dois olha aquela pasta. Só apareceu horas depois.

**Use caminho absoluto sempre**, principalmente em `cp`, `rm` e
`git checkout`:

```bash
cd /caminho/para/Nuvem-Lorena/apps/profissionais
```

---

## 3. Como rodar na sua máquina

```bash
git clone https://github.com/lobraganca/Nuvem-Lorena.git
cd Nuvem-Lorena/apps/profissionais
npm install
```

Crie um arquivo `.env` **dentro de `apps/profissionais/`**:

```
VITE_SUPABASE_URL=https://dfdinrimxqoqjedemjbw.supabase.co
VITE_SUPABASE_ANON_KEY=<peça a chave anon à Lorena>
```

A chave `anon` é pública de propósito (o app inteiro roda com ela no
navegador). A que **nunca** pode sair do painel é a `service_role`.

Depois:

```bash
npm run dev        # abre o app
npx tsc --noEmit   # conferência de tipos
npm run build      # é o que o CI roda
```

Não existe `npm run lint` nem teste de tela. O que existe de teste é o de
banco, em `supabase/testes/` (leia o README de lá).

### Rodar sem credencial nenhuma

Dá para exercitar a navegação de verdade trocando `src/lib/supabase.ts`
por um cliente falso, e restaurando depois com `git checkout --`.

O falso precisa implementar, além de `from().select().eq()...`, também
`channel()` (a presença chama, e sem isso a tela inteira cai no
`ErrorBoundary`) e `overlaps()`.

**Antes de commitar, confira que `git status` não lista
`src/lib/supabase.ts`.** Já foi commitado sem querer.

Aviso: quase todo "bug" encontrado nesse modo é defeito do cliente falso,
não do app. Confirme no app de verdade antes de consertar qualquer coisa.

---

## 4. Branches — e onde cada uma publica

| Branch | Para quê |
|---|---|
| `claude/professional-search-app-duqnk8` | **é ela que publica o Ei Itabirito** |
| `procuro-producao` | **NÃO TOCAR** — publica o site do procurô, outro produto |
| branch padrão do repositório | é do Avena |

O que publica é a `duqnk8`. Empurrar nela publica o site em minutos.

**Combine quem empurra antes de empurrar.** Em 31/08 duas sessões do
Claude empurraram para a `duqnk8` em menos de uma hora. Deu certo só
porque mexeram em arquivos diferentes — o único conflito foi o nome do
app no workflow da Play Store. Se as duas tocarem no mesmo arquivo, uma
sobrescreve a outra sem aviso, e o site vai ao ar com metade do
trabalho.

**A `procuro-producao` está congelada** no commit `d96e017`. Ela serve o
`procuroapp.com.br`, que é outro produto da Lorena. Qualquer commit nela
republica aquele site. Não commite nada ali.

### Confira em que branch você está, na PRIMEIRA mensagem

Uma sessão inteira foi trabalhada numa branch que não publicava — 27
commits — e ninguém percebeu. A dona olhava o site, via o app antigo, e
pedia redesenhos; cada redesenho era julgado contra um site que nunca
recebeu nenhum deles.

```bash
git fetch origin claude/professional-search-app-duqnk8
git merge-base --is-ancestor HEAD origin/claude/professional-search-app-duqnk8 \
  && echo "publica" || echo "NÃO PUBLICA"
```

E quando a Lorena reclamar da aparência ou do funcionamento do site, a
primeira pergunta não é "o que mudo?" — é **"o que está no ar é o meu
código?"**. Foto de tela do seu ambiente local não responde isso.

---

## 5. Publicação (Vercel)

São **dois projetos separados** na conta da Vercel dela, e a separação é
recente — foi feita depois de uma publicação do Ei tirar o procurô do ar:

| Projeto Vercel | Branch que ele publica | Domínios |
|---|---|---|
| `ei-itabirito` | `claude/professional-search-app-duqnk8` | empregoitabirito.com.br, www.empregoitabirito.com.br, ei-itabirito.vercel.app |
| `nuvem-lorena-4uiw` | `procuro-producao` (congelada) | procuroapp.com.br, buscaitabirito.com.br |

A Vercel está ligada ao GitHub: **empurrar na `duqnk8` publica sozinho.**

**Antes de publicar, confira quais domínios o projeto serve.** Foi
exatamente isso que não foi conferido, e o resultado foi o procurô fora do
ar por horas.

### "Check verde" não quer dizer "no ar"

Durante um dia inteiro o workflow de publicação ficou verde sem o site
mudar: as builds iam para **Preview** e a **Production** continuava num
commit antigo. Nada no GitHub nem na Vercel apontava a diferença.

Por isso o `vite.config.ts` publica um `versao.json` com o commit, e o
workflow confere se o site devolve aquele commit exato.

### E "no ar" ainda não quer dizer que ela vai VER

Esta é a segunda causa de "não mudou nada", e ela sobrevive ao check
verde. Aconteceu em 31/08: o log do workflow mostrava o site trocando de
commit no meio da execução — `606cf8f` → `b5b8141` — e a resposta foi
"não vi alteração nenhuma no site".

O app é uma PWA. O *service worker* guarda cópias dos arquivos para a
próxima visita abrir rápido, e continua entregando as antigas depois de
uma publicação. Do lado de quem olha, publicar e não publicar são
idênticos.

O tratamento está em `src/lib/atualizacao.ts`, e o cabeçalho dele conta a
história inteira — vale ler antes de mexer. Em resumo, a versão nova
entra sozinha quando não há nada em jogo na tela (nada digitado, nenhuma
folha aberta, ninguém no meio do cadastro), e só avisa quando há.

Até 31/08 essa troca automática só valia na transição "segundo plano →
voltou". Quem abre o SITE numa aba nunca passa por ela: a aba nasce
visível. Agora a primeira carga também troca.

**Quando ela disser que não mudou nada, o roteiro é este, nesta ordem:**

1. o workflow ficou verde? Se não, é publicação — veja acima.
2. ficou verde? Então peça **Conta > Forçar atualização** (fim da tela de
   Conta). Ele apaga os caches e busca do servidor.
3. continua? Pergunte o endereço EXATO que ela abriu. O workflow confere
   `www.empregoitabirito.com.br`.

E a armadilha do conserto: uma correção no próprio `atualizacao.ts` só
começa a valer da atualização SEGUINTE — ela mora justamente na versão
que o aparelho ainda não recebeu.

---

## 6. Banco de dados (Supabase)

São **dois projetos Supabase** na conta dela:

| Projeto | Qual app |
|---|---|
| `dfdinrimxqoqjedemjbw` | **Ei Itabirito** (aparece como "Busca Itabirito") |
| `wkuwwzcucsxonhsblkmc` | Avena |

No projeto errado, uma conferência de coluna responde "não existe" **sem
erro nenhum** — porque lá a tabela não existe. Confirme o projeto antes de
investigar qualquer coisa.

### As migrations NÃO são aplicadas por nenhum automatismo

Nenhum workflow, nenhum CLI. **A Lorena cola o SQL à mão no SQL Editor do
painel.** Então o fluxo é:

1. escrever o arquivo em `supabase/migrations/` (numeração sequencial — a
   última hoje é a `0080`);
2. **mandar o SQL no chat, colado, para ela copiar.** Ela não abre o
   repositório para pegar arquivo. Isso foi pedido muitas vezes;
3. **esperar ela confirmar que aplicou** — e só ENTÃO empurrar o código
   que depende daquela SQL.

O passo 3 não é zelo. A migration 0060 acrescentou a coluna `uf`; o código
que a envia foi publicado às 6h40 e a coluna só existiu às 21h. Nesse
intervalo o PostgREST recusava a gravação **inteira** — o formulário manda
`{...form}` de uma vez, e uma coluna desconhecida derruba o cadastro todo.
Um dia inteiro com gente sem conseguir se cadastrar.

Coluna criada sozinha não quebra nada: o app antigo simplesmente a ignora.
Então a ordem segura é sempre SQL primeiro.

### Escrevendo SQL para ela

- **Migration longa vai em partes numeradas**, uma por vez, e o que
  destrava as pessoas vem na Parte 1. Motivo: no editor do painel, **um
  erro no meio desfaz o bloco inteiro**, inclusive o que já tinha passado.
- **Com texto selecionado, o botão Run executa só a seleção** — roda,
  responde "Success", e não faz o que se pediu. Avise para clicar uma vez
  fora e só então rodar.
- Toda SQL deve **terminar conferindo a si mesma**, com a resposta escrita
  em português ("PRONTO — ..." / "AINDA FALTA — ..."). Ela lê o resultado
  do **último** comando.
- **Conferência lê `pg_catalog`, nunca `information_schema`.** O
  `information_schema` respondeu "a coluna não existe" cinco vezes para uma
  coluna que estava lá (ele filtra por privilégio do papel corrente).

```sql
select count(*) from pg_attribute
 where attrelid = 'public.professionals'::regclass
   and attname = 'uf' and not attisdropped;
```

- Escreva tudo idempotente (`if not exists`, `drop policy if exists` antes
  de `create policy`) — ela recola a mesma SQL com frequência.

### Quatro pegadinhas que já geraram bug em produção

1. **View ignora RLS.** Uma view roda com os direitos de quem a criou. Toda
   view pública precisa do próprio `where` escrito no arquivo. A 0049 tirou
   o `where` da `professionals_public` e cadastros suspensos voltaram a
   aparecer; a `profiles_public` entregava a lista de todas as contas.
2. **`upsert` do PostgREST é `insert ... on conflict`** — quem manda passa
   pela policy de **INSERT** mesmo editando linha existente. Para editar
   linha que já existe, use `update`.
3. **Erro do Supabase não é um `Error`** — é objeto solto com `message` e
   `code`. `err instanceof Error ? err.message : "..."` cai sempre no texto
   genérico. Use `mensagemDeErro(err, "...")` de `src/lib/erros.ts`. Esse
   padrão escondeu por semanas o fato de que ninguém conseguia avaliar.
4. **Teto de linhas.** A 0062 pôs `pgrst.db_max_rows = 200`, e o teto vale
   para TODA consulta — inclusive as do painel administrativo, que
   carregavam a tabela e contavam no navegador. O total pararia no
   ducentésimo e nunca mais subiria, sem nada avisando. Consulta que CONTA
   usa `lerTudo()` (`src/lib/lerTudo.ts`), que lê em páginas.

E a regra que sai das quatro: **função de dados que falha nunca deve
devolver lista vazia.** "Nenhum resultado" é uma mentira calma — a tela
parece normal e o defeito não aparece em lugar nenhum.

### Testar SQL antes de mandar

Há Postgres e um arranjo pronto em `supabase/testes/`. Vale sempre:
aplicar as migrations num banco descartável e exercitar o comportamento
novo. Foi assim que se descobriu que um conserto de limite de telefone
ainda deixava passar `+55 31 99999-8888`, e que um comentário meu dizendo
"pausar já funciona" estava errado (a constraint só permitia
`active`/`closed`).

### Outras coisas do Supabase

- Edge Functions ficam em `supabase/functions/` e sobem pelo workflow
  `publicar-functions.yml` (disparado ao salvar `PUBLICAR-FUNCTIONS.txt`).
- O bucket `professional-photos` é criado **à mão** no painel — migration
  não cria bucket.
- Confirmação de número por SMS usa **Twilio Verify**, configurado no Auth.
- `supabase/banco-completo.sql` **está desatualizado** (para na 0051). Serve
  para montar um banco do zero até ali, não como retrato do que está no ar.

---

## 7. O que está PRONTO

- Cadastro de quem procura trabalho, com foto, ofícios e experiências
- Perfil **público ou oculto**
- Cadastro de empresa e de vaga, com todos os campos (tipo de contrato,
  jornada, benefícios, faixa salarial, salário a combinar)
- **Pausar, arquivar e excluir** vaga
- Disparo de onda com encaixe por ofício/cidade
- Resposta da pessoa: **tenho interesse** / **não é para mim**
- Painel da empresa com as vagas e a lista de interessados
- Tela de avisos para quem procura trabalho, com selo de não lidos
- Excluir a própria conta, e política de privacidade
- Login por telefone (SMS) e por Google
- App Android empacotado com Capacitor, pronto para a Play Store

---

## 8. O que NÃO está pronto (em ordem de importância)

### 8.1 As notificações push não chegam a ninguém — MAIS IMPORTANTE

O código está todo escrito (`supabase/functions/enviar-avisos-de-vaga`,
`supabase/functions/_shared/fcm.ts`, workflow `esvaziar-fila-de-avisos.yml`).
Falta a configuração:

- criar o projeto no **Firebase**, baixar o `google-services.json` e pôr o
  segredo `FCM_SERVICE_ACCOUNT`;
- gerar as chaves **VAPID** (web push) e configurar `VITE_VAPID_PUBLICA`.

Sem isso, a empresa dispara a onda e ninguém é avisado. É o coração do
produto parado.

Note: a API antiga do Firebase (`fcm/send`) foi desligada. O código já usa
a **HTTP v1**, que exige conta de serviço e OAuth2.

### 8.2 Pagamentos desligados

Os botões de plano estão desativados; falta ligar o Mercado Pago (as Edge
Functions existem, em `supabase/functions/mercadopago-*`).

**Regra da Google, importante:** dentro do app da Play Store **as telas que
vendem não existem** — bem digital vendido dentro do app tem que passar
pela cobrança da Google, e o Ei vende pelo Mercado Pago. Isso é decidido em
tempo de execução por `podeVender()`, em `src/lib/plataforma.ts`.

O que fica de propósito no app da loja: "Suas assinaturas" **com o botão de
cancelar** (esconder cancelamento seria infração do CDC), o desempenho do
cadastro, e a explicação do selo sem preço.

**E em lugar nenhum aparece "assine no site".** Convidar a pagar fora é a
mesma violação que vender. Esconder pode; apontar o caminho não.

Ao mexer em qualquer tela com preço, **varra as rotas nos dois modos** —
já apareceu um "a partir de R$ 10,90/mês" escondido no TÍTULO de uma seção,
que sobreviveu a esconder a vitrine inteira.

### 8.3 Convite para entrevista

A empresa vê quem se interessou, mas não há caminho para chamar a pessoa
para conversar. Foi proposto e nunca decidido pela Lorena.

### 8.4 Play Store

- Teste fechado obrigatório: **12 pessoas, 14 dias**. Convidado não conta —
  só quem instalou e não desinstalou. Por isso se convida 15 ou 16. É
  calendário puro, nada acelera.
- As capturas de tela **têm que sair do app real, com profissionais de
  verdade**. Captura com dado inventado é motivo de reprovação.
- Falta preencher o formulário de segurança de dados do Play Console.

### 8.5 Dívidas técnicas conhecidas

- O cálculo da onda ainda acontece em parte no cliente; devia ser todo no
  servidor.
- Não há monitoramento de erro em produção.
- Não há teste de tela.
- `allowBackup="true"` no Android — revisar.
- Algumas telas antigas ainda não receberam o visual novo. Medido em
  31/08, procurando `className="container"`, `className="card"` e
  `btn btn-primary`: AdminPage (14 ocorrências), CriarVagaPage (6),
  ConfiguracaoPage (5), LoginPage (4), DiagnosticoPage (3),
  CadastroEmpresaPage (3), PrivacidadePage (2), ExcluirContaPage (2).
  O caminho principal já foi convertido; sobrou o que fica nas beiradas.

---

## 9. O aplicativo da Play Store

O Ei Itabirito é **um app instalável de verdade**, não um site aberto numa
janelinha — e essa distinção decide entre aprovado e rejeitado. Os arquivos
ficam DENTRO do aparelho (`android/app/src/main/assets/public`), copiados
por `npx cap sync`. Nenhum endereço é aberto.

**Uma base de código só.** O que muda entre site e app é decidido em tempo
de execução por `src/lib/plataforma.ts`.

### Identidade: `br.com.eiitabirito.app`

Nos três lugares (`capacitor.config.ts`, `namespace`, `applicationId`).
**Definitiva** — publicada, não muda nunca: trocá-la cria outro app, com
outro endereço, sem os usuários do primeiro.

### O service worker é desligado dentro do app

Ele guarda cópias dos arquivos para o site abrir rápido. Dentro do app isso
se inverte: a pessoa atualiza pela loja e ele continua entregando os
arquivos velhos — app novo instalado, tela velha, sem nada explicando.

### Entrar no app é pelo telefone, não pelo Google

O Google recusa fazer login dentro da tela do próprio app, então abre no
navegador do celular. Voltar de lá exige uma ponte — endereço próprio do
app registrado no Android e autorizado no Google Cloud e no Supabase.
**Essa ponte não existe.** Por isso `googleServeAqui()` esconde o botão no
app — **mas só se houver outra porta**. Sem o login por telefone ligado, o
botão do Google fica: um caminho ruim é melhor que nenhum.

Duas armadilhas do login por SMS, as duas descobertas em produção:

1. **Pedir um código novo invalida o anterior.** Quem pedia duas vezes e
   digitava o primeiro via "código incorreto" com o código certo na mão.
   Daí os 60 segundos de espera entre pedidos.
2. **A conferência pode falhar DEPOIS de a sessão existir.** O app agora
   pergunta se há sessão antes de acreditar no erro — sem isso, quem entrou
   lia "código incorreto" e desistia, já logado.

### Workflow do app

`.github/workflows/gerar-app-play-store.yml`, disparado à mão em Actions.
Devolve dois pacotes: `ei-itabirito-celular-…` (o `.apk`, que instala no
aparelho) e `ei-itabirito-loja-…` (o `.aab`, que **não** instala e só serve
para o Play Console).

- **Node 22**, não 20 — o Capacitor 8 recusa abaixo disso. O build passa em
  qualquer versão e só o `cap sync` quebra, então o log parece bom até o fim.
- O `versionCode` vem do número da execução. Fixo, a loja recusaria o
  segundo envio.

### Segredos do GitHub (Settings > Secrets and variables > Actions)

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
GitHub não conhece.

**A chave de assinatura é para sempre.** Perdê-la = nunca mais atualizar o
app publicado. Ela não está no repositório; a cópia é da Lorena.

---

## 10. Outros workflows

| Arquivo | O que faz |
|---|---|
| `verificar-app.yml` | tipos + build a cada push |
| `publicar-busca-itabirito.yml` | publicação do site (em revisão depois da separação dos projetos) |
| `publicar-functions.yml` | Edge Functions, ao salvar `PUBLICAR-FUNCTIONS.txt` |
| `esvaziar-fila-de-avisos.yml` | a cada 15 min, manda os push pendentes |
| `rotina-diaria.yml` | avisos de vencimento |
| `conferir-cadastros.yml` | confere de fora quantos cadastros estão no ar |

---

## 11. Como trabalhar com a Lorena

Ela usa **celular ou tablet**, escreve em português, manda print e pede
curto. O que ela espera:

- **Português**, sem jargão. "A policy do RLS barrou o insert" não diz
  nada; "o banco não deixou salvar porque esta conta não tem permissão" diz.
- **O SQL colado na conversa** quando houver migration. Não mande arquivo,
  não mande link para o repositório.
- **Dizer quando algo não foi verificado.** Ela já foi informada doze vezes
  num dia que estava "no ar" quando não estava. Se a prova não existe, diga
  que não existe.
- **O link, sempre.** Quando pedir para ela abrir alguma tela, mande o
  endereço completo. Ela perde horas procurando coisa em painel.

O código é comentado **em português**, explicando *por que* cada decisão
existe — muitos comentários citam o defeito que a motivou. Mantenha esse
padrão: o comentário que sobrevive é o que conta a história, não o que
descreve a linha.

---

## 12. Resumo de uma linha

Trabalhe em `apps/profissionais/`, empurre na
`claude/professional-search-app-duqnk8`, mande a SQL colada na conversa e
espere ela aplicar antes de publicar o código que depende dela, e nunca
toque na `procuro-producao`.
