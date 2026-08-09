import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addFavorite, removeFavorite } from "../lib/professionals";
import { useAuth } from "../lib/useAuth";
import { guardarDestinoLogin } from "../lib/auth";

interface FavoriteButtonProps {
  professionalId: string;
  initialFavorited?: boolean;
  size?: "small" | "large";
}

/**
 * Coração de favoritar.
 *
 * Aparece para todo mundo, inclusive quem não entrou. Antes ele sumia para
 * quem estava deslogado: a pessoa não favoritava e também não descobria que
 * podia — e favoritar é justamente o melhor motivo para criar conta, porque
 * é o momento em que ela quer guardar alguém para depois.
 *
 * Sem login, o toque leva para a tela de entrar e guarda o caminho de volta,
 * para a pessoa voltar exatamente ao perfil que estava olhando.
 */
export function FavoriteButton({ professionalId, initialFavorited = false, size = "small" }: FavoriteButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [saving, setSaving] = useState(false);

  useEffect(() => setFavorited(initialFavorited), [initialFavorited]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      guardarDestinoLogin(window.location.pathname);
      navigate("/login");
      return;
    }
    if (saving) return;
    setSaving(true);
    const next = !favorited;
    setFavorited(next);
    try {
      if (next) {
        await addFavorite(user.id, professionalId);
      } else {
        await removeFavorite(user.id, professionalId);
      }
    } catch {
      setFavorited(!next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        !user
          ? "Entrar para guardar nos favoritos"
          : favorited
            ? "Remover dos favoritos"
            : "Adicionar aos favoritos"
      }
      title={!user ? "Entre para guardar este profissional" : undefined}
      className="btn btn-outline"
      style={{
        fontSize: size === "large" ? "1.1rem" : "0.9rem",
        padding: size === "large" ? "8px 14px" : "4px 10px",
        lineHeight: 1,
        color: favorited ? "var(--color-primary)" : undefined,
      }}
    >
      {favorited ? "♥" : "♡"}
    </button>
  );
}
