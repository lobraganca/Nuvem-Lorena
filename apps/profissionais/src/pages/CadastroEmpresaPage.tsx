import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { upsertCompany, obterMinhaEmpresa, marcarOnboardingCompleto } from "../lib/company";
import { uploadProfessionalPhoto } from "../lib/storage";
import { DEFAULT_CITY, DEFAULT_UF, CITIES, UFS, type Company } from "../types/domain";
import { formatDocument, isValidDocument } from "../lib/documents";
import { formatPhone, isValidPhone } from "../lib/phone";
import { mensagemDeErro } from "../lib/erros";

/* O selo do telefone fica de fora: quem o grava é a função
   `confirmar_telefone_empresa`, no banco, e um campo aqui viraria um valor
   que a tela manda junto no salvamento — que é exatamente o caminho que o
   gatilho da 0071 existe para recusar. */
type FormState = Omit<
  Company,
  | "id"
  | "created_at"
  | "phone_verified"
  | "phone_verified_at"
  /* O plano também sai daqui: ele é consequência de um pagamento, e um
     campo no formulário do cadastro seria um plano que a tela manda junto
     ao salvar o endereço. */
  | "plano"
  | "plano_ate"
  | "plano_recorrente"
>;

const EMPTY: FormState = {
  owner_id: "",
  company_name: "",
  cnpj: "",
  city: DEFAULT_CITY,
  uf: DEFAULT_UF,
  neighborhood: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  photo_url: "",
  responsible_name: "",
  description: "",
};

/**
 * Cadastro de empresa.
 *
 * Coleta: razão social, CNPJ, responsável, bairro, endereço, telefone, etc.
 */
