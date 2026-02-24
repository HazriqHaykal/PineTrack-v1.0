import type { PlotStatus, Task } from "./api";

export const statusPriority: Record<PlotStatus, number> = {
  Proceed: 0,
  Pending: 1,
  Stop: 2,
};

export function normalizeStatus(value?: string | null): PlotStatus {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "stop" || normalized === "stopped") return "Stop";
  if (normalized === "pending") return "Pending";
  return "Proceed";
}

export function getPlotStatusFromTasks(tasks: Task[]): PlotStatus {
  let current: PlotStatus = "Proceed";
  for (const task of tasks) {
    const status = normalizeStatus(task.decision);
    if (statusPriority[status] > statusPriority[current]) {
      current = status;
    }
    if (current === "Stop") return current;
  }
  return current;
}

export function getPlotOverallStatus(tasks: Task[]): PlotStatus {
  return getPlotStatusFromTasks(tasks);
}
