import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PILARES, caminho, chaveDoCampo } from "../dados/metodo";
import { ler, respondido, trocarTudo, type Respostas } from "../lib/guardar";
import { contarTudo, porcento } from "../lib/progresso";
import { useRespostas } from "../lib/useRespostas";
import { Barra } from "../componentes/Menu";

export function Relatorio() {
  const respostas = useRespostas();
  const tudo = contarTudo(respostas);
  const [recado, setRecado] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);

  async function copiar() {
    const texto = emTexto(respostas);
    try {
      await navigator.clipboard.writeText(texto);
      setRecado("Copiado. É só colar onde você quiser.");
    } catch {
      // Sem permissão de área de transferência (acontece em navegador de
      // dentro de aplicativo). Em vez de não fazer nada, baixa o arquivo.
      baixar("mapa-digital.md", texto, "text/markdown");
      setRecado("O navegador não deixou copiar, então baixei o arquivo.");
    }
  }

  function baixarCopia() {
    baixar(
      `mapa-digital-copia-${hoje()}.json`,
      JSON.stringify(ler(), null, 2),
      "application/json",
    );
    setRecado("Cópia baixada. Guarde esse arquivo fora do celular.");
  }

  async function restaurar(lista: FileList | null) {
    const escolhido = lista?.[0];
    if (!escolhido) return;
    try {
      const lido = JSON.parse(await escolhido.text()) as Respostas;
      if (typeof lido !== "object" || lido === null || Array.isArray(lido)) {
        throw new Error("não é um mapa");
      }
      trocarTudo(lido);
      setRecado("Cópia restaurada.");
    } catch {
      setRecado("Esse arquivo não é uma cópia do mapa. Nada foi trocado.");
    } finally {
      // Sem isto, escolher o MESMO arquivo de novo não dispara nada, e parece
      // que o botão quebrou.
      if (arquivo.current) arquivo.current.value = "";
    }
  }

  return (
    <article className="tela">
      <header className="tela-topo">
        <p className="sobrenome">O mapa inteiro</p>
        <h1>Tudo o que você respondeu</h1>
        <div className="progresso-da-etapa">
          <Barra fracao={porcento(tudo)} />
          <span>
            {tudo.feitos}/{tudo.total}
          </span>
        </div>
      </header>

      <div className="acoes">
        <button type="button" className="botao" onClick={copiar}>
          Copiar tudo
        </button>
        <button
          type="button"
          className="botao-vazado"
          onClick={() => baixar("mapa-digital.md", emTexto(respostas), "text/markdown")}
        >
          Baixar como texto
        </button>
        <button type="button" className="botao-vazado" onClick={baixarCopia}>
          Baixar cópia de segurança
        </button>
        <button
          type="button"
          className="botao-vazado"
          onClick={() => arquivo.current?.click()}
        >
          Restaurar cópia
        </button>
        <input
          ref={arquivo}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(evento) => void restaurar(evento.target.files)}
        />
      </div>

      {recado && <p className="recado">{recado}</p>}

      {PILARES.map((pilar) => (
        <section key={pilar.numero} className="bloco-do-relatorio">
          <h2>
            <span className="numero">{pilar.numero}</span> {pilar.nome}
          </h2>

          {pilar.etapas.map((etapa) => (
            <div key={etapa.slug} className="etapa-do-relatorio">
              <h3>
                <Link to={caminho(pilar, etapa)}>{etapa.nome}</Link>
              </h3>
              <dl>
                {etapa.campos.map((campo) => {
                  const valor = respostas[chaveDoCampo(pilar, etapa, campo)];
                  return (
                    <div key={campo.id}>
                      <dt>{campo.pergunta}</dt>
                      {respondido(valor) ? (
                        <dd>{valor}</dd>
                      ) : (
                        <dd className="em-branco">
                          — em branco{" "}
                          <Link to={caminho(pilar, etapa)}>responder</Link>
                        </dd>
                      )}
                    </div>
                  );
                })}
              </dl>
            </div>
          ))}
        </section>
      ))}

      <p className="aviso">
        Isto vive no navegador deste aparelho. Trocou de celular, limpou o
        histórico ou abriu numa janela anônima: não está lá. A cópia de
        segurança é o que atravessa.
      </p>
    </article>
  );
}

/** O mapa em texto corrido, para colar em qualquer lugar. */
function emTexto(respostas: Respostas): string {
  const linhas: string[] = ["# Mapa Digital", ""];
  for (const pilar of PILARES) {
    linhas.push(`## Pilar ${pilar.numero} — ${pilar.nome}`, "");
    for (const etapa of pilar.etapas) {
      linhas.push(`### ${etapa.nome}`, "");
      for (const campo of etapa.campos) {
        const valor = respostas[chaveDoCampo(pilar, etapa, campo)];
        linhas.push(`**${campo.pergunta}**`, "");
        linhas.push(respondido(valor) ? valor.trim() : "_(em branco)_", "");
      }
    }
  }
  return linhas.join("\n");
}

function baixar(nome: string, conteudo: string, tipo: string): void {
  const endereco = URL.createObjectURL(new Blob([conteudo], { type: `${tipo};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = endereco;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(endereco);
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}
