import { useEffect, useState } from "react";
import { getSession } from "../lib/auth";
import { problemaDeConfiguracao } from "../lib/supabase";
import { passosDaAtualizacao } from "../lib/atualizacao";
import { useTituloDaPagina } from "../lib/tituloDaPagina";

/**
 * Tela de diagnóstico do login, em `/diagnostico`.
 *
 * Existe porque depurar um login à distância virou adivinhação: da tela de
 * fora, "o Google recusou", "entrou e foi para o lugar errado" e "entrou e a
 * sessão não ficou" são indistinguíveis — e cada palpite errado custa uma
 * rodada inteira de quem está do outro lado.
 *
 * Aqui cada pergunta que importa vira uma linha respondida: em que endereço o
 * app está rodando, se ele acha a configuração do banco, se existe sessão, de
 * quem ela é, e se o navegador deixa guardar coisas. Não é tela de usuário —
 * não tem link para ela em lugar nenhum, só o endereço direto.
 *
 * Nada de segredo aparece: o token não é mostrado, apenas se ele existe.
 */
function testaArmazenamento(): string {
  try {
    const chave = "__teste_armazenamento__";
    window.localStorage.setItem(chave, "1");
    const leu = window.localStorage.getItem(chave) === "1";
    window.localStorage.removeItem(chave);
    return leu ? "funciona" : "não guarda (leitura falhou)";
  } catch (err) {
    return `bloqueado (${err instanceof Error ? err.name : "erro"})`;
  }
}

function Linha({ rotulo, valor, ok }: { rotulo: string; valor: string; ok?: boolean }) {
  return (
    <div style={{ display: "grid", gap: 2, padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
      <span className="muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {rotulo}
      </span>
      <span
        style={{
          fontSize: "0.9rem",
          wordBreak: "break-all",
          userSelect: "text",
          color: ok === undefined ? undefined : ok ? "#1c6b3f" : "var(--color-danger)",
          fontWeight: ok === false ? 700 : 400,
        }}
      >
        {valor}
      </span>
    </div>
  );
}

export function DiagnosticoPage() {
  useTituloDaPagina("Diagnóstico");
  const [sessao, setSessao] = useState<string>("consultando…");
  const [email, setEmail] = useState<string>("—");
  const [expira, setExpira] = useState<string>("—");

  useEffect(() => {
    getSession()
      .then((s) => {
        if (!s) {
          setSessao("NÃO — nenhuma sessão guardada");
          return;
        }
        setSessao("SIM — sessão ativa");
        setEmail(s.user.email ?? "(sem e-mail)");
        setExpira(s.expires_at ? new Date(s.expires_at * 1000).toLocaleString("pt-BR") : "—");
      })
      .catch((err) => setSessao(`erro ao consultar: ${err?.message ?? err}`));
  }, []);

  const problema = problemaDeConfiguracao();
  const chavesSupabase = (() => {
    try {
      return Object.keys(window.localStorage).filter((k) => k.startsWith("sb-")).join(", ") || "nenhuma";
    } catch {
      return "não deu para ler";
    }
  })();

  const passos = passosDaAtualizacao();

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 60, maxWidth: 560 }}>
      <h1 style={{ fontSize: "1.3rem" }}>Diagnóstico do login</h1>
      <p className="muted">Tire uma foto desta tela inteira e mande na conversa.</p>

      <div className="card">
        {/* Conferia os endereços do procurô, de onde este código veio: no
            Ei Itabirito a linha ficava VERMELHA no endereço certo, que é o
            pior estado possível de uma tela de diagnóstico — ela manda
            procurar defeito onde não há. */}
        <Linha
          rotulo="Endereço"
          valor={window.location.host}
          ok={window.location.host === "www.empregoitabirito.com.br"}
        />
        <Linha rotulo="Configuração do banco" valor={problema ?? "OK"} ok={!problema} />
        <Linha rotulo="Tem sessão?" valor={sessao} ok={sessao.startsWith("SIM")} />
        <Linha rotulo="Conta" valor={email} />
        <Linha rotulo="Sessão expira em" valor={expira} />
        <Linha rotulo="Guardar dados no navegador" valor={testaArmazenamento()} />
        <Linha rotulo="Chaves do Supabase guardadas" valor={chavesSupabase} />
        <Linha rotulo="Versão" valor={__VERSAO__} />
      </div>

      {/* "Não apareceu aviso de versão nova" tem meia dúzia de causas — sem
          rede, service worker não registrado, navegador entregando o arquivo
          guardado — e nenhuma delas se distingue olhando a tela. Aqui fica o
          rastro das últimas checagens. */}
      <h2 style={{ fontSize: "1rem", marginTop: 24 }}>Checagem de versão nova</h2>
      <div className="card">
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: "0.82rem", display: "grid", gap: 4 }}>
          {passos.length === 0 && <li className="muted">Nenhuma checagem ainda.</li>}
          {passos.map((passo, i) => (
            <li key={i}>{passo}</li>
          ))}
        </ol>
      </div>

      <p className="muted" style={{ fontSize: "0.82rem", marginTop: 14 }}>
        Nenhuma senha ou token aparece aqui — só se existem.
      </p>
    </div>
  );
}
