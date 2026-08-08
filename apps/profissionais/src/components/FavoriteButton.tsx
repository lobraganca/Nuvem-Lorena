import { useEffect, useState } from "react";
import { addFavorite, removeFavorite } from "../lib/professionals";
import { useAuth } from "../lib/useAuth";

interface FavoriteButtonProps {
  professionalId: string;
  initialFavorited?: boolean;
  size?: "small" | "large";
}

/** Coração de favoritar. Só aparece funcional para usuário logado. */
export function FavoriteButton({ professionalId, initialFavorited = false, size = "small" }: FavoriteButtonProps) {
  const { user } = useAuth();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [saving, setSaving] = useState(false);

  useEffect(() => setFavorited(initialFavorited), [initialFavorited]);

  if (!user) return null;

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user || saving) return;
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
      aria-label={favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
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
