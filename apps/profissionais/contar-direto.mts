import { createClient } from "@supabase/supabase-js";

// Tenta usar variáveis de ambiente
const url = (process.env.VITE_SUPABASE_URL ?? "").trim();
const key = (process.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

console.log("=".repeat(60));
console.log("🔍 Verificando credenciais do Supabase...");
console.log("=".repeat(60));

if (!url || !key) {
  console.error("\n❌ Credenciais não encontradas!");
  console.error("   Variáveis de ambiente esperadas:");
  console.error("   - VITE_SUPABASE_URL");
  console.error("   - VITE_SUPABASE_ANON_KEY");
  console.error("\n   Por favor, configure um arquivo .env.local com:");
  console.error("   VITE_SUPABASE_URL=https://seu-projeto.supabase.co");
  console.error("   VITE_SUPABASE_ANON_KEY=sua-chave-aqui\n");
  process.exit(1);
}

console.log(`✓ URL: ${url}`);
console.log(`✓ Chave: ${key.substring(0, 20)}...`);

// Cria cliente Supabase
const client = createClient(url, key);

async function contarProfissionais() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 Contando profissionais cadastrados...");
  console.log("=".repeat(60));

  try {
    // Usa a mesma query que a função getEstatisticasPublicas
    const { count, error } = await client
      .from("professionals_public")
      .select("id", { count: "exact", head: true });

    if (error) {
      console.error("\n❌ Erro ao consultar banco de dados:");
      console.error(error.message);
      process.exit(1);
    }

    console.log(`\n✅ Profissionais cadastrados: ${count ?? 0}\n`);
    console.log("=".repeat(60));

  } catch (err) {
    console.error("\n❌ Erro inesperado:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

contarProfissionais();
