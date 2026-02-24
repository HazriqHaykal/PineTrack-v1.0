// ---------- Recommendations ----------
export async function getWeatherRescheduleSuggestions(
  tasks: Task[], 
  weatherForecast: Record<string, unknown>[], 
  sensorSummary?: { avg_moisture: number; avg_temp: number }
) {
  const res = await fetch(`${API_BASE}/recommendations/weather-reschedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      tasks, 
      weather_forecast: weatherForecast,
      sensor_summary: sensorSummary 
    })
  });
  if (!res.ok) throw new Error("Failed to fetch insight suggestions");
  return res.json();
}
// src/lib/api.ts

const API_BASE = import.meta.env.DEV
  ? ""
  : (import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE ?? "");

type ApiFetchOptions = RequestInit & {
  skipAuthRedirect?: boolean;
};

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { skipAuthRedirect, ...fetchOptions } = options;
  const token = sessionStorage.getItem("access_token");

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fetchOptions.headers ?? {}),
    },
  });

  if (res.status === 401) {
    sessionStorage.removeItem("access_token");
    if (!skipAuthRedirect && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }


  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed (${res.status})`);
  }

  // Prevent crash for 204 No Content
  if (res.status === 204) return null as unknown as T;

  return (await res.json()) as T;
}

export async function login(username: string, password: string) {
  return apiFetch<{ access_token: string; token_type: string; user?: User }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
    skipAuthRedirect: true,
  });
}

export async function deletePlot(plotId: string) {
  return apiFetch<{ ok: true; deleted_plot_id: string }>(`/api/plots/${plotId}`, {
    method: "DELETE",
  });
}


// ---------- Types ----------
export type PlotStatus = "Proceed" | "Pending" | "Stop";

// Helper interfaces for raw backend responses to avoid 'any'
interface RawBackendPlot extends Partial<Plot> {
    plot_id?: string | number;
}

interface RawBackendTask extends Partial<Omit<Task, 'decision'>> {
    status?: string | PlotStatus;
}


export type Plot = {
  id: string;
  name: string;
  planting_date: string; // YYYY-MM-DD recommended
  location_x: number | null; // grid-based position
  location_y: number | null; // grid-based position
  status: PlotStatus;
  created_at: string;

  // ✅ fields used by FarmMap / PlotDetails UI (keep optional for backward compatibility)
  area_ha?: number | null;
  crop_type?: string | null;
  growth_stage?: string | null;
};

