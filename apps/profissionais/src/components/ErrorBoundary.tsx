import { Component, type ErrorInfo, type ReactNode } from "react";
import { pareceArquivoDesatualizado, recarregarDoZero } from "../lib/importarPagina";
import { ehAppDaLoja } from "../lib/plataforma";

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

    /* Este é o erro específico de um app instalado com arquivo antigo
       guardado (ver lib/importarPagina.ts). Um `reload()` comum não
       resolve: quem serve a página é o próprio service worker, e ele
       devolveria a mesma cópia velha de novo — foi o que aconteceu com
       quem tocou em "Tentar de novo" e viu o mesmo erro se repetir. Aqui
       o botão também descarta o service worker e o que ele guardou antes
       de recarregar, então desta vez busca a versão atual de verdade. */
    const eArquivoAntigo = pareceArquivoDesatualizado(this.state.erro.message);

    return (
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 20px" }}>
        <div className="card">
          <h1 style={{ marginTop: 0, fontSize: "1.4rem" }}>
            {eArquivoAntigo ? "Tem uma versão mais nova do app" : "Alguma coisa quebrou nesta tela"}
          </h1>
          <p className="muted">
            {eArquivoAntigo
              ? "O aparelho ficou com uma cópia antiga guardada. Toque abaixo para buscar a versão atual."
              : "O erro está escrito abaixo. Se você estiver configurando o app, ele costuma dizer exatamente o que falta."}
          </p>
          {!eArquivoAntigo && (
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
          )}
          <button
            className="btn btn-primary btn-block"
            onClick={() => (eArquivoAntigo ? recarregarDoZero() : window.location.reload())}
          >
            {eArquivoAntigo ? "Buscar versão atual" : "Tentar de novo"}
          </button>
          {eArquivoAntigo && (
            /* Reforço para quando o botão acima não resolve sozinho: em
               alguns navegadores o service worker demora a soltar o
               controle mesmo depois de cancelado, e a pessoa toca de novo
               e vê o mesmo erro. Reinstalar sempre busca tudo do zero,
               então é o caminho que não depende de o navegador cooperar. */
            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: "1px solid var(--color-border)",
                fontSize: "0.86rem",
                color: "var(--color-text-muted)",
              }}
            >
              {/* Duas receitas, porque reinstalar não é a mesma coisa nos dois
                  lugares — e a receita errada é pior que nenhuma: manda a
                  pessoa procurar um botão que a tela dela não tem.

                  No app da Play Store não existe "Instalar App" nem site
                  para abrir; quem reinstala vai à loja. Escrever
                  "acesse eiitabirito.com.br" ali também seria mandar sair do
                  app para resolver um problema do app. */}
              {ehAppDaLoja() ? (
                <>
                  <p style={{ margin: "0 0 8px" }}>
                    Se o botão não resolver, feche o Ei Itabirito de vez e abra de novo:
                  </p>
                  <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>
                    <li>Abra a tela de aplicativos recentes do seu celular.</li>
                    <li>Empurre o Ei Itabirito para fora e solte.</li>
                    <li>Abra o Ei Itabirito pelo ícone de novo.</li>
                  </ol>
                </>
              ) : (
                <>
                  <p style={{ margin: "0 0 8px" }}>
                    Se o botão não resolver, reinstale o app — é rápido:
                  </p>
                  <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>
                    <li>Toque e segure o ícone do Ei Itabirito na tela e remova-o.</li>
                    <li>
                      Abra o navegador e acesse <strong>eiitabirito.com.br</strong>.
                    </li>
                    <li>Toque em "Instalar App" no topo da tela.</li>
                  </ol>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}
