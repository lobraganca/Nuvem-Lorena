import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { useAuth } from "../../lib/useAuth";
import { mensagemDeErro } from "../../lib/erros";
import { Switch } from "../../components/ei/Switch";
import { Pagina } from "../../components/ei/Pagina";
import { CATEGORIES, MAX_FUNCOES } from "../../types/domain";
import {
  lerMeuPerfil,
  salvarMeuPerfil,
  lerCursos,
  salvarCursos,
  PERFIL_VAZIO,
  type MeuPerfil,
} from "../../lib/meuPerfil";
import { lerExperiencias, salvarExperiencias } from "../../lib/experiencias";

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
 *
 * ── Esta tela era uma MAQUETE ─────────────────────────────────────────
 *
 * Até aqui ela desenhava tudo isso e não gravava nada: o botão "Salvar"
 * não tinha `onClick`, o arquivo não importava o banco, e recarregar a
 * página zerava o que a pessoa tinha marcado. Parecia funcionar, que é o
 * pior estado possível — e era a tela de que todo o resto depende, porque
 * é `areas_de_interesse` que a onda consulta para achar quem avisar.
 */
type Experiencia = { empresa: string; cargo: string; inicio: string; fim: string };
type Curso = { nome: string; instituicao: string; ano: string };

export function MeuPerfilPage() {
  useTituloDaPagina("Meu perfil");
  const navegar = useNavigate();
  const { user, loading: carregandoConta } = useAuth();

  const [perfil, setPerfil] = useState<MeuPerfil>(PERFIL_VAZIO);
  const [experiencias, setExperiencias] = useState<Experiencia[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  /* O aviso de que salvou. Sem ele a pessoa toca em Salvar, nada muda na
     tela, e ela não sabe se deu certo — numa tela em que o que está em
     jogo é a chance de ser chamada para trabalhar. */
  const [salvo, setSalvo] = useState(false);

  const { disponivel, oculto, funcoes } = perfil;
  const setDisponivel = (v: boolean) => setPerfil((p) => ({ ...p, disponivel: v }));
  const setOculto = (v: boolean) => setPerfil((p) => ({ ...p, oculto: v }));
  const setFuncoes = (f: (a: string[]) => string[]) =>
    setPerfil((p) => ({ ...p, funcoes: f(p.funcoes) }));

  useEffect(() => {
    if (carregandoConta) return;
    if (!user) {
      navegar("/login", { replace: true });
      return;
    }

    (async () => {
      try {
        const meu = await lerMeuPerfil(user.id);
        if (meu) {
          setPerfil(meu);
          if (meu.id) {
            /* As duas listas juntas: uma falha em qualquer uma derruba as
               duas, e é isso que se quer — meia tela carregada é a que faz
               a pessoa salvar por cima do que não apareceu. */
            const [exps, curs] = await Promise.all([
              lerExperiencias(meu.id),
              lerCursos(meu.id),
            ]);
            setExperiencias(
              exps.map((e) => ({
                cargo: e.cargo,
                empresa: e.onde ?? "",
                /* O banco guarda um período em texto livre ("de 2019 a
                   2022"); a tela tem dois campos. Na volta, o que não dá
                   para separar vai inteiro no "começou" — melhor mostrar
                   torto do que sumir com o que a pessoa escreveu. */
                inicio: e.periodo ?? "",
                fim: "",
              }))
            );
            setCursos(curs);
          }
        } else {
          /* Sem cadastro ainda: o telefone da conta já entra preenchido.
             É o dado que a pessoa acabou de confirmar por SMS, e pedir de
             novo é o tipo de atrito que faz desistir no primeiro campo. */
          setPerfil({ ...PERFIL_VAZIO, phone: user.phone ?? "", email: user.email ?? "" });
        }
      } catch (err) {
        setErro(mensagemDeErro(err, "Não consegui carregar o seu perfil."));
      } finally {
        setCarregando(false);
      }
    })();
  }, [user, carregandoConta, navegar]);

  async function salvar() {
    if (!user) return;
    setSalvando(true);
    setErro("");
    setSalvo(false);
    try {
      const id = await salvarMeuPerfil(user.id, perfil);
      setPerfil((p) => ({ ...p, id }));
      await Promise.all([
        salvarExperiencias(
          id,
          experiencias.map((e) => ({
            cargo: e.cargo,
            onde: e.empresa,
            periodo: [e.inicio, e.fim].filter(Boolean).join(" a "),
          }))
        ),
        salvarCursos(id, cursos),
      ]);
      setSalvo(true);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não consegui salvar o seu perfil."));
    } finally {
      setSalvando(false);
    }
  }

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

  if (carregandoConta || carregando) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <p className="ei-apoio ei-margem" style={{ paddingTop: 24 }}>Carregando…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ei">
      <div className="ei-tela">
        {/* Era a única tela principal sem o cabeçalho de página — sem
            migalha, sem ícone, e com o título centralizado enquanto todas
            as outras alinham à esquerda. */}
        <Pagina icone="🧰" titulo="Meu perfil" ondeEstou="Meu perfil" />
        <p className="ei-apoio ei-margem" style={{ paddingBottom: 6 }}>
          É por ele que as vagas chegam até você.
        </p>

        {/* ── 0. Quem é você ───────────────────────────────────────────
            Nome, telefone e e-mail, que a dona pediu por escrito e não
            existiam nesta tela. O nome é o que a empresa lê primeiro; o
            telefone é como ela chama. Sem os dois, o cadastro não serve
            para nada — por isso vêm antes de tudo. */}
        <h2 className="ei-secao">Seus dados</h2>
        <div className="ei-cartao" style={{ display: "grid", gap: 12 }}>
          <div className="ei-campo">
            <label htmlFor="meu-nome">Nome</label>
            <input
              id="meu-nome"
              value={perfil.name}
              placeholder="Como a empresa vai te chamar"
              maxLength={80}
              onChange={(e) => setPerfil((x) => ({ ...x, name: e.target.value }))}
            />
          </div>
          <div className="ei-campo">
            <label htmlFor="meu-fone">Telefone</label>
            <input
              id="meu-fone"
              type="tel"
              inputMode="tel"
              value={perfil.phone}
              placeholder="(31) 99999-8888"
              onChange={(e) => setPerfil((x) => ({ ...x, phone: e.target.value }))}
            />
            <span className="ei-campo-ajuda">É por aqui que a empresa vai te chamar.</span>
          </div>
          <div className="ei-campo">
            <label htmlFor="meu-email">E-mail</label>
            <input
              id="meu-email"
              type="email"
              inputMode="email"
              value={perfil.email}
              placeholder="opcional"
              onChange={(e) => setPerfil((x) => ({ ...x, email: e.target.value }))}
            />
          </div>
          <div className="ei-campo">
            <label htmlFor="meu-bairro">Bairro</label>
            <input
              id="meu-bairro"
              value={perfil.neighborhood}
              placeholder="Centro"
              maxLength={60}
              onChange={(e) => setPerfil((x) => ({ ...x, neighborhood: e.target.value }))}
            />
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

        {/* O aviso de que deu certo, e o de que não deu.
            ───────────────────────────────────────────────
            O botão não tinha ação nenhuma; agora tem, e avisa nos dois
            casos. Salvar em silêncio numa tela em que o que está em jogo é
            a chance de ser chamada para trabalhar faz a pessoa tocar de
            novo, e depois desconfiar do app inteiro. */}
        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 16 }} role="alert">
            {erro}
          </p>
        )}
        {salvo && !erro && (
          <div className="ei-callout" style={{ marginTop: 16 }}>
            <span className="ei-callout-emoji" aria-hidden="true">✅</span>
            <span className="ei-callout-texto">
              <strong>Perfil salvo.</strong>{" "}
              {funcoes.length === 0
                ? "Marque ao menos uma função para começar a receber vaga."
                : oculto
                  ? "Você não aparece na lista, mas continua recebendo vaga."
                  : "As vagas do seu ofício vão chegar aqui."}
            </span>
          </div>
        )}

        <div className="ei-margem" style={{ marginTop: 20 }}>
          <button
            type="button"
            className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
            disabled={salvando}
            onClick={salvar}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
