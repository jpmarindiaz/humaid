// Map for an alert location. Uses Mapbox GL when online + token is set;
// falls back to a hand-drawn SVG of Colombia with the pin and reference
// regions when offline (or token missing). Both modes accept the same props.

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import type { AlertCoords } from "../types";
// Re-export of the prop shape — used as `coords` here even though the wire
// field is now `coordinates`. Resolved by the parent before passing in.

// Vite injects this at build time. If the user doesn't supply one, we fall
// back to the offline SVG renderer.
const MAPBOX_TOKEN: string | undefined = (import.meta as unknown as {
  env?: Record<string, string>;
}).env?.VITE_MAPBOX_TOKEN;

if (MAPBOX_TOKEN) mapboxgl.accessToken = MAPBOX_TOKEN;

const REFERENCE_PINS: { name: string; lat: number; lon: number }[] = [
  { name: "La Mojana",   lat: 8.7,  lon: -74.7 },
  { name: "Putumayo",    lat: 0.5,  lon: -76.0 },
];

export default function AlertMap({
  coords,
  region,
  severity,
}: {
  coords?: AlertCoords;
  region: string;
  severity: string;
}) {
  // Pick a sensible default if the alert didn't include coords.
  const target = useMemo(() => {
    if (coords) return coords;
    if (region === "la-mojana") return REFERENCE_PINS[0];
    if (region === "putumayo") return REFERENCE_PINS[1];
    return { lat: 4.6, lon: -74.1 } as AlertCoords; // Bogotá
  }, [coords, region]);

  const haveToken = !!MAPBOX_TOKEN;
  const [mapboxFailed, setMapboxFailed] = useState(false);
  const useOnline = haveToken && navigator.onLine && !mapboxFailed;

  if (useOnline) {
    return (
      <MapboxView
        target={target}
        severity={severity}
        onFail={() => setMapboxFailed(true)}
      />
    );
  }
  return <SvgFallback target={target} severity={severity} reason={!haveToken ? "no-token" : "offline"} />;
}

function MapboxView({
  target,
  severity,
  onFail,
}: {
  target: AlertCoords;
  severity: string;
  onFail: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: ref.current,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [target.lon, target.lat],
        zoom: 9,
        attributionControl: false,
      });
    } catch (e) {
      console.error("mapbox init failed", e);
      onFail();
      return;
    }
    mapRef.current = map;

    map.on("error", (e) => {
      console.error("mapbox error", e);
      onFail();
    });

    const markerEl = document.createElement("div");
    markerEl.className = severity === "severe" ? "alert-pin alert-pin-severe" : "alert-pin";
    new mapboxgl.Marker({ element: markerEl })
      .setLngLat([target.lon, target.lat])
      .addTo(map);

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

    // Animate in shortly after load — feels less abrupt than a hard center.
    map.once("load", () => {
      map.flyTo({ center: [target.lon, target.lat], zoom: 11, duration: 1400 });
    });

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fly when the target changes (e.g. user picks a different alert).
  useEffect(() => {
    mapRef.current?.flyTo({ center: [target.lon, target.lat], zoom: 11, duration: 1200 });
  }, [target.lat, target.lon]);

  return <div ref={ref} className="w-full h-full" />;
}

// ── Offline SVG fallback ────────────────────────────────────────────────

// Very rough simplified outline of Colombia. Coordinates are (lon, lat). This
// is a "good enough for an alert pin" fallback, not a cartographic feature.
const COLOMBIA_OUTLINE: [number, number][] = [
  [-77.6, 7.9],   // Caribbean NW
  [-75.6, 9.4],
  [-72.5, 11.7],  // Guajira
  [-71.0, 12.4],
  [-71.8, 11.0],
  [-69.7, 10.5],
  [-68.1, 8.5],   // Venezuela border
  [-67.0, 6.2],
  [-67.5, 1.8],
  [-69.4, 1.2],
  [-69.8, -1.6],
  [-70.0, -3.8],  // Amazon trifinio
  [-72.6, -2.4],  // Amazon
  [-74.5, -0.7],  // Putumayo
  [-76.4, 0.4],
  [-78.1, 0.8],
  [-78.9, 1.7],   // Pacific south
  [-78.4, 3.2],
  [-77.4, 6.0],
  [-77.7, 7.6],
  [-77.6, 7.9],   // close
];

function SvgFallback({
  target,
  severity,
  reason,
}: {
  target: AlertCoords;
  severity: string;
  reason: "no-token" | "offline";
}) {
  // Bounding box of Colombia (slight padding).
  const minLon = -82, maxLon = -65;
  const minLat = -5,  maxLat = 13;
  const w = 600, h = 640;
  const project = (lon: number, lat: number) => ({
    x: ((lon - minLon) / (maxLon - minLon)) * w,
    y: ((maxLat - lat) / (maxLat - minLat)) * h,
  });

  const outline = COLOMBIA_OUTLINE.map(([lon, lat]) => {
    const { x, y } = project(lon, lat);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const { x: tx, y: ty } = project(target.lon, target.lat);
  const pinColor = severity === "severe" ? "#a3431c" : "#d97706";

  return (
    <div className="relative w-full h-full bg-deep">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        <defs>
          <pattern id="cream-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="#fbf4e3" />
            <path d="M 40 0 L 0 0 0 40" stroke="#e3dccd" strokeWidth="0.5" fill="none" />
          </pattern>
        </defs>
        <rect width={w} height={h} fill="url(#cream-grid)" />
        {/* Country outline */}
        <polygon
          points={outline}
          fill="#f3ede0"
          stroke="#7a6f5e"
          strokeWidth="1.5"
        />
        {/* Reference regions */}
        {REFERENCE_PINS.map((p) => {
          const { x, y } = project(p.lon, p.lat);
          return (
            <g key={p.name}>
              <circle cx={x} cy={y} r={5} fill="#7a6f5e" opacity="0.4" />
              <text
                x={x + 8}
                y={y + 4}
                fontSize="11"
                fill="#4a3f33"
                fontFamily="ui-sans-serif, system-ui"
              >
                {p.name}
              </text>
            </g>
          );
        })}
        {/* Alert pin (animated pulse) */}
        <g>
          <circle cx={tx} cy={ty} r={20} fill={pinColor} opacity="0.18">
            <animate attributeName="r" values="20;36;20" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.32;0;0.32" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle cx={tx} cy={ty} r={9} fill={pinColor} stroke="#fff" strokeWidth="2" />
        </g>
      </svg>
      <div className="absolute bottom-2 right-2 text-[10px] text-muted bg-cream/80 backdrop-blur px-2 py-1 rounded">
        {reason === "no-token" ? "offline map · set VITE_MAPBOX_TOKEN for live tiles" : "offline · simplified map"}
      </div>
    </div>
  );
}
