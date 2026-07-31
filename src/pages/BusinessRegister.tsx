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
import type { Business, BusinessType, LegalDetails, PlanTier } from "../types";
import { ModerationNotice, isPublishable } from "../components/ModerationNotice";
import { newId } from "../lib/ids";
import { cadasturLooksValid, formatPhone } from "../lib/documents";
import {
  LegalDetailsForm,
  emptyLegalDetails,
  legalDetailsError,
} from "../components/LegalDetailsForm";

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
  const [legal, setLegal] = useState<LegalDetails>(emptyLegalDetails);
  const [step, setStep] = useState<1 | 2>(1);
  const [problem, setProblem] = useState<string | null>(null);

  /** Step one is the shop window; step two is what the law and the bank need. */
  function goToLegal(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    if (!name || !description || !city || !email) return;
    if (!isPublishable(`${name} ${description}`)) return;
    if (requiresCadastur && !cadastur) return;
    if (cadastur && !cadasturLooksValid(cadastur)) return;
    // Sensible defaults carried over, so nothing is typed twice.
    setLegal((d) => ({
      ...d,
      legalName: d.legalName || name,
      tradeName: d.tradeName || name,
      city: d.city || city,
      state: d.state || state,
      businessEmail: d.businessEmail || email,
      // Formatted on the way in, so a number typed loose in step one is
      // stored the same way as one typed in the legal form.
      businessPhone: d.businessPhone || formatPhone(phone),
    }));
    setStep(2);
    window.scrollTo({ top: 0 });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    const legalProblem = legalDetailsError(legal);
    if (legalProblem) {
      setProblem(legalProblem);
      return;
    }
    if (!legalOk) return;
    if (!legalAccepted) acceptLegal();

    const business: Business = {
      id: newId(),
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
      legal,
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
      <p className="register-step">Passo {step} de 2</p>

      <form
        className="experience-form"
        onSubmit={goToLegal}
        hidden={step !== 1}
      >
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
            <input
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
            />
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
            placeholder="26.123456.10-4"
            required={requiresCadastur}
          />
          <span className="muted">
            {requiresCadastur
              ? "Obrigatório por lei para agências, guias e meios de hospedagem venderem serviços de turismo no Brasil."
              : "Se você tem registro no Ministério do Turismo, informe aqui."}
          </span>
          {cadastur && !cadasturLooksValid(cadastur) && (
            <span className="availability-none">
              O Cadastur tem o formato 26.123456.10-4.
            </span>
          )}
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

        <ModerationNotice text={`${name} ${description}`} />
        <button
          type="submit"
          className="btn-primary"
          disabled={!isPublishable(`${name} ${description}`)}
        >
          Continuar
        </button>
      </form>

      {step === 2 && (
        <form className="experience-form" onSubmit={handleSubmit}>
          <h2>Informações legais</h2>
          <p className="muted">
            Precisam estar no nome de quem responde pelo serviço. É o que o
            provedor de pagamento exige antes de repassar qualquer valor, e o
            que a nota fiscal usa.
          </p>

          <LegalDetailsForm value={legal} onChange={setLegal} />

          {problem && <p className="availability-none">{problem}</p>}

          <LegalAcceptance checked={legalChecked} onChange={setLegalChecked} />

          <button type="submit" className="btn-primary" disabled={!legalOk}>
            Concluir cadastro
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              setStep(1);
              window.scrollTo({ top: 0 });
            }}
          >
            Voltar
          </button>

          {/* What the app cannot do yet, said here rather than discovered
              later by an agency waiting for money that never arrives. */}
          <p className="muted">
            A confirmação por SMS e a conta de recebimento entram quando o
            servidor estiver no ar. Até lá o cadastro fica guardado neste
            aparelho e a empresa aparece na busca sem botão de reserva.
          </p>
        </form>
      )}
    </div>
  );
}
