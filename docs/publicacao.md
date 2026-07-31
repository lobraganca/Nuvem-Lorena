# Publicar em avenaapp.com.br

O domínio já é seu. Este documento é o caminho do registro.br até o site no ar.

**Antes de apontar o domínio, leia o Bloco 0 de
[pendencias-para-o-ar.md](pendencias-para-o-ar.md).**

O painel administrativo já não é mais um impedimento: ele só entra no pacote se
o site for compilado com `VITE_ADMIN_ENABLED=true`, e o build público não é. O
que continua valendo é que **não há servidor**: cada visitante tem uma cópia
isolada do app no próprio navegador, ninguém paga nada de verdade, e as contas
não existem fora do aparelho de quem as criou.

Ou seja: publicar hoje coloca no ar um **site de demonstração no seu domínio**.
Isso é legítimo e útil — serve para mostrar a sócio, investidor, agência e
guia, e para começar a aparecer no Google. O que não dá para fazer ainda é
receber dinheiro nem prometer a alguém que os dados dela ficam guardados.

---

## O que já está pronto no código

| Item | Onde |
|---|---|
| Título, descrição e endereço canônico | `index.html` |
| Imagem de compartilhamento (WhatsApp, redes) | `public/og-avena.png` |
| Ícones do app instalado, inclusive maskable | `public/icon-*.png` |
| `robots.txt` bloqueando `/admin` e telas privadas | `public/robots.txt` |
| `sitemap.xml` | `public/sitemap.xml` |
| Regra de rota para a Vercel | `vercel.json` |
| Regra de rota para a Netlify | `public/_redirects` |

A regra de rota não é detalhe: sem ela, abrir `avenaapp.com.br/destination`
direto — ou dar F5 nessa página — devolve erro 404, porque o servidor procura
um arquivo que não existe. As rotas do Avena vivem no navegador.

---

## Passo 1 — Escolher a hospedagem

**Vercel** ou **Netlify**. As duas:

- têm plano gratuito que aguenta bem o começo;
- instalam o certificado HTTPS sozinhas;
- publicam sozinhas a cada envio para o GitHub.

O resto deste documento usa a Vercel. Na Netlify os passos são equivalentes.

## Passo 2 — Conectar o repositório

1. Entre na Vercel com a conta do GitHub.
2. Importe o repositório `Nuvem-Lorena`.
3. As configurações são detectadas sozinhas (Vite):
   - Build: `npm run build`
   - Diretório de saída: `dist`
4. Publique. Você recebe um endereço temporário terminado em `.vercel.app` —
   confira que está tudo certo nele antes de apontar o domínio.

## Passo 3 — Apontar o domínio

Na Vercel, em **Settings › Domains**, adicione `avenaapp.com.br` e também
`www.avenaapp.com.br`. Ela mostra os registros a criar.

Depois, no painel de DNS de quem registrou o domínio:

| Tipo | Nome | Valor |
|---|---|---|
| A | `@` (raiz) | o IP que a Vercel indicar |
| CNAME | `www` | o endereço `.vercel-dns.com` que ela indicar |

Copie os valores da tela da Vercel — não de um tutorial antigo, eles mudam.

### Na GoDaddy

**My Products › o domínio › DNS › Manage DNS.** A lista de registros aparece
ali. Três armadilhas, nesta ordem de importância:

1. **Já existe um registro `A` no nome `@`**, apontando para um IP da própria
   GoDaddy (é a página "este domínio está estacionado"). Ele tem de ser
   **editado** para o IP da Vercel, não duplicado. Dois registros `A` no mesmo
   nome mandam metade das visitas para a página de estacionamento — e o erro
   aparece de forma intermitente, que é o pior jeito de descobrir.
2. **Não use "Forwarding" (redirecionamento).** É um atalho que a GoDaddy
   oferece na mesma tela e que parece resolver, mas ele serve a página por
   dentro de um quadro, quebra o HTTPS do endereço final e atrapalha o Google.
   O caminho certo é o registro `A` acima.
