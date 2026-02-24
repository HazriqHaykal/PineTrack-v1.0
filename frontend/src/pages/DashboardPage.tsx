import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { WeatherCard } from '../components/WeatherCard';
import { PlotCard } from '../components/PlotCard';
import { Sun, CloudSun, CloudRain, Cloud, Calendar, Users, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

import { calcHarvestProgressPercent } from '../lib/progress';
import { sortPlotsById } from '../lib/sortPlots';
import { getPlotStatusFromTasks } from '../lib/plotStatus';
import { InsightRecommendationsCard } from '../components/insights/InsightRecommendationsCard';

// ✅ Use real API
import { getDashboardStats, getDashboardWeather, getAnalyticsHistory, getPendingRescheduleApprovals, getWeatherAnalytics, getWeatherRescheduleSuggestions } from '../lib/api';
import type { Plot, Task, Worker } from '../lib/api';

// Weather types (aligned with backend response)
interface CurrentWeather {
  temperature: number;
  condition: string;
  icon: string;
}

interface ForecastDay {
  day: string;
  temp: number;
  icon: string;
  condition: string;
}

interface DashboardPageProps {
  onNavigate: (page: string, plotId?: string) => void;
}

interface Suggestion {
  type: string;
  task_name: string;
  task_id?: string;
  original_date: string;
  suggested_date: string;
  reason: string;
}

type TaskVM = {
  id: string;
  title: string;
  date: string; // normalized from task_date
  plotId: string;
  plotName: string;
  decision: "Proceed" | "Pending" | "Stop";

  // add these because Dashboard UI uses them
  reason?: string | null;
  original_date?: string | null;
  proposed_date?: string | null;
};

type StatCardProps = {
  label: string;
  value: number;
  icon: ReactNode;
  to: string;
};

function StatCard({ label, value, icon, to }: StatCardProps) {
  return (
    <Link
      to={to}
      className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F9FAFB]"
      aria-label={`View ${label}`}
    >
      <Card className="min-h-[96px] p-5 rounded-2xl bg-white transition-all duration-150 cursor-pointer group-hover:shadow-md group-hover:-translate-y-0.5 group-active:translate-y-0 group-active:shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-[#6B7280] mb-1">{label}</p>
            <p className="text-3xl text-[#111827] font-semibold tabular-nums">
              {value}
            </p>
          </div>
          <div className="text-4xl w-12 h-12 flex items-center justify-center leading-none">
            {icon}
          </div>
        </div>
      </Card>
    </Link>
  );
}