export type Task = {
  id: string;
  plot_id: string;
  title: string;
  type: string;
  task_date: string; // YYYY-MM-DD

  // ✅ frontend single-truth field (mapped from backend "status")
  decision: PlotStatus;

  assigned_worker_id?: string | null;
  assigned_worker_name?: string | null;
  description?: string | null;
  original_date?: string | null;
  proposed_date?: string | null;
  reason?: string | null;
};
export type Worker = {
  id: string;
  name: string;
  role?: string | null;
  tasks_completed?: number | null;
  contact?: string | null;
  avatar_url?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

export type User = {
  id: number;
  username: string;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
  created_at?: string | null;
};

function normalizeWorker(worker: Worker): Worker {
  const rawId = worker?.id;
  return {
    ...worker,
    id: rawId == null ? "" : String(rawId),
  } as Worker;
}

// ---------- Plots ----------
export async function listPlots() {
  const res = await apiFetch<{ ok: true; data: RawBackendPlot[] }>("/api/plots");
  const normalized = (res.data ?? []).map((plot) => {
    const rawId = plot?.id ?? plot?.plot_id;
    return {
      ...plot,
      id: rawId == null ? "" : String(rawId),
    } as Plot;
  });

  return { ...res, data: normalized };
}

export async function createPlotWithPlan(payload: {
  name: string;
  area_ha: number;
  crop_type: string;
  planting_date: string; // YYYY-MM-DD
  growth_stage: string;
  location_x?: number | null;
  location_y?: number | null;
}) {
  return apiFetch<{ message: string; plot_id: string; tasks_created: number }>(
    "/api/plots/create-with-plan",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function updatePlot(
  plotId: string,
  payload: {
    name?: string;
    area_ha?: number;
    crop_type?: string;
    planting_date?: string; // YYYY-MM-DD
  },
) {
  return apiFetch<{ ok: true; data: Plot }>(`/api/plots/${plotId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * ✅ Helper: always get ONE plot by id using the same source
 * (later we can switch to a dedicated backend endpoint without changing pages)
 */
export async function getPlotById(plotId: string): Promise<Plot> {
  const res = await listPlots();
  const targetId = String(plotId);
  const plot = res.data.find((p) => String(p.id) === targetId);
  if (!plot) throw new Error("Plot not found");
  return plot;
}

// ---------- Tasks ----------
export async function listTasks(params?: { plot_id?: string }) {
  const query = params?.plot_id ? `?plot_id=${encodeURIComponent(params.plot_id)}` : "";
  const res = await apiFetch<{ ok: true; data: RawBackendTask[] }>(`/api/tasks${query}`);

  return {
    ...res,
    data: res.data.map((t) => ({
      ...t,
      decision: t.status as PlotStatus, // ✅ standard mapping
    })),
  } as { ok: true; data: Task[] };
}

/** ✅ Helper: always get tasks for ONE plot */
export async function getTasksByPlotId(plotId: string): Promise<Task[]> {
  const res = await listTasks({ plot_id: plotId });
  return res.data;
}

export async function updateTaskAssignment(payload: {
  task_id: string;
  assigned_worker_id: string | null;
  assigned_worker_name: string | null;
}) {
  const res = await apiFetch<{ ok: true; data: RawBackendTask }>(
    `/api/tasks/${encodeURIComponent(payload.task_id)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        assigned_worker_id: payload.assigned_worker_id,
        assigned_worker_name: payload.assigned_worker_name,
      }),
    },
  );

  return {
    ...res,
    data: {
      ...res.data,
      decision: res.data.status as PlotStatus,
    } as Task,
  };
}

// ---------- Workers ----------
export async function listWorkers() {
  const res = await apiFetch<{ ok: true; data: Worker[] }>("/api/workers");
  const normalized = (res.data ?? []).map((worker) => normalizeWorker(worker));

  return { ...res, data: normalized };
}

export async function getWorkers() {
  return listWorkers();
}

export async function createWorker(payload: {
  name: string;
  role?: string | null;
  contact?: string | null;
  is_active?: boolean | null;
}) {
  const res = await apiFetch<{ ok: true; data: Worker }>(`/api/workers`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return { ...res, data: normalizeWorker(res.data) };
}

export async function updateWorker(
  workerId: string,
  payload: { name?: string; role?: string | null; contact?: string | null; is_active?: boolean | null },
) {
  const res = await apiFetch<{ ok: true; data: Worker }>(
    `/api/workers/${encodeURIComponent(workerId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
  return { ...res, data: normalizeWorker(res.data) };
}

export async function deleteWorker(workerId: string) {
  return apiFetch<{ ok: true; deleted_worker_id: string }>(
    `/api/workers/${encodeURIComponent(workerId)}`,
    { method: "DELETE" },
  );
}

// ---------- Users ----------
export async function getCurrentUser() {
  const res = await apiFetch<{ ok?: boolean; data?: User } | User>("/auth/me");
  if ("data" in res && res.data) return res.data;
  return res as User;
}

export async function updateUserProfile(
  userId: string | number,
  payload: { full_name?: string; email?: string | null },
) {
  const res = await apiFetch<{ ok?: boolean; data?: User } | User>(`/api/users/${encodeURIComponent(String(userId))}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if ("data" in res && res.data) return res.data;
  return res as User;
}

export async function changePassword(payload: {
  current_password: string;
  new_password: string;
}) {
  return apiFetch<{ ok: boolean; message?: string }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------- Reschedule Center ----------
/**
 * ✅ Keep same mapping as listTasks so Schedule & Reschedule never disagree.
 * If backend later supports filtering by plot_id, we can add params safely.
 */
export async function listRescheduleProposals() {
  const res = await apiFetch<{ ok: true; data: RawBackendTask[] }>("/api/tasks/reschedule-proposals");

  return {
    ...res,
    data: res.data.map((t) => ({
      ...t,
      decision: t.status as PlotStatus,
    })),
  } as { ok: true; data: Task[] };
}

export async function getDashboardStats() {
  const [plotsRes, tasksRes, workersRes] = await Promise.all([
    listPlots(),
    listTasks(),
    listWorkers(),
  ]);

  return {
    plots: plotsRes.data ?? [],
    tasks: tasksRes.data ?? [],
    workers: workersRes.data ?? [],
  };
}

export async function getPendingRescheduleApprovals(): Promise<Task[]> {
  const res = await listRescheduleProposals();
  return (res.data ?? []).filter((task) => task.proposed_date);
}

export async function approveReschedule(taskId: string) {
  const res = await apiFetch<{ ok: true; data: RawBackendTask }>(`/api/tasks/${taskId}/approve-reschedule`, {
    method: "POST",
  });

  return {
    ...res,
    data: {
      ...res.data,
      decision: res.data.status as PlotStatus,
    } as Task,
  } as { ok: true; data: Task };
}

export async function rejectReschedule(taskId: string) {
  const res = await apiFetch<{ ok: true; data: RawBackendTask }>(`/api/tasks/${taskId}/reject-reschedule`, {
    method: "POST",
  });

  return {
    ...res,
    data: {
      ...res.data,
      decision: res.data.status as PlotStatus,
    } as Task,
  } as { ok: true; data: Task };
}

export async function getAnalyticsHistory(days: number = 30, plotId?: string) {
  let url = `${API_BASE}/analytics/history?days=${days}`;
  if (plotId && plotId !== 'all') {
    url += `&plot_id=${plotId}`;
  }
  
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      // Add Authorization header if needed later
      // "Authorization": `Bearer ${token}` 
    }
  });

  if (!res.ok) {
    throw new Error("Failed to fetch historical data");
  }

  return res.json();
}

export async function getAnalyticsForecast(days: number = 7, plotId?: string) {
  // Map friendly strings to integers if passed (e.g. '1W' -> 7 handled in component, or here)
  // For now expecting integer
  let url = `${API_BASE}/analytics/forecast?days=${days}`;
  if (plotId && plotId !== 'all') {
    url += `&plot_id=${plotId}`;
  }
  
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    }
  });

  if (!res.ok) {
    throw new Error("Failed to fetch forecast data");
  }

  return res.json();
}

