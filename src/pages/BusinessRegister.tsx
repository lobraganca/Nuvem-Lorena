import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAvena } from "../store/AvenaContext";
import { plans } from "../lib/plans";
import { BRAZILIAN_STATES } from "../lib/collections";
import { businessTypes } from "../lib/categories";
import {
  LegalAcceptance,
  useAcceptLegal,
  useLegalAccepted,
} from "../components/LegalAcceptance";
import type { Business, BusinessType, PlanTier } from "../types";

export function BusinessRegister() {
  const { addBusiness, updateUser } = useAvena();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isOnboarding = searchParams.get("onboarding") === "1";

  const [name, setName] = useState("");
  const [type, setType] = useState<BusinessType>("Agência");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState(BRAZILIAN_STATES[0]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [cadastur, setCadastur] = useState("");

  // Cadastur is compulsory for those who actually sell tourism services.
  const requiresCadastur = type === "Agência" || type === "Guia" || type === "Hotel";

  const [legalChecked, setLegalChecked] = useState(false);
  const legalAccepted = useLegalAccepted();
  const acceptLegal = useAcceptLegal();
  const legalOk = legalAccepted || legalChecked;
  const [planTier, setPlanTier] = useState<PlanTier>("Básico");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !description || !city || !email) return;
    if (requiresCadastur && !cadastur) return;
    if (!legalOk) return;
    if (!legalAccepted) acceptLegal();

    const business: Business = {
      id: crypto.randomUUID(),
      name,
      type,
      planTier,
      description,
      city,
      state,
      country: "Brasil",
      email,
      phone: phone || undefined,
      website: website || undefined,
      cadastur: cadastur || undefined,
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
            {businessTypes.map((t) => (
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
            <select value={state} onChange={(e) => setState(e.target.value)}>
              {BRAZILIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            País
            <input value="Brasil" disabled />
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

        <label>
          Cadastur {requiresCadastur ? "" : "(opcional)"}
          <input
            value={cadastur}
            onChange={(e) => setCadastur(e.target.value)}
            placeholder="Número de registro no Ministério do Turismo"
            required={requiresCadastur}
          />
          <span className="muted">
            {requiresCadastur
              ? "Obrigatório por lei para agências, guias e meios de hospedagem venderem serviços de turismo no Brasil."
              : "Se você tem registro no Ministério do Turismo, informe para ganhar o selo de verificado."}
          </span>
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

        <LegalAcceptance checked={legalChecked} onChange={setLegalChecked} />

        <button type="submit" className="btn-primary" disabled={!legalOk}>
          Concluir cadastro
        </button>
      </form>
    </div>
  );
}
