import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { consumirDestinoLogin } from "../lib/auth";

/**
 * Leva a pessoa de volta para onde ela estava quando pediu para entrar.
 *
 * O caminho normal seria o `redirectTo` do OAuth, mas ele depende de a URL
 * estar cadastrada na lista de endereços permitidos do projeto Supabase.
 * Fora dela, o Supabase ignora o pedido em silêncio e devolve todo mundo na
 * raiz — foi por isso que "Quero ser encontrado" continuava caindo na busca
 * mesmo depois de o destino ser informado no login.
 *
 * Aqui o destino vem do próprio aparelho, guardado antes de sair para o
 * Google. Funciona mesmo com a lista mal configurada, e nada se perde quando
 * ela estiver certa: o destino é consumido uma vez e apagado.
 *
 * Só age quando existe sessão. Um destino guardado por um login que a pessoa
 * abandonou no meio fica ali até o próximo login dela — nunca sequestra a
 * navegação de quem está apenas usando o app.
 */
export function RetomarDestinoLogin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    const destino = consumirDestinoLogin();
    if (!destino) return;
    if (window.location.pathname === destino) return;
    navigate(destino, { replace: true });
  }, [user, loading, navigate]);

  return null;
}
