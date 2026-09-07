# Rodar o app sem banco, para exercitar a tela

Sobe o app neste container com um Supabase de mentira, para abrir no
navegador e testar navegação de verdade — tocar num cartão, voltar, buscar
de novo.

Existe porque um defeito real passou despercebido por meses e não seria
encontrado lendo código: **abrir um cadastro e voltar apagava a busca**. Só
apareceu quando o caminho foi percorrido de ponta a ponta.

## Os interruptores

O falso responde a chaves no endereço (`?plano=nao`) e a chaves no
`localStorage`. Elas existem porque **caso que não dá para reproduzir é
caso que passa em qualquer teste sem nunca ter rodado** — foi assim com o
contador de on-line, que só quebrava para quem estava sozinha, e com os
dois planos pagos que valiam zero, porque o falso fixava o plano num dos
três que funcionavam.

Esta lista existe porque em 06/09 três interruptores foram inventados de
novo por não estarem escritos em lugar nenhum.

### No endereço

| Chave | O que exercita |
|---|---|
| `?vagas=0` | banco de vagas VAZIO — a tela do estado vazio tem texto próprio |
| `?falsos=3` | cidade quase sem cadastro, onde as prateleiras ficam feias |
| `?plano=nao` | empresa SEM plano — a barreira de publicar vaga |
| `?plano=pro\|cinco\|dez\|ilimitado` | qual plano (o padrão é `tres`) |
| `?cortesia=1` | o plano é TESTE GRÁTIS (0123): "faltam 3 dias" |
| `?conta=nova` | quem acabou de entrar: sem cadastro, sem empresa, sem nada |
| `?semperfil=1` | tem empresa e NÃO tem cadastro de pessoa — o caso mais comum de quem contrata |
| `?lado=empresa\|novo` | de que lado a sessão entrou, ou nenhum ainda |
| `?telefone=nao` | telefone da empresa não confirmado |
| `?confirmado=nao` | WhatsApp da pessoa não confirmado |
| `?foto=nao` | conta sem foto — o círculo com as iniciais |
| `?sozinha=1` | ninguém mais on-line, que é quando o contador some |
| `?cheio=hoje` | o dia já com 5 candidaturas — o teto |
| `?combina=1` | uma vaga do ofício da pessoa, para a compatibilidade passar de 80% |
| `?destaque=nao` | a pessoa NÃO está em destaque — é o único jeito de ver a tela que VENDE o destaque |
| `?cadastro=metade` | a empresa SEM foto |
| `?acessos=N` \| `semsql` \| `0` | os acessos de hoje no painel: um número, a migration 0131 não aplicada, ou o dia zerado |

`?combina=1` mexe na SEGUNDA vaga de propósito: a primeira já tem resposta
no falso, e vaga respondida fica fora do baralho — o caso alto apareceria
na lista e nunca nos cartões.

### No `localStorage`

| Chave | O que exercita |
|---|---|
| `falso-usuario` | quem está logado (`telefone`, ou vazio para deslogado) |
| `falso-admin` | a conta é da administração, e o painel abre |
| `falso-perfil-completo` | perfil preenchido, com nome e foto |
| `falso-tem-senha` | a conta já criou senha |
| `falso-colunas-estrito` | o banco RECUSA coluna que não existe, nos dois sentidos — é o que prova que `colunasNovas.ts` está tolerando de verdade |

### A vitrine, sem conta

A partir de 07/09 a tela inicial mostra vagas e candidatos para quem NÃO
tem conta. Para exercitar isso não há interruptor: basta **não** gravar
`falso-usuario`. Deslogada, o app abre em `/` e as duas prateleiras
carregam.

O falso conhece a view `professionals_vitrine` (migration 0132) e serve
dela a MESMA lista da `professionals_public`, com as colunas de contato
removidas. É isso que permite reprovar, no navegador, o dia em que alguém
puser telefone na lista que abre sem conta — que é o vazamento que a 0118
fechou.


## Como rodar

```bash
cd /home/user/Nuvem-Lorena/apps/profissionais

# 1. o cliente falso entra no lugar do real
cp scripts/teste-navegador/supabase-falso.ts src/lib/supabase.ts

# 2. uma config de Vite sem PWA e sem o carimbo de versão
cat > vite.teste.local.ts <<'EOF'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  define: { __VERSAO__: JSON.stringify("teste") },
  plugins: [react()],
  server: { port: 5599, strictPort: true },
});
EOF

npx vite --config vite.teste.local.ts
```

Depois, **sempre**:

```bash
git checkout -- src/lib/supabase.ts
rm -f vite.teste.local.ts
git status --short          # supabase.ts NÃO pode aparecer aqui
```

## Por que trocar o arquivo, e não usar `resolve.alias`

