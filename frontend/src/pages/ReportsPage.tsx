import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../components/ui/table';
import { listPlots, listTasks, listWorkers } from '../lib/api';
import type { Plot, Task, Worker } from '../lib/api';
import { toast } from 'sonner';
import { Printer } from 'lucide-react';

const monthKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabel = (key: string) => {
  if (!key) return 'Unknown month';
  const [year, month] = key.split('-').map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });
};

const toWorkerKey = (task: Task) => {
  const id = task.assigned_worker_id?.trim();
  const name = task.assigned_worker_name?.trim();
  if (id) return { key: id, name };
  if (name) return { key: name, name };
  return { key: 'unassigned', name: 'Unassigned' };
};

export function ReportsPage() {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printTarget, setPrintTarget] = useState<'plot' | 'worker' | null>(null);

  const handlePrint = (target: 'plot' | 'worker') => {
    setPrintTarget(target);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
  };

  useEffect(() => {
    let isActive = true;

    Promise.all([listPlots(), listTasks(), listWorkers()])
      .then(([plotsRes, tasksRes, workersRes]) => {
        if (!isActive) return;
        setError(null);
        setPlots(plotsRes.data ?? []);
        setTasks(tasksRes.data ?? []);
        setWorkers(workersRes.data ?? []);
      })
      .catch((err: Error) => {
        if (!isActive) return;
        setError(err.message || 'Failed to load report data');
        toast.error('Failed to load report data');
      })
      .finally(() => {
        if (!isActive) return;
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (printTarget) {
      document.body.setAttribute('data-report-print', printTarget);
    } else {
      document.body.removeAttribute('data-report-print');
    }
  }, [printTarget]);

  useEffect(() => {
    const handleAfterPrint = () => setPrintTarget(null);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const tasksForMonth = useMemo(
    () => tasks.filter((task) => monthKey(task.task_date) === selectedMonth),
    [tasks, selectedMonth]
  );

  const plotRows = useMemo(() => {
    const byPlot = new Map<
      string,
      { total: number; proceed: number; pending: number; stop: number }
    >();

    tasksForMonth.forEach((task) => {
      const entry =
        byPlot.get(task.plot_id) ?? { total: 0, proceed: 0, pending: 0, stop: 0 };
      entry.total += 1;
      if (task.decision === 'Proceed') entry.proceed += 1;
      if (task.decision === 'Pending') entry.pending += 1;
      if (task.decision === 'Stop') entry.stop += 1;
      byPlot.set(task.plot_id, entry);
    });

    return plots
      .map((plot) => {
        const counts = byPlot.get(plot.id) ?? {
          total: 0,
          proceed: 0,
          pending: 0,
          stop: 0
        };
        const completionRate =
          counts.total === 0 ? 0 : Math.round((counts.proceed / counts.total) * 100);
        return {
          plotId: plot.id,
          plotName: plot.name,
          ...counts,
          completionRate
        };
      })
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.plotName.localeCompare(b.plotName);
      });
  }, [plots, tasksForMonth]);

  const workerIndex = useMemo(() => {
    return new Map(workers.map((worker) => [worker.id, worker.name]));
  }, [workers]);

  const workerRows = useMemo(() => {
    const byWorker = new Map<
      string,
      { workerKey: string; workerName: string; total: number; proceed: number; pending: number; stop: number }
    >();

    tasksForMonth.forEach((task) => {
      const { key, name } = toWorkerKey(task);
      const workerName = workerIndex.get(key) ?? name ?? 'Unknown Worker';
      const entry =
        byWorker.get(key) ?? {
          workerKey: key,
          workerName,
          total: 0,
          proceed: 0,
          pending: 0,
          stop: 0
        };

      entry.total += 1;
      if (task.decision === 'Proceed') entry.proceed += 1;
      if (task.decision === 'Pending') entry.pending += 1;
      if (task.decision === 'Stop') entry.stop += 1;
      entry.workerName = workerName;
      byWorker.set(key, entry);
    });

    return Array.from(byWorker.values()).sort((a, b) => {
      if (b.proceed !== a.proceed) return b.proceed - a.proceed;
      if (b.total !== a.total) return b.total - a.total;
      return a.workerName.localeCompare(b.workerName);
    });
  }, [tasksForMonth, workerIndex]);

  const monthLabel = formatMonthLabel(selectedMonth);
  const isEmptyMonth = !loading && tasksForMonth.length === 0;

  return (
    <div className="space-y-6 report-print-page">
      <div className="print-only report-print-header">
        <div>
          <h1 className="text-[22px] text-[#111827]">Reports & History</h1>
          <p className="text-sm text-[#6B7280]">Month: {monthLabel}</p>
        </div>
        <div className="text-sm text-[#6B7280]">
          Generated {new Date().toLocaleDateString('en-US')}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] text-[#111827]">Reports & History</h2>
          <p className="text-[16px] text-[#374151]">
            Monthly reports for plot progress and worker performance
          </p>
        </div>

        <div className="flex items-center gap-3 print:hidden">
          <label className="text-sm text-[#6B7280]" htmlFor="report-month">
            Month
          </label>
          <input
            id="report-month"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-10 px-3 rounded-xl border border-[#E5E7EB] bg-white text-[#111827] focus:border-[#15803D] focus:ring-[#15803D] focus:outline-none"
            aria-label="Select month"
          />
        </div>
      </div>

      {error && (
        <Card className="p-4 rounded-2xl bg-white border border-[#FCA5A5]">
          <p className="text-sm text-[#991B1B]">{error}</p>
        </Card>
      )}

      {loading && (
        <Card className="p-6 rounded-2xl bg-white">
          <p className="text-sm text-[#6B7280]">Loading report data...</p>
        </Card>
      )}

      {!loading && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="rounded-2xl bg-white overflow-hidden report-print-card report-print-plot">
            <div className="p-6 border-b border-[#E5E7EB] flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[#111827]">Monthly Plot Progress</h3>
                <p className="text-sm text-[#6B7280]">{monthLabel}</p>
              </div>
              <Button
                variant="default"
                size="sm"
                className="rounded-xl bg-[#16A34A] text-white hover:bg-[#15803D] report-print-controls"
                onClick={() => handlePrint('plot')}
              >
                <Printer size={16} />
                Print
              </Button>
            </div>

            <div className="p-4">
              {isEmptyMonth ? (
                <p className="text-sm text-[#6B7280]">No tasks recorded for this month.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F9FAFB] hover:bg-[#F9FAFB]">
                      <TableHead>Plot</TableHead>
                      <TableHead>Total Tasks</TableHead>
                      <TableHead>Proceed</TableHead>
                      <TableHead>Pending</TableHead>
                      <TableHead>Stop</TableHead>
                      <TableHead>Completion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plotRows.map((row) => (
                      <TableRow key={row.plotId} className="hover:bg-[#F9FAFB]">
                        <TableCell className="font-medium">{row.plotName}</TableCell>
                        <TableCell>{row.total}</TableCell>
                        <TableCell className="text-[#16A34A]">{row.proceed}</TableCell>
                        <TableCell className="text-[#CA8A04]">{row.pending}</TableCell>
                        <TableCell className="text-[#DC2626]">{row.stop}</TableCell>
                        <TableCell>{row.completionRate}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>

          <Card className="rounded-2xl bg-white overflow-hidden report-print-card report-print-worker">
            <div className="p-6 border-b border-[#E5E7EB] flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[#111827]">Monthly Worker Report</h3>
                <p className="text-sm text-[#6B7280]">{monthLabel}</p>
              </div>
              <Button
                variant="default"
                size="sm"
                className="rounded-xl bg-[#16A34A] text-white hover:bg-[#15803D] report-print-controls"
                onClick={() => handlePrint('worker')}
              >
                <Printer size={16} />
                Print
              </Button>
            </div>

            <div className="p-4">
              {isEmptyMonth ? (
                <p className="text-sm text-[#6B7280]">No tasks recorded for this month.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F9FAFB] hover:bg-[#F9FAFB]">
                      <TableHead>Worker</TableHead>
                      <TableHead>Total Assigned</TableHead>
                      <TableHead>Proceed</TableHead>
                      <TableHead>Pending</TableHead>
                      <TableHead>Stop</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workerRows.map((row) => (
                      <TableRow key={row.workerKey} className="hover:bg-[#F9FAFB]">
                        <TableCell className="font-medium">{row.workerName}</TableCell>
                        <TableCell>{row.total}</TableCell>
                        <TableCell className="text-[#16A34A]">{row.proceed}</TableCell>
                        <TableCell className="text-[#CA8A04]">{row.pending}</TableCell>
                        <TableCell className="text-[#DC2626]">{row.stop}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
