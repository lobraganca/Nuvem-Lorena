import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { signInWithGoogle, signOut } from "../lib/auth";
import { hasDatabase } from "../lib/supabase";
import { getProfile } from "../lib/profiles";
import { isAdmin } from "../lib/admin";
import { resetOnboarding } from "../lib/onboarding";
import { excluirMinhaConta } from "../lib/account";
import { BottomSheet } from "../components/BottomSheet";
import { InstalarApp } from "../components/InstalarApp";
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
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [textoConfirmacao, setTextoConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState("");

  async function handleExcluirConta() {
    setExcluindo(true);
    setErroExclusao("");
    try {
      await excluirMinhaConta();
      // Depois de apagar, não há para onde voltar dentro da conta.
      window.location.href = "/inicio";
    } catch (err) {
      setErroExclusao(err instanceof Error ? err.message : "Não foi possível apagar a conta.");
      setExcluindo(false);
    }
  }

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
      await signInWithGoogle("/perfil");
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
        <InstalarApp />
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

      {/* Separado de "Sair da conta" por espaço e por peso visual: são ações
          vizinhas com consequências muito diferentes, e trocar uma pela outra
          por engano seria irreversível. */}
      <button
        type="button"
        className="link-perigo"
        onClick={() => {
          setTextoConfirmacao("");
          setErroExclusao("");
          setConfirmarExclusao(true);
        }}
      >
        Excluir minha conta
      </button>

      {confirmarExclusao && (
        <BottomSheet
          title="Excluir minha conta"
          subtitle="Esta ação não tem volta."
          onClose={() => setConfirmarExclusao(false)}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <p style={{ margin: 0 }}>Vão ser apagados para sempre:</p>
            <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }} className="muted">
              <li>seus anúncios e as avaliações que você recebeu neles</li>
              <li>as avaliações que você escreveu sobre outros profissionais</li>
              <li>seus favoritos e seu cadastro</li>
            </ul>
            <p className="muted" style={{ margin: 0, fontSize: "0.86rem" }}>
              Os pedidos de contato que você enviou continuam com os profissionais, sem o vínculo com a sua
              conta — eles precisam do seu recado para poder te retornar.
            </p>
            <p className="muted" style={{ margin: 0, fontSize: "0.86rem" }}>
              Se você tem assinatura ativa, cancele antes pelo Mercado Pago: apagar a conta aqui não cancela a
              cobrança lá.
            </p>

            <label style={{ display: "grid", gap: 6, fontSize: "0.88rem" }}>
              Para confirmar, escreva <strong>EXCLUIR</strong> abaixo:
              <input
                value={textoConfirmacao}
                onChange={(e) => setTextoConfirmacao(e.target.value.toUpperCase())}
                placeholder="EXCLUIR"
                autoComplete="off"
              />
            </label>

            {erroExclusao && <p style={{ color: "var(--color-danger)", margin: 0 }}>{erroExclusao}</p>}

            <div style={{ display: "grid", gap: 10 }}>
              <button
                className="btn btn-danger-forte btn-block"
                disabled={textoConfirmacao !== "EXCLUIR" || excluindo}
                onClick={handleExcluirConta}
              >
                {excluindo ? "Apagando…" : "Apagar minha conta para sempre"}
              </button>
              <button className="btn btn-outline btn-block" onClick={() => setConfirmarExclusao(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
