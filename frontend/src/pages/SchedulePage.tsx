import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Check, ChevronLeft, ChevronRight, Filter, Calendar as CalendarIcon, Clock, XCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '../components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { toast } from 'sonner';
// import { useParams } from "react-router-dom";
import { listPlots, listTasks } from '../lib/api';
import type { Plot } from '../lib/api';

type ViewMode = "month" | "week" | "day";
type DominantStatus = "pending" | "stop" | "none";

type ScheduleTaskVM = {
  id: string;
  title: string;
  status: "Proceed" | "Pending" | "Stop";
  date: string; // YYYY-MM-DD
  plotId: string;
  plotName: string;
  description?: string | null;
  assignedWorker?: string | null;
  reason?: string | null;
  updatedAt?: string | null;
};

export function SchedulePage() {
  const [filterPlot, setFilterPlot] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedTask, setSelectedTask] = useState<ScheduleTaskVM | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [plots, setPlots] = useState<Plot[]>([]);
  const [tasks, setTasks] = useState<ScheduleTaskVM[]>([]);
  const [loading, setLoading] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const day = currentDate.getDate();
  const today = new Date();

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const parseDateString = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const isPastDate = (dateStr: string) => parseDateString(dateStr) < startOfToday;

  const formatTaskDate = (dateStr: string) =>
    parseDateString(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const getTaskContainerClasses = (
    task: ScheduleTaskVM,
    dominantStatus: DominantStatus = "none",
  ) => {
    if (isPastDate(task.date)) return 'bg-gray-100 border border-gray-200 opacity-80';
    if (dominantStatus === 'pending') {
      return 'bg-amber-100 border border-amber-400 hover:bg-amber-200';
    }
    if (dominantStatus === 'stop') {
      return 'bg-rose-100 border border-rose-500 hover:bg-rose-200';
    }
    if (task.status === 'Proceed') return 'bg-green-100 border border-green-200';
    if (task.status === 'Pending') return 'bg-amber-100 border border-amber-400';
    return 'bg-rose-100 border border-rose-500';
  };

  const getTaskTextColor = (
    task: ScheduleTaskVM,
    tone: 'primary' | 'secondary' = 'primary',
    dominantStatus: DominantStatus = "none",
  ) => {
    if (isPastDate(task.date)) return 'text-gray-500';
    if (dominantStatus === 'pending') return tone === 'primary' ? 'text-amber-900' : 'text-amber-800';
    if (dominantStatus === 'stop') return tone === 'primary' ? 'text-rose-900' : 'text-rose-800';
    if (task.status === 'Proceed') return tone === 'primary' ? 'text-green-800' : 'text-green-700';
    if (task.status === 'Pending') return tone === 'primary' ? 'text-amber-900' : 'text-amber-800';
    return tone === 'primary' ? 'text-rose-900' : 'text-rose-800';
  };

  const getTaskStatusLabel = (task: ScheduleTaskVM) => {
    if (isPastDate(task.date)) return 'Done';
    if (task.status === 'Stop') return 'Stopped';
    return task.status;
  };

  const getTaskStatusIcon = (task: ScheduleTaskVM) => {
    if (isPastDate(task.date)) return Check;
    if (task.status === 'Pending') return Clock;
    if (task.status === 'Stop') return XCircle;
    return null;
  };

  const getTaskPriority = (task: ScheduleTaskVM) => {
    if (isPastDate(task.date)) return 3;
    if (task.status === 'Stop') return 0;
    if (task.status === 'Pending') return 1;
    return 2;
  };

  const getPrimaryTask = (dayTasks: ScheduleTaskVM[], statusFilter: string) => {
    if (dayTasks.length === 0) return null;
    if (statusFilter !== 'all') return dayTasks[0];

    const sorted = dayTasks
      .map((task, index) => ({ task, index }))
      .sort((a, b) => {
        const priorityA = getTaskPriority(a.task);
        const priorityB = getTaskPriority(b.task);
        if (priorityA !== priorityB) return priorityA - priorityB;

        const timeA = a.task.updatedAt ? Date.parse(a.task.updatedAt) : NaN;
        const timeB = b.task.updatedAt ? Date.parse(b.task.updatedAt) : NaN;
        if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
          return timeB - timeA;
        }
        return a.index - b.index;
      });

    return sorted[0]?.task ?? null;
  };

  const getDominantStatus = (dayTasks: ScheduleTaskVM[], statusFilter: string): DominantStatus => {
    if (statusFilter !== 'all') return 'none';
    const activeTasks = dayTasks.filter((task) => !isPastDate(task.date));
    if (activeTasks.some((task) => task.status === 'Stop')) return 'stop';
    if (activeTasks.some((task) => task.status === 'Pending')) return 'pending';
    return 'none';
  };

  const getDayCellBackground = (
    dayTasks: ScheduleTaskVM[],
    isTodayCell: boolean,
    dominantStatus: DominantStatus,
  ) => {
    const activeTasks = dayTasks.filter((task) => !isPastDate(task.date));
    const hasStop = activeTasks.some((task) => task.status === 'Stop');
    const hasPending = activeTasks.some((task) => task.status === 'Pending');

    if (dominantStatus === 'stop') {
      return 'bg-rose-100 border-rose-500';
    }
    if (dominantStatus === 'pending') {
      return 'bg-amber-50 border-amber-400';
    }
    if (hasStop) return 'bg-rose-50 border-rose-300';
    if (hasPending) return 'bg-amber-50 border-amber-300';
    return isTodayCell ? 'bg-slate-50 border-slate-200' : 'bg-white border-gray-200';
  };

  const getCountBadgeClasses = () => 'bg-[#111827] border-[#111827] text-white';

  const renderTaskStatusBadge = (task: ScheduleTaskVM) => {
    const StatusIcon = getTaskStatusIcon(task);

    return (
      <div
        className={`inline-flex items-center justify-center gap-1.5 rounded-[16px] h-[28px] px-3 ${getTaskContainerClasses(task)} ${getTaskTextColor(task)}`}
        style={{ minWidth: '90px' }}
      >
        {StatusIcon && <StatusIcon size={14} className="text-current" aria-hidden="true" />}
        <span className="text-[14px] font-medium">{getTaskStatusLabel(task)}</span>
      </div>
    );
  };

  const loadScheduleData = useCallback(async () => {
    setLoading(true);
    try {
      const [plotsRes, tasksRes] = await Promise.all([
        listPlots(),
        listTasks(), // Note: all tasks
      ]);

      const plotsData = plotsRes.data ?? [];
      setPlots(plotsData);

      const nameById = new Map(plotsData.map((p) => [p.id, p.name]));

      const vm: ScheduleTaskVM[] = (tasksRes.data ?? []).map((t: {
        id: string;
        title: string;
        decision?: "Proceed" | "Pending" | "Stop";
        status?: "Proceed" | "Pending" | "Stop";
        task_date: string;
        plot_id: string;
        description?: string | null;
        assigned_worker_name?: string | null;
        reason?: string | null;
        updated_at?: string | null;
      }) => ({
        id: t.id,
        title: t.title,
        status: t.decision ?? t.status,
        date: t.task_date,
        plotId: t.plot_id,
        plotName: nameById.get(t.plot_id) ?? t.plot_id,
        description: t.description ?? null,
        assignedWorker: t.assigned_worker_name ?? null,
        reason: t.reason ?? null,
        updatedAt: t.updated_at ?? null,
      }));

      setTasks(vm);

      // Note: ensure default filter stays global
      setFilterPlot("all");
    } catch (e) {
      toast.error((e as Error)?.message ?? "Failed to load schedule data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScheduleData();
  }, [loadScheduleData]);

  useEffect(() => {
    const handler = () => {
      loadScheduleData();
    };
    window.addEventListener("tasks:refresh", handler);
    return () => window.removeEventListener("tasks:refresh", handler);
  }, [loadScheduleData]);


  // Generate calendar days for month view
  const getMonthCalendarDays = useCallback(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (number | null)[] = [];

    // Add empty cells for days before the start of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d);
    }

    return days;
  }, [year, month]);

  const getTasksForDate = useCallback((dateStr: string) => {
    let tasksForDate = tasks.filter((task) => task.date === dateStr);

    if (filterPlot !== 'all') {
      tasksForDate = tasksForDate.filter((task) => task.plotId === filterPlot);
    }
    if (filterStatus !== 'all') {
      tasksForDate = tasksForDate.filter((task) => task.status === filterStatus);
    }

    return tasksForDate;
  }, [tasks, filterPlot, filterStatus]);

  const selectedDateTasks = useMemo(() => {
    if (!selectedDate) return [];
    return getTasksForDate(selectedDate);
  }, [selectedDate, getTasksForDate]);

  const getTasksForDay = (d: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return getTasksForDate(dateStr);
  };

  const previousMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(month - 1);
    setCurrentDate(newDate);
  };

  const nextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(month + 1);
    setCurrentDate(newDate);
  };

  const previousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(day - 7);
    setCurrentDate(newDate);
  };

  const nextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(day + 7);
    setCurrentDate(newDate);
  };

  const previousDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(day - 1);
    setCurrentDate(newDate);
  };

  const nextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(day + 1);
    setCurrentDate(newDate);
  };

  const formatDateDisplay = () => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (viewMode === 'week') {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(day - startOfWeek.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Get tasks for current day (day view)
  const getDayTasks = () => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return getTasksForDate(dateStr);
  };

  // Get tasks for current week (week view)
  const getWeekTasks = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(day - startOfWeek.getDay());

    const weekTasks: { date: string; dayName: string; dayNumber: number; tasks: ScheduleTaskVM[] }[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);

      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      weekTasks.push({
        date: dateStr,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        tasks: getTasksForDate(dateStr)
      });
    }

    return weekTasks;
  };

  const days = useMemo(() => getMonthCalendarDays(), [getMonthCalendarDays]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] text-[#111827]">Farm Schedule</h2>
          <p className="text-[16px] text-[#374151]">View and manage all scheduled tasks</p>
        </div>
        <div className="flex items-center gap-2 text-[#6B7280] text-[14px]">
          <CalendarIcon size={16} />
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 rounded-2xl bg-white shadow-sm">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-[#6B7280]" />
              <span className="text-[14px] text-[#6B7280]">Filters:</span>
            </div>

            <Select value={filterPlot} onValueChange={setFilterPlot}>
              <SelectTrigger className="w-[180px] rounded-xl" aria-label="Filter by plot">
                <SelectValue placeholder="All Plots" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plots</SelectItem>
                {plots.map((plot) => (
                  <SelectItem key={plot.id} value={plot.id}>
                    {plot.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px] rounded-xl" aria-label="Filter by status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Proceed">Proceed</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Stop">Stop</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex rounded-xl bg-[#F3F4F6] p-1">
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-lg text-[14px] ${viewMode === 'month' ? 'bg-[#DCFCE7] text-[#166534]' : 'text-[#6B7280]'}`}
              onClick={() => setViewMode('month')}
            >
              Month
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-lg text-[14px] ${viewMode === 'week' ? 'bg-[#DCFCE7] text-[#166534]' : 'text-[#6B7280]'}`}
              onClick={() => setViewMode('week')}
            >
              Week
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-lg text-[14px] ${viewMode === 'day' ? 'bg-[#DCFCE7] text-[#166534]' : 'text-[#6B7280]'}`}
              onClick={() => setViewMode('day')}
            >
              Day
            </Button>
          </div>
        </div>
      </Card>

      {/* Calendar Container */}
      <Card className="rounded-2xl bg-white shadow-sm overflow-hidden">
        {/* Calendar Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() => {
              if (viewMode === 'month') previousMonth();
              if (viewMode === 'week') previousWeek();
              if (viewMode === 'day') previousDay();
            }}
          >
            <ChevronLeft size={18} />
          </Button>

          <h3 className="text-[18px] text-[#111827] font-medium">{formatDateDisplay()}</h3>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() => {
              if (viewMode === 'month') nextMonth();
              if (viewMode === 'week') nextWeek();
              if (viewMode === 'day') nextDay();
            }}
          >
            <ChevronRight size={18} />
          </Button>
        </div>

        {/* Loading hint */}
        {loading && (
          <div className="p-4 text-sm text-[#6B7280]">
            Loading schedule from databaseâ€¦
          </div>
        )}

        {/* Month View */}
        {viewMode === 'month' && (
          <div className="p-4">
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((dayName) => (
                <div key={dayName} className="text-center text-[14px] text-[#374151] font-medium py-2 bg-[#ECFDF5] rounded-xl">
                  {dayName}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {days.map((d, index) => {
                if (d === null) {
                  return <div key={`empty-${index}`} className="h-[84px] border border-transparent" />;
                }

                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const dayTasks = getTasksForDay(d);
                const maxVisible = 1;
                const isToday = isSameDay(new Date(year, month, d), today);
                const dominantStatus = getDominantStatus(dayTasks, filterStatus);
                const dayBackground = getDayCellBackground(dayTasks, isToday, dominantStatus);
                const showTodayBadge = isToday && dayTasks.length <= maxVisible;
                const showCountBadge = dayTasks.length > maxVisible;
                const primaryTask = getPrimaryTask(dayTasks, filterStatus);
                const previewTasks = primaryTask ? [primaryTask] : [];

                return (
                  <div
                    key={d}
                    className={`h-[84px] border rounded-xl p-2 relative cursor-pointer ${dayBackground} ${isToday ? 'ring-2 ring-blue-300' : ''}`}
                    onClick={() => setSelectedDate(dateStr)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelectedDate(dateStr);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[14px] text-[#111827]">{d}</div>
                      {(showTodayBadge || showCountBadge) && (
                        <div className="flex items-center gap-1">
                          {showTodayBadge && (
                            <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
                              Today
                            </span>
                          )}
                          {showCountBadge && (
                            <Badge className={`text-[11px] rounded-full px-2 border ${getCountBadgeClasses()}`}>
                              {dayTasks.length}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-1 space-y-1">
                      {previewTasks.map((task) => {
                        const isPastTask = isPastDate(task.date);
                        const StatusIcon = getTaskStatusIcon(task);

                        return (
                          <TooltipProvider key={task.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={`text-[12px] px-2 py-1 rounded-lg ${getTaskContainerClasses(task, dominantStatus)} ${getTaskTextColor(task, 'primary', dominantStatus)} ${isPastTask ? 'cursor-default' : 'cursor-pointer'}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isPastTask) setSelectedTask(task);
                                  }}
                                  aria-disabled={isPastTask}
                                >
                                  <p className="flex items-center gap-1 min-w-0">
                                    {StatusIcon && <StatusIcon size={12} className="text-current" aria-hidden="true" />}
                                    <span className="truncate">
                                      {isPastTask ? `Done: ${task.title}` : task.title}
                                    </span>
                                  </p>
                                  <p className={`text-[10px] truncate ${getTaskTextColor(task, 'secondary', dominantStatus)}`}>
                                    {task.assignedWorker ?? 'Unassigned'}
                                  </p>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[220px]">
                                <p className="font-medium">{task.title}</p>
                                <p className="text-xs text-[#6B7280]">{task.plotName} ??? {task.date}</p>
                                <p className="text-xs text-[#6B7280]">Worker: {task.assignedWorker ?? 'Unassigned'}</p>
                                {isPastTask && (
                                  <p className="text-xs text-gray-500">Task completed on {formatTaskDate(task.date)}</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Week View (Month-style, one row) */}
        {viewMode === 'week' && (
          <div className="p-4">
            {/* Day headers (Mon â†’ Sun) */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((dayName) => (
                <div
                  key={dayName}
                  className="text-center text-[14px] text-[#374151] font-medium py-2 bg-[#ECFDF5] rounded-xl"
                >
                  {dayName}
                </div>
              ))}
            </div>

            {/* One-row week grid */}
            <div className="grid grid-cols-7 gap-2">
              {(() => {
                const week = getWeekTasks();

                // Reorder to Mon â†’ Sun (in case your getWeekTasks() is Sun â†’ Sat)
                const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                const weekOrdered = [...week].sort(
                  (a, b) => order.indexOf(a.dayName) - order.indexOf(b.dayName)
                );

                const maxVisible = 1;

                return weekOrdered.map((dayData) => {
                  const dayTasks = dayData.tasks ?? [];
                  const isToday = isSameDay(parseDateString(dayData.date), today);
                  const dominantStatus = getDominantStatus(dayTasks, filterStatus);
                  const dayBackground = getDayCellBackground(dayTasks, isToday, dominantStatus);
                  const showTodayBadge = isToday && dayTasks.length <= maxVisible;
                  const showCountBadge = dayTasks.length > maxVisible;
                  const primaryTask = getPrimaryTask(dayTasks, filterStatus);
                  const previewTasks = primaryTask ? [primaryTask] : [];

                  return (
                    <div
                      key={dayData.date}
                      className={`h-[84px] border rounded-xl p-2 relative cursor-pointer ${dayBackground} ${isToday ? 'ring-2 ring-blue-300' : ''}`}
                      onClick={() => setSelectedDate(dayData.date)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setSelectedDate(dayData.date);
                      }}
                    >
                      {/* Day number (same style as month view) */}
                      <div className="flex items-center justify-between">
                        <div className="text-[14px] text-[#111827]">{dayData.dayNumber}</div>
                        {(showTodayBadge || showCountBadge) && (
                          <div className="flex items-center gap-1">
                            {showTodayBadge && (
                              <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
                                Today
                              </span>
                            )}
                            {showCountBadge && (
                              <Badge className={`text-[11px] rounded-full px-2 border ${getCountBadgeClasses()}`}>
                                {dayTasks.length}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-1 space-y-1">
                        {previewTasks.map((task) => {
                          const isPastTask = isPastDate(task.date);
                          const StatusIcon = getTaskStatusIcon(task);

                          return (
                            <TooltipProvider key={task.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={`text-[12px] px-2 py-1 rounded-lg ${getTaskContainerClasses(task, dominantStatus)} ${getTaskTextColor(task, 'primary', dominantStatus)} ${isPastTask ? 'cursor-default' : 'cursor-pointer'}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isPastTask) setSelectedTask(task);
                                  }}
                                  aria-disabled={isPastTask}
                                >
                                  <p className="flex items-center gap-1 min-w-0">
                                    {StatusIcon && <StatusIcon size={12} className="text-current" aria-hidden="true" />}
                                    <span className="truncate">
                                      {isPastTask ? `Done: ${task.title}` : task.title}
                                    </span>
                                  </p>
                                  <p className={`text-[10px] truncate ${getTaskTextColor(task, 'secondary', dominantStatus)}`}>
                                    {task.assignedWorker ?? 'Unassigned'}
                                  </p>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[220px]">
                                <p className="font-medium">{task.title}</p>
                                  <p className="text-xs text-[#6B7280]">{task.plotName} ??? {task.date}</p>
                                  <p className="text-xs text-[#6B7280]">Worker: {task.assignedWorker ?? 'Unassigned'}</p>
                                  {isPastTask && (
                                    <p className="text-xs text-gray-500">Task completed on {formatTaskDate(task.date)}</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}

                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}



        {/* Day View */}
        {viewMode === 'day' && (
          <div className="p-4">
            <div
              className={`space-y-3 ${isSameDay(currentDate, today)
                ? 'rounded-xl bg-slate-50 ring-2 ring-blue-300'
                : ''
                }`}
            >
              {getDayTasks().map((task) => {
                const isPastTask = isPastDate(task.date);

                return (
                  <div
                    key={task.id}
                    className={`p-3 rounded-xl ${getTaskContainerClasses(task)} ${isPastTask
                      ? 'cursor-default'
                      : 'cursor-pointer transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                      }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isPastTask) setSelectedTask(task);
                    }}
                    title={isPastTask ? `Task completed on ${formatTaskDate(task.date)}` : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {/* LEFT */}
                      <div className="min-w-0 flex-1">
                        <p className={`text-[14px] font-medium truncate ${getTaskTextColor(task)}`}>
                          {task.title}
                        </p>
                        <p className={`text-[12px] truncate ${getTaskTextColor(task, 'secondary')}`}>
                          {task.plotName} ??? {task.date}
                        </p>
                        <p className={`text-[12px] truncate ${getTaskTextColor(task, 'secondary')}`}>
                          Worker: {task.assignedWorker ?? 'Unassigned'}
                        </p>
                      </div>

                      {/* RIGHT */}
                      <div className="shrink-0">
                        {renderTaskStatusBadge(task)}
                      </div>
                    </div>
                  </div>
                );
              })}

              {getDayTasks().length === 0 && (
                <p className="text-[12px] text-[#9CA3AF]">No tasks scheduled for this day</p>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Task Details Dialog */}
      <Dialog
        key={selectedTask?.id ?? 'task-dialog'}
        open={!!selectedTask}
        onOpenChange={(open) => {
          if (!open) setSelectedTask(null);
        }}
      >


        <DialogContent
          className="rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >

          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
            <DialogDescription>
              {selectedTask?.plotName} â€¢ {selectedTask?.date}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#6B7280]">Status</span>
              {selectedTask ? renderTaskStatusBadge(selectedTask) : null}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#6B7280]">Assigned</span>
              <span>{selectedTask?.assignedWorker ?? 'Unassigned'}</span>
            </div>

            {selectedTask?.description && (
              <div>
                <p className="text-[#6B7280] mb-1">Description</p>
                <p className="text-[#111827]">{selectedTask.description}</p>
              </div>
            )}

            {selectedTask?.reason && (
              <div>
                <p className="text-[#6B7280] mb-1">Reason</p>
                <p className="text-[#111827]">{selectedTask.reason}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Date Details Dialog */}
      <Dialog
        key={selectedDate ?? 'date-dialog'}
        open={!!selectedDate}
        onOpenChange={(open) => {
          if (!open) setSelectedDate(null);
        }}
      >
        <DialogContent
          className="rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>
              {selectedDate
                ? new Date(selectedDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })
                : 'Selected Date'}
            </DialogTitle>
            <DialogDescription>
              {selectedDateTasks.length} task{selectedDateTasks.length === 1 ? '' : 's'} matching current filters
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {selectedDateTasks.map((task) => {
              const isPastTask = isPastDate(task.date);

              return (
                <div
                  key={task.id}
                  className={`p-3 rounded-xl ${getTaskContainerClasses(task)}`}
                  title={isPastTask ? `Task completed on ${formatTaskDate(task.date)}` : undefined}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`text-[14px] font-medium truncate ${getTaskTextColor(task)}`}>
                        {task.title}
                      </p>
                      <p className={`text-[12px] truncate ${getTaskTextColor(task, 'secondary')}`}>
                        {task.plotName} ({task.plotId})
                      </p>
                    </div>
                    {renderTaskStatusBadge(task)}
                  </div>
                  <div className={`mt-2 text-[12px] ${getTaskTextColor(task, 'secondary')}`}>
                    <p>Date: {task.date}</p>
                    <p>Worker: {task.assignedWorker ?? 'Unassigned'}</p>
                  </div>
                </div>
              );
            })}

            {selectedDateTasks.length === 0 && (
              <p className="text-[12px] text-[#9CA3AF]">No tasks for this date under current filters.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


