# www.lorenabraganca.com.br

Site pessoal da Lorena. **Não é do Ei Emprego** nem de nenhum outro app deste
repositório, e não deve citar nenhum deles: ela pediu isso com todas as
letras.

Hoje é uma página só, "em breve, novidades por aqui", em HTML puro e sem
build. Dá para abrir o `index.html` direto no navegador.

| Arquivo | Para quê |
|---|---|
| `index.html` | a página |
| `foto.jpg` | a foto dela, em preto e branco |
| `previa.jpg` | a imagem que aparece quando o link é colado no WhatsApp e no Instagram (1200×630) |
| `favicon.svg`, `icone-180.png` | o ícone da aba e o da tela inicial do celular |

## Onde publica

Num projeto **próprio** na Vercel, separado do `ei-itabirito`, com o
Root Directory = `sites/lorenabraganca` e o Framework Preset = "Other".
O `vercel.json` da raiz do repositório é do outro app e não vale aqui.

O DNS do domínio está na **GoDaddy** (nameservers `ns37`/`ns38.domaincontrol.com`),
não no registro.br.

## A prévia do link aponta para o domínio

`og:image` e `og:url` usam `https://www.lorenabraganca.com.br/`. Se o domínio
principal na Vercel for o sem `www`, troque os dois, ou a prévia some no
WhatsApp sem nenhum aviso.
