import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { registrarTipoDeUsuario, marcarOnboardingCompleto } from "../lib/company";
import { mensagemDeErro } from "../lib/erros";
import { IconeInicio } from "../components/IconesInicio";

/**
 * Primeira página após login/criar conta: escolhe se é profissional ou empresa.
 *
 * Depois disso:
 * - Profissional → CadastroPage (nome, foto, serviço, bairro, etc)
 * - Empresa → CadastroEmpresaPage (razão social, CNPJ, endereço, etc)
 */
export function OnboardingTipoPage() {
  useTituloDaPagina("Qual é seu tipo de conta?");
  const navegar = useNavigate();
  const { user, loading } = useAuth();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navegar("/login", { replace: true });
    }
  }, [user, loading, navegar]);

  async function escolherProfissional() {
    if (!user) return;
    setEnviando(true);
    setErro("");

    try {
      await registrarTipoDeUsuario(user.id, "professional");
      await marcarOnboardingCompleto(user.id);
      // Vai para cadastro de profissional
      navegar("/painel/novo", { replace: true });
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível continuar."));
      setEnviando(false);
    }
  }

  async function escolherEmpresa() {
    if (!user) return;
    setEnviando(true);
    setErro("");

    try {
      await registrarTipoDeUsuario(user.id, "company");
      // Vai para cadastro de empresa (não marca completo ainda)
      navegar("/cadastro-empresa", { replace: true });
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível continuar."));
      setEnviando(false);
    }
  }

  if (loading) {
    return <div className="container" style={{ paddingTop: 48, textAlign: "center" }}>
      <span className="muted">Carregando…</span>
    </div>;
  }

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 32 }}>
      <h1 style={{ marginBottom: 8 }}>Qual é seu tipo de conta?</h1>
      <p className="muted" style={{ marginBottom: 32 }}>
        Escolha como você vai usar o Ei Itabirito e complete seu perfil.
      </p>

      {erro && (
        <p style={{ color: "var(--color-danger)", marginBottom: 16 }}>
          {erro}
        </p>
      )}

      <div style={{ display: "grid", gap: 16, marginBottom: 24 }}>
        {/* Profissional */}
        <button
          type="button"
          className="card"
          onClick={escolherProfissional}
          disabled={enviando}
          style={{
            padding: 20,
            textAlign: "left",
            cursor: "pointer",
            border: "2px solid transparent",
            transition: "all 0.2s ease",
            background: "var(--color-bg-card)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--color-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "transparent";
          }}
        >
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: "var(--color-primary-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconeInicio nome="maleta" tamanho={24} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: "0 0 4px 0" }}>Sou profissional</h3>
              <p className="muted" style={{ margin: 0, fontSize: "0.9em" }}>
                Encanador, eletricista, manicure, professor — apareça aqui e receba clientes.
              </p>
            </div>
            <span style={{ fontSize: 20, color: "var(--color-muted)" }}>›</span>
          </div>
        </button>

        {/* Empresa/Contratante */}
        <button
          type="button"
          className="card"
          onClick={escolherEmpresa}
          disabled={enviando}
          style={{
            padding: 20,
            textAlign: "left",
            cursor: "pointer",
            border: "2px solid transparent",
            transition: "all 0.2s ease",
            background: "var(--color-bg-card)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--color-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "transparent";
          }}
        >
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: "var(--color-primary-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconeInicio nome="lupa" tamanho={24} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: "0 0 4px 0" }}>Sou empresa/contratante</h3>
              <p className="muted" style={{ margin: 0, fontSize: "0.9em" }}>
                Preciso de profissionais: vendedora, recepcionista, eletricista — busque aqui.
              </p>
            </div>
            <span style={{ fontSize: 20, color: "var(--color-muted)" }}>›</span>
          </div>
        </button>
      </div>

      <p className="muted" style={{ fontSize: "0.9em", textAlign: "center" }}>
        Você pode mudar de ideia depois, mas preencha seu tipo principal primeiro.
      </p>
    </div>
  );
}
