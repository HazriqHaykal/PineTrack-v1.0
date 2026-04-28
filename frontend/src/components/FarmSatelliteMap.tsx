import { useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

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
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const resolvedCenter = useMemo(() => {
    if (center) return center;
    if (plots.length > 0) return { lng: plots[0].lng, lat: plots[0].lat };
    return { lng: 0, lat: 0 };
  }, [center, plots]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [resolvedCenter.lng, resolvedCenter.lat],
      zoom,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [resolvedCenter.lng, resolvedCenter.lat, zoom]);

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

      const popup = new maplibregl.Popup({ offset: 14 }).setHTML(
        `<div style="font-size:12px;line-height:1.2;"><strong>${plot.name}</strong><br/>ID: ${plot.id}</div>`
      );
      const marker = new maplibregl.Marker({ element: el })
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
    </div>
  );
}
