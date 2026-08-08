import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { signInWithGoogle, signOut } from "../lib/auth";
import { hasDatabase } from "../lib/supabase";
import { getProfile } from "../lib/profiles";
import { isAdmin } from "../lib/admin";
import { resetOnboarding } from "../lib/onboarding";
import type { Profile } from "../types/domain";

function initials(name: string | null, email: string | null | undefined): string {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function SettingsItem({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link to={to} className="settings-item">
      <span className="settings-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
      <span className="settings-arrow" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}

export function PerfilPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setAdmin(false);
      return;
    }
    getProfile(user.id).then(setProfile);
    isAdmin(user.id).then(setAdmin);
  }, [user]);

  async function handleGoogleLogin() {
    setError("");
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar o login.");
    }
  }

  if (loading) return null;

  if (!user) {
    return (
      <div className="container" style={{ maxWidth: 420, paddingTop: 60, textAlign: "center" }}>
        <div className="card">
          <h1 style={{ marginTop: 0 }}>Entrar</h1>
          <p className="muted">Use sua conta Google para buscar, avaliar e anunciar seus serviços.</p>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 20 }}
            onClick={handleGoogleLogin}
            disabled={!hasDatabase()}
          >
            Entrar com Google
          </button>
          {!hasDatabase() && (
            <p className="muted" style={{ marginTop: 10 }}>
              Configure VITE_SUPABASE_URL/ANON_KEY e o provider Google no Supabase para habilitar o login.
            </p>
          )}
          {error && <p style={{ color: "var(--color-danger)", marginTop: 10 }}>{error}</p>}
        </div>
      </div>
    );
  }

  const name = profile?.full_name ?? user.user_metadata?.full_name ?? null;
  const avatarUrl = profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null;

  return (
    <div className="container" style={{ maxWidth: 480, paddingTop: 32 }}>
      <div className="card" style={{ textAlign: "center" }}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            style={{ width: 88, height: 88, borderRadius: "50%", margin: "0 auto", objectFit: "cover" }}
          />
        ) : (
          <div className="profile-avatar">{initials(name, user.email)}</div>
        )}
        <h2 style={{ margin: "12px 0 2px" }}>{name || user.email}</h2>
        {name && <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>{user.email}</p>}
      </div>

      <p className="settings-group-title">Meus anúncios</p>
      <div className="settings-list">
        <SettingsItem to="/painel" icon="📋" label="Meus anúncios" />
        <SettingsItem to="/favoritos" icon="❤️" label="Meus favoritos" />
      </div>

      <p className="settings-group-title">Dados e segurança</p>
      <div className="settings-list">
        <SettingsItem to="/termos" icon="📄" label="Termos de uso" />
        <SettingsItem to="/como-funciona" icon="ℹ️" label="Como funciona" />
        <button
          type="button"
          className="settings-item"
          onClick={() => {
            resetOnboarding();
            navigate("/inicio");
          }}
        >
          <span className="settings-icon" aria-hidden="true">
            🧭
          </span>
          <span>Rever apresentação do app</span>
          <span className="settings-arrow" aria-hidden="true">
            ›
          </span>
        </button>
        {admin && <SettingsItem to="/admin" icon="🛡️" label="Painel administrativo" />}
      </div>

      <button
        className="btn btn-danger-soft btn-block"
        style={{ marginTop: 26 }}
        onClick={() => signOut()}
      >
        Sair da conta
      </button>
    </div>
  );
}
