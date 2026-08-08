/**
 * Junta todas as migrations num arquivo só, na ordem numérica.
 *
 * Existe para quem vai montar o banco pela primeira vez pelo SQL Editor do
 * Supabase: colar 23 arquivos na ordem certa é onde alguém erra ou desiste.
 * O arquivo gerado é descartável — a fonte da verdade continua sendo a pasta
 * `supabase/migrations/`. Rode `npm run sql:unico` depois de criar qualquer
 * migration nova.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "supabase/migrations";
const SAIDA = "supabase/banco-completo.sql";

const arquivos = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const partes = [
  `-- Busca Itabirito — banco completo, para montar o projeto do zero.
--
-- GERADO AUTOMATICAMENTE por scripts/gerar-sql-unico.mjs. Não edite à mão:
-- edite a migration correspondente em supabase/migrations/ e rode de novo
-- \`npm run sql:unico\`.
--
-- Como usar: abra o SQL Editor do seu projeto no Supabase, cole este arquivo
-- inteiro e rode uma vez. São ${arquivos.length} migrations, já na ordem certa.
--
-- Rodar de novo num banco que já tem os dados é seguro na maior parte (quase
-- tudo usa "if not exists" / "or replace"), mas não é o uso pretendido: para
-- um banco que já existe, aplique só a migration nova.
`,
];

for (const arquivo of arquivos) {
  partes.push(
    `\n\n-- ═══════════════════════════════════════════════════════════════\n` +
      `-- ${arquivo}\n` +
      `-- ═══════════════════════════════════════════════════════════════\n\n` +
      readFileSync(join(DIR, arquivo), "utf8").trimEnd()
  );
}

writeFileSync(SAIDA, partes.join("") + "\n");
console.log(`${SAIDA} gerado a partir de ${arquivos.length} migrations.`);
