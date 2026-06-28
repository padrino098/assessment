import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TripDetail } from "../types";
import { KIND_COLORS, KIND_LABELS, fmtElapsed, fmtDuration } from "../utils";

// Fix leaflet's default icon path in Vite bundles
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function makeIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};border:2.5px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,.35);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

interface Props {
  trip: TripDetail;
}

export default function MapView({ trip }: Props) {
  const coords: [number, number][] = (trip.route_geometry?.coordinates ?? []).map(
    ([lng, lat]) => [lat, lng],
  );

  const center: [number, number] =
    coords.length > 0
      ? [
          (Math.min(...coords.map((c) => c[0])) + Math.max(...coords.map((c) => c[0]))) / 2,
          (Math.min(...coords.map((c) => c[1])) + Math.max(...coords.map((c) => c[1]))) / 2,
        ]
      : [39.5, -98.35]; // fallback: geographic center of USA

  // Only show meaningful stops (not individual drive slices)
  const stops = trip.stops.filter((s) =>
    ["start", "pickup", "dropoff", "fuel", "break", "rest", "end"].includes(s.kind),
  );

  return (
    <MapContainer
      center={center}
      zoom={5}
      className="w-full h-full min-h-[400px] rounded-2xl z-0"
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {coords.length > 1 && (
        <Polyline positions={coords} color="#2563eb" weight={3.5} opacity={0.85} />
      )}
      {stops.map((stop) =>
        stop.lat !== null && stop.lng !== null ? (
          <Marker
            key={stop.id}
            position={[stop.lat, stop.lng]}
            icon={makeIcon(KIND_COLORS[stop.kind] ?? "#64748b")}
          >
            <Popup>
              <div className="text-xs leading-relaxed min-w-[160px]">
                <p className="font-semibold text-sm mb-1">{KIND_LABELS[stop.kind] ?? stop.kind}</p>
                <p className="text-slate-600">{stop.label}</p>
                <p className="mt-1 text-slate-500">
                  Arrive: {fmtElapsed(stop.arrive_min)}
                </p>
                {stop.depart_min !== stop.arrive_min && (
                  <p className="text-slate-500">
                    Duration: {fmtDuration(stop.depart_min - stop.arrive_min)}
                  </p>
                )}
                <p className="text-slate-500">
                  Miles so far: {Math.round(stop.miles_so_far).toLocaleString()}
                </p>
              </div>
            </Popup>
          </Marker>
        ) : null,
      )}
    </MapContainer>
  );
}
