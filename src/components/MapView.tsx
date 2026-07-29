import { useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { divIcon } from "leaflet";
import { Link } from "react-router-dom";
import type { Experience } from "../types";
import { categoryColor } from "../lib/categories";
import { clusterExperiences, type Cluster } from "../lib/mapClusters";
import { useT } from "../i18n";

/** A single memory: a solid dot in the category colour, no emoji. */
function pinIcon(color: string) {
  return divIcon({
    html: `<span class="map-pin" style="--pin-color:${color}"></span>`,
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });
}

/** Several memories in the same spot, shown as a count. */
function clusterIcon(count: number) {
  const size = count > 20 ? 46 : count > 5 ? 40 : 34;
  return divIcon({
    html: `<span class="map-cluster" style="--cluster-size:${size}px">${count}</span>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function ClusterLayer({ experiences }: { experiences: Experience[] }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });

  const clusters = clusterExperiences(experiences, zoom);

  return (
    <>
      {clusters.map((cluster) =>
        cluster.items.length === 1 ? (
          <SinglePin key={cluster.id} experience={cluster.items[0]} />
        ) : (
          <ClusterPin key={cluster.id} cluster={cluster} />
        )
      )}
    </>
  );
}

function SinglePin({ experience }: { experience: Experience }) {
  return (
    <Marker
      position={[experience.lat, experience.lng] as [number, number]}
      icon={pinIcon(categoryColor[experience.category])}
      alt={`${experience.title}, ${experience.locationName}`}
    >
      <Popup>
        <div className="map-popup">
          <strong>{experience.title}</strong>
          <div>{experience.locationName}</div>
          <div className="muted">
            {new Date(experience.date).toLocaleDateString("pt-BR")}
          </div>
          <Link to={`/experience/${experience.id}`}>Ver detalhes</Link>
        </div>
      </Popup>
    </Marker>
  );
}

function ClusterPin({ cluster }: { cluster: Cluster }) {
  const map = useMap();
  const places = [...new Set(cluster.items.map((e) => e.locationName))];

  return (
    <Marker
      position={[cluster.lat, cluster.lng] as [number, number]}
      icon={clusterIcon(cluster.items.length)}
      alt={`${cluster.items.length} experiências nesta região`}
      eventHandlers={{
        // Clicking a group zooms in until the pins separate on their own.
        click: () => map.setView([cluster.lat, cluster.lng], map.getZoom() + 3),
      }}
    >
      <Popup>
        <div className="map-popup">
          <strong>{cluster.items.length} experiências aqui</strong>
          <div className="muted">{places.slice(0, 3).join(" · ")}</div>
          <ul className="map-popup-list">
            {cluster.items.slice(0, 5).map((exp) => (
              <li key={exp.id}>
                <Link to={`/experience/${exp.id}`}>{exp.title}</Link>
              </li>
            ))}
          </ul>
          {cluster.items.length > 5 && (
            <div className="muted">e mais {cluster.items.length - 5}</div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

export function MapView({ experiences }: { experiences: Experience[] }) {
  // The map tiles are the one thing that cannot be bundled: they come from
  // OpenStreetMap. When they fail — offline, or on a host that blocks external
  // images — a silent grey rectangle looks like a broken app, so it says what
  // happened. The pins keep working either way.
  const [tilesFailed, setTilesFailed] = useState(false);
  const t = useT();

  return (
    <div className="map-wrap">
      {tilesFailed && (
        <p className="map-tiles-note" role="status">
          {t("map.tilesUnavailable")}
        </p>
      )}
      <MapContainer
        center={[-14, -51] as [number, number]}
        zoom={4}
        scrollWheelZoom
        className="avena-map"
        /* Keeps the top-left clear for the search bar overlay. */
        zoomControl={false}
      >
        <ZoomControl position="bottomleft" />
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{ tileerror: () => setTilesFailed(true) }}
        />
        <ClusterLayer experiences={experiences} />
      </MapContainer>
    </div>
  );
}
