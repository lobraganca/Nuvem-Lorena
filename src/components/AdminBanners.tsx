import { useState } from "react";
import { useAvena } from "../store/AvenaContext";
import { PhotoPicker } from "./PhotoPicker";
import {
  RESPONSIBLE_TOURISM_BANNER,
  bannerPlacements,
  isBannerLive,
  placementLabel,
} from "../lib/banners";
import type { Banner, BannerKind, BannerPlacement } from "../types";

const kindLabel: Record<BannerKind, string> = {
  institucional: "Institucional (mensagem da Avena)",
  publicidade: "Publicidade (anunciante pagante)",
};

function emptyBanner(): Banner {
  return {
    id: crypto.randomUUID(),
    placement: "home-top",
    kind: "institucional",
    title: "",
    text: "",
    active: true,
  };
}

/** Where Lorena creates and schedules the banners travellers see. */
export function AdminBanners() {
  const { banners, saveBanner, removeBanner } = useAvena();
  const [draft, setDraft] = useState<Banner>(emptyBanner);

  function set<K extends keyof Banner>(key: K, value: Banner[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim() || !draft.text.trim()) return;
    saveBanner({ ...draft, title: draft.title.trim(), text: draft.text.trim() });
    setDraft(emptyBanner());
  }

  return (
    <>
      <h2 className="timeline-title">Banner padrão</h2>
      <p className="muted">
        A mensagem de turismo responsável aparece no topo da tela inicial sempre
        que não houver outro banner programado para aquele espaço. Ela vem com o
        app, é traduzida junto com o resto e não pode ser apagada por engano.
      </p>
      <div className="banner banner-institucional">
        <div className="banner-body">
          <strong className="banner-title">
            O Avena é a favor do turismo responsável
          </strong>
          <p className="banner-text">
            Respeite a natureza, a cultura e as comunidades que recebem você.
            Prefira guias registrados no Cadastur, não alimente nem toque em
            animais silvestres e leve seu lixo de volta.
          </p>
          <span className="muted">
            Espaço: {placementLabel[RESPONSIBLE_TOURISM_BANNER.placement]}
          </span>
        </div>
      </div>

      <h2 className="timeline-title">Novo banner</h2>
      <form className="booking-form" onSubmit={submit}>
        <div className="form-row">
          <label>
            Espaço
            <select
              value={draft.placement}
              onChange={(e) => set("placement", e.target.value as BannerPlacement)}
            >
              {bannerPlacements.map((p) => (
                <option key={p} value={p}>
                  {placementLabel[p]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select
              value={draft.kind}
              onChange={(e) => set("kind", e.target.value as BannerKind)}
            >
              {(Object.keys(kindLabel) as BannerKind[]).map((k) => (
                <option key={k} value={k}>
                  {kindLabel[k]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {draft.kind === "publicidade" && (
          <p className="muted">
            Banners de publicidade aparecem com o selo "Publicidade". O Código de
            Defesa do Consumidor exige que o anúncio seja identificável como tal.
          </p>
        )}

        <label>
          Título
          <input value={draft.title} onChange={(e) => set("title", e.target.value)} required />
        </label>
        <label>
          Texto
          <textarea
            value={draft.text}
            onChange={(e) => set("text", e.target.value)}
            rows={3}
            required
          />
        </label>

        <PhotoPicker
          photos={draft.image ? [draft.image] : []}
          onChange={(photos) => set("image", photos[0])}
          max={1}
          label="Imagem do banner"
          hint="Opcional. A imagem é reduzida automaticamente."
        />

        <div className="form-row">
          <label>
            Link (opcional)
            <input
              type="url"
              value={draft.linkUrl ?? ""}
              onChange={(e) => set("linkUrl", e.target.value || undefined)}
              placeholder="https://"
            />
          </label>
          <label>
            Texto do botão
            <input
              value={draft.linkLabel ?? ""}
              onChange={(e) => set("linkLabel", e.target.value || undefined)}
              placeholder="Saiba mais"
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Começa em (opcional)
            <input
              type="date"
              value={draft.startsAt ?? ""}
              onChange={(e) => set("startsAt", e.target.value || undefined)}
            />
          </label>
          <label>
            Termina em (opcional)
            <input
              type="date"
              value={draft.endsAt ?? ""}
              onChange={(e) => set("endsAt", e.target.value || undefined)}
            />
          </label>
        </div>

        <button type="submit" className="btn-primary">
          Publicar banner
        </button>
      </form>

      <h2 className="timeline-title">
        {banners.length} {banners.length === 1 ? "banner criado" : "banners criados"}
      </h2>
      <div className="timeline">
        {banners.map((banner) => (
          <div key={banner.id} className="booking-card">
            <div className="timeline-card-title">
              {banner.title}
              <span
                className={`booking-status ${
                  isBannerLive(banner)
                    ? "booking-status-confirmada"
                    : "booking-status-expirada"
                }`}
              >
                {isBannerLive(banner) ? "No ar" : "Fora do ar"}
              </span>
            </div>
            <div className="muted">
              {placementLabel[banner.placement]} · {kindLabel[banner.kind]}
            </div>
            {(banner.startsAt || banner.endsAt) && (
              <div className="muted">
                {banner.startsAt
                  ? new Date(banner.startsAt).toLocaleDateString("pt-BR")
                  : "sempre"}{" "}
                até{" "}
                {banner.endsAt
                  ? new Date(banner.endsAt).toLocaleDateString("pt-BR")
                  : "sem data final"}
              </div>
            )}
            <p>{banner.text}</p>
            {banner.image && (
              <img src={banner.image} alt="" className="banner-image banner-image-preview" />
            )}
            <div className="chip-row">
              <button
                type="button"
                className="btn-outline"
                onClick={() => saveBanner({ ...banner, active: !banner.active })}
              >
                {banner.active ? "Tirar do ar" : "Colocar no ar"}
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  if (confirm(`Excluir o banner "${banner.title}"?`)) {
                    removeBanner(banner.id);
                  }
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
