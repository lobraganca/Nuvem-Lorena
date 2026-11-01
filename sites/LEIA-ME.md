# `sites/` — sites que não são apps

## `lorenabraganca/` → www.lorenabraganca.com.br

O site pessoal da Lorena. Ele não deve citar nenhum app deste repositório:
ela pediu isso com todas as letras.

É uma página de captação em HTML puro e sem build: dá para abrir o
`index.html` direto no navegador. Desde 31/10 ela ocupa o lugar do antigo
"em breve, novidades por aqui" (o pedido de não dar spoiler acabou com ele).

**A cara é a do post dela** — "Eu construo a ferramenta pro seu negócio",
fundo grafite, verde-limão e cartões arredondados. As cores foram medidas no
pixel da arte que ela mandou: fundo `#0F1115`, limão `#C8F26B`, cartão
`#181B21`, borda `#262A32`. A `previa.jpg`, o ícone e o `404.html` seguem
as mesmas. O Instagram dela nesta página é o **@lo_braganca**.

### O diagnóstico, que termina no WhatsApp — e agora fica gravado

Sete perguntas, uma por vez. Quatro valem de 0 a 3 pontos (onde ficam as
informações, se sabe os números do mês, tempo perdido, se a empresa anda sem
ela) e viram um índice de 0 a 100. Ramo, equipe e objetivo só vão para a
conversa e para a sugestão de serviço.

Desde 01/11 ele grava, em duas etapas que caem na mesma linha (o id nasce no
navegador):

1. **chegou ao resultado** → linha sem nome (para contar quantos fizeram);
2. **tocou em "Receber minha análise"** → nome, WhatsApp e empresa, e o aviso
   vai para o celular dela. O WhatsApp da pessoa passou a ser obrigatório: sem
   ele, a Lorena não tinha como chamar quem não mandou a mensagem.

A página **não fala com o banco**: manda para `/api/diagnostico` e não espera
resposta. Se o servidor ou o banco estiverem fora, a pessoa não percebe e o
WhatsApp abre igual — o que se perde é só a linha no /adm.

O número que recebe a mensagem fica na constante `WHATSAPP` do `index.html` —
`5531971473162`, confirmado por ela em 31/10. É o mesmo do suporte do Ei.

### O `/adm` e o servidor (`api/`)

`/adm` é a lista de quem fez o diagnóstico, só dela: senha, números no topo,
botão "Chamar" (abre a conversa já começada) e "Já falei com essa pessoa".
Fica fora do Google (`noindex`) e sem link em lugar nenhum.

Tudo passa pelas funções da Vercel em `api/` — `diagnostico.mjs` (público),
`adm.mjs` (com o passe que a senha gera, válido por 30 dias) e `_lib.mjs`
(o "_" faz a Vercel não publicá-lo). São **`.mjs` de propósito**: a raiz do
repositório tem `"type": "module"`, e um `.js` aqui seria lido de um jeito ou
de outro conforme quem olhasse. O teste local pegou isso antes de subir.

Precisam de duas coisas ligadas na Vercel:

