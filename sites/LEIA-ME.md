# `sites/` — sites que não são apps

## `lorenabraganca/` → www.lorenabraganca.com.br

O site pessoal da Lorena. Ele não deve citar nenhum app deste repositório:
ela pediu isso com todas as letras.

Hoje é uma página só, "em breve, novidades por aqui", em HTML puro e sem
build. Dá para abrir o `index.html` direto no navegador.

**E a página não revela o que vem.** Ela pediu sem spoiler (16/10). Isso
vale também para a `previa.jpg` e para as `meta` de descrição, que aparecem
quando o link é colado no WhatsApp. Por isso este arquivo também não diz o
que vem.

**O fundo é preto para todo mundo**, não só para quem usa o celular no modo
escuro. Ela escolheu entre seis cores, olhando a página pronta em cada uma
(25/10). A `previa.jpg` e o `404.html` seguem o mesmo preto.

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
