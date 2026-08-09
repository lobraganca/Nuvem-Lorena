import { useEffect, useState } from "react";
import { useAuth } from "../lib/useAuth";
import { isAdmin } from "../lib/admin";
import { verificarConfiguracao, type EstadoItem, type ItemConfig } from "../lib/configuracao";

/**
 * Painel de configuração, em `/configuracao` (só para administradoras).
 *
 * A configuração deste app mora em cinco lugares — banco, storage, funções de
 * servidor, segredos e painéis de terceiros — e nada avisa quando falta uma
 * peça: a tela para de funcionar num canto só, às vezes semanas depois, e
 * quem descobre é o usuário.
 *
 * Cada linha aqui é uma pergunta feita ao servidor de verdade. O que não dá
 * para verificar de fora aparece como "conferir à mão", nunca como aprovado:
 * dizer "ok" sem ter checado é pior do que não checar, porque cria confiança
 * onde não há informação.
 */
const CORES: Record<EstadoItem, { rotulo: string; classe: string }> = {
  ok: { rotulo: "Pronto", classe: "cfg-ok" },
  faltando: { rotulo: "Falta fazer", classe: "cfg-falta" },
  manual: { rotulo: "Conferir à mão", classe: "cfg-manual" },
  checando: { rotulo: "Verificando…", classe: "cfg-manual" },
};

export function ConfiguracaoPage() {
  const { user, loading } = useAuth();
  const [admin, setAdmin] = useState(false);
  const [checando, setChecando] = useState(true);
  const [itens, setItens] = useState<ItemConfig[]>([]);

  async function recarregar() {
    setChecando(true);
    try {
      setItens(await verificarConfiguracao());
    } finally {
      setChecando(false);
    }
  }

  useEffect(() => {
    if (!user) {
      setChecando(false);
      return;
    }
    isAdmin(user.id).then(async (ok) => {
      setAdmin(ok);
      if (ok) await recarregar();
      else setChecando(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || (checando && itens.length === 0)) {
    return <div className="container" style={{ paddingTop: 40 }}>Verificando a configuração…</div>;
  }
  if (!user || !admin) {
    return <div className="container" style={{ paddingTop: 40 }}><p>Acesso restrito.</p></div>;
  }

  const faltando = itens.filter((i) => i.estado === "faltando");
  const manuais = itens.filter((i) => i.estado === "manual");
  const grupos = [...new Set(itens.map((i) => i.grupo))];

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <div className="secao-topo">
        <h1 style={{ margin: 0 }}>Configuração</h1>
        <button className="btn btn-outline" onClick={recarregar} disabled={checando}>
          {checando ? "Verificando…" : "Verificar de novo"}
        </button>
      </div>

      {/* O resumo vem antes da lista: quem abre esta tela quer saber se pode
          ir dormir tranquila, não ler dezoito linhas. */}
      <div className="card" style={{ marginBottom: 20 }}>
        {faltando.length === 0 ? (
          <p style={{ margin: 0 }}>
            <strong>Nada faltando no que dá para verificar daqui.</strong> Restam {manuais.length} itens que só
            você consegue conferir, listados abaixo.
          </p>
        ) : (
          <>
            <p style={{ margin: "0 0 8px" }}>
              <strong>
                {faltando.length} {faltando.length === 1 ? "item falta" : "itens faltam"}
              </strong>{" "}
              — e cada um deles quebra alguma coisa hoje:
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
              {faltando.map((i) => (
                <li key={i.id} style={{ fontSize: "0.9rem" }}>
                  {i.titulo}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {grupos.map((grupo) => (
        <section key={grupo} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: "1.05rem" }}>{grupo}</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {itens
              .filter((i) => i.grupo === grupo)
              .map((item) => (
                <div key={item.id} className="card cfg-item">
                  <div className="cfg-linha">
                    <strong>{item.titulo}</strong>
                    <span className={`cfg-selo ${CORES[item.estado].classe}`}>
                      {CORES[item.estado].rotulo}
                    </span>
                  </div>
                  {/* A consequência aparece só quando falta: para o que já
                      está pronto, ela seria susto sem motivo. */}
                  {item.estado !== "ok" && (
                    <>
                      <p className="muted cfg-texto">{item.consequencia}</p>
                      <p className="cfg-texto">
                        <strong>Como resolver:</strong> {item.comoResolver}
                      </p>
                    </>
                  )}
                  {item.detalhe && <p className="muted cfg-texto">{item.detalhe}</p>}
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
