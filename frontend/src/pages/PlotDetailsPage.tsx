import { useEffect, useState, useMemo } from 'react';
import { useParams, Navigate } from "react-router-dom";
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { StatusBadge } from '../components/StatusBadge';
import {
  mockObservations
} from '../lib/mockData';
import { ArrowLeft, Calendar as CalendarIcon, Check, Clock, XCircle } from 'lucide-react';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '../components/ui/tooltip';
import { GraphSection } from '../components/analytics/GraphSection';
import { getPlotById, listTasks } from "../lib/api";
import type { Plot, Task } from "../lib/api";
import { calcHarvestProgressPercent } from '../lib/progress';

type PlotDetailsPageProps = {
  onNavigate: (page: string, plotId?: string) => void;
};

export function PlotDetailsPage({ onNavigate }: PlotDetailsPageProps) {
  const { plotId } = useParams<{ plotId: string }>();
  const id = plotId?.trim();

  // Current date set to November 13, 2025
  const TODAY = new Date();

  const parseDateString = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const startOfToday = new Date(TODAY);
  startOfToday.setHours(0, 0, 0, 0);

  const isPastDate = (dateStr: string) => parseDateString(dateStr) < startOfToday;

  const formatTaskDate = (dateStr: string) =>
    parseDateString(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  // DB-backed
  const [plot, setPlot] = useState<Plot | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  // mock-backed
  const [newObservation, setNewObservation] = useState('');

  const plotObservations = useMemo(() => {
    if (!id) return [];
    return mockObservations.filter((o) => o.plotId === id);
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      try {
        // ✅ Use the helper function from api.ts
        const plotData = await getPlotById(id);
        setPlot(plotData);

        // ✅ Tasks from DB (plot filtered)
        const tasksRes = await listTasks({ plot_id: id });
        setTasks(tasksRes.data ?? []);

        // keep context
        sessionStorage.setItem("last_plot_id", id);
      } catch (e) {
        const error = e as { message?: string };
        toast.error(error?.message ?? "Failed to load plot details");
        setPlot(null);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  // If user somehow lands here without plotId, send them back
  if (!plotId) return <Navigate to="/plots" replace />;

  if (!id) return <div>Plot not found</div>;
  if (loading && !plot) return <div>Loading...</div>;
  if (!plot) return <div>Plot not found</div>;

  // ✅ consistent progress from DB planting_date
  const progress = calcHarvestProgressPercent(plot.planting_date);

  // ✅ normalize tasks to the format your UI expects
  // If your UI expects fields lTask `date` + `status`, map here.
  const uiTasks = tasks.map((t: Task) => ({
    ...t,
    date: t.task_date,
    status: t.decision,
  }));

  // Generate calendar for current month (November 2025)
  const year = TODAY.getFullYear();
  const month = TODAY.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const calendarDays = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  const getTasksForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return uiTasks.filter((task) => task.date === dateStr);
  };

  const handleAddObservation = () => {
    if (newObservation.trim()) {
      toast.success('Observation added successfully');
      setNewObservation('');
    }
  };

  const isToday = (day: number) => {
    return day === TODAY.getDate();
  };

  const getTaskColor = (status: string, isPastTask: boolean) => {
    if (isPastTask) return 'bg-gray-100 text-gray-500 border border-gray-200 opacity-80';
    if (status === 'Proceed') return 'bg-green-100 text-green-800 border border-green-200';
    if (status === 'Pending') return 'bg-amber-100 text-amber-800 border border-amber-200';
    return 'bg-red-100 text-red-800 border border-red-200';
  };

  const getDayCellBackground = (dayTasks: { date: string; status: string }[], isTodayCell: boolean) => {
    const activeTasks = dayTasks.filter((task) => !isPastDate(task.date));
    const hasStop = activeTasks.some((task) => task.status === 'Stop');
    const hasPending = activeTasks.some((task) => task.status === 'Pending');

    if (hasStop) return 'bg-red-50';
    if (hasPending) return 'bg-amber-50';
    return isTodayCell ? 'bg-slate-50' : 'bg-white';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl"
            onClick={() => onNavigate('plots')}
            aria-label="Back to plots"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h2 className="text-[24px] font-semibold leading-snug text-[#111827]">{plot.name}</h2>
            <p className="text-[18px] text-[#374151]">{plot.crop_type}</p>
          </div>
        </div>
        <StatusBadge status={plot.status} />
      </div>

      {/* Plot Summary Card */}
      <Card className="p-6 rounded-2xl bg-white shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <div>
            <p className="text-[15px] text-[#6B7280] mb-1">Area</p>
            <p className="text-[20px] font-medium text-[#111827]">{plot.area_ha} hectares</p>
          </div>
          <div>
            <p className="text-[15px] text-[#6B7280] mb-1">Planting Date</p>
            <p className="text-[20px] font-medium text-[#111827]">
              {new Date(plot.planting_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div>
            <p className="text-[15px] text-[#6B7280] mb-1">Progress</p>
            <div className="flex items-center gap-2">
              <p className="text-[20px] font-semibold text-[#111827]">{progress}%</p>
              <div className="flex-1 h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${progress >= 80 ? 'bg-[#2563eb]' : progress >= 60 ? 'bg-[#2563eb]' : 'bg-[#2563eb]'
                    }`}
                  style={{ width: `${progress}%` }}
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sensor Data Charts */}
          <GraphSection plotId={null} />

          {/* Calendar View */}
          <Card className="p-6 rounded-2xl bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[20px] text-[#111827]">Task Calendar - November 2025</h3>
              <CalendarIcon size={20} className="text-[#6B7280]" />
            </div>

            <div className="grid grid-cols-7 gap-1">
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                <div key={day} className="text-center py-2 px-3 bg-[#EBF8EF] rounded-lg">
                  <span className="text-[14px] text-[#111827]">{day.slice(0, 3)}</span>
                </div>
              ))}
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="min-h-[100px] bg-[#F9FAFB] rounded-lg" />;
                }

                const tasks = getTasksForDate(day);
                const isTodayCell = isToday(day);
                const dayBackground = getDayCellBackground(tasks, isTodayCell);

                return (
                  <button
                    key={day}
                    className={`min-h-[100px] p-2 rounded-lg border border-gray-200 transition-shadow ${dayBackground} ${isTodayCell ? 'ring-2 ring-blue-300' : ''}`}
                    aria-label={`Day ${day}, ${tasks.length} tasks`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[14px] text-[#111827]">{day}</div>
                      {isTodayCell && (
                        <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
                          Today
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {tasks.slice(0, 2).map((task) => {
                        const isPastTask = isPastDate(task.date);
                        const StatusIcon = isPastTask
                          ? Check
                          : task.status === 'Pending'
                            ? Clock
                            : task.status === 'Stop'
                              ? XCircle
                              : null;

                        return (
                          <TooltipProvider key={task.id}>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={`text-[11px] p-1 rounded ${getTaskColor(task.status, isPastTask)} ${isPastTask
                                    ? 'cursor-default'
                                    : 'cursor-pointer transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                                    }`}
                                  style={{ fontWeight: 500 }}
                                  aria-disabled={isPastTask}
                                >
                                  <div className="flex items-center gap-1 min-w-0">
                                    {StatusIcon && <StatusIcon size={10} className="text-current" aria-hidden="true" />}
                                    <span className="truncate">
                                      {isPastTask ? `Done: ${task.title}` : task.title}
                                    </span>
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  <p className="text-[14px]">{task.title}</p>
                                  <p className="text-[12px] text-[#6B7280]">Worker: {task.assigned_worker_name ?? 'Unassigned'}</p>
                                  {isPastTask && (
                                    <p className="text-[12px] text-gray-500">Task completed on {formatTaskDate(task.date)}</p>
                                  )}
                                </div>
                              </TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                        );
                      })}
                      {tasks.length > 2 && (
                        <div className="text-[10px] text-[#6B7280] text-center">+{tasks.length - 2}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Tasks for Plot */}
          <Card className="p-6 rounded-2xl bg-white shadow-sm">
            <h3 className="text-[18px] text-[#111827] mb-4">Scheduled Tasks</h3>
            <div className="space-y-3">
              {uiTasks.slice(0, 5).map((task) => (
                <div key={task.id} className="p-3 bg-[#F9FAFB] rounded-xl">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-[14px] text-[#111827]">{task.title}</p>
                    <StatusBadge status={task.status} size="sm" />
                  </div>
                  <p className="text-[14px] text-[#6B7280] mb-1">{new Date(task.date).toLocaleDateString()}</p>
                  <p className="text-[14px] text-[#6B7280]">Worker: {task.assigned_worker_name ?? 'Unassigned'}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Observations */}
          <Card className="p-6 rounded-2xl bg-white shadow-sm">
            <h3 className="text-[18px] text-[#111827] mb-4">Observations</h3>
            <div className="space-y-4 mb-4">
              {plotObservations.map((obs) => (
                <div key={obs.id} className="border-l-2 border-[#15803D] pl-3">
                  <p className="text-[14px] text-[#6B7280] mb-1">
                    {obs.author} • {new Date(obs.date).toLocaleDateString()}
                  </p>
                  <p className="text-[14px] text-[#111827]">{obs.note}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Textarea
                placeholder="Add a new observation..."
                value={newObservation}
                onChange={(e) => setNewObservation(e.target.value)}
                className="rounded-xl border-[#E5E7EB] min-h-[80px]"
                aria-label="New observation"
              />
              <Button
                onClick={handleAddObservation}
                className="w-full bg-[#15803D] hover:bg-[#16A34A] rounded-xl"
                disabled={!newObservation.trim()}
              >
                Add Observation
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

