import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { obterMinhaEmpresa, criarVaga, abrirOnda, calcularOndas } from "../lib/company";
import {
  CATEGORIES,
  DEFAULT_CITY,
  DEFAULT_UF,
  ONDAS,
  type JobListing,
  type WaveNumber,
  type WorkModality,
} from "../types/domain";
import { mensagemDeErro } from "../lib/erros";

type FormState = Omit<JobListing, "id" | "created_at" | "closed_at" | "status">;

const EMPTY_FORM: FormState = {
  company_id: "",
  title: "",
  description: "",
  profession: "",
  specialty: null,
  required_experience: null,
  skills: [],
  salary_range_min: null,
  salary_range_max: null,
  available_immediately: true,
  work_modality: "presencial",
  city: DEFAULT_CITY,
  uf: DEFAULT_UF,
  neighborhood: null,
};

/**
 * Criar uma vaga de trabalho.
 *
 * Dois passos: o formulário e a conferência. Na conferência a tela mostra
 * quantas pessoas cada onda alcançaria — números lidos do banco, não
 * estimados. Uma versão anterior desta tela sorteava os três números com
 * `Math.random()` para "ilustrar", e ilustração com cara de dado é a
 * mentira mais barata que existe: a empresa decidiria disparar olhando um
 * número que não veio de lugar nenhum.
 *
 * Ao confirmar, **só a onda 1 abre**. As outras duas ficam esperando um
 * toque na tela da vaga — ver `ONDAS` e o cabeçalho da migration 0068.
 */
