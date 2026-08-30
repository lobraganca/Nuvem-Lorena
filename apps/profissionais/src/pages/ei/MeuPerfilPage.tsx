import { useState } from "react";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { Switch } from "../../components/ei/Switch";
import { CATEGORIES, MAX_FUNCOES } from "../../types/domain";

/**
 * O perfil de quem procura trabalho.
 *
 * Tela nova, escrita do zero no desenho do Ei — não é o CadastroPage do
 * procurô repintado. Aquele existe para montar uma VITRINE: foto grande,
 * texto de venda, lista de serviços, selo, destaque pago. Aqui a pergunta é
 * outra: "para que trabalho posso te chamar, e você está disponível?".
 *
 * A ordem das partes segue o que decide se a pessoa termina o cadastro:
 *
 *   1. Disponível — o estado que muda toda semana, então fica no topo, onde
 *      se troca sem rolar nada.
 *   2. Funções — o que faz a vaga chegar. Sem isto, nada mais importa.
 *   3. Contato — curto.
 *   4. Experiências e cursos — opcionais, recolhidos.
 *
 * O procurô pedia o inverso: foto e texto de apresentação primeiro, e o que
 * a pessoa faz lá pelo meio.
 */

/* Rascunho de tela: os dados ainda vêm do formulário e vão para o banco na
   próxima leva, junto com a migration das funções e dos cursos. O que está
   pronto aqui é o DESENHO, e é ele que precisava ser visto antes. */
type Experiencia = { empresa: string; cargo: string; inicio: string; fim: string };
type Curso = { nome: string; instituicao: string; ano: string };

