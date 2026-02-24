import React from "react";
import { Card } from "./ui/card";
import { StatusBadge } from "./StatusBadge";
import type { Plot, PlotStatus } from "../lib/api";
import { MapPin } from "lucide-react";

interface PlotCardProps {
  plot: Plot;
  progressPercent: number;
  onClick?: () => void;
  status?: PlotStatus;
  variant?: "dashboard" | "farmMap";
  ariaLabel?: string;
}

const getStatusBarClass = (status: PlotStatus) => {
  switch (status) {
    case "Proceed":
      return "bg-[#16A34A]";
    case "Pending":
      return "bg-[#CA8A04]";
    case "Stop":
      return "bg-[#DC2626]";
    default:
      return "bg-[#E5E7EB]";
  }
};

const getCardBackground = (status: PlotStatus) => {
  switch (status) {
    case "Proceed":
      return "bg-[#16A34A] hover:bg-[#15803D]";
    case "Pending":
      return "bg-[#CA8A04] hover:bg-[#B87A04]";
    case "Stop":
      return "bg-[#DC2626] hover:bg-[#B91C1C]";
    default:
      return "bg-[#6B7280]";
  }
};

export function PlotCard({
  plot,
  progressPercent,
  onClick,
  status,
  variant = "dashboard",
  ariaLabel,
}: PlotCardProps) {
  const resolvedStatus = status ?? plot.status;
  const interactiveProps = onClick
    ? {
        role: "button" as const,
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") onClick();
        },
      }
    : {};

  if (variant === "farmMap") {
    return (
      <Card
        onClick={onClick}
        aria-label={ariaLabel}
        className={`relative overflow-hidden rounded-2xl p-6 cursor-pointer transition-all transform hover:scale-105 shadow-lg border-0 gap-0 text-white ${getCardBackground(resolvedStatus)}`}
        {...interactiveProps}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-[22px] font-semibold leading-snug mb-1">{plot.name}</h3>
            <p className="text-base text-white/90">{plot.crop_type}</p>
          </div>
          <MapPin size={24} className="text-white/90" />
        </div>

        <div className="space-y-2 text-base text-white/90">
          <p>{plot.area_ha} hectares</p>
        </div>

        <div className="mt-4 pt-4 border-t border-white/20">
          <div className="flex items-center justify-between">
            <span className="text-base text-white/80">Progress</span>
            <span className="text-lg font-semibold text-white">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 bg-white/20 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-white rounded-full"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      onClick={onClick}
      aria-label={ariaLabel}
      className="relative overflow-hidden p-5 rounded-2xl bg-white cursor-pointer hover:shadow-md transition"
      {...interactiveProps}
    >
      <div
        className={`absolute left-0 top-0 h-full w-1.5 ${getStatusBarClass(resolvedStatus)} rounded-l-2xl`}
        aria-hidden="true"
      />
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-[#6B7280]">{plot.id}</p>
          <h4 className="text-lg font-semibold leading-snug text-[#111827]">{plot.name}</h4>
          <p className="text-base text-[#6B7280]">{plot.crop_type}</p>
        </div>
        <StatusBadge status={resolvedStatus} size="sm" />
      </div>

      {/* Meta */}
      <div className="grid grid-cols-1 gap-4 text-sm mb-4">
        <div>
          <p className="text-sm text-[#6B7280]">Area</p>
          <p className="text-base font-medium text-[#111827]">{plot.area_ha} ha</p>
        </div>
      </div>

      {/* Progress (same logic as Plot Management) */}
      <div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-sm text-[#6B7280]">Progress</span>
          <span className="text-base font-semibold text-[#111827]">{progressPercent}%</span>
        </div>
        <div className="w-full h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#3B82F6] rounded-full transition-all"
            style={{ width: `${Math.max(progressPercent, 3)}%` }}
          />
        </div>
      </div>
    </Card>
  );
}
