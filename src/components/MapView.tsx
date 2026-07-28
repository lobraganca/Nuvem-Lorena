import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from "react-leaflet";
import { divIcon } from "leaflet";
import { Link } from "react-router-dom";
import type { Experience } from "../types";
import { categoryEmoji } from "../lib/categories";

function pinIcon(emoji: string) {
  return divIcon({
    html: `<div class="map-pin">${emoji}</div>`,
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
}

export function MapView({ experiences }: { experiences: Experience[] }) {
  return (
    <MapContainer
      center={[-14, -51] as [number, number]}
      zoom={3}
      scrollWheelZoom
      className="avena-map"
      /* Keeps the top-left clear for the search bar overlay. */
      zoomControl={false}
    >
      <ZoomControl position="bottomleft" />
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {experiences.map((exp) => (
        <Marker
          key={exp.id}
          position={[exp.lat, exp.lng] as [number, number]}
          icon={pinIcon(categoryEmoji[exp.category])}
        >
          <Popup>
            <div className="map-popup">
              <strong>{exp.title}</strong>
              <div>{exp.locationName}</div>
              <div className="muted">{exp.date}</div>
              <Link to={`/experience/${exp.id}`}>Ver detalhes</Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
