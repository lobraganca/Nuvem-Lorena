import { useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import { divIcon } from "leaflet";
import { useAvena } from "../store/AvenaContext";
import type { Business } from "../types";

function pin() {
  return divIcon({
    html: `<span class="meeting-pin"></span>`,
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });
}

function Catcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/**
 * Where the business tells the traveller to meet it.
 *
 * The pin is tapped on the map rather than typed, because nobody knows their
 * own latitude — and because an address alone routes to the street, which on
 * the morning of a boat trip is the difference between arriving and missing
 * it. The sentence beside it is for what a map cannot say: which gate, which
 * kiosk, the blue van.
 */
export function MeetingPointEditor({ business }: { business: Business }) {
  const { updateBusiness } = useAvena();
  const [address, setAddress] = useState(business.address ?? "");
  const [meetingPoint, setMeetingPoint] = useState(business.meetingPoint ?? "");
  const [lat, setLat] = useState<number | null>(business.lat ?? null);
  const [lng, setLng] = useState<number | null>(business.lng ?? null);
  const [saved, setSaved] = useState(false);

  const hasPoint = lat !== null && lng !== null;

  function save(e: React.FormEvent) {
    e.preventDefault();
    updateBusiness(business.id, {
      address: address.trim() || undefined,
      meetingPoint: meetingPoint.trim() || undefined,
      lat: lat ?? undefined,
      lng: lng ?? undefined,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form className="experience-form" onSubmit={save}>
      <h2 className="timeline-title">Onde encontrar você</h2>
      <p className="muted">
        Aparece na sua página com um mapa e um botão que leva o viajante até
        aqui pelo Google Maps.
      </p>

      <label>
        Endereço
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Rua e número, ou o nome do lugar"
        />
      </label>

      <label>
        Ponto de encontro
        <input
          value={meetingPoint}
          onChange={(e) => setMeetingPoint(e.target.value)}
          placeholder="Ex.: em frente ao quiosque 3, na van azul"
        />
        <span className="muted">
          O que o mapa não diz: qual portão, qual quiosque, qual carro.
        </span>
      </label>

      <label>
        Ponto no mapa
        <span className="muted">
          {hasPoint
            ? "Toque em outro lugar para corrigir."
            : "Toque no mapa para marcar. Sem isso, a rota vai pelo endereço e pode cair perto, não exato."}
        </span>
      </label>

      <MapContainer
        center={hasPoint ? [lat, lng] : [-14, -51]}
        zoom={hasPoint ? 15 : 4}
        scrollWheelZoom={false}
        className="meeting-map"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Catcher
          onPick={(a, b) => {
            setLat(a);
            setLng(b);
          }}
        />
        {hasPoint && <Marker position={[lat, lng]} icon={pin()} />}
      </MapContainer>

      <button type="submit" className="btn-primary">
        Salvar local
      </button>
      {saved && <p className="availability-ok">Local salvo.</p>}
    </form>
  );
}
