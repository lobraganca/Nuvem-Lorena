# Trocar o endereço para www.procuroapp.com.br

O app funciona hoje em `www.buscaitabirito.com.br`. Este roteiro leva ele
para `www.procuroapp.com.br` **sem nenhum momento de app fora do ar e sem
derrubar o login de ninguém**.

A ordem importa mais que a pressa. O erro clássico é apontar o app para o
endereço novo antes de o Google e o Supabase conhecerem esse endereço — e aí
ninguém consegue entrar, inclusive você.

O código já está preparado: os dois endereços funcionam ao mesmo tempo, cada
um com o seu login. A virada acontece numa linha só, no fim (passo 6).

---

## 1. Comprar o domínio

`procuroapp.com.br` — no Registro.br, que é onde se registra `.com.br`.

Guarde o login do Registro.br: é lá que se mexe no DNS, e perder esse acesso
é perder o endereço.

## 2. Ligar o domínio na Vercel

No projeto da Vercel: **Settings → Domains → Add**.

Acrescente os dois:

- `www.procuroapp.com.br`
- `procuroapp.com.br` (a Vercel vai sugerir redirecionar para o `www` — aceite)

A Vercel mostra os valores de DNS que você precisa cadastrar no Registro.br.
**Use os valores que ela mostrar**, não os que estiverem escritos em qualquer
tutorial: eles mudam de projeto para projeto.

Depois de cadastrar no Registro.br, a Vercel leva de alguns minutos a algumas
horas para dizer **Valid Configuration** e emitir o certificado (o cadeado).

> **Não siga para o passo 3 antes de o cadeado existir.** Abrir
> `https://www.procuroapp.com.br` no navegador tem que mostrar o app.

## 3. Autorizar o endereço novo no Google

Console do Google Cloud → **APIs e serviços → Credenciais** → o seu
OAuth Client.

- **Origens JavaScript autorizadas**: acrescente `https://www.procuroapp.com.br`
- **URIs de redirecionamento autorizados**: acrescente o endereço de retorno
  do Supabase, se ainda não estiver lá

**Acrescente, não substitua.** O endereço antigo continua precisando
funcionar enquanto os dois estiverem no ar.

## 4. Autorizar no Supabase

Painel do Supabase → **Authentication → URL Configuration**:

- **Site URL**: pode continuar no antigo por enquanto
- **Redirect URLs**: acrescente `https://www.procuroapp.com.br/**`

De novo: acrescentar, não trocar.

## 5. Conferir que o endereço novo funciona por inteiro

Abra `https://www.procuroapp.com.br` e faça o teste completo:

- [ ] a busca carrega e mostra profissionais
- [ ] entrar com o Google funciona (é este que quebra se algo faltou)
- [ ] `www.procuroapp.com.br/diagnostico` mostra "Endereço" em verde

Se o login falhar aqui, o problema está no passo 3 ou 4 — e **o app antigo
continua funcionando normalmente**, então não há pressa nem prejuízo.

## 6. Virar a chave

Só agora. No arquivo `src/lib/enderecoCanonico.ts`:

```ts
const LIGAR_DOMINIO_NOVO = true;
```

Junto com isso, no `index.html`, trocar os três endereços (`canonical`,
`og:url`, `og:image`) para o domínio novo — são eles que decidem como o link
aparece quando alguém manda o app no WhatsApp.

A partir daqui, quem abrir o endereço antigo é levado para o novo, com o
caminho preservado.

## 7. Depois da virada

- **Supabase → Site URL**: agora sim, trocar para `https://www.procuroapp.com.br`
- **Mercado Pago**: refazer o endereço do webhook quando os pagamentos entrarem
- **E-mails automáticos**: `RESEND_FROM_EMAIL` hoje é um marcador
  (`DOMINIO-AINDA-NAO-DEFINIDO`) de propósito. Verifique `procuroapp.com.br`
  no Resend e configure `avisos@procuroapp.com.br`
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