export async function getWeatherAnalytics(plotId?: string) {
  const plotQuery = plotId ? `?plot_id=${encodeURIComponent(plotId)}` : "";
  const res = await fetch(`${API_BASE}/analytics/weather${plotQuery}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
  });

  if (!res.ok) throw new Error("Failed to fetch weather data");
  return res.json();
}

export async function getDashboardWeather() {
  const res = await fetch(`${API_BASE}/analytics/weather/dashboard`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
  });

  if (!res.ok) throw new Error("Failed to fetch dashboard weather");
  return res.json();
}

// ---------- Configuration / Thresholds ----------
export interface Thresholds {
  id: number;
  temperature_min: number;
  temperature_max: number;
  soil_moisture_min: number;
  soil_moisture_max: number;
  updated_at: string;
}

export interface TaskEvalThresholds {
  id: string;
  name?: string | null;
  is_active: boolean;
  soil_moisture_min: number;
  soil_moisture_max: number;
  temperature_min: number;
  temperature_max: number;
  rain_mm_min: number;
  rain_mm_heavy: number;
  waterlogging_hours: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export type TaskEvalThresholdUpdate = Omit<
  TaskEvalThresholds,
  "id" | "name" | "is_active" | "created_at" | "updated_at"
>;

export type EvaluateStatusThresholdPayload = {
  plot_id: string;
  date: string;
  device_id?: number;
  reschedule_days?: number;
  thresholds?: Record<string, number>;
  readings?: Record<string, number>;
};

export type EvaluateStatusThresholdResponse = {
  message: string;
  plot_id: string;
  date: string;
  updated: number;
  reading_device_id?: number | null;
  reading_timestamp?: string | null;
};

export async function getThresholds(): Promise<Thresholds> {
  const res = await fetch(`${API_BASE}/config/thresholds`, {
    method: "GET",
    headers: { "Content-Type": "application/json" }
  });
  
  if (!res.ok) throw new Error("Failed to fetch thresholds");
  return res.json();
}

export async function updateThresholds(data: Partial<Omit<Thresholds, 'id' | 'updated_at'>>) {
  const res = await fetch(`${API_BASE}/config/thresholds`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  
  if (!res.ok) throw new Error("Failed to update thresholds");
  return res.json();
}

export async function resetThresholds() {
  const res = await fetch(`${API_BASE}/config/thresholds/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  
  if (!res.ok) throw new Error("Failed to reset thresholds");
  return res.json();
}

export async function getTaskEvalThresholds(): Promise<TaskEvalThresholds> {
  const res = await fetch(`${API_BASE}/api/config/task-eval-thresholds`, {
    method: "GET",
    headers: { "Content-Type": "application/json" }
  });

  if (!res.ok) throw new Error("Failed to fetch task evaluation thresholds");
  return res.json();
}

export async function updateTaskEvalThresholds(data: TaskEvalThresholdUpdate) {
  const res = await fetch(`${API_BASE}/api/config/task-eval-thresholds`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  if (!res.ok) throw new Error("Failed to update task evaluation thresholds");
  return res.json();
}

export async function evaluateStatusThreshold(payload: EvaluateStatusThresholdPayload) {
  return apiFetch<EvaluateStatusThresholdResponse>("/api/schedule/evaluate-status-threshold", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