export function CadastroEmpresaPage() {
  const navegar = useNavigate();
  const { user, loading: carregandoConta } = useAuth();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [carregandoEmpresa, setCarregandoEmpresa] = useState(false);
  /* O estado da confirmação vem do banco e não entra no formulário: quem
     grava esse campo é a função `confirmar_telefone_empresa`, e um valor
     editável aqui seria só um espelho — que sai do lugar no primeiro
     salvamento. */
  const [empresaExistente, setEmpresaExistente] = useState<Company | null>(null);

  useEffect(() => {
    if (carregandoConta || !user) return;

    setForm((f) => ({ ...f, owner_id: user.id }));
    setCarregandoEmpresa(true);

    obterMinhaEmpresa(user.id).then((empresa) => {
      if (empresa) {
        setForm(empresa);
        setEmpresaExistente(empresa);
      }
      setCarregandoEmpresa(false);
    });
  }, [user, carregandoConta]);

  if (carregandoConta || !user) {
    return <div className="container" style={{ paddingTop: 48 }}>
      <span className="muted">Carregando…</span>
    </div>;
  }

  async function salvar() {
    if (!user) {
      setErro("Usuário não autenticado.");
      return;
    }

    setErro("");

    if (!form.company_name.trim()) {
      setErro("Nome da empresa é obrigatório.");
      return;
    }

    if (form.cnpj && !isValidDocument(form.cnpj, "pj")) {
      setErro("CNPJ inválido.");
      return;
    }

    if (!form.phone || !isValidPhone(form.phone)) {
      setErro("Telefone inválido.");
      return;
    }

    if (!form.responsible_name?.trim()) {
      setErro("Nome do responsável é obrigatório.");
      return;
    }

    setSalvando(true);
    try {
      const empresa = await upsertCompany({
        ...form,
        owner_id: user.id,
      });

      // Marca onboarding como completo
      await marcarOnboardingCompleto(user.id);

      // Redireciona para painel da empresa
      navegar("/painel-empresa", { replace: true });
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível salvar a empresa."));
    } finally {
      setSalvando(false);
    }
  }

  async function atualizarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const url = await uploadProfessionalPhoto(user.id, file);
      setForm((f) => ({ ...f, photo_url: url }));
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível salvar a foto."));
    }
  }

  return (
    <div className="container cadastro-pagina" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <h1>Cadastre sua empresa</h1>
      <p className="muted">Preencha os dados para começar a procurar profissionais.</p>

      {erro && (
        <div style={{ color: "var(--color-danger)", marginBottom: 16, padding: 12, backgroundColor: "var(--color-danger-light)", borderRadius: 8 }}>
          {erro}
        </div>
      )}

      <div style={{ display: "grid", gap: 24 }}>
        {/* Foto/Logo */}
        <section>
          <label style={{ display: "block", marginBottom: 8 }}>Logo da empresa</label>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: 12,
                backgroundColor: "var(--color-bg-input)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {form.photo_url ? (
                <img src={form.photo_url} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span className="muted">Sem logo</span>
              )}
            </div>
            <div>
              <label htmlFor="photo_upload" className="btn btn-secondary">
                Selecionar logo
              </label>
              <input
                id="photo_upload"
                type="file"
                accept="image/*"
                onChange={atualizarFoto}
                style={{ display: "none" }}
              />
            </div>
          </div>
        </section>

        {/* Dados da empresa */}
        <section>
          <h3 style={{ marginTop: 0 }}>Informações da empresa</h3>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="company_name">Nome da empresa *</label>
            <input
              id="company_name"
              type="text"
              placeholder="Razão social ou nome fantasia"
              value={form.company_name}
              onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="cnpj">CNPJ</label>
            <input
              id="cnpj"
              type="text"
              placeholder="00.000.000/0000-00"
              value={formatDocument(form.cnpj || "", "pj")}
              onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="responsible_name">Nome do responsável *</label>
            <input
              id="responsible_name"
              type="text"
              placeholder="Seu nome"
              value={form.responsible_name || ""}
              onChange={(e) => setForm((f) => ({ ...f, responsible_name: e.target.value }))}
            />
          </div>

          {/* O telefone da empresa confirma-se no próprio campo.
              ────────────────────────────────────────────────────
              Era um campo comum aqui, e a confirmação vinha depois, num
              aviso solto no painel — quando a empresa já tinha terminado o
              cadastro e ido embora. É a mesma coisa que a dona apontou no
              lado do profissional: "tem que ser algo inerente ao cadastro,
              não uma coisa apartada".

              Do lado de quem contrata isso pesa ainda mais: é por este
              número que quem responde à vaga vai procurar a empresa de
              volta, e é aí que mora o golpe do falso emprego. */}
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="phone">
              Telefone comercial *{" "}
              {empresaExistente?.phone_verified ? (
                <span className="ei-selo ei-selo-verde">Confirmado</span>
              ) : (
                <span className="ei-selo ei-selo-laranja">Falta confirmar</span>
              )}
            </label>
            <input
              id="phone"
              type="tel"
              placeholder="(31) 99999-9999"
              value={formatPhone(form.phone)}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            {!empresaExistente?.phone_verified && (
              <p className="ei-campo-ajuda" style={{ marginTop: 6 }}>
                Sem confirmar este número a empresa não publica vaga. Salve o cadastro e
                a confirmação é o próximo passo — ela usa o mesmo número com que você
                entrou no app.
              </p>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              placeholder="contato@empresa.com.br"
              value={form.email || ""}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="website">Website</label>
            <input
              id="website"
              type="url"
              placeholder="https://www.empresa.com.br"
              value={form.website || ""}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="description">Sobre a empresa</label>
            <textarea
              id="description"
              placeholder="Descrição breve da empresa"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
        </section>

        {/* Localização */}
        <section>
          <h3 style={{ marginTop: 0 }}>Localização</h3>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="city">Cidade *</label>
            <select
              id="city"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            >
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="uf">Estado</label>
            <select
              id="uf"
              value={form.uf}
              onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))}
            >
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="neighborhood">Bairro</label>
            <input
              id="neighborhood"
              type="text"
              placeholder="Centro, Zona Norte, etc"
              value={form.neighborhood || ""}
              onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="address">Endereço comercial</label>
            <input
              id="address"
              type="text"
              placeholder="Rua, número, complemento"
              value={form.address || ""}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
        </section>

        {/* Ações */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            className="btn btn-primary btn-block"
            onClick={salvar}
            disabled={salvando}
          >
            {salvando ? "Salvando…" : "Salvar e continuar"}
          </button>
        </div>

        <p className="muted" style={{ fontSize: "0.9em", textAlign: "center" }}>
          Você pode atualizar essas informações a qualquer momento no seu painel.
        </p>
      </div>
    </div>
  );
}
