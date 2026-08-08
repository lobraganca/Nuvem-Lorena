import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { getMyProfessionals, isCurrentlyBoosted, isCurrentlyVerified, upsertProfessional } from "../lib/professionals";
import { startSubscriptionCheckout, PRICES } from "../lib/payments";
import { CATEGORIES, CITIES, DEFAULT_CITY, type Professional } from "../types/domain";
import { formatDocument, isValidDocument } from "../lib/documents";
import { uploadProfessionalPhoto } from "../lib/storage";

type FormState = Omit<
  Professional,
  "id" | "created_at" | "verified" | "verified_until" | "boosted" | "boosted_until" | "suspended" | "suspended_reason"
> & { id?: string };

const EMPTY: FormState = {
  owner_id: "",
  name: "",
  category: CATEGORIES[0],
  city: DEFAULT_CITY,
  bio: "",
  phone: "",
  entity_type: "pf",
  document: "",
  company_name: "",
  photo_url: null,
  responsible_name: "",
};

const NAME_MAX_LENGTH = 80;

export function PainelPage() {
  const { user, loading } = useAuth();
  const [mine, setMine] = useState<Professional[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const isEditing = !!form.id;

  useEffect(() => {
    if (user) getMyProfessionals(user.id).then(setMine);
  }, [user]);

  function resetForm() {
    setForm(EMPTY);
    setPhotoFile(null);
    setPhotoPreview(null);
    setAcceptedTerms(false);
  }

  function startEdit(p: Professional) {
    setForm({
      id: p.id,
      owner_id: p.owner_id,
      name: p.name,
      category: p.category,
      city: p.city,
      bio: p.bio,
      phone: p.phone,
      entity_type: p.entity_type,
      document: p.document ? formatDocument(p.document, p.entity_type) : "",
      company_name: p.company_name ?? "",
      photo_url: p.photo_url,
      responsible_name: p.responsible_name ?? "",
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setAcceptedTerms(true);
    setMessage("");
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setMessage("");

    if (form.document && !isValidDocument(form.document, form.entity_type)) {
      setMessage(form.entity_type === "pj" ? "CNPJ inválido. Confira os números digitados." : "CPF inválido. Confira os números digitados.");
      return;
    }
    if (form.entity_type === "pf" && !photoFile && !form.photo_url) {
      setMessage("Envie uma foto de rosto para publicar o anúncio de pessoa física.");
      return;
    }
    if (form.entity_type === "pj" && !form.responsible_name?.trim()) {
      setMessage("Informe o nome do responsável pela empresa.");
      return;
    }
    if (!acceptedTerms) {
      setMessage("Para publicar, é preciso concordar com os Termos de Uso.");
      return;
    }

    setSaving(true);
    try {
      let photoUrl = form.photo_url;
      if (photoFile) {
        photoUrl = await uploadProfessionalPhoto(user.id, photoFile);
      }
      await upsertProfessional({
        ...form,
        owner_id: user.id,
        document: form.document ? form.document.replace(/\D/g, "") : null,
        company_name: form.entity_type === "pj" ? form.company_name || null : null,
        responsible_name: form.entity_type === "pj" ? form.responsible_name || null : null,
        photo_url: photoUrl,
      });
      const wasEditing = isEditing;
      resetForm();
      setMine(await getMyProfessionals(user.id));
      setMessage(wasEditing ? "Anúncio atualizado." : "Anúncio salvo.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubscribe(professionalId: string, type: "verification" | "boost") {
    setCheckoutLoading(`${professionalId}:${type}`);
    setMessage("");
    try {
      const { initPoint } = await startSubscriptionCheckout(professionalId, type);
      window.location.href = initPoint;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não foi possível iniciar o checkout do Mercado Pago.");
    } finally {
      setCheckoutLoading(null);
    }
  }

  if (loading) return <div className="container" style={{ paddingTop: 40 }}>Carregando…</div>;
  if (!user) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <p>Você precisa entrar para acessar o painel do profissional.</p>
      </div>
    );
  }

  const isPj = form.entity_type === "pj";

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <h1>Painel do profissional</h1>
      {message && <p className="card">{message}</p>}

      <section style={{ marginTop: 24 }}>
        <h2>Meus anúncios</h2>
        {mine.length === 0 && <p className="muted">Você ainda não tem um anúncio. Cadastre abaixo.</p>}
        <div className="grid">
          {mine.map((p) => {
            const verified = isCurrentlyVerified(p);
            const boosted = isCurrentlyBoosted(p);
            return (
              <div key={p.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{p.name}</strong>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span className={p.entity_type === "pj" ? "badge badge-entity-pj" : "badge badge-entity-pf"}>
                      {p.entity_type === "pj" ? "Empresa" : "Autônomo"}
                    </span>
                    {verified && <span className="badge badge-verified">✓ Verificado</span>}
                    {boosted && <span className="badge badge-boosted">Destaque</span>}
                  </div>
                </div>
                <p className="muted">{p.category} · {p.city}</p>
                {p.entity_type === "pj" && p.responsible_name && (
                  <p className="muted" style={{ margin: "4px 0" }}>Responsável: {p.responsible_name}</p>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <button className="btn btn-outline" onClick={() => startEdit(p)}>
                    Editar
                  </button>
                  <button
                    className="btn btn-teal"
                    disabled={checkoutLoading === `${p.id}:verification` || verified}
                    onClick={() => handleSubscribe(p.id, "verification")}
                  >
                    {verified
                      ? "Selo ativo"
                      : `Assinar selo de verificação — R$ ${PRICES.verification.amount.toFixed(2).replace(".", ",")}/mês`}
                  </button>
                  <button
                    className="btn btn-gold"
                    disabled={checkoutLoading === `${p.id}:boost` || boosted}
                    onClick={() => handleSubscribe(p.id, "boost")}
                  >
                    {boosted
                      ? "Anúncio turbinado"
                      : `Turbinar anúncio — R$ ${PRICES.boost.amount.toFixed(2).replace(".", ",")}/mês`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>{isEditing ? "Editar anúncio" : "Cadastrar anúncio"}</h2>
        <form className="card" onSubmit={handleSave} style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                name="entity_type"
                checked={form.entity_type === "pf"}
                onChange={() => setForm({ ...form, entity_type: "pf", document: "" })}
                style={{ width: "auto" }}
              />
              Pessoa física
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                name="entity_type"
                checked={form.entity_type === "pj"}
                onChange={() => setForm({ ...form, entity_type: "pj", document: "" })}
                style={{ width: "auto" }}
              />
              Pessoa jurídica (empresa)
            </label>
          </div>

          <input
            placeholder={isPj ? "Nome exibido (ex: Escolinha Golfinho Azul)" : "Nome"}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            maxLength={NAME_MAX_LENGTH}
          />

          {isPj && (
            <>
              <input
                placeholder="Nome da empresa (razão social/nome fantasia)"
                value={form.company_name ?? ""}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              />
              <input
                placeholder="Responsável pela empresa (ex: Maria Silva)"
                value={form.responsible_name ?? ""}
                onChange={(e) => setForm({ ...form, responsible_name: e.target.value })}
                required
              />
            </>
          )}

          <input
            placeholder={isPj ? "CNPJ" : "CPF"}
            value={form.document ?? ""}
            onChange={(e) => setForm({ ...form, document: formatDocument(e.target.value, form.entity_type) })}
            inputMode="numeric"
            maxLength={isPj ? 18 : 14}
          />

          <label style={{ display: "grid", gap: 6 }}>
            <span className="muted">{isPj ? "Logo da empresa" : "Foto de rosto"} {!isPj && "(obrigatória)"}</span>
            <input type="file" accept="image/*" onChange={handlePhotoChange} />
            {(photoPreview || form.photo_url) && (
              <img
                src={photoPreview || form.photo_url || undefined}
                alt={form.name ? `Pré-visualização de ${form.name}` : "Pré-visualização"}
                style={{ width: 96, height: 96, objectFit: "cover", borderRadius: isPj ? 10 : "50%", border: "1px solid var(--color-border)" }}
              />
            )}
          </label>

          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <textarea placeholder="Bio / descrição do serviço" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} />
          <input placeholder="WhatsApp (com DDD)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.88rem" }}>
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              style={{ width: "auto" }}
            />
            Li e concordo com os <Link to="/termos" target="_blank" rel="noreferrer">Termos de Uso</Link>
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-gold" type="submit" disabled={saving}>
              {saving ? "Salvando…" : isEditing ? "Salvar alterações" : "Salvar anúncio"}
            </button>
            {isEditing && (
              <button type="button" className="btn btn-outline" onClick={resetForm} disabled={saving}>
                Cancelar edição
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
