import { createClient } from "@supabase/supabase-js";

const url = (process.env.VITE_SUPABASE_URL ?? "").trim();
const key = (process.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

console.log("\n" + "=".repeat(70));
console.log("📊 CONTAGEM DE USUÁRIOS E PROFISSIONAIS - PROCURÔ");
console.log("=".repeat(70));

if (!url || !key) {
  console.error("\n❌ Credenciais não encontradas!");
  console.error("   Configure as variáveis de ambiente:");
  console.error("   VITE_SUPABASE_URL=https://seu-projeto.supabase.co");
  console.error("   VITE_SUPABASE_ANON_KEY=sua-chave-aqui\n");
  process.exit(1);
}

const client = createClient(url, key);

async function contar() {
  try {
    console.log("\n🔄 Consultando banco de dados...\n");

    // Conta usuários (perfis)
    const { count: usuariosCount, error: usuariosError } = await client
      .from("profiles")
      .select("id", { count: "exact", head: true });

    if (usuariosError) throw usuariosError;

    // Conta profissionais
    const { count: profissionaisCount, error: profError } = await client
      .from("professionals_public")
      .select("id", { count: "exact", head: true });

    if (profError) throw profError;

    // Tenta contar avaliações
    const { count: avaliacoesCount, error: avalError } = await client
      .from("reviews")
      .select("id", { count: "exact", head: true });

    if (avalError) throw avalError;

    // Exibe resultados
    console.log("✅ RESULTADOS:\n");
    console.log(`   📱 Usuários cadastrados:      ${usuariosCount ?? 0}`);
    console.log(`   💼 Profissionais cadastrados: ${profissionaisCount ?? 0}`);
    console.log(`   ⭐ Avaliações realizadas:     ${avaliacoesCount ?? 0}`);
    console.log("\n" + "=".repeat(70));
    console.log("");

  } catch (err) {
    console.error("\n❌ Erro:", err instanceof Error ? err.message : err);
    console.error("\nVerifique se:");
    console.error("  • A URL do Supabase está correta");
    console.error("  • A chave de acesso é válida");
    console.error("  • A conexão com a internet está funcionando\n");
    process.exit(1);
  }
}

contar();
