import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Barreira de erro: quando alguma tela quebra, mostra o que houve em vez de
 * deixar a página em branco.
 *
 * Tela branca é o pior resultado possível para quem está do outro lado: não
 * dá para agir, não dá para relatar, e quem está ajudando fica adivinhando.
 * Aqui a mensagem do erro aparece em texto selecionável, para poder ser
 * copiada ou fotografada.
 */
interface Estado {
  erro: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { erro: null };

  static getDerivedStateFromError(erro: Error): Estado {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error("Erro na interface:", erro, info.componentStack);
  }

  render() {
    if (!this.state.erro) return this.props.children;

    return (
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 20px" }}>
        <div className="card">
          <h1 style={{ marginTop: 0, fontSize: "1.4rem" }}>Alguma coisa quebrou nesta tela</h1>
          <p className="muted">
            O erro está escrito abaixo. Se você estiver configurando o app, ele costuma dizer exatamente o que
            falta.
          </p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "var(--color-bg-soft)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              padding: 14,
              fontSize: "0.82rem",
              userSelect: "text",
            }}
          >
            {this.state.erro.message}
          </pre>
          <button className="btn btn-primary btn-block" onClick={() => window.location.reload()}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }
}
