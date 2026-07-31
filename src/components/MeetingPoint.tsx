import { MapContainer, Marker, TileLayer } from "react-leaflet";
import { divIcon } from "leaflet";
import type { Business } from "../types";

/**
 * Where to meet, on a map, with a way to be taken there.
 *
 * The address alone is not enough on the day of the tour: people are already
 * on the street, often in a city they do not know, sometimes late. What they
 * need is the pin and the button that hands the route to the app they already
 * use for driving.
 *
 * The route opens in Google Maps, Waze or Apple Maps rather than being drawn
 * here, and that is deliberate — turn-by-turn navigation with live traffic is
 * not something to reimplement, and the traveller already trusts theirs.
 */

/** Google Maps directions, which every phone opens — app if installed, site if not. */
function directionsUrl(business: Business): string {
  const label = [business.meetingPoint, business.address, business.name]
    .filter(Boolean)
    .join(", ");
  // With coordinates the pin is exact; without them the address is the query,
  // which is still better than nothing but can land on the wrong side of town.
  const destination =
    business.lat != null && business.lng != null
      ? `${business.lat},${business.lng}`
      : `${label}, ${business.city}${business.state ? ` - ${business.state}` : ""}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    destination
  )}`;
}

function pin() {
  return divIcon({
    html: `<span class="meeting-pin"></span>`,
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });
}

export function MeetingPoint({ business }: { business: Business }) {
  const hasPoint = business.lat != null && business.lng != null;
  const hasAnything = hasPoint || business.address || business.meetingPoint;
  if (!hasAnything) return null;

  return (
    <section className="meeting-point">
      <h2 className="timeline-title">Onde encontrar</h2>

      {business.meetingPoint && <p className="meeting-note">{business.meetingPoint}</p>}
      {business.address && (
        <p className="muted">
          {business.address} — {business.city}
          {business.state ? `, ${business.state}` : ""}
        </p>
      )}

      {hasPoint && (
        <MapContainer
          center={[business.lat as number, business.lng as number]}
          zoom={15}
          scrollWheelZoom={false}
          className="meeting-map"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker
            position={[business.lat as number, business.lng as number]}
            icon={pin()}
          />
        </MapContainer>
      )}

      <a
        className="btn-primary meeting-go"
        href={directionsUrl(business)}
        target="_blank"
        rel="noreferrer"
      >
        Como chegar
      </a>

      {!hasPoint && (
        // Said out loud, because a route to an address is a guess and a route
        // to a pin is not — and the difference shows up on the morning of the
        // tour, with the boat leaving.
        <p className="muted">
          Esta empresa ainda não marcou o ponto no mapa. A rota vai pelo
          endereço, que pode cair perto e não exato — confirme com ela antes.
        </p>
      )}
    </section>
  );
}
