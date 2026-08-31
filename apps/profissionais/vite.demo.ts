/* Montagem da DEMONSTRAÇÃO: o app inteiro num arquivo HTML só.
   ───────────────────────────────────────────────────────────
   Serve para publicar uma página navegável — com dados de mentira — para a
   dona abrir no celular e ver o que existe pronto, enquanto o site de
   verdade ainda publica de outra branch.

   COMO GERAR (a ordem importa, e o passo 1 não é opcional):

     cd /home/user/Nuvem-Lorena/apps/profissionais
     cp scripts/teste-navegador/supabase-falso.ts src/lib/supabase.ts
     npx vite build --config vite.demo.ts
     git checkout -- src/lib/supabase.ts     # SEMPRE

   `inlineDynamicImports` junta as telas de carregamento tardio no mesmo
   pacote: sem isso a montagem gera vários arquivos e nada carregaria numa
   página solta. E sem PWA e sem carimbo de versão — os dois falam com
   coisas que não existem aqui. */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { readFileSync } from "node:fs";

/* A TRAVA.
   ────────
   Sem ela, quem rodasse este build esquecendo o passo 1 geraria uma
   demonstração com o cliente de VERDADE embutido — uma página pública
   tentando falar com o banco da dona, com a chave dentro. Não daria erro
   nenhum na montagem: sairia um arquivo de 550 KB com cara de pronto.

   O falso exporta `DONO_FALSO`; o real não exporta nada parecido. */
const cliente = readFileSync("src/lib/supabase.ts", "utf8");
if (!cliente.includes("DONO_FALSO")) {
  throw new Error(
    "src/lib/supabase.ts é o cliente DE VERDADE.\n" +
      "A demonstração precisa do falso — sem ele, a página publicada tentaria\n" +
      "falar com o banco real. Rode antes:\n\n" +
      "  cp scripts/teste-navegador/supabase-falso.ts src/lib/supabase.ts\n"
  );
}

export default defineConfig({
  define: { __VERSAO__: JSON.stringify("demonstração") },
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "dist-demo",
    rollupOptions: { input: "index.demo.html" },
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});