| O quê | Onde |
|---|---|
| o banco | aba **Storage** do projeto > Upstash (Redis) > conectar ao projeto. A Vercel cria sozinha as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN` (o código aceita qualquer prefixo, `*_REST_API_URL`/`*_REST_API_TOKEN`, e nunca a de só leitura) |
| `ADMIN_SENHA` | Settings > Environment Variables. É a senha do /adm, escolhida por ela; trocá-la desloga todo mundo |

Sem elas, as funções respondem 503 dizendo o que falta, e o /adm mostra isso
na tela. Variável nova só vale depois de uma nova publicação (Redeploy).

### O banco: Upstash (Redis), pela própria Vercel

**Não é o Supabase**: o plano grátis dela no Supabase já estava no limite de
projetos (01/11), e ela escolheu o banco grátis da Vercel em vez de pausar um
projeto antigo ou assinar o Pro. Vantagem que sobrou: nenhuma chave passa pela
mão dela — a Vercel liga o banco ao projeto e cria as variáveis.

O que fica lá, tudo pela API REST da Upstash (`/pipeline`), sem dependência:

| Chave | O quê |
|---|---|
| `diag:<id>` | um diagnóstico, em JSON (respostas, índice, nível, nome, WhatsApp, datas) |
| `diags` | a fila por data (sorted set; pontuação = quando nasceu) — é dela que sai a lista do /adm |
| `push` | os celulares inscritos para o aviso (hash: endereço → inscrição) |
| `config:vapid` | o par de chaves das notificações; a parte privada nunca sai do servidor |

As regras que o banco não impõe (WhatsApp `55` + DDD + número, índice de 0 a
100, textos curtos) estão em `api/diagnostico.mjs`, antes de gravar.

### A notificação no celular (Web Push)

Ela escolheu o aviso no próprio /adm, sem app de terceiro. O /adm é um app
instalável (`adm/manifest.webmanifest` + `adm/sw.js`, escopo `/adm/`).
**No iPhone só funciona com o /adm salvo na Tela de Início e aberto por lá**
(regra da Apple) — a tela explica isso em vez de mostrar um botão que falha.

A cifra (RFC 8291) e a assinatura VAPID foram feitas à mão em `_lib.mjs`, com
o `crypto` do Node, para não ter dependência. Foram conferidas contra a
biblioteca de referência (`http_ece`): ela abre a mensagem, e recusa quando a
chave do aparelho é outra. O par de chaves VAPID nasce no primeiro uso e fica
em `config:vapid`; a parte privada nunca sai do servidor.

### O portfólio: `/portifolio`

Assim, com "i": é o endereço que ela pediu (01/11). A pasta `portfolio/`, com
a grafia certa, só redireciona para lá, para quem digitar da outra forma não
cair no 404.

Nove serviços em três frentes (gestão, ferramentas, presença digital) e
quatro trabalhos de verdade como exemplo, com foto de tela: a página com
diagnóstico, a página de lista de espera da mentoria, as capas dos destaques
e o post "Eu construo a ferramenta". As fotos de tela (`portifolio/*.jpg`)
foram tiradas das páginas reais; se uma delas mudar, a foto fica velha até
alguém tirar outra.

O portfólio usa endereços que começam na raiz (`/foto.jpg`, `/favicon.svg`):
abrir o arquivo direto no navegador não mostra a foto nem o ícone. Para ver
como fica, sirva a pasta: `python3 -m http.server` dentro de `lorenabraganca/`.

### TUDO o que está dentro de `lorenabraganca/` vai para o ar

Sem build, a Vercel publica a pasta inteira, arquivo por arquivo. Uma
anotação deixada lá dentro fica aberta em
`www.lorenabraganca.com.br/nome-do-arquivo`. Foi por isso que este LEIA-ME
saiu de lá: ele estava a um deploy de publicar o spoiler e o nome do outro
app. Anotação fica aqui, um nível acima.

E o repositório é **público**: o que entra num commit, mensagem incluída,
qualquer pessoa lê no GitHub, mesmo depois de apagado.

| Arquivo | Para quê |
|---|---|
| `index.html` | a página |
| `404.html` | endereço errado volta para o início, em vez da página 404 da Vercel, em inglês |
| `foto.jpg` | a foto dela, em preto e branco (402×467: a original que ela mandou era desse tamanho) |
| `previa.jpg` | a imagem que aparece quando o link é colado no WhatsApp e no Instagram (1200×630) |
| `favicon.svg` | o desenho do ícone. Os dois PNG saem dele |
| `favicon-32.png`, `icone-180.png` | o ícone de aba para navegador que não lê SVG, e o da tela inicial do iPhone |

### Onde publica

Num projeto **próprio** na Vercel, o `nuvem-lorena-lorenabraganca`
(endereço provisório `nuvem-lorena-lorenabraganca.vercel.app`), separado do
`ei-itabirito` e do `nuvem-lorena-4uiw` (este é do procurô), com o
Root Directory = `sites/lorenabraganca` e o Framework Preset = "Other".
O `vercel.json` da raiz é do outro app e não vale aqui.

Os três projetos se reconstroem a cada push na `ei-itabirito`, porque o
repositório não tem workspaces e a Vercel não sabe pular projeto não
afetado. É inofensivo. Não ponha "Ignored Build Step" para evitar isso: a
comparação é só com o commit anterior, e um push de vários commits pode
pular uma montagem necessária.

O DNS do domínio está na **GoDaddy** (nameservers `ns37`/`ns38.domaincontrol.com`),
não no registro.br. São dois registros: o A de `@` e o CNAME de `www`, com
os valores do cartão do domínio na Vercel.

### A prévia do link aponta para o domínio com www

`og:image`, `og:url` e o `canonical` usam `https://www.lorenabraganca.com.br/`.
Se o domínio principal na Vercel for o sem `www`, troque os três, ou a
prévia some no WhatsApp sem nenhum aviso.

### Os ícones e a prévia saem de desenho, não se editam à mão

Os dois PNG de ícone saem do `favicon.svg`. O primeiro `icone-180.png` foi
gerado de um `<img>` que não carregou: saiu um quadrado azul com o símbolo
de imagem quebrada, e nenhuma conferência de tipo ou de build pega isso.
Quem refizer: olhe o arquivo gerado antes de commitar.

## `instagram/` — capas dos destaques do @lolemos

Quatro capas com fundo preto, desenho de traço fino e claro e o sublinhado
amarelo do título do site embaixo: pessoa (sobre mim), estrela de quatro
pontas (novidades), câmera (bastidores) e balão (contato). Ficam fora de
`lorenabraganca/`, então não vão para o ar.

**É o estilo "B", escolhido por ela em 25/10 entre três.** A primeira versão,
de adesivos coloridos com contorno e estrelinha, ela achou infantil. A cor
fica só no sublinhado; não volte a pôr cor dentro do desenho.

```bash
cd /home/user/Nuvem-Lorena/sites/instagram
python3 gerar-capas.py && node gerar-png.mjs
```

Os SVG são a fonte; os PNG saem deles. Capa nova é uma entrada a mais em
`CAPAS`, no `gerar-capas.py`, e não um PNG feito à mão: é o mesmo cuidado
dos ícones do Ei, que já saíram de três fontes diferentes sem ninguém ver.

São de 1080×1920, o tamanho do story. O Instagram recorta o círculo do
destaque no meio da imagem, com a largura dela, por isso o desenho fica todo
no centro, longe das bordas.
