import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export type PlotMarker = {
  id: string;
  name: string;
  lng: number;
  lat: number;
  status: "Proceed" | "Pending" | "Stop" | string;
};

type FarmSatelliteMapProps = {
  center?: { lng: number; lat: number };
  zoom?: number;
  plots?: PlotMarker[];
  onPlotClick?: (plotId: string) => void;
};

export function FarmSatelliteMap({
  center,
  zoom = 12,
  plots = [],
  onPlotClick,
}: FarmSatelliteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // Add `VITE_MAPBOX_ACCESS_TOKEN=your_token_here` to `frontend/.env`, then restart Vite to load it.
  const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

  const resolvedCenter = useMemo(() => {
    if (center) return center;
    if (plots.length > 0) return { lng: plots[0].lng, lat: plots[0].lat };
    return { lng: 0, lat: 0 };
  }, [center, plots]);

  useEffect(() => {
    if (!mapboxToken) {
      console.error("Missing VITE_MAPBOX_TOKEN for Mapbox.");
      return;
    }

    if (!mapContainerRef.current) return;

    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [resolvedCenter.lng, resolvedCenter.lat],
      zoom,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [mapboxToken, resolvedCenter.lng, resolvedCenter.lat, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const statusColor = (status: PlotMarker["status"]) => {
      switch (status) {
        case "Proceed":
          return "#16A34A";
        case "Pending":
          return "#F59E0B";
        case "Stop":
          return "#DC2626";
        default:
          return "#6B7280";
      }
    };

    plots.forEach((plot) => {
      const el = document.createElement("div");
      el.style.width = "12px";
      el.style.height = "12px";
      el.style.borderRadius = "9999px";
      el.style.backgroundColor = statusColor(plot.status);
      el.style.border = "2px solid #FFFFFF";
      el.style.boxShadow = "0 0 0 2px rgba(0, 0, 0, 0.08)";
      el.style.cursor = "pointer";

      const popup = new mapboxgl.Popup({ offset: 14 }).setHTML(
        `<div style="font-size:12px;line-height:1.2;"><strong>${plot.name}</strong><br/>ID: ${plot.id}</div>`
      );
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([plot.lng, plot.lat])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener("click", () => {
        marker.togglePopup();
        onPlotClick?.(plot.id);
      });

      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [plots, onPlotClick]);

  return (
    <div className="relative w-full" style={{ height: 360 }}>
      <div ref={mapContainerRef} className="h-full w-full rounded-2xl overflow-hidden" />
      {!mapboxToken && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#F9FAFB] text-[#6B7280] text-sm px-6 text-center">
          Mapbox access token missing. Add VITE_MAPBOX_ACCESS_TOKEN to your env file to enable the satellite map.
        </div>
      )}
    </div>
  );
}