export function CriarVagaPage() {
  const navegar = useNavigate();
  const { user, loading: carregandoConta } = useAuth();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [passo, setPasso] = useState<"formulario" | "preview">("formulario");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [conferindo, setConferindo] = useState(false);
  const [ondaPreview, setOndaPreview] = useState<Array<{ onda: WaveNumber; novos: number }>>([]);

  useEffect(() => {
    if (carregandoConta || !user) return;

    obterMinhaEmpresa(user.id).then((empresa) => {
      if (!empresa) {
        navegar("/cadastro-empresa", { replace: true });
        return;
      }
      setForm((f) => ({
        ...f,
        company_id: empresa.id,
        city: empresa.city,
        uf: empresa.uf,
        neighborhood: empresa.neighborhood,
      }));
    });
  }, [user, carregandoConta, navegar]);

  async function previsualizarOndas() {
    setErro("");

    if (!form.title.trim()) {
      setErro("Escreva o título da vaga.");
      return;
    }

    if (!form.profession) {
      setErro("Escolha a profissão.");
      return;
    }

    setConferindo(true);
    try {
      /* A vaga ainda não existe no banco — a contagem é feita sobre o que
         está no formulário. Os campos que `calcularOndas` lê (cidade,
         estado, profissão, especialidade) já estão todos preenchidos aqui. */
      const ondas = await calcularOndas(form as JobListing);
      setOndaPreview(ondas.map(({ onda, novos }) => ({ onda, novos })));
      setPasso("preview");
    } catch (err) {
      /* Contagem que falha não é contagem zero. Mostrar "0 profissionais"
         quando o banco recusou a consulta faria a empresa concluir que não
         há ninguém na cidade — e desistir de uma vaga que teria enchido. */
      setErro(mensagemDeErro(err, "Não foi possível contar os profissionais."));
    } finally {
      setConferindo(false);
    }
  }

  async function confirmarEAbrirPrimeiraOnda() {
    setSalvando(true);
    setErro("");

    try {
      const vaga = await criarVaga({ ...form, status: "active" });

      /* Só a onda 1. As outras esperam a empresa pedir, na tela da vaga:
         quem já achou gente na primeira não incomoda mais ninguém. */
      await abrirOnda(vaga, 1);

      navegar(`/vaga/${vaga.id}`, { replace: true });
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível criar a vaga."));
      setSalvando(false);
    }
  }

  if (carregandoConta) {
    return <div className="container" style={{ paddingTop: 48 }}>
      <span className="muted">Carregando…</span>
    </div>;
  }

  return (
    <div className="container criar-vaga" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <h1>Criar vaga</h1>

      {erro && (
        <div style={{ color: "var(--color-danger)", marginBottom: 16, padding: 12, backgroundColor: "var(--color-danger-light)", borderRadius: 8 }}>
          {erro}
        </div>
      )}

      {passo === "formulario" ? (
        // FORMULÁRIO
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <label htmlFor="title">Qual profissional você procura? *</label>
            <input
              id="title"
              type="text"
              placeholder="Ex: Vendedor, Recepcionista, Eletricista"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="profession">Profissão/Categoria *</label>
            <select
              id="profession"
              value={form.profession}
              onChange={(e) => setForm((f) => ({ ...f, profession: e.target.value }))}
            >
              <option value="">Escolha uma profissão</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="specialty">Especialidade (opcional)</label>
            <input
              id="specialty"
              type="text"
              placeholder="Ex: Vendas em loja de roupas"
              value={form.specialty || ""}
              onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value || null }))}
            />
          </div>

          <div>
            <label htmlFor="description">Descrição da vaga</label>
            <textarea
              id="description"
              placeholder="Detalhes sobre a vaga, responsabilidades, etc"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="required_experience">Experiência requerida</label>
            <select
              id="required_experience"
              value={form.required_experience || ""}
              onChange={(e) => setForm((f) => ({ ...f, required_experience: e.target.value || null }))}
            >
              <option value="">Qualquer experiência</option>
              <option value="0-2 anos">0-2 anos</option>
              <option value="2-5 anos">2-5 anos</option>
              <option value="5+ anos">5+ anos</option>
            </select>
          </div>

          <div>
            <label htmlFor="work_modality">Modalidade de trabalho</label>
            <select
              id="work_modality"
              value={form.work_modality}
              onChange={(e) => setForm((f) => ({ ...f, work_modality: e.target.value as WorkModality }))}
            >
              <option value="presencial">Presencial</option>
              <option value="remoto">Remoto</option>
              <option value="hibrido">Híbrido</option>
            </select>
          </div>

          <div>
            <label>
              <input
                type="checkbox"
                checked={form.available_immediately}
                onChange={(e) => setForm((f) => ({ ...f, available_immediately: e.target.checked }))}
              />
              {" "}Disponibilidade imediata
            </label>
          </div>

          {/* Não há campo de raio em quilômetros, e não é esquecimento: o
              cadastro de profissional não guarda latitude nem longitude, e
              Itabirito inteira se atravessa em dez minutos. Ver `ONDAS` em
              types/domain.ts. */}

          <div>
            <label htmlFor="salary_min">Faixa salarial mínima (R$)</label>
            <input
              id="salary_min"
              type="number"
              placeholder="Deixar em branco = não informar"
              value={form.salary_range_min ? form.salary_range_min / 100 : ""}
              onChange={(e) => setForm((f) => ({ ...f, salary_range_min: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null }))}
            />
          </div>

          <div>
            <label htmlFor="salary_max">Faixa salarial máxima (R$)</label>
            <input
              id="salary_max"
              type="number"
              placeholder="Deixar em branco = não informar"
              value={form.salary_range_max ? form.salary_range_max / 100 : ""}
              onChange={(e) => setForm((f) => ({ ...f, salary_range_max: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null }))}
            />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              className="btn btn-secondary"
              onClick={() => navegar("/painel-empresa")}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={previsualizarOndas}
              disabled={conferindo}
            >
              {conferindo ? "Contando…" : "Ver quem esta vaga alcança"}
            </button>
          </div>
        </div>
      ) : (
        // PREVIEW DAS ONDAS
        <div style={{ display: "grid", gap: 20 }}>
          <div className="card" style={{ padding: 16 }}>
            <h2 style={{ margin: "0 0 8px 0" }}>Quem esta vaga alcança</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Ao confirmar, só a <strong>onda 1</strong> é avisada. As outras
              ficam esperando: se ninguém responder, você abre a próxima num
              toque, na tela da vaga.
            </p>

            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {ondaPreview.map(({ onda, novos }) => (
                <div
                  key={onda}
                  style={{
                    padding: 12,
                    backgroundColor: "var(--color-bg-input)",
                    borderRadius: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    /* A onda 1 é a única que sai agora; as outras são
                       possibilidade. Deixá-las com o mesmo peso visual fazia
                       a tela parecer prometer três disparos. */
                    opacity: onda === 1 ? 1 : 0.62,
                  }}
                >
                  <div>
                    <strong>
                      Onda {onda} — {ONDAS[onda].titulo}
                    </strong>
                    <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "0.9em" }}>
                      {ONDAS[onda].explicacao} {onda === 1 ? "Sai agora." : "Só se você pedir."}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: "1.5em", fontWeight: "bold", color: "var(--color-primary)" }}>
                      {novos}
                    </div>
                    <div className="muted" style={{ fontSize: "0.9em" }}>
                      {novos === 1 ? "pessoa" : "pessoas"}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cada onda conta só quem as anteriores não alcançaram, então
                somar os três números dá o total de verdade. Sem o desconto,
                "12, 30, 45" para 45 pessoas seria lido como 87. */}
            <p className="muted" style={{ marginTop: 16, fontSize: "0.9em" }}>
              No total, {ondaPreview.reduce((soma, o) => soma + o.novos, 0)} pessoas em{" "}
              {form.city} podem ser avisadas — nenhuma duas vezes.
            </p>

            {ondaPreview[0]?.novos === 0 && (
              <p style={{ marginTop: 12, fontSize: "0.9em" }}>
                Ninguém com esse encaixe exato hoje. A vaga pode ser criada do
                mesmo jeito — e a onda 2 provavelmente tem gente.
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              className="btn btn-secondary"
              onClick={() => setPasso("formulario")}
              disabled={salvando}
            >
              Voltar
            </button>
            <button
              className="btn btn-primary"
              onClick={confirmarEAbrirPrimeiraOnda}
              disabled={salvando}
            >
              {salvando ? "Criando…" : "Criar vaga e avisar a onda 1"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
