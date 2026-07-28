import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { plans } from "../lib/plans";
import type { Business, BusinessType, PlanTier } from "../types";

const types: BusinessType[] = ["Agência", "Guia", "Restaurante"];

export function BusinessRegister() {
  const { addBusiness, updateUser } = useAvena();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isOnboarding = searchParams.get("onboarding") === "1";

  const [name, setName] = useState("");
  const [type, setType] = useState<BusinessType>("Agência");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("Brasil");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [planTier, setPlanTier] = useState<PlanTier>("Básico");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !description || !city || !email) return;

    const business: Business = {
      id: crypto.randomUUID(),
      name,
      type,
      planTier,
      description,
      city,
      state: state || undefined,
      country,
      email,
      phone: phone || undefined,
      website: website || undefined,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    addBusiness(business);

    if (isOnboarding) {
      updateUser({ ownBusinessId: business.id });
      navigate("/professional");
    } else {
      navigate(`/business/${business.id}`);
    }
  }

  return (
    <div className="page">
      <h1>Cadastrar empresa</h1>
      {isOnboarding && (
        <p className="muted">
          Último passo para começar a usar o Avena como profissional.
        </p>
      )}
      <form className="experience-form" onSubmit={handleSubmit}>
        <label>
          Nome
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label>
          Tipo
          <select value={type} onChange={(e) => setType(e.target.value as BusinessType)}>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label>
          Descrição
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            required
          />
        </label>

        <div className="form-row">
          <label>
            Cidade
            <input value={city} onChange={(e) => setCity(e.target.value)} required />
          </label>
          <label>
            Estado
            <input value={state} onChange={(e) => setState(e.target.value)} />
          </label>
          <label>
            País
            <input value={country} onChange={(e) => setCountry(e.target.value)} />
          </label>
        </div>

        <div className="form-row">
          <label>
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Telefone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
        </div>

        <label>
          Site (opcional)
          <input value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>

        <fieldset>
          <legend>Escolha seu plano</legend>
          <div className="plan-picker">
            {plans.map((plan) => (
              <button
                type="button"
                key={plan.tier}
                className={`plan-option ${planTier === plan.tier ? "plan-option-active" : ""}`}
                onClick={() => setPlanTier(plan.tier)}
              >
                <strong>{plan.tier}</strong>
                <span className="muted">{plan.price}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <button type="submit" className="btn-primary">
          Concluir cadastro
        </button>
      </form>
    </div>
  );
}
