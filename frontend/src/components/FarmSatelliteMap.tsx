import { useEffect, useMemo, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

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
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const resolvedCenter = useMemo(() => {
    if (center) return center;
    if (plots.length > 0) return { lng: plots[0].lng, lat: plots[0].lat };
    return { lng: 0, lat: 0 };
  }, [center, plots]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [resolvedCenter.lat, resolvedCenter.lng],
      zoom,
      zoomControl: false,
    });

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution:
          'Tiles &copy; Esri &mdash; Source: Esri, USGS, NOAA',
        maxZoom: 19,
      }
    ).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
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
      const iconHtml = `
        <div style="width:16px;height:16px;border-radius:50%;background:${statusColor(
          plot.status
        )};border:2px solid #fff;box-shadow:0 0 0 2px rgba(0,0,0,0.08);"></div>`;

      const marker = L.marker([plot.lat, plot.lng], {
        icon: L.divIcon({
          className: "",
          html: iconHtml,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).addTo(map);

      marker.bindPopup(
        `<div style="font-size:12px;line-height:1.3;"><strong>${plot.name}</strong><br/>ID: ${plot.id}</div>`
      );

      marker.on("click", () => {
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
