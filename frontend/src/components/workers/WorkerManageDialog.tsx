import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { AlertTriangle } from "lucide-react";
import type { Plot, Task, Worker } from "../../lib/api";
import { deleteWorker, updateTaskAssignment, updateWorker } from "../../lib/api";

type WorkerManageDialogProps = {
  worker: Worker | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  plotsById: Map<string, Plot>;
  onUpdated: (worker: Worker) => void;
  onDeleted: (workerId: string) => void;
  onTaskUpdated: (task: Task) => void;
};

const ROLE_OPTIONS = [
  "Field Worker",
  "Field Supervisor",
  "Soil Specialist",
  "Irrigation Technician",
];

function getWorkerInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function WorkerManageDialog({
  worker,
  open,
  onOpenChange,
  tasks,
  plotsById,
  onUpdated,
  onDeleted,
  onTaskUpdated,
}: WorkerManageDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("Field Worker");
  const [formContact, setFormContact] = useState("");
  const [formStatus, setFormStatus] = useState("active");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const todayStr = useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const workerTasks = useMemo(() => {
    if (!worker) return [];
    return tasks.filter((task) => task.assigned_worker_id === worker.id);
  }, [tasks, worker]);

  const activeWorkerTasks = useMemo(() => {
    return workerTasks.filter((task) => task.task_date >= todayStr);
  }, [workerTasks, todayStr]);

  const tasksForAssignment = useMemo(() => {
    return tasks
      .filter((task) => task.task_date >= todayStr)
      .slice()
      .sort((a, b) => {
        const aAssigned = Boolean(a.assigned_worker_id);
        const bAssigned = Boolean(b.assigned_worker_id);
        if (aAssigned !== bAssigned) return aAssigned ? 1 : -1;
        return a.task_date.localeCompare(b.task_date);
      });
  }, [tasks, todayStr]);

  const selectedTask = useMemo(() => {
    return tasksForAssignment.find((task) => task.id === selectedTaskId) ?? null;
  }, [tasksForAssignment, selectedTaskId]);

  useEffect(() => {
    if (!worker) return;
    setFormName(worker.name);
    setFormRole(worker.role ?? "Field Worker");
    setFormContact(worker.contact ?? "");
    setFormStatus(worker.is_active ? "active" : "inactive");
    setIsEditing(false);
    setSelectedTaskId("");
    setShowDeleteConfirm(false);
  }, [worker, open]);

  const handleSave = async () => {
    if (!worker) return;
    if (!formName.trim()) {
      toast.error("Worker name is required.");
      return;
    }
    const payload = {
      name: formName.trim() || worker.name,
      role: formRole,
      contact: formContact.trim() || null,
      ...(worker.is_active != null ? { is_active: formStatus === "active" } : {}),
    };

    try {
      setIsSaving(true);
      const res = await updateWorker(worker.id, payload);
      onUpdated(res.data);
      setIsEditing(false);
      toast.success("Worker updated.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update worker.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!worker) return;
    if (activeWorkerTasks.length > 0) {
      toast.error("Cannot delete a worker with active tasks.");
      return;
    }

    try {
      setIsDeleting(true);
      await deleteWorker(worker.id);
      onDeleted(worker.id);
      onOpenChange(false);
      toast.success("Worker deleted.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete worker.";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAssignTask = async () => {
    if (!worker || !selectedTask) return;

    const isOverwrite =
      selectedTask.assigned_worker_id &&
      selectedTask.assigned_worker_id !== worker.id;

    if (isOverwrite) {
      const confirmed = window.confirm(
        "This task is already assigned. Overwrite the assignment?",
      );
      if (!confirmed) return;
    }

    try {
      const res = await updateTaskAssignment({
        task_id: selectedTask.id,
        assigned_worker_id: worker.id,
        assigned_worker_name: worker.name,
      });
      onTaskUpdated(res.data);
      setSelectedTaskId("");
      toast.success("Task assigned.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to assign task.";
      toast.error(message);
    }
  };

  if (!worker) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Worker Details</DialogTitle>
          <DialogDescription>View and manage worker profile information.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={worker.avatar_url || undefined} alt={worker.name} />
            <AvatarFallback>{getWorkerInitials(worker.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-[#111827] font-medium">{worker.name}</p>
            <p className="text-sm text-[#6B7280]">{worker.role ?? "Field Worker"}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {isEditing ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="workerEditName">Full Name</Label>
                <Input
                  id="workerEditName"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workerEditRole">Role</Label>
                <select
                  id="workerEditRole"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-white text-[#111827] focus:border-[#15803D] focus:ring-[#15803D] focus:outline-none"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="workerEditContact">Phone</Label>
                <Input
                  id="workerEditContact"
                  value={formContact}
                  onChange={(e) => setFormContact(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              {worker.is_active != null && (
                <div className="space-y-2">
                  <Label htmlFor="workerEditStatus">Status</Label>
                  <select
                    id="workerEditStatus"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-white text-[#111827] focus:border-[#15803D] focus:ring-[#15803D] focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  className="bg-[#16A34A] hover:bg-[#15803D] rounded-xl"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl bg-[#F9FAFB] p-3">
                <p className="text-xs text-[#6B7280]">Phone</p>
                <p className="text-sm text-[#111827]">{worker.contact ?? "—"}</p>
              </div>
              <div className="rounded-xl bg-[#F9FAFB] p-3">
                <p className="text-xs text-[#6B7280]">Role</p>
                <p className="text-sm text-[#111827]">{worker.role ?? "Field Worker"}</p>
              </div>
              {worker.is_active != null && (
                <div className="rounded-xl bg-[#F9FAFB] p-3">
                  <p className="text-xs text-[#6B7280]">Status</p>
                  <p className="text-sm text-[#111827]">
                    {worker.is_active ? "Active" : "Inactive"}
                  </p>
                </div>
              )}
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" className="rounded-xl" onClick={() => setIsEditing(true)}>
                    Edit Worker
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl text-[#DC2626] border-[#DC2626] hover:bg-red-50 hover:text-[#991B1B]"
                    disabled={activeWorkerTasks.length > 0 || isDeleting}
                    onClick={() => setShowDeleteConfirm((prev) => !prev)}
                  >
                    Delete Worker
                  </Button>
                </div>

                {showDeleteConfirm && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 text-[#B91C1C]">
                        <AlertTriangle size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#7F1D1D]">Delete worker?</p>
                        <p className="text-xs text-[#991B1B]">
                          This action cannot be undone.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={isDeleting}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="rounded-xl bg-[#DC2626] hover:bg-[#B91C1C]"
                        onClick={handleDelete}
                        disabled={isDeleting}
                      >
                        {isDeleting ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              {activeWorkerTasks.length > 0 && (
                <p className="text-xs text-[#DC2626]">
                  Cannot delete a worker with active tasks.
                </p>
              )}
            </>
          )}
        </div>

        <div className="mt-6 border-t border-[#E5E7EB] pt-4 space-y-3">
          <h4 className="text-sm text-[#111827] font-medium">Assign Tasks</h4>
          <div className="space-y-2">
            <Label htmlFor="taskSelect">Select Task</Label>
            <select
              id="taskSelect"
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-white text-[#111827] focus:border-[#15803D] focus:ring-[#15803D] focus:outline-none"
            >
              <option value="">Choose a task</option>
              {tasksForAssignment.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title} • {task.task_date}
                </option>
              ))}
            </select>
          </div>

          {selectedTask && (
            <div className="rounded-xl bg-[#F9FAFB] p-3 space-y-1 text-sm">
              <p className="text-[#111827] font-medium">{selectedTask.title}</p>
              <p className="text-[#6B7280]">Date: {selectedTask.task_date}</p>
              <p className="text-[#6B7280]">
                Plot: {plotsById.get(selectedTask.plot_id)?.name ?? selectedTask.plot_id}
              </p>
              <p className="text-[#6B7280]">
                Assigned: {selectedTask.assigned_worker_name ?? "Unassigned"}
              </p>
            </div>
          )}

          <Button
            className="bg-[#16A34A] hover:bg-[#15803D] rounded-xl"
            onClick={handleAssignTask}
            disabled={!selectedTask}
          >
            Assign to this Worker
          </Button>
        </div>

        {workerTasks.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-[#6B7280] mb-2">Assigned Tasks</p>
            <div className="space-y-2 max-h-32 overflow-auto">
              {workerTasks.map((task) => (
                <div key={task.id} className="text-xs text-[#6B7280]">
                  {task.title} • {task.task_date}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