export function MeuPerfilPage() {
  useTituloDaPagina("Meu perfil");

  const [disponivel, setDisponivel] = useState(true);
  const [oculto, setOculto] = useState(false);
  const [funcoes, setFuncoes] = useState<string[]>([]);
  const [experiencias, setExperiencias] = useState<Experiencia[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [busca, setBusca] = useState("");

  const cheio = funcoes.length >= MAX_FUNCOES;

  function alternar(f: string) {
    setFuncoes((atual) =>
      atual.includes(f) ? atual.filter((x) => x !== f) : cheio ? atual : [...atual, f]
    );
  }

  /* A lista inteira é longa demais para rolar atrás de uma função, e curta
     demais para justificar abrir outra tela. O campo de procurar resolve os
     dois: quem sabe o nome digita, quem não sabe rola. */
  const visiveis = busca.trim()
    ? CATEGORIES.filter((c) => c.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")))
    : CATEGORIES;

  return (
    <div className="ei">
      <div className="ei-tela">
        <div className="ei-topo">
          <div>
            <h1 className="ei-titulo-g">Meu perfil</h1>
            <p className="ei-apoio">É por ele que as vagas chegam até você.</p>
          </div>
        </div>

        {/* ── 1. Disponível ────────────────────────────────────────────
            No topo porque é o que muda toda semana. Quem arrumou emprego
            precisa desligar em dois toques, sem procurar. */}
        <div className="ei-lista" style={{ marginBottom: 8 }}>
          <div className="ei-cartao" style={{ padding: 0 }}>
            <Switch
              ligado={disponivel}
              onChange={setDisponivel}
              titulo={disponivel ? "Estou disponível" : "Não estou disponível"}
              descricao={
                disponivel
                  ? "Você recebe as vagas que combinam com você."
                  : "Você não recebe vaga nenhuma até ligar de novo."
              }
            />
          </div>

          <div className="ei-cartao" style={{ padding: 0 }}>
            <Switch
              ligado={oculto}
              onChange={setOculto}
              desabilitado={!disponivel}
              titulo="Não aparecer na lista"
              /* O texto muda com o estado porque a consequência é
                 diferente, e é ela que a pessoa precisa entender — não o
                 nome da opção. */
              descricao={
                oculto
                  ? "As empresas não te encontram procurando. Você continua recebendo as vagas."
                  : "Hoje as empresas podem te encontrar procurando na lista."
              }
            />
          </div>
        </div>

        {/* Este é o motivo de a opção existir, e dizê-lo evita a pergunta
           "por que eu esconderia meu perfil?". */}
        <p className="ei-apoio" style={{ margin: "0 0 8px", padding: "0 4px" }}>
          Quem está empregado e não quer ser encontrado pelo patrão pode se esconder
          da lista e continuar recebendo vaga.
        </p>

        {/* ── 2. Funções ───────────────────────────────────────────────── */}
        <h2 className="ei-secao">O que você aceita fazer</h2>
        <div className="ei-cartao">
          <p className="ei-apoio" style={{ marginBottom: 12 }}>
            Escolha até {MAX_FUNCOES}. É por aqui que a vaga te encontra —{" "}
            <strong>{funcoes.length} de {MAX_FUNCOES}</strong> marcadas.
          </p>

          <div className="ei-campo" style={{ marginBottom: 12 }}>
            <input
              type="search"
              placeholder="Procurar função"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Procurar função"
            />
          </div>

          {/* As marcadas sobem para o topo: com oito escolhidas no meio de
              oitenta, a pessoa perde de vista o que já marcou. */}
          {funcoes.length > 0 && (
            <div className="ei-chips" style={{ marginBottom: 12 }}>
              {funcoes.map((f) => (
                <button
                  key={f}
                  type="button"
                  className="ei-chip"
                  aria-pressed={true}
                  onClick={() => alternar(f)}
                >
                  {f} <span aria-hidden="true">✕</span>
                </button>
              ))}
            </div>
          )}

          <div className="ei-chips" style={{ maxHeight: 220, overflowY: "auto" }}>
            {visiveis
              .filter((c) => !funcoes.includes(c))
              .map((c) => (
                <button
                  key={c}
                  type="button"
                  className="ei-chip"
                  aria-pressed={false}
                  disabled={cheio}
                  onClick={() => alternar(c)}
                >
                  {c}
                </button>
              ))}
          </div>

          {cheio && (
            <p className="ei-apoio" style={{ marginTop: 10 }}>
              Você marcou as {MAX_FUNCOES}. Tire uma para pôr outra.
            </p>
          )}
        </div>

        {/* ── 3. Experiências ──────────────────────────────────────────── */}
        <h2 className="ei-secao">Onde você já trabalhou</h2>
        <div className="ei-cartao">
          {experiencias.length === 0 && (
            <p className="ei-apoio" style={{ marginBottom: 12 }}>
              Opcional. Empresas costumam chamar antes quem já fez o serviço.
            </p>
          )}

          <div style={{ display: "grid", gap: 16 }}>
            {experiencias.map((exp, i) => (
              <div key={i} style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="ei-apoio">{i + 1}ª experiência</span>
                  <button
                    type="button"
                    className="ei-btn ei-btn-texto"
                    style={{ minHeight: 0, padding: "0 4px" }}
                    onClick={() => setExperiencias((a) => a.filter((_, j) => j !== i))}
                  >
                    Tirar
                  </button>
                </div>

                <div className="ei-campo">
                  <label htmlFor={`empresa-${i}`}>Empresa</label>
                  <input
                    id={`empresa-${i}`}
                    value={exp.empresa}
                    placeholder="Construções Silva"
                    onChange={(e) =>
                      setExperiencias((a) =>
                        a.map((x, j) => (j === i ? { ...x, empresa: e.target.value } : x))
                      )
                    }
                  />
                </div>

                <div className="ei-campo">
                  <label htmlFor={`cargo-${i}`}>O que você fazia</label>
                  <input
                    id={`cargo-${i}`}
                    value={exp.cargo}
                    placeholder="Ajudante de pedreiro"
                    onChange={(e) =>
                      setExperiencias((a) =>
                        a.map((x, j) => (j === i ? { ...x, cargo: e.target.value } : x))
                      )
                    }
                  />
                </div>

                {/* Mês e ano, não dia: ninguém lembra o dia em que começou
                    num emprego de cinco anos atrás, e pedir o dia faz a
                    pessoa inventar ou desistir. */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div className="ei-campo">
                    <label htmlFor={`inicio-${i}`}>Começou</label>
                    <input
                      id={`inicio-${i}`}
                      type="month"
                      value={exp.inicio}
                      onChange={(e) =>
                        setExperiencias((a) =>
                          a.map((x, j) => (j === i ? { ...x, inicio: e.target.value } : x))
                        )
                      }
                    />
                  </div>
                  <div className="ei-campo">
                    <label htmlFor={`fim-${i}`}>Saiu</label>
                    <input
                      id={`fim-${i}`}
                      type="month"
                      value={exp.fim}
                      onChange={(e) =>
                        setExperiencias((a) =>
                          a.map((x, j) => (j === i ? { ...x, fim: e.target.value } : x))
                        )
                      }
                    />
                    <span className="ei-campo-ajuda">Vazio = ainda trabalho lá</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="ei-btn ei-btn-tonal ei-btn-largo"
            style={{ marginTop: experiencias.length ? 16 : 0 }}
            onClick={() =>
              setExperiencias((a) => [...a, { empresa: "", cargo: "", inicio: "", fim: "" }])
            }
          >
            + {experiencias.length ? "Outra experiência" : "Acrescentar experiência"}
          </button>
        </div>

        {/* ── 4. Cursos ────────────────────────────────────────────────── */}
        <h2 className="ei-secao">Cursos e especializações</h2>
        <div className="ei-cartao">
          {cursos.length === 0 && (
            <p className="ei-apoio" style={{ marginBottom: 12 }}>
              NR-35, curso técnico, CNH categoria D — o que te habilita a alguma vaga.
            </p>
          )}

          <div style={{ display: "grid", gap: 16 }}>
            {cursos.map((c, i) => (
              <div key={i} style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="ei-apoio">{i + 1}º curso</span>
                  <button
                    type="button"
                    className="ei-btn ei-btn-texto"
                    style={{ minHeight: 0, padding: "0 4px" }}
                    onClick={() => setCursos((a) => a.filter((_, j) => j !== i))}
                  >
                    Tirar
                  </button>
                </div>
                <div className="ei-campo">
                  <label htmlFor={`curso-${i}`}>Curso</label>
                  <input
                    id={`curso-${i}`}
                    value={c.nome}
                    placeholder="NR-35 — trabalho em altura"
                    onChange={(e) =>
                      setCursos((a) => a.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))
                    }
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 96px", gap: 8 }}>
                  <div className="ei-campo">
                    <label htmlFor={`inst-${i}`}>Onde fez</label>
                    <input
                      id={`inst-${i}`}
                      value={c.instituicao}
                      placeholder="SENAI"
                      onChange={(e) =>
                        setCursos((a) =>
                          a.map((x, j) => (j === i ? { ...x, instituicao: e.target.value } : x))
                        )
                      }
                    />
                  </div>
                  <div className="ei-campo">
                    <label htmlFor={`ano-${i}`}>Ano</label>
                    <input
                      id={`ano-${i}`}
                      inputMode="numeric"
                      maxLength={4}
                      value={c.ano}
                      placeholder="2021"
                      onChange={(e) =>
                        setCursos((a) => a.map((x, j) => (j === i ? { ...x, ano: e.target.value } : x)))
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="ei-btn ei-btn-tonal ei-btn-largo"
            style={{ marginTop: cursos.length ? 16 : 0 }}
            onClick={() => setCursos((a) => [...a, { nome: "", instituicao: "", ano: "" }])}
          >
            + {cursos.length ? "Outro curso" : "Acrescentar curso"}
          </button>
        </div>

        <button className="ei-btn ei-btn-cheio ei-btn-largo" style={{ marginTop: 24 }}>
          Salvar
        </button>
      </div>
    </div>
  );
}
