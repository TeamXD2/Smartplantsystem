import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Species distribution map (proposal item 15), drawn with Leaflet + OpenStreetMap.
// points: [{ id, lat, lng, title, subtitle, href, kind }]
//   kind: 'published' (green), 'research' (orange) or 'sensor' (dark, square).
// Only points that have coordinates are drawn; the parent decides what may be
// shown (the public catalog only gets plants whose location is "Public").
const NIAH = [3.8167, 113.7667]; // Niah National Park

const COLORS = { published: '#1F4D3A', research: '#C97B3D', sensor: '#12211A' };

function icon(kind) {
  const color = COLORS[kind] || COLORS.published;
  const shape = kind === 'sensor'
    ? `<rect x="5" y="5" width="18" height="18" rx="5" fill="${color}" stroke="#fff" stroke-width="3"/>`
    : `<circle cx="14" cy="14" r="9" fill="${color}" stroke="#fff" stroke-width="3"/>`;
  return L.divIcon({
    className: 'map-pin',
    html: `<svg width="28" height="28" viewBox="0 0 28 28">${shape}</svg>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -12],
  });
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default function PlantMap({ points, height = 460 }) {
  const box = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);

  useEffect(() => {
    map.current = L.map(box.current, { scrollWheelZoom: false }).setView(NIAH, 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => map.current.remove();
  }, []);

  useEffect(() => {
    layer.current.clearLayers();
    const shown = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    shown.forEach((p) => {
      const link = p.href ? `<br><a href="${escapeHtml(p.href)}">Open record</a>` : '';
      const marker = L.marker([p.lat, p.lng], { icon: icon(p.kind), title: p.title })
        .bindPopup(`<strong>${escapeHtml(p.title)}</strong>${p.subtitle ? `<br><em>${escapeHtml(p.subtitle)}</em>` : ''}${link}`)
        .addTo(layer.current);
      // Screen readers need a name for each pin
      const el = marker.getElement();
      if (el) el.setAttribute('aria-label', `${p.title}${p.subtitle ? `, ${p.subtitle}` : ''}`);
    });
    if (shown.length > 0) {
      map.current.fitBounds(L.latLngBounds(shown.map((p) => [p.lat, p.lng])).pad(0.3), { maxZoom: 15 });
    }
  }, [points]);

  return <div ref={box} className="plant-map" style={{ height }} role="region" aria-label="Map of plant locations" />;
}
