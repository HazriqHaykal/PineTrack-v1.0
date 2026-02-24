import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '../components/ui/dialog';
import { Plus, Search, Phone, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { createWorker, listPlots, listTasks, listWorkers } from "../lib/api";
import type { Plot, Task, Worker } from "../lib/api";
import { WorkerManageDialog } from "../components/workers/WorkerManageDialog";

export function WorkersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    role: 'Field Worker',
    contact: ''
  });

  useEffect(() => {
    const load = async () => {
      // Load workers, plots, and tasks from the backend (no mock data).
      setLoading(true);
      setError(null);
      try {
        const [workersRes, plotsRes, tasksRes] = await Promise.all([
          listWorkers(),
          listPlots(),
          listTasks(),
        ]);
        setWorkers(workersRes.data ?? []);
        setPlots(plotsRes.data ?? []);
        setTasks(tasksRes.data ?? []);
      } catch (err: Error | unknown) {
        const message = err instanceof Error ? err.message : "Failed to load workers data";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [])

  const filteredWorkers = workers.filter((worker) =>
    worker.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const todayStr = useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const tasksByWorker = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const workerId = task.assigned_worker_id ?? '';
      if (!workerId) continue;
      const bucket = map.get(workerId) ?? [];
      bucket.push(task);
      map.set(workerId, bucket);
    }
    return map;
  }, [tasks]);

  const plotsById = useMemo(() => {
    return new Map(plots.map((plot) => [plot.id, plot]));
  }, [plots]);

  const handleWorkerUpdated = (updatedWorker: Worker) => {
    setWorkers((prev) =>
      prev.map((worker) => (worker.id === updatedWorker.id ? updatedWorker : worker)),
    );
    setSelectedWorker(updatedWorker);
  };

  const handleWorkerDeleted = (workerId: string) => {
    setWorkers((prev) => prev.filter((worker) => worker.id !== workerId));
    setSelectedWorker(null);
  };

  const handleTaskUpdated = (updatedTask: Task) => {
    setTasks((prev) => prev.map((task) => (task.id === updatedTask.id ? updatedTask : task)));
  };

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      const message = "Worker name is required.";
      setError(message);
      toast.error(message);
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const res = await createWorker({
        name: trimmedName,
        role: formData.role,
        contact: formData.contact.trim() || null,
        is_active: true,
      });
      setWorkers((prev) => [res.data, ...prev]);
      toast.success("Worker added successfully");
      setIsAddDialogOpen(false);
      setFormData({ name: '', role: 'Field Worker', contact: '' });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add worker.";
      setError(message);
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const getWorkerInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] text-[#111827]">Worker Management</h2>
          <p className="text-[16px] text-[#374151]">Manage field workers and task assignments</p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#16A34A] hover:bg-[#16A34A] rounded-xl gap-2">
              <Plus size={20} />
              Add Worker
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Add New Worker</DialogTitle>
              <DialogDescription>Enter worker details and assign to plots</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddWorker} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workerName">Full Name</Label>
                <Input
                  id="workerName"
                  placeholder="e.g., Juan Santos"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="rounded-xl"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-white text-[#111827] focus:border-[#15803D] focus:ring-[#15803D] focus:outline-none"
                  required
                >
                  <option>Field Worker</option>
                  <option>Field Supervisor</option>
                  <option>Soil Specialist</option>
                  <option>Irrigation Technician</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact">Contact Number</Label>
                <Input
                  id="contact"
                  type="tel"
                  placeholder="+63 912 345 6789"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  className="rounded-xl"
                  required
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => setIsAddDialogOpen(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[#16A34A] hover:bg-[#16A34A] rounded-xl"
                  disabled={isCreating}
                >
                  {isCreating ? 'Saving...' : 'Add Worker'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl bg-white">
          <p className="text-sm text-[#6B7280] mb-1">Total Workers</p>
          <p className="text-2xl text-[#111827]">{workers.length}</p>
        </Card>
        <Card className="p-5 rounded-2xl bg-white">
          <p className="text-sm text-[#6B7280] mb-1">Active Today</p>
          <p className="text-2xl text-[#111827]">
            {workers.filter((worker) => worker.is_active).length}
          </p>
        </Card>
        <Card className="p-5 rounded-2xl bg-white">
          <p className="text-sm text-[#6B7280] mb-1">Tasks Completed</p>
          <p className="text-2xl text-[#111827]">
            {workers.reduce((sum, worker) => sum + (worker.tasks_completed ?? 0), 0)}
          </p>
        </Card>
        <Card className="p-5 rounded-2xl bg-white">
          <p className="text-sm text-[#6B7280] mb-1">Avg Performance</p>
          <p className="text-2xl text-[#111827]">94%</p>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4 rounded-2xl bg-white">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={18} />
          <Input
            placeholder="Search workers by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl border-[#E5E7EB]"
            aria-label="Search workers"
          />
        </div>
      </Card>

      {loading && (
        <Card className="p-3 rounded-2xl bg-white text-sm text-[#6B7280]">
          Loading workers...
        </Card>
      )}
      {error && !loading && (
        <Card className="p-3 rounded-2xl bg-red-50 text-sm text-[#991B1B] border border-red-200">
          {error}
        </Card>
      )}

      {/* Workers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWorkers.map((worker) => {
          const workerTasks = tasksByWorker.get(worker.id) ?? [];
          const todayTasks = workerTasks.filter((task) => task.task_date === todayStr);
          const assignedPlotIds = Array.from(
            new Set(workerTasks.map((task) => task.plot_id))
          );

          return (
            <Card
              key={worker.id}
              className="p-6 rounded-2xl bg-white border border-transparent hover:border-[#BBF7D0] hover:shadow-lg transition-all cursor-pointer"
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedWorker(worker);
                setManageDialogOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setSelectedWorker(worker);
                  setManageDialogOpen(true);
                }
              }}
              aria-label={`Manage ${worker.name}`}
            >
              {/* Worker Header */}
              <div className="flex items-start gap-4 mb-4">
                <Avatar>
                  <AvatarImage src={worker.avatar_url || undefined} alt={worker.name} />
                  <AvatarFallback>{getWorkerInitials(worker.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[#111827] truncate">{worker.name}</h3>
                  <p className="text-sm text-[#6B7280]">{worker.role ?? 'Field Worker'}</p>
                </div>
              </div>

              {/* Contact */}
              <div className="flex items-center gap-2 text-sm text-[#6B7280] mb-4">
                <Phone size={14} />
                <span>{worker.contact ?? '—'}</span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-[#E5E7EB]">
                <div>
                  <p className="text-xs text-[#6B7280] mb-1">Assigned Plots</p>
                  <p className="text-lg text-[#111827]">{assignedPlotIds.length}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6B7280] mb-1">Tasks Today</p>
                  <p className="text-lg text-[#111827]">{todayTasks.length}</p>
                </div>
              </div>

              {/* Assigned Plots */}
              <div className="mb-4">
                <p className="text-xs text-[#6B7280] mb-2">Assigned Plots:</p>
                <div className="flex flex-wrap gap-2">
                  {assignedPlotIds.map((plotId) => {
                    const plot = plotsById.get(plotId);
                    return plot ? (
                      <span
                        key={plotId}
                        className="px-2 py-1 bg-[#DCFCE7] text-[#15803D] text-xs rounded-lg"
                      >
                        {plot.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>

              {/* Performance */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-[#6B7280]">Tasks Completed</p>
                  <div className="flex items-center gap-1 text-[#16A34A]">
                    <CheckCircle2 size={14} />
                    <span className="text-xs">{worker.tasks_completed ?? 0}</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#15803D] to-[#16A34A] rounded-full"
                    style={{ width: '94%' }}
                    role="progressbar"
                    aria-valuenow={94}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <WorkerManageDialog
        worker={selectedWorker}
        open={manageDialogOpen}
        onOpenChange={(open) => {
          setManageDialogOpen(open);
          if (!open) setSelectedWorker(null);
        }}
        tasks={tasks}
        plotsById={plotsById}
        onUpdated={handleWorkerUpdated}
        onDeleted={handleWorkerDeleted}
        onTaskUpdated={handleTaskUpdated}
      />
    </div>
  );
}
