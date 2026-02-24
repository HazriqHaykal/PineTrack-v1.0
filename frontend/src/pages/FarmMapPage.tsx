import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/card";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { listPlots, listTasks } from "../lib/api";
import type { Plot, Task } from "../lib/api";
import { calcHarvestProgressPercent } from "../lib/progress";
import { sortPlotsById } from "../lib/sortPlots";
import { FarmSatelliteMap } from "../components/FarmSatelliteMap";
import { PlotCard } from "../components/PlotCard";
import { getPlotStatusFromTasks } from "../lib/plotStatus";

interface FarmMapPageProps {
  onNavigate: (page: string, plotId?: string) => void;
}

type PlotVM = Plot & {
  progressPercent: number;
  lng: number | null;
  lat: number | null;
  overallStatus: Plot["status"];
};

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function FarmMapPage({ onNavigate }: FarmMapPageProps) {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const loadPlots = useCallback(async () => {
    setLoading(true);
    try {
      const [plotsRes, tasksRes] = await Promise.all([listPlots(), listTasks()]);
      setPlots(sortPlotsById(plotsRes.data ?? []));
      setTasks(tasksRes.data ?? []);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load plots";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlots();
  }, [loadPlots]);

  useEffect(() => {
    const handler = () => {
      loadPlots();
    };
    window.addEventListener("tasks:refresh", handler);
    return () => window.removeEventListener("tasks:refresh", handler);
  }, [loadPlots]);

  const plotsVM: PlotVM[] = useMemo(() => {
    const tasksByPlot = new Map<string, Task[]>();
    for (const task of tasks) {
      const plotId = String(task.plot_id ?? "").trim();
      if (!plotId) continue;
      const bucket = tasksByPlot.get(plotId) ?? [];
      bucket.push(task);
      tasksByPlot.set(plotId, bucket);
    }

    return (plots ?? []).map((p) => {
      const lng = toNumber(p.location_x);
      const lat = toNumber(p.location_y);
      const plotTasks = tasksByPlot.get(p.id) ?? [];

      return {
        ...p,
        progressPercent: clamp(calcHarvestProgressPercent(p.planting_date), 0, 100),
        lng,
        lat,
        overallStatus: getPlotStatusFromTasks(plotTasks),
      };
    });
  }, [plots, tasks]);

  const plotMarkers = useMemo(() => {
    return (plotsVM ?? [])
      .map((plot) => {
        const { lng, lat } = plot;
        if (lng === null || lat === null) return null;
        return { id: plot.id, name: plot.name, lng, lat, status: plot.overallStatus };
      })
      .filter(
        (plot): plot is { id: string; name: string; lng: number; lat: number; status: Plot["status"] } =>
          Boolean(plot)
      );
  }, [plotsVM]);

  const mapCenter = useMemo(() => {
    if (plotMarkers.length > 0) {
      return { lng: plotMarkers[0].lng, lat: plotMarkers[0].lat };
    }
    return { lng: 101.9758, lat: 4.2105 };
  }, [plotMarkers]);

  const mapZoom = useMemo(() => (plotMarkers.length > 0 ? 12 : 5), [plotMarkers.length]);

  // Only plots with usable coordinates
  const mappable = useMemo(() => plotsVM.filter((p) => p.lng !== null && p.lat !== null), [plotsVM]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl text-[#111827] mb-1">Farm Map</h2>
        <p className="text-[#6B7280]">Interactive view of all plantation plots</p>
      </div>

      {/* Legend */}
      <Card className="p-4 rounded-2xl bg-white">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-[#6B7280]" />
            <span className="text-sm text-[#6B7280]">Status Legend:</span>
          </div>

          <div className="flex gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[#16A34A] rounded" />
              <span className="text-sm text-[#111827]">Proceed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[#CA8A04] rounded" />
              <span className="text-sm text-[#111827]">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[#DC2626] rounded" />
              <span className="text-sm text-[#111827]">Stop</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 rounded-2xl bg-white">
        <FarmSatelliteMap
          center={mapCenter}
          zoom={mapZoom}
          plots={plotMarkers}
          onPlotClick={(plotId) => navigate(`/plots/${plotId}`)}
        />
      </Card>

      {/* Map Grid */}
      <Card className="p-8 rounded-2xl bg-white">
        {loading && (
          <div className="text-sm text-[#6B7280]">Loading plots from database…</div>
        )}

        {!loading && mappable.length === 0 && (
          <div className="text-sm text-[#6B7280]">
            No plots with coordinates found. Please ensure <b>location_x</b> and <b>location_y</b> are filled in
            the <b>plots</b> table.
          </div>
        )}

        {!loading && mappable.length > 0 && (
          <div
            className={`grid gap-6 ${
              plots.length > 8 ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1 md:grid-cols-2"
            }`}
          >
            {mappable.map((plot) => (
              <PlotCard
                key={plot.id}
                plot={plot}
                progressPercent={plot.progressPercent}
                status={plot.overallStatus}
                variant="farmMap"
                ariaLabel={`${plot.name}, status: ${plot.overallStatus}`}
                onClick={() => onNavigate("plot-details", plot.id)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
