import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { StatusBadge } from '../components/StatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../components/ui/table';
import {
  approveReschedule,
  getAnalyticsHistory,
  getWeatherAnalytics,
  getWeatherRescheduleSuggestions,
  listPlots,
  listRescheduleProposals,
  listTasks,
  rejectReschedule,
} from '../lib/api';
import type { Task } from '../lib/api';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { InsightRecommendationsCard, type InsightSuggestion } from '../components/insights/InsightRecommendationsCard';
import { ReasonCard } from '../components/ReasonCard';

export function RescheduleCenterPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [plotNameMap, setPlotNameMap] = useState<Record<string, string>>({});
  const [weatherSuggestions, setWeatherSuggestions] = useState<InsightSuggestion[]>([]);
  const rescheduleTasks = useMemo(() => tasks.filter((t) => t.proposed_date), [tasks]);

  const loadData = async () => {
    const [plotsRes, tasksRes] = await Promise.all([listPlots(), listRescheduleProposals()]);
    const map: Record<string, string> = {};
    for (const p of plotsRes.data) map[p.id] = p.name;
    setPlotNameMap(map);
    setTasks(tasksRes.data);
  };

  const loadInsights = async () => {
    const safeFetch = async <T,>(promise: Promise<T>, fallback: T): Promise<T> => {
      try {
        return await promise;
      } catch (e) {
        console.error("Partial fetch error:", e);
        return fallback;
      }
    };

    try {
      interface RawBackendHistory {
        data_added: string;
        temperature: number;
        cleaned_temperature: number;
        soil_moisture: number;
        cleaned_soil_moisture: number;
        nitrogen: number;
        cleaned_nitrogen: number;
        [key: string]: unknown;
      }

      type WeatherItem = { date?: string; time?: string; [key: string]: unknown };

      const history = await safeFetch<RawBackendHistory[]>(
        getAnalyticsHistory(30) as unknown as Promise<RawBackendHistory[]>,
        [],
      );
      const processedHistory = history.map((item) => ({
        ...item,
        temperature_clean: item.cleaned_temperature,
        moisture_clean: item.cleaned_soil_moisture,
        nitrogen_clean: item.cleaned_nitrogen,
      }));

      const weather = await safeFetch<WeatherItem[]>(getWeatherAnalytics(), []);

      const allTasksRes = await safeFetch(listTasks(), { ok: true, data: [] });
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);
      
      // Include both today and tomorrow for suggestions (alignment with task evaluation)
      const upcomingTasks = allTasksRes.data.filter((t) => 
        t.task_date === todayStr || t.task_date === tomorrowStr
      );

      const upcomingWeather = weather.filter((w) => {
        const dateStr = w.date || w.time;
        if (!dateStr) return false;
        const wDate = dateStr.slice(0, 10);
        return wDate === todayStr || wDate === tomorrowStr;
      });

      let sensorSummary = null;
      if (processedHistory.length > 0) {
        const latest = processedHistory[processedHistory.length - 1];
        sensorSummary = {
          avg_n: latest.nitrogen_clean,
          avg_moisture: latest.moisture_clean,
          avg_temp: latest.temperature_clean,
        };
      }

      let suggestions: InsightSuggestion[] = [];
      try {
        const result = await getWeatherRescheduleSuggestions(
          upcomingTasks,
          upcomingWeather,
          sensorSummary,
        );
        suggestions = result.suggestions ?? [];
      } catch (e) {
        console.error("Insight suggestion error:", e);
      }
      setWeatherSuggestions(suggestions);
    } catch (err) {
      console.error("Critical error in reschedule insights:", err);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await loadData();
      } catch (e) {
        toast.error((e as Error).message ?? 'Failed to load reschedule proposals');
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      await loadInsights();
    })();
  }, []);

  const handleApprove = async (taskId: string) => {
    try {
      await approveReschedule(taskId);
      toast.success('Reschedule approved and applied');
      loadData();
      window.dispatchEvent(new Event('tasks:refresh'));
    } catch (e) {
      toast.error((e as Error).message ?? 'Approve failed');
    }
  };

  const handleReject = async (taskId: string) => {
    try {
      await rejectReschedule(taskId);
      toast.success('Reschedule rejected - original date maintained');
      loadData();
      window.dispatchEvent(new Event('tasks:refresh'));
    } catch (e) {
      toast.error((e as Error).message ?? 'Reject failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[20px] text-[#111827]">Reschedule Center</h2>
          <p className="text-[16px] text-[#374151]">Review and approve AI-generated reschedule proposals</p>
        </div>
        <Card className="p-4 rounded-2xl bg-gradient-to-br from-[#CA8A04] to-[#D97706] text-white shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle size={24} />
            <div>
              <p className="text-[14px] opacity-90">Pending Approvals</p>
              <p className="text-[20px]">{rescheduleTasks.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 rounded-2xl bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#DC2626]/10 rounded-xl flex items-center justify-center">
              <XCircle className="text-[#DC2626]" size={20} />
            </div>
            <div>
              <p className="text-[14px] text-[#6B7280]">Stop Status</p>
              <p className="text-[20px] text-[#111827]">
                {rescheduleTasks.filter((t) => t.decision === 'Stop').length}
              </p>
            </div>
          </div>
          <p className="text-[14px] text-[#6B7280]">Tasks halted due to critical conditions</p>
        </Card>

        <Card className="p-5 rounded-2xl bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#CA8A04]/10 rounded-xl flex items-center justify-center">
              <AlertCircle className="text-[#CA8A04]" size={20} />
            </div>
            <div>
              <p className="text-[14px] text-[#6B7280]">Pending Status</p>
              <p className="text-[20px] text-[#111827]">
                {rescheduleTasks.filter((t) => t.decision === 'Pending').length}
              </p>
            </div>
          </div>
          <p className="text-[14px] text-[#6B7280]">Tasks delayed for optimal conditions</p>
        </Card>
      </div>

      {/* Reschedule Table */}
      <Card className="rounded-2xl bg-white overflow-hidden shadow-sm">
        <div className="p-6 border-b border-[#E5E7EB]">
          <h3 className="text-[18px] text-[#111827]">Pending Reschedule Approvals</h3>
        </div>

        {rescheduleTasks.length > 0 ? (
          <div className="overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow className="bg-[#F9FAFB] hover:bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <TableHead className="pl-8 text-[14px]">Plot</TableHead>
                  <TableHead className="text-[14px]">Task</TableHead>
                  <TableHead className="text-[14px]">Original Date</TableHead>
                  <TableHead className="text-[14px]">Proposed Date</TableHead>
                  <TableHead className="text-[14px]">Status</TableHead>
                  <TableHead className="text-[14px] w-[320px]">Reason</TableHead>
                  <TableHead className="text-right pr-8 text-[14px] w-[220px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rescheduleTasks.map((task) => {
                  return (
                  <TableRow 
                    key={task.id} 
                    className="hover:bg-[#F0FDF4] transition-colors border-b border-[#E5E7EB]"
                  >
                    <TableCell className="pl-8 font-medium text-[14px]">{plotNameMap[task.plot_id] ?? task.plot_id}</TableCell>
                    <TableCell className="text-[14px]">{task.title}</TableCell>
                    <TableCell className="text-[14px]">
                      {task.original_date &&
                        new Date(task.original_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                    </TableCell>
                    <TableCell className="font-medium text-[#15803D] text-[14px]">
                      {task.proposed_date &&
                        new Date(task.proposed_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={task.decision} />
                    </TableCell>
                    <TableCell className="w-[320px] align-top">
                      <ReasonCard reasonText={task.reason ?? ''} status={task.decision} />
                    </TableCell>
                    <TableCell className="text-right pr-8 w-[220px]">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          className="bg-[#16A34A] hover:bg-[#15803D] rounded-xl gap-1 text-[14px]"
                          onClick={() => handleApprove(task.id)}
                        >
                          <CheckCircle2 size={16} />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl gap-1 text-[#DC2626] border-[#DC2626] hover:bg-red-50 hover:text-[#991B1B] transition-colors text-[14px]"
                          onClick={() => handleReject(task.id)}
                        >
                          <XCircle size={16} />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <CheckCircle2 size={48} className="mx-auto text-[#16A34A] mb-4" />
            <h4 className="text-[18px] text-[#111827] mb-2">All Clear!</h4>
            <p className="text-[14px] text-[#6B7280]">No reschedule proposals pending approval</p>
          </div>
        )}
      </Card>

      {/* Insight Recommendation (Weather-based) */}
      <InsightRecommendationsCard
        variant="analytics"
        suggestions={weatherSuggestions}
      />
    </div>
  );
}
