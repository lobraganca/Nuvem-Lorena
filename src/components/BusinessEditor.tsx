import { useState } from "react";
import { useAvena } from "../store/AvenaContext";
import { businessTypes, cadasturRequired } from "../lib/categories";
import { BRAZILIAN_STATES } from "../lib/collections";
import { cadasturLooksValid, formatPhone } from "../lib/documents";
import { ModerationNotice, isPublishable } from "./ModerationNotice";
import type { Business, BusinessType } from "../types";

/**
 * Editar os dados da empresa.
 *
 * Faltava inteiro: o que se digitava no cadastro ficava para sempre. Trocou de
 * telefone, mudou de cidade, corrigiu um erro de digitação no nome — não havia
 * caminho. Para um negócio que vive de ser encontrado, um telefone velho na
 * página é pior do que nenhum.
 *
 * Duas coisas continuam fora daqui, de propósito: o selo de verificado e a
 * suspensão, que são da administradora. Uma empresa que se verifica sozinha é
 * uma empresa não verificada.
 */
export function BusinessEditor({ business }: { business: Business }) {
  const { updateBusiness } = useAvena();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(business.name);
  const [type, setType] = useState<BusinessType>(business.type);
  const [description, setDescription] = useState(business.description);
  const [city, setCity] = useState(business.city);
  const [state, setState] = useState(business.state ?? BRAZILIAN_STATES[0]);
  const [email, setEmail] = useState(business.email);
  const [phone, setPhone] = useState(business.phone ?? "");
  const [website, setWebsite] = useState(business.website ?? "");
  const [cadastur, setCadastur] = useState(business.cadastur ?? "");
  const [saved, setSaved] = useState(false);

  const exigeCadastur = cadasturRequired(type);
  const texto = `${name} ${description}`;

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!isPublishable(texto)) return;
    if (exigeCadastur && !cadastur) return;
    if (cadastur && !cadasturLooksValid(cadastur)) return;
    updateBusiness(business.id, {
      name,
      type,
      description,
      city,
      state,
      email,
      phone: phone || undefined,
      website: website || undefined,
      cadastur: cadastur || undefined,
    });
    setSaved(true);
    setOpen(false);
    window.setTimeout(() => setSaved(false), 2500);
  }

  if (!open) {
    return (
      <>
        <button type="button" className="btn-outline" onClick={() => setOpen(true)}>
          Editar dados da empresa
        </button>
        {saved && <p className="availability-ok">Dados salvos.</p>}
      </>
    );
  }

  return (
    <form className="experience-form" onSubmit={save}>
      <h3>Dados da empresa</h3>

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
      </div>

      <div className="form-row">
        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
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
        Cadastur {exigeCadastur ? "" : "(opcional)"}
        <input
          value={cadastur}
          onChange={(e) => setCadastur(e.target.value)}
          placeholder="26.123456.10-4"
          required={exigeCadastur}
        />
        {cadastur && !cadasturLooksValid(cadastur) && (
          <span className="availability-none">
            O Cadastur tem o formato 26.123456.10-4.
          </span>
        )}
      </label>

      <p className="muted">
        O telefone e o e-mail só aparecem para quem já reservou com você.
      </p>

      <ModerationNotice text={texto} />

      <button type="submit" className="btn-primary" disabled={!isPublishable(texto)}>
        Salvar
      </button>
      <button type="button" className="btn-outline" onClick={() => setOpen(false)}>
        Cancelar
      </button>
    </form>
  );
}
