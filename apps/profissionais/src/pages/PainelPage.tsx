import { useEffect, useState } from "react";
import { useAuth } from "../lib/useAuth";
import { getMyProfessionals, upsertProfessional } from "../lib/professionals";
import { startSubscriptionCheckout, PRICES } from "../lib/payments";
import { CATEGORIES, CITIES, DEFAULT_CITY, type Professional } from "../types/domain";

const EMPTY: Omit<Professional, "id" | "created_at" | "verified" | "verified_until" | "boosted" | "boosted_until"> = {
  owner_id: "",
  name: "",
  category: CATEGORIES[0],
  city: DEFAULT_CITY,
  bio: "",
  phone: "",
};

export function PainelPage() {
  const { user, loading } = useAuth();
  const [mine, setMine] = useState<Professional[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (user) getMyProfessionals(user.id).then(setMine);
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage("");
    try {
      await upsertProfessional({ ...form, owner_id: user.id });
      setForm(EMPTY);
      setMine(await getMyProfessionals(user.id));
      setMessage("Anúncio salvo.");
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

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <h1>Painel do profissional</h1>
      {message && <p className="card">{message}</p>}

      <section style={{ marginTop: 24 }}>
        <h2>Meus anúncios</h2>
        {mine.length === 0 && <p className="muted">Você ainda não tem um anúncio. Cadastre abaixo.</p>}
        <div className="grid">
          {mine.map((p) => (
            <div key={p.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{p.name}</strong>
                <div style={{ display: "flex", gap: 6 }}>
                  {p.verified && <span className="badge badge-verified">✓ Verificado</span>}
                  {p.boosted && <span className="badge badge-boosted">Destaque</span>}
                </div>
              </div>
              <p className="muted">{p.category} · {p.city}</p>
              <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <button
                  className="btn btn-teal"
                  disabled={checkoutLoading === `${p.id}:verification` || p.verified}
                  onClick={() => handleSubscribe(p.id, "verification")}
                >
                  {p.verified
                    ? "Selo ativo"
                    : `Assinar selo de verificação — R$ ${PRICES.verification.amount.toFixed(2).replace(".", ",")}/mês`}
                </button>
                <button
                  className="btn btn-gold"
                  disabled={checkoutLoading === `${p.id}:boost` || p.boosted}
                  onClick={() => handleSubscribe(p.id, "boost")}
                >
                  {p.boosted
                    ? "Anúncio turbinado"
                    : `Turbinar anúncio — R$ ${PRICES.boost.amount.toFixed(2).replace(".", ",")}/mês`}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Cadastrar / editar anúncio</h2>
        <form className="card" onSubmit={handleSave} style={{ display: "grid", gap: 12 }}>
          <input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
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
          <button className="btn btn-gold" type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar anúncio"}
          </button>
        </form>
      </section>
    </div>
  );
}
