import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { obterMinhaEmpresa, criarVaga, dispararVagaComOndas, buscarProfissionaisComFiltrosLocais } from "../lib/company";
import { CATEGORIES, DEFAULT_CITY, DEFAULT_UF, type JobListing, type WorkModality } from "../types/domain";
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
  distance_radius_km: 5,
};

/**
 * Criar uma vaga de trabalho.
 *
 * Coleta dados da vaga, mostra pré-visualização das ondas,
 * e dispara automaticamente quando confirmado.
 */
export function CriarVagaPage() {
  const navegar = useNavigate();
  const { user, loading: carregandoConta } = useAuth();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [passo, setPasso] = useState<"formulario" | "preview">("formulario");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [ondaPreview, setOndaPreview] = useState<Array<{ wave: number; count: number }>>([]);

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
      setErro("Título da vaga é obrigatório.");
      return;
    }

    if (!form.profession) {
      setErro("Profissão é obrigatória.");
      return;
    }

    // Busca profissionais compatíveis
    const profissionais = await buscarProfissionaisComFiltrosLocais(
      form as JobListing & { id: string; created_at: string; closed_at: null; status: "active" }
    );

    // Mock: simula 3 ondas com números aleatórios
    const onda1 = Math.floor(Math.random() * 20) + 5;
    const onda2 = Math.floor(Math.random() * 30) + 10;
    const onda3 = Math.floor(Math.random() * 50) + 20;

    setOndaPreview([
      { wave: 1, count: onda1 },
      { wave: 2, count: onda2 },
      { wave: 3, count: onda3 },
    ]);

    setPasso("preview");
  }

  async function confirmarEDisparar() {
    setSalvando(true);
    setErro("");

    try {
      // Cria a vaga
      const vaga = await criarVaga({
        ...form,
        status: "active",
      });

      // Dispara as ondas
      await dispararVagaComOndas(vaga.id);

      // Redireciona para a vaga
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

          <div>
            <label htmlFor="distance_radius">Raio de busca (km)</label>
            <input
              id="distance_radius"
              type="number"
              min="1"
              max="50"
              value={form.distance_radius_km || 5}
              onChange={(e) => setForm((f) => ({ ...f, distance_radius_km: parseInt(e.target.value) || 5 }))}
            />
          </div>

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
            >
              Ver previsão de profissionais
            </button>
          </div>
        </div>
      ) : (
        // PREVIEW DAS ONDAS
        <div style={{ display: "grid", gap: 20 }}>
          <div className="card" style={{ padding: 16 }}>
            <h2 style={{ margin: "0 0 16px 0" }}>Previsão de profissionais</h2>
            <p className="muted">
              Com base nos seus critérios, o sistema vai disparar em 3 ondas:
            </p>

            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {ondaPreview.map((onda) => (
                <div
                  key={onda.wave}
                  style={{
                    padding: 12,
                    backgroundColor: "var(--color-bg-input)",
                    borderRadius: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong>Onda {onda.wave}</strong>
                    {onda.wave === 1 && (
                      <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "0.9em" }}>
                        Maior compatibilidade + menor distância. Sai agora.
                      </p>
                    )}
                    {onda.wave === 2 && (
                      <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "0.9em" }}>
                        Outros compatíveis. Sai em 4 horas (se sem respostas).
                      </p>
                    )}
                    {onda.wave === 3 && (
                      <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "0.9em" }}>
                        Ampliação dentro da cidade. Sai em 8 horas (se sem respostas).
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.5em", fontWeight: "bold", color: "var(--color-primary)" }}>
                      {onda.count}
                    </div>
                    <div className="muted" style={{ fontSize: "0.9em" }}>profissionais</div>
                  </div>
                </div>
              ))}
            </div>

            <p className="muted" style={{ marginTop: 16, fontSize: "0.9em" }}>
              Total: {ondaPreview.reduce((sum, o) => sum + o.count, 0)} profissionais na cidade
            </p>
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
              onClick={confirmarEDisparar}
              disabled={salvando}
            >
              {salvando ? "Disparando..." : "Confirmar e disparar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
