import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export const STATUS_COLORS = {
  Pending: "#F43F5E",
  Assigned: "#8B5CF6",
  "In Progress": "#F59E0B",
  Resolved: "#10B981",
};

export function makePinIcon(color, pulse = false) {
  return L.divIcon({
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<div class="map-pin">${
      pulse ? `<span class="pin-ring" style="--c:${color}"></span>` : ""
    }<span class="pin-dot" style="--c:${color}"></span></div>`,
  });
}

function ClickPicker({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyTo({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, Math.max(map.getZoom(), 15), { duration: 1.1 });
  }, [center, map]);
  return null;
}

export default function IssueMap({
  center = [12.9716, 77.5946],
  zoom = 12,
  issues = [],
  onPick,
  pickerPos,
  flyTo,
  renderPopup,
  className = "h-full w-full",
}) {
  return (
    <MapContainer center={center} zoom={zoom} className={className} style={{ background: "#0B0F16" }}>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      {onPick && <ClickPicker onPick={onPick} />}
      {flyTo && <FlyTo center={flyTo} />}
      {pickerPos && (
        <Marker
          position={[pickerPos.lat, pickerPos.lng]}
          draggable
          icon={makePinIcon("#00F0FF", true)}
          eventHandlers={{
            dragend: (e) => {
              const p = e.target.getLatLng();
              onPick && onPick(p.lat, p.lng);
            },
          }}
        />
      )}
      {issues.map((i) =>
        i.lat && i.lng ? (
          <Marker
            key={i.id}
            position={[i.lat, i.lng]}
            icon={makePinIcon(
              STATUS_COLORS[i.status] || "#00F0FF",
              i.status === "Pending" || i.status === "In Progress"
            )}
          >
            {renderPopup && <Popup>{renderPopup(i)}</Popup>}
          </Marker>
        ) : null
      )}
    </MapContainer>
  );
}
