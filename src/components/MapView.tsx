import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export interface MapMarker {
  lat: number;
  lon: number;
  label: string;
  color?: string;
}

export interface MapLine {
  path: [number, number][];
  color?: string;
  dashed?: boolean;
  label?: string;
}

/** Points along the great circle between two coordinates, unwrapped so lines don't jump across the map. */
export function greatCircle(a: { lat: number; lon: number }, b: { lat: number; lon: number }, steps = 48): [number, number][] {
  const rad = Math.PI / 180;
  const [φ1, λ1, φ2, λ2] = [a.lat * rad, a.lon * rad, b.lat * rad, b.lon * rad];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  if (d === 0) return [[a.lat, a.lon]];
  const out: [number, number][] = [];
  let prevLon = a.lon;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    let lon = Math.atan2(y, x) / rad;
    while (lon - prevLon > 180) lon -= 360;
    while (lon - prevLon < -180) lon += 360;
    prevLon = lon;
    out.push([Math.atan2(z, Math.sqrt(x * x + y * y)) / rad, lon]);
  }
  return out;
}

// Standard OpenStreetMap tiles (free, no key), darkened in CSS to match the theme.
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * A dark OpenStreetMap map that fits itself to the given markers and lines (or
 * just to `focus`, when given).
 */
export function MapView({ markers, lines, focus, height = 380 }: { markers: MapMarker[]; lines: MapLine[]; focus?: [number, number][]; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current) return;
    map.current = L.map(el.current, { zoomControl: true, worldCopyJump: true, attributionControl: true }).setView([20, 0], 2);
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19, className: "dark-tiles" }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const group = layer.current;
    if (!m || !group) return;
    group.clearLayers();
    // Keep everything on one copy of the world, so a flight across the date
    // line (SFO → Tokyo) ends where the Tokyo markers are.
    const ref = markers[0]?.lon ?? lines[0]?.path[0]?.[1] ?? 0;
    const shift = (lon: number) => 360 * Math.round((ref - lon) / 360);
    const bounds: [number, number][] = [];
    for (const raw of lines) {
      if (raw.path.length < 2) continue;
      const s = shift(raw.path[0][1]);
      const line = { ...raw, path: raw.path.map(([lat, lon]) => [lat, lon + s] as [number, number]) };
      const poly = L.polyline(line.path, { color: line.color ?? "#7fb38f", weight: 3, opacity: 0.9, dashArray: line.dashed ? "6 8" : undefined });
      if (line.label) poly.bindTooltip(line.label, { sticky: true });
      poly.addTo(group);
      bounds.push(...line.path);
    }
    for (const raw of markers) {
      const mk = { ...raw, lon: raw.lon + shift(raw.lon) };
      L.circleMarker([mk.lat, mk.lon], { radius: 7, color: "#0d1110", weight: 2, fillColor: mk.color ?? "#7fb38f", fillOpacity: 1 })
        .bindTooltip(mk.label)
        .addTo(group);
      bounds.push([mk.lat, mk.lon]);
    }
    const target = focus?.length ? focus.map(([lat, lon]) => [lat, lon + shift(lon)] as [number, number]) : bounds;
    // The container may have been resized while hidden.
    m.invalidateSize();
    if (target.length === 1) m.setView(target[0], 12);
    else if (target.length > 1) m.fitBounds(L.latLngBounds(target), { padding: [36, 36], maxZoom: 13 });
  }, [markers, lines, focus]);

  return <div ref={el} className="map" style={{ height }} />;
}
