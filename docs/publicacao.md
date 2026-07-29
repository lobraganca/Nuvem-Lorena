# Publicar em avenaapp.com.br

O domínio já é seu. Este documento é o caminho do registro.br até o site no ar.

**Antes de apontar o domínio, leia o Bloco 0 de
[pendencias-para-o-ar.md](pendencias-para-o-ar.md).** Hoje `/admin` está aberto
para qualquer pessoa que digitar o endereço. Publicar num domínio real, com
dados reais, antes de resolver isso, expõe faturamento e documentos de
participantes.

Para publicar **uma demonstração** — para mostrar a sócio, investidor ou
agência — não há problema, desde que os dados sejam os de exemplo.

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

No **registro.br**, em "Editar zona DNS" do seu domínio:

| Tipo | Nome | Valor |
|---|---|---|
| A | `@` (raiz) | o IP que a Vercel indicar |
| CNAME | `www` | o endereço `.vercel-dns.com` que ela indicar |

Copie os valores da tela da Vercel — não de um tutorial antigo, eles mudam.

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
