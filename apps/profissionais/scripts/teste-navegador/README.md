# Rodar o app sem banco, para exercitar a tela

Sobe o app neste container com um Supabase de mentira, para abrir no
navegador e testar navegação de verdade — tocar num cartão, voltar, buscar
de novo.

Existe porque um defeito real passou despercebido por meses e não seria
encontrado lendo código: **abrir um cadastro e voltar apagava a busca**. Só
apareceu quando o caminho foi percorrido de ponta a ponta.

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