export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [tasks, setTasks] = useState<TaskVM[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [pendingRescheduleApprovals, setPendingRescheduleApprovals] = useState<Task[]>([]);
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [weatherSuggestions, setWeatherSuggestions] = useState<Suggestion[]>([]);
  const [sensorAlerts, setSensorAlerts] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const threeDaysFromNow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      // 1) Load dashboard data (same endpoints as destination pages)
      const [dashboardData, pendingApprovals] = await Promise.all([
        getDashboardStats(),
        getPendingRescheduleApprovals(),
      ]);
      const plotsData = sortPlotsById(dashboardData.plots ?? []);
      setPlots(plotsData);
      setRawTasks(dashboardData.tasks ?? []);
      setWorkers(dashboardData.workers ?? []);
      setPendingRescheduleApprovals(pendingApprovals);

      // 2) Load tasks (all tasks)
      const tasksData = dashboardData.tasks ?? [];

      // 3) Enrich tasks with plot name
      const plotNameById = new Map<string, string>(
        plotsData.map((p) => [p.id, p.name]),
      );

      const enriched: TaskVM[] = tasksData.map((t) => ({
        id: t.id,
        title: t.title,
        date: t.task_date,
        plotId: t.plot_id,
        plotName: plotNameById.get(t.plot_id) ?? t.plot_id,
        decision: t.decision ?? "Proceed", // Fallback if undefined

        reason: t.reason ?? null,
        original_date: t.original_date ?? null,
        proposed_date: t.proposed_date ?? null,
      }));


      setTasks(enriched);

      // 4) Fetch Weather
      try {
        const weatherData = await getDashboardWeather();
        setWeather(weatherData.current);
        setForecast(weatherData.forecast);
      } catch (wErr) {
        console.error("Weather fetch failed", wErr);
        // Don't block whole dashboard if weather fails, just leave it null/empty
      }

      // 5) Fetch Insight Recommendations
      try {
         // Need history for sensors
         const history = await getAnalyticsHistory(30).catch(() => []);
         const processedHistory = history.map((item: { cleaned_temperature: number; cleaned_soil_moisture: number; cleaned_nitrogen: number }) => ({
           ...item,
           temperature_clean: item.cleaned_temperature,
           moisture_clean: item.cleaned_soil_moisture,
           nitrogen_clean: item.cleaned_nitrogen,
         }));
         
         let sensorSummary = null;
         if (processedHistory.length > 0) {
            const latest = processedHistory[processedHistory.length - 1];
            sensorSummary = {
              avg_n: latest.nitrogen_clean,
              avg_moisture: latest.moisture_clean,
              avg_temp: latest.temperature_clean
            };
         }

         // Need weather forecast for tomorrow
         const fullWeather = await getWeatherAnalytics().catch(() => []);
         const tomorrow = new Date();
         tomorrow.setDate(tomorrow.getDate() + 1);
         const tomorrowStr = tomorrow.toISOString().slice(0, 10);

         // Helper logic to find tomorrow's forecast from analytics data
         const weatherForecastForTomorrow = fullWeather.filter((w: { date?: string; time?: string }) => {
             const dateStr = w.date || w.time;
             return dateStr && dateStr.slice(0, 10) === tomorrowStr;
         });

         // Tasks for tomorrow
         const tasksForTomorrow = tasksData.filter((t) => t.task_date === tomorrowStr);
         
         const result = await getWeatherRescheduleSuggestions(tasksForTomorrow, weatherForecastForTomorrow, sensorSummary);
         const allSuggestions = result.suggestions ?? [];
         
         // Separate sensor alerts from regular suggestions
         const alerts = allSuggestions.filter(s => s.affected_by === 'sensor_health');
         const suggestions = allSuggestions.filter(s => s.affected_by !== 'sensor_health');
         
         setSensorAlerts(alerts);
         setWeatherSuggestions(suggestions);

      } catch (err) {
         console.error("Insight fetch failed", err);
      }

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load dashboard data';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const handler = () => {
      loadDashboard();
    };
    window.addEventListener("tasks:refresh", handler);
    return () => window.removeEventListener("tasks:refresh", handler);
  }, [loadDashboard]);

  // ✅ Option A: progress is computed at frontend (not stored)
  const plotsWithProgress = useMemo(() => {
    return (plots ?? []).map((p) => ({
      plot: p,
      progressPercent: calcHarvestProgressPercent(p.planting_date),
    }));
  }, [plots]);

  const plotStatusById = useMemo(() => {
    const tasksByPlot = new Map<string, Task[]>();
    for (const task of rawTasks) {
      const plotId = String(task.plot_id ?? "").trim();
      if (!plotId) continue;
      const bucket = tasksByPlot.get(plotId) ?? [];
      bucket.push(task);
      tasksByPlot.set(plotId, bucket);
    }

    const map = new Map<string, Task["decision"]>();
    for (const plot of plots) {
      const plotTasks = tasksByPlot.get(plot.id) ?? [];
      map.set(plot.id, getPlotStatusFromTasks(plotTasks));
    }
    return map;
  }, [plots, rawTasks]);

  const upcomingTasks = useMemo(() => {
    return tasks.filter((t) => {
      const d = t.date;
      return d >= todayStr && d <= threeDaysFromNow && t.decision === 'Proceed';
    });
  }, [tasks, todayStr, threeDaysFromNow]);

  const recentReschedules = useMemo(() => {
    // Proposed reschedules: proposed_date exists
    // sort by created_at desc if you want, but backend already sorts task_date
    return tasks.filter((t) => t.proposed_date).slice(0, 3);
  }, [tasks]);

  const getWeatherIcon = (icon: string) => {
    const iconProps = { size: 24, className: 'text-[#15803D]' };
    switch (icon) {
      case 'sun':
        return <Sun {...iconProps} />;
      case 'cloud-sun':
        return <CloudSun {...iconProps} />;
      case 'cloud-rain':
        return <CloudRain {...iconProps} />;
      case 'cloud':
        return <Cloud {...iconProps} />;
      default:
        return <CloudSun {...iconProps} />;
    }
  };

  const rescheduleActionCount = useMemo(
    () => pendingRescheduleApprovals.length,
    [pendingRescheduleApprovals],
  );

  const stats = useMemo(
    () => [
      {
        label: 'Total Plots',
        value: plotsWithProgress.length,
        icon: '🌱',
        to: '/plots',
      },
      {
        label: 'Tasks Today',
        value: tasks.filter((t) => t.date === todayStr).length,
        icon: '📋',
        to: '/schedule',
      },
      {
        label: 'Active Workers',
        value: workers.length,
        icon: '👷',
        to: '/workers',
      },
      {
        label: 'Reschedule Actions Required',
        value: rescheduleActionCount,
        icon: '⚠️',
        to: '/reschedule',
      },
    ],
    [plotsWithProgress.length, tasks, todayStr, workers.length, rescheduleActionCount],
  );

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl text-[#111827] mb-1">Farm Overview</h2>
          <p className="text-[#6B7280]">Monitor your plantation operations in real-time</p>
        </div>

        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => loadDashboard()}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            to={stat.to}
          />
        ))}
      </div>

      {/* Weather Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Weather */}
        <div>
          {weather ? (
            <WeatherCard
              temperature={weather.temperature}
              condition={weather.condition}
            />
          ) : (
             <Card className="p-6 rounded-2xl bg-white h-full flex items-center justify-center">
                 <p className="text-gray-400">Loading Weather...</p>
             </Card>
          )}
        </div>

        {/* 10-Day Forecast */}
        <Card className="lg:col-span-2 p-6 rounded-2xl bg-white">
          <h3 className="text-[#111827] mb-4">10-Day Forecast</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {forecast.length > 0 ? (
                forecast.map((day, index) => (
                  <div
                    key={index}
                    className="flex flex-col items-center gap-2 min-w-[80px] p-3 rounded-xl hover:bg-[#F9FAFB] transition-colors"
                  >
                    <span className="text-sm text-[#6B7280]">{day.day}</span>
                    {getWeatherIcon(day.icon)}
                    <span className="text-[#111827]">{day.temp}°C</span>
                  </div>
                ))
            ) : (
                <p className="text-gray-400 text-sm">Loading Forecast...</p>
            )}
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Farm Overview - Plots */}
        <Card className="lg:col-span-2 p-6 rounded-2xl bg-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#111827]">All Plots</h3>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => onNavigate('farm-map')}
            >
              View Map
            </Button>
          </div>

          {loading && plotsWithProgress.length === 0 ? (
            <p className="text-sm text-[#6B7280]">Loading plots...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plotsWithProgress.map(({ plot, progressPercent }) => (
                <PlotCard
                  key={plot.id}
                  plot={plot}
                  progressPercent={progressPercent}
                  status={plotStatusById.get(plot.id) ?? plot.status}
                  variant="dashboard"
                  onClick={() => onNavigate('plot-details', plot.id)}
                />
              ))}

              {plotsWithProgress.length === 0 && (
                <p className="text-sm text-[#6B7280]">No plots found.</p>
              )}
            </div>
          )}
        </Card>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Sensor Health Alerts */}
          {sensorAlerts.length > 0 && (
            <Card className="p-6 rounded-2xl bg-gradient-to-br from-[#DC2626] to-[#B91C1C] text-white shadow-sm border-0">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="text-white" size={20} />
                <h3 className="text-white font-semibold">Alert</h3>
              </div>

              <div className="space-y-3">
                {sensorAlerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-colors border border-white/20 backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">⚠️</span>
                      <p className="text-base font-semibold text-white">
                        {alert.task_name}
                      </p>
                    </div>
                    <p className="text-sm text-white/95 font-normal leading-relaxed">
                      {alert.reason}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Insight Recommendation (Replaces Critical Actions) */}
          <InsightRecommendationsCard
            variant="dashboard"
            suggestions={weatherSuggestions}
            onSuggestionClick={() => onNavigate('reschedule')}
            onViewAll={() => onNavigate('reschedule')}
          />

          {/* Upcoming Tasks */}
          <Card className="p-6 rounded-2xl bg-white">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="text-[#15803D]" size={20} />
              <h3 className="text-[#111827]">Next 3 Days</h3>
            </div>

            <div className="space-y-3">
              {upcomingTasks.slice(0, 6).map((task) => (
                <div key={task.id} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#DCFCE7] rounded-xl flex flex-col items-center justify-center">
                    <span className="text-xs text-[#15803D]">
                      {new Date(task.date).toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span className="text-[#15803D]">{new Date(task.date).getDate()}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#111827] truncate">{task.title}</p>
                    <p className="text-xs text-[#6B7280]">{task.plotName}</p>
                  </div>
                </div>
              ))}

              {upcomingTasks.length === 0 && (
                <p className="text-sm text-[#6B7280] text-center py-4">No upcoming tasks</p>
              )}
            </div>
          </Card>

          {/* Recent Reschedules */}
          <Card className="p-6 rounded-2xl bg-white">
            <div className="flex items-center gap-2 mb-4">
              <Users className="text-[#2563EB]" size={20} />
              <h3 className="text-[#111827]">Recent Reschedules</h3>
            </div>

            <div className="space-y-3">
              {recentReschedules.map((task) => (
                <div key={task.id} className="text-sm">
                  <p className="text-[#111827] mb-1">{task.title}</p>
                  <p className="text-xs text-[#6B7280]">
                    {task.original_date ?? '—'} → {task.proposed_date ?? '—'}
                  </p>
                </div>
              ))}

              {recentReschedules.length === 0 && (
                <p className="text-sm text-[#6B7280] text-center py-4">
                  No reschedules recorded
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
