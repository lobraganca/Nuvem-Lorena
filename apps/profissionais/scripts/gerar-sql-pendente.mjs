/**
 * Junta um intervalo de migrations num arquivo só, para colar no SQL Editor.
 *
 * Existe porque `banco-completo.sql` serve para montar um banco do zero, e o
 * banco dela já existe: rodar o arquivo inteiro num banco com dados é seguro
 * na maior parte, mas não é o uso pretendido, e "na maior parte" não é
 * garantia que se dê a quem vai colar sem ler.
 *
 * Uso: node scripts/gerar-sql-pendente.mjs 0028 0039
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [de, ate] = process.argv.slice(2);
if (!de || !ate) {
  console.error("Uso: node scripts/gerar-sql-pendente.mjs 0028 0039");
  process.exit(1);
}

const dir = "supabase/migrations";
const arquivos = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .filter((f) => f.slice(0, 4) >= de && f.slice(0, 4) <= ate)
  .sort();

const cabecalho = `-- Ei Itabirito — migrations ${de} a ${ate}, na ordem.
--
-- GERADO por scripts/gerar-sql-pendente.mjs. Não edite à mão.
--
-- Para um banco que JÁ EXISTE. Cole tudo no SQL Editor do Supabase e rode
-- uma vez só. São ${arquivos.length} migrations; a ordem importa, porque
-- várias recriam a mesma view acrescentando uma coluna de cada vez.
--
-- Rodar de novo é seguro: tudo aqui usa "if not exists" / "or replace" /
-- "drop ... if exists". O que não é seguro é rodar fora de ordem.
`;

const corpo = arquivos
  .map((f) => {
    const linha = "═".repeat(66);
    return `\n-- ${linha}\n-- ${f}\n-- ${linha}\n\n${readFileSync(join(dir, f), "utf8").trimEnd()}\n`;
  })
  .join("\n");

const saida = `supabase/pendente-${de}-a-${ate}.sql`;
writeFileSync(saida, cabecalho + corpo);
console.log(`${saida} gerado a partir de ${arquivos.length} migrations.`);
