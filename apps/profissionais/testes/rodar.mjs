/**
 * Roda todos os testes de lógica deste diretório.
 *
 *   npm test
 *
 * Não há framework: o Node 22 executa TypeScript direto, e cada arquivo
 * `*.test.ts` importa o código de VERDADE do app (não uma cópia). Ver
 * `ajuda.ts`.
 *
 * Os testes de banco são outros e rodam em `supabase/testes/` — eles
 * precisam de um Postgres, estes não precisam de nada.
 */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const aqui = dirname(fileURLToPath(import.meta.url));
const arquivos = readdirSync(aqui).filter((f) => f.endsWith(".test.ts")).sort();

let falhou = false;
for (const arquivo of arquivos) {
  console.log(`\n═══ ${arquivo}`);
  const r = spawnSync(process.execPath, ["--experimental-strip-types", join(aqui, arquivo)], {
    stdio: "inherit",
  });
  if (r.status !== 0) falhou = true;
}

console.log(falhou ? "\nALGUM TESTE FALHOU" : `\nTodos passaram (${arquivos.length} arquivos).`);
process.exit(falhou ? 1 : 0);
