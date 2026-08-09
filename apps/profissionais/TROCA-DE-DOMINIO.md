# Trocar o endereço para www.procuroapp.com.br

**Concluído em 9/8/2026.** O app responde por `www.procuroapp.com.br`, e o
endereço antigo redireciona para ele.

Este roteiro fica registrado porque descreve a ordem que funcionou — e é a
mesma ordem para qualquer troca de domínio futura.

A ordem importa mais que a pressa. O erro clássico é apontar o app para o
endereço novo antes de o Google e o Supabase conhecerem esse endereço — e aí
ninguém consegue entrar, inclusive você.

O código já está preparado: os dois endereços funcionam ao mesmo tempo, cada
um com o seu login. A virada acontece numa linha só, no fim (passo 6).

---

## 1. Comprar o domínio ✅

`procuroapp.com.br` — comprado na GoDaddy, que é também quem controla o DNS
(os registros NS do domínio apontam para `ns35`/`ns36.domaincontrol.com`).

## 2. Ligar o domínio na Vercel ✅

No projeto da Vercel: **Settings → Domains → Add**.

Acrescente os dois:

- `www.procuroapp.com.br`
- `procuroapp.com.br` (a Vercel vai sugerir redirecionar para o `www` — aceite)

Basta adicionar `www.procuroapp.com.br`: com "Redirect apex domains to www"
marcado, a Vercel cria sozinha o domínio raiz redirecionando para o `www`.
Adicionar os dois à mão dá o erro "Domain overlaps another row".

Depois, na **GoDaddy** (Meus produtos → o domínio → DNS), **editar** dois
registros que já existem — editar, não acrescentar: dois registros A para `@`
fazem o site funcionar metade das vezes.

| Tipo | Nome | Valor |
|---|---|---|
| A | `@` | `216.198.79.1` |
| CNAME | `www` | `b8c9c6d1dbaf641a.vercel-dns-017.com` |

Esses valores são deste projeto da Vercel. O jeito mais confiável de
descobri-los é consultar um domínio que já funciona no mesmo projeto:

```bash
python3 -c "import socket; print(socket.gethostbyname_ex('www.buscaitabirito.com.br'))"
```

Isso lê o que está no ar, em vez de confiar no que um tutorial diz que
deveria ser. A Vercel leva de alguns minutos a algumas horas para dizer
**Valid Configuration** e emitir o certificado (o cadeado).

> **Não siga para o passo 3 antes de o cadeado existir.** Abrir
> `https://www.procuroapp.com.br` no navegador tem que mostrar o app.

## 3. Autorizar o endereço novo no Google ✅

Console do Google Cloud → **APIs e serviços → Credenciais** → o seu
OAuth Client.

- **Origens JavaScript autorizadas**: acrescente `https://www.procuroapp.com.br`
- **URIs de redirecionamento autorizados**: não mexer. Apontam para o
  Supabase, que não mudou de endereço.

**Acrescente, não substitua.** O endereço antigo continua precisando
funcionar enquanto os dois estiverem no ar.

Atenção ao formato, que é diferente do Supabase: aqui vai **só o endereço**,
sem caminho, sem barra final e sem `*`. O Google recusa
`https://www.procuroapp.com.br/**` com "Origem inválida".

## 4. Autorizar no Supabase ✅

Painel do Supabase → **Authentication → URL Configuration**:

- **Site URL**: pode continuar no antigo por enquanto
- **Redirect URLs**: acrescente `https://www.procuroapp.com.br/**`

De novo: acrescentar, não trocar.

## 5. Conferir que o endereço novo funciona por inteiro ✅

Abra `https://www.procuroapp.com.br` e faça o teste completo:

- [ ] a busca carrega e mostra profissionais
- [ ] entrar com o Google funciona (é este que quebra se algo faltou)
- [ ] `www.procuroapp.com.br/diagnostico` mostra "Endereço" em verde

Se o login falhar aqui, o problema está no passo 3 ou 4 — e **o app antigo
continua funcionando normalmente**, então não há pressa nem prejuízo.

## 6. Virar a chave ✅

Feito. No arquivo `src/lib/enderecoCanonico.ts`:

```ts
const LIGAR_DOMINIO_NOVO = true;
```

Junto com isso, no `index.html`, trocar os três endereços (`canonical`,
`og:url`, `og:image`) para o domínio novo — são eles que decidem como o link
aparece quando alguém manda o app no WhatsApp.

A partir daqui, quem abrir o endereço antigo é levado para o novo, com o
caminho preservado.

## 7. Depois da virada — o que ainda falta

- [ ] **Supabase → Site URL** para `https://www.procuroapp.com.br`
- [ ] **Resend**: verificar o domínio e configurar `avisos@procuroapp.com.br`
- [ ] **Mercado Pago**: endereço do webhook, quando os pagamentos entrarem

Detalhes:

- O `RESEND_FROM_EMAIL` é um marcador explícito (`DOMINIO-AINDA-NAO-DEFINIDO`)
  de propósito: endereço plausível e errado faz o e-mail sumir sem erro
- **Não desligue o domínio antigo.** Ele custa pouco e é o que segura quem
  guardou o link antigo, quem tem o app instalado e o que já foi indexado
  pelo Google. Deixe redirecionando por pelo menos um ano

## O que acontece com quem já instalou o app

Para o celular, **o app instalado é o endereço**. Quem instalou pelo domínio
antigo continua abrindo o domínio antigo — e, depois do passo 6, será levado
ao novo a cada abertura, o que funciona mas dá um piscar a mais.

O ícone na tela de início continua sendo o antigo até a pessoa instalar de
novo. Hoje isso são você e pouca gente; por isso vale fazer a troca agora, e
não depois de trezentos profissionais cadastrados.

---

## Se algo der errado no endereço novo

`LIGAR_DOMINIO_NOVO`, em `src/lib/enderecoCanonico.ts`, volta para `false` e
o app inteiro retorna ao endereço antigo numa publicação — sem desfazer nada
na Vercel, no Google ou no Supabase, porque os dois endereços continuam
autorizados nos três.
