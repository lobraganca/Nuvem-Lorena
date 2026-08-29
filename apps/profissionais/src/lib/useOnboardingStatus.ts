import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { obterTipoDeUsuario } from "./company";

/**
 * Hook que verifica o status de onboarding do usuário.
 *
 * Retorna:
 * - null: carregando
 * - "profissional" / "empresa": tipo registrado
 * - false: não passou pelo onboarding
 */
export function useOnboardingStatus(): "professional" | "company" | false | null {
  const { user, loading: carregandoAuth } = useAuth();
  const [tipo, setTipo] = useState<"professional" | "company" | false | null>(null);

  useEffect(() => {
    if (carregandoAuth || !user) {
      setTipo(null);
      return;
    }

    obterTipoDeUsuario(user.id).then((resultado) => {
      if (resultado) {
        setTipo(resultado);
      } else {
        setTipo(false);
      }
    });
  }, [user, carregandoAuth]);

  return tipo;
}