3. **Se houver um registro `CNAME` chamado `www`** apontando para
   `@` ou para a GoDaddy, edite-o para o endereço `.vercel-dns.com`.

O TTL padrão é uma hora; baixar para dez minutos antes de mexer faz a mudança
valer mais rápido, e depois pode voltar ao padrão.

### No registro.br

Em **"Editar zona DNS"** do domínio, os mesmos dois registros da tabela acima.

**Prazo:** a mudança de DNS leva de alguns minutos a algumas horas para valer
no mundo todo. É normal o site aparecer para você e ainda não para outra
pessoa. Não refaça a configuração no meio do caminho.

**Escolha uma versão principal.** O padrão recomendado é `avenaapp.com.br` como
principal e `www` redirecionando para ela. Isso evita que o Google trate as
duas como sites diferentes.

## Passo 4 — Variáveis de ambiente

Em **Settings › Environment Variables**, com base no `.env.example`:

```
VITE_PAYMENTS_ENABLED=false
```

Deixe em `false` enquanto o backend de pagamento não existir. A tela de
pagamento continua avisando que nada é cobrado.

**Não cadastre `VITE_BASE_PATH` na Vercel.** Ela existe só para o site de teste
no GitHub Pages, que serve o app dentro de `/Nuvem-Lorena/`. No domínio próprio
o app fica na raiz. Se essa variável for definida lá, o site sobe, a página
abre em branco e o navegador procura os arquivos numa pasta que não existe —
sem nenhuma mensagem de erro que explique o motivo.

Não cadastre `VITE_SMS_ENDPOINT` enquanto não houver servidor de SMS. Sem ela,
a confirmação de telefone roda em modo de teste, mostra o código na tela e
grava a conta como confirmada "em teste" — que é o comportamento honesto. Com
ela apontando para um endereço que não responde, o cadastro trava sem saída.

**Nunca** cadastre aqui uma variável com `VITE_` que contenha segredo: tudo com
esse prefixo é embutido no site e qualquer visitante consegue ler.

## Passo 5 — Conferir depois de no ar

- [ ] `https://avenaapp.com.br` abre com cadeado (HTTPS).
- [ ] `avenaapp.com.br/destination` funciona ao dar F5 — se der 404, a regra de
      rota não foi aplicada.
- [ ] Mandar o link no WhatsApp mostra a imagem verde com a logo.
- [ ] No celular, o navegador oferece "Adicionar à tela de início" e o ícone
      aparece certo.
- [ ] `avenaapp.com.br/robots.txt` abre e contém `Disallow: /admin`.

---

## Endereços que dependem do domínio

Guarde esta lista: vários serviços pedem os endereços exatos, e errar um deles
é a causa mais comum de "funcionou no teste e quebrou em produção".

**Mercado Pago** (quando fizer a integração):
- Redirect URI: `https://avenaapp.com.br/api/mercadopago/callback`
- Webhook: `https://avenaapp.com.br/api/mercadopago/webhook`
- Retornos: `https://avenaapp.com.br/pagamento/...` — já são gerados
  automaticamente pelo app a partir do endereço em que ele estiver rodando.

**Login pelo Google** (quando fizer a autenticação):
- Origem autorizada: `https://avenaapp.com.br`
- Redirect URI: o que o Supabase indicar, mais o seu domínio

**Supabase:**
- Site URL: `https://avenaapp.com.br`

## E-mails no domínio

Vale criar antes de preencher os documentos legais, porque eles pedem endereços
de contato ([pendencias-para-o-ar.md](pendencias-para-o-ar.md), Bloco 3):

- `contato@avenaapp.com.br` — atendimento
- `privacidade@avenaapp.com.br` — encarregado de dados (LGPD, art. 41)

Google Workspace e Zoho Mail resolvem; o Zoho tem plano gratuito para poucos
usuários. Exige adicionar registros MX na mesma zona DNS do registro.br.

## Renovação

Domínio `.com.br` é anual. Se vencer, o site sai do ar e o nome pode ser
registrado por outra pessoa depois do prazo de carência. Deixe a renovação
automática ligada no registro.br e confira se o cartão cadastrado não venceu.