Porque o alias não funciona para isto, e descobrir isso custou tempo. O
alias do Vite casa com o **texto do import** — as telas escrevem
`../lib/supabase`, e apontar o alias para `/src/lib/supabase` (o caminho que
aparece depois, no que o navegador baixa) não pega nada. O import segue
resolvendo para o arquivo real, o app roda sem banco e o teste "passa"
testando a tela de erro.

## O que o falso precisa ter

Além de `from().select().eq().or().order().range()`:

- **`channel()`** — `src/lib/presence.ts` chama na montagem. Sem ele, a tela
  inteira cai no `ErrorBoundary`, e o sintoma engana: o teste diz que não
  achou a barra nem o campo de busca, como se o seletor estivesse errado.
- **`overlaps()`** — usado pela busca por necessidade.
- **`auth.onAuthStateChange`** devolvendo `{ data: { subscription } }`.

Ele não valida sintaxe de PostgREST. Filtro montado à mão numa string passa
aqui e pode ser recusado pelo Supabase de verdade — por isso a busca usa
métodos do cliente (`overlaps`, `contains`) em vez de texto concatenado.

## Dirigindo com o Playwright

`playwright` está instalado na **raiz do repositório**, não aqui. Então o
script de teste roda de `/home/user/Nuvem-Lorena`, e o Chromium fica em
`/opt/pw-browsers/chromium`:

```js
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
```

Pule a tela de apresentação antes de qualquer coisa:

```js
await p.evaluate(() => {
  localStorage.setItem('busca-itabirito-inicio-visto', '1');
  localStorage.setItem('busca-itabirito-tour-visto', '1');
});
```

Arquivos `*.mjs` na raiz do repositório são ignorados pelo git, então dá para
deixar os scripts de teste lá enquanto se trabalha.

## Medir alinhamento em vez de olhar

Para "está torto" — que já foi apontado três vezes na mesma marca —,
fotografe o elemento com `deviceScaleFactor: 8` e calcule o centro da tinta
com `pngjs`, filtrando só o miolo do círculo (senão o fundo branco da página
entra na conta e o resultado dá certo quando está errado).

O visto do número confirmado estava 0,66px abaixo do centro. A olho isso é
"parece torto"; medido, é um número que se conserta e se confere.

## Publicar uma demonstração navegável

Quando a dona pede "me manda o link para eu ver o app", não há link para
dar: este container não é acessível de fora, e o site publica de outra
branch. A saída é montar o app inteiro **num arquivo HTML só**, com este
mesmo cliente falso, e publicar essa página.

```bash
cd /home/user/Nuvem-Lorena/apps/profissionais
cp scripts/teste-navegador/supabase-falso.ts src/lib/supabase.ts
npx vite build --config vite.demo.ts        # sai em dist-demo/
git checkout -- src/lib/supabase.ts         # SEMPRE
```

Dá ~550 KB. Depois é extrair do `dist-demo/index.demo.html` o `<style>` e o
`<script>` e publicar só o conteúdo (a publicação monta o `<head>` em
volta).

`vite.demo.ts` **recusa montar** se `src/lib/supabase.ts` for o cliente de
verdade. Sem essa trava, esquecer o primeiro passo geraria uma página
pública tentando falar com o banco da dona, com a chave dentro — e sem erro
nenhum na montagem.

### O que a demonstração tem de diferente do app

`src/main.demo.tsx`:

- **HashRouter** e não BrowserRouter — é uma página só, num endereço fixo;
  com o de endereço real, tocar em qualquer link daria 404.
- **Sem** o redirecionamento para o `www` e **sem** `cuidarDasAtualizacoes`
  (fala com o service worker, que não existe nesta montagem).
- Uma **barra de escolha** no topo, que não faz parte do app: sem ela a
  demonstração mostraria só as três telas públicas, porque não há login de
  verdade num app sem banco. Ela grava `falso-usuario` e `falso-lado` e
  recarrega.

O cliente falso lê os ajustes da URL **ou** do armazenamento (`ajuste()`),
justamente por causa dessa barra: na página publicada não dá para
acrescentar `?lado=empresa`.

### Duas armadilhas que já custaram tempo aqui

1. **Editar `scripts/…/supabase-falso.ts` não muda a demonstração.** O que
   é montado é a cópia em `src/lib/supabase.ts`. Esquecer de recopiar faz o
   app aparecer com o comportamento antigo — e parece defeito do app.
2. **`location.hash = …` seguido de `location.reload()` na mesma linha não
   recarrega.** A navegação do `#` engole a recarga. O cliente falso lê o
   armazenamento uma vez só, ao carregar, então a troca de papel não fazia
   efeito: o botão acendia e a tela continuava a mesma. Ver o `setTimeout`
   em `main.demo.tsx`.
