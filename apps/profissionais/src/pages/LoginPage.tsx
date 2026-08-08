import { useState } from "react";
import { signInWithGoogle } from "../lib/auth";
import { hasDatabase } from "../lib/supabase";

export function LoginPage() {
  const [error, setError] = useState("");

  async function handleGoogleLogin() {
    setError("");
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar o login.");
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 60, textAlign: "center" }}>
      <h1>Entrar</h1>
      <p className="muted">Use sua conta Google para buscar, avaliar e anunciar seus serviços.</p>
      <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 20 }} onClick={handleGoogleLogin} disabled={!hasDatabase()}>
        Entrar com Google
      </button>
      {!hasDatabase() && <p className="muted" style={{ marginTop: 10 }}>Configure VITE_SUPABASE_URL/ANON_KEY e o provider Google no Supabase para habilitar o login.</p>}
      {error && <p style={{ color: "var(--color-danger)", marginTop: 10 }}>{error}</p>}
    </div>
  );
}
