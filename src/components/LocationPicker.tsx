import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import { divIcon } from "leaflet";
import { categoryColor } from "../lib/categories";
import type { Category } from "../types";

interface Props {
  lat: number | null;
  lng: number | null;
  category: Category;
  onPick: (lat: number, lng: number) => void;
}

function ClickCatcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

/**
 * Nobody types their own latitude. The place is chosen by tapping the map,
 * which is the only version of this a traveller will actually complete.
 */
export function LocationPicker({ lat, lng, category, onPick }: Props) {
  const hasPoint = lat !== null && lng !== null;

  return (
    <div className="location-picker">
      <MapContainer
        center={hasPoint ? ([lat, lng] as [number, number]) : ([-14, -51] as [number, number])}
        zoom={hasPoint ? 11 : 4}
        scrollWheelZoom={false}
        className="location-picker-map"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickCatcher onPick={onPick} />
        {hasPoint && (
          <Marker
            position={[lat, lng] as [number, number]}
            icon={divIcon({
              html: `<span class="map-pin" style="--pin-color:${categoryColor[category]}"></span>`,
              className: "",
              iconSize: [22, 22],
              iconAnchor: [11, 22],
            })}
            alt="Local escolhido"
          />
        )}
      </MapContainer>
      <p className="muted">
        {hasPoint
          ? `Local marcado em ${lat.toFixed(4)}, ${lng.toFixed(4)}. Toque de novo para corrigir.`
          : "Toque no mapa para marcar onde essa memória aconteceu."}
      </p>
    </div>
  );
}
