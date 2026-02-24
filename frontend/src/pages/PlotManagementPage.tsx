import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '../components/ui/dialog';
import { StatusBadge } from '../components/StatusBadge';
import { createPlotWithPlan, listPlots, listTasks, updatePlot } from '../lib/api';
import type { Plot, Task } from '../lib/api';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deletePlot } from "../lib/api";
import { getPlotStatusFromTasks } from '../lib/plotStatus';



interface PlotManagementPageProps {
  onNavigate: (page: string, plotId?: string) => void;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function calcHarvestProgressPercent(plantingDateISO: string, cycleDays = 420): number {
  const start = new Date(plantingDateISO);
  const now = new Date();

  const diffMs = now.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  const pct = (diffDays / cycleDays) * 100;
  return Math.round(clamp(pct, 0, 100));
}




export function PlotManagementPage({ onNavigate }: PlotManagementPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [plots, setPlots] = useState<Plot[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const defaultGrowthStage = 'Establishment';
  const [formData, setFormData] = useState({
    name: '',
    cropType: 'MD2 Pineapple',
    area: '',
    plantingDate: ''
  });

  const loadPlots = async () => {
    try {
      const [plotsRes, tasksRes] = await Promise.all([listPlots(), listTasks()]);
      // Sort by created_at (oldest first) so newly added plots land at the bottom.
      const sortedPlots = (plotsRes.data ?? []).slice().sort((a, b) => {
        const aTime = Date.parse(a.created_at ?? "");
        const bTime = Date.parse(b.created_at ?? "");

        if (Number.isFinite(aTime) && Number.isFinite(bTime)) {
          return aTime - bTime;
        }

        return String(a.id).localeCompare(String(b.id));
      });

      setPlots(sortedPlots);
      setTasks(tasksRes.data ?? []);
    } catch (e) {
      toast.error((e as Error).message ?? 'Failed to load plots');
    }
  };

  useEffect(() => {
    loadPlots();
  }, []);

  useEffect(() => {
    const handler = () => {
      loadPlots();
    };
    window.addEventListener("tasks:refresh", handler);
    return () => window.removeEventListener("tasks:refresh", handler);
  }, []);

  const filteredPlots = useMemo(() => {
    return plots.filter(
      (plot) =>
        plot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plot.crop_type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [plots, searchTerm]);

  const plotStatusById = useMemo(() => {
    const tasksByPlot = new Map<string, Task[]>();
    for (const task of tasks) {
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
  }, [plots, tasks]);

  const handleAddPlot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createPlotWithPlan({
        name: formData.name,
        crop_type: formData.cropType,
        area_ha: Number(formData.area),
        planting_date: formData.plantingDate,
        growth_stage: defaultGrowthStage,
      });
      toast.success(`Plot created (${res.plot_id}). ${res.tasks_created} tasks generated.`);
      setIsAddDialogOpen(false);
      setFormData({ name: '', cropType: 'MD2 Pineapple', area: '', plantingDate: '' });
      loadPlots();
    } catch (e) {
      toast.error((e as Error).message ?? 'Failed to create plot');
    }
  };

  const handleDeletePlot = async (
    plotId: string,
    plotName: string,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();

    const confirmed = window.confirm(
      `Are you sure you want to delete "${plotName}"?\n\nAll related tasks will also be removed.`
    );
    if (!confirmed) return;

    try {
      await deletePlot(plotId);
      toast.success(`Plot "${plotName}" deleted`);

      // clear context if needed
      if (sessionStorage.getItem("last_plot_id") === plotId) {
        sessionStorage.removeItem("last_plot_id");
      }

      // refresh plot list
      await loadPlots(); // ⬅️ your existing fetch function
    } catch (err) {
      toast.error((err as Error)?.message ?? "Failed to delete plot");
    }
  };


  const handleEditClick = (plot: Plot, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPlot(plot);
    setFormData({
      name: plot.name,
      cropType: plot.crop_type,
      area: String(plot.area_ha),
      plantingDate: plot.planting_date
    });
    setIsEditDialogOpen(true);
  };

  const handleEditPlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlot?.id) {
      toast.error('No plot selected for update.');
      return;
    }

    if (!formData.name || !formData.area || !formData.plantingDate) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setIsSaving(true);
    try {
      await updatePlot(selectedPlot.id, {
        name: formData.name,
        crop_type: formData.cropType,
        area_ha: Number(formData.area),
        planting_date: formData.plantingDate,
      });

      toast.success('Plot updated successfully.');
      setIsEditDialogOpen(false);
      setSelectedPlot(null);
      setFormData({ name: '', cropType: 'MD2 Pineapple', area: '', plantingDate: '' });
      await loadPlots();
    } catch (err) {
      console.error('Failed to update plot:', err);
      toast.error((err as Error)?.message ?? 'Failed to update plot');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header directly on gradient */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] text-[#111827]">Plot Management</h2>
          <p className="text-[16px] text-[#374151]">Manage all registered plots</p>
        </div>

        {/* Add New Plot Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#16A34A] hover:bg-[#16A34A] rounded-xl gap-2">
              <Plus size={20} />
              Add New Plot
            </Button>
          </DialogTrigger>

          {/* Add Plot dialog content */}
          <DialogContent className="rounded-[20px] p-8 shadow-[0_8px_20px_rgba(0,0,0,0.15)]">
            <DialogHeader>
              <DialogTitle className="text-[20px]">Add New Plot</DialogTitle>
              <DialogDescription className="text-[14px]">
                Enter plot details. A 14-month schedule will be auto-generated.
              </DialogDescription>
            </DialogHeader>


            <form onSubmit={handleAddPlot} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="plotName" className="text-[14px]">Plot Name</Label>
                <Input
                  id="plotName"
                  placeholder="e.g., Plot D-1"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="rounded-xl"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cropType" className="text-[14px]">Crop Type</Label>
                <select
                  id="cropType"
                  value={formData.cropType}
                  onChange={(e) => setFormData({ ...formData, cropType: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-white text-[#111827] text-[14px] focus:border-[#15803D] focus:ring-[#15803D] focus:outline-none"
                  required
                >
                  <option>MD2 Pineapple</option>
                  <option>Queen Pineapple</option>
                  <option>Smooth Cayenne</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="area" className="text-[14px]">Area (hectares)</Label>
                <Input
                  id="area"
                  type="number"
                  step="0.1"
                  placeholder="e.g., 2.5"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  className="rounded-xl"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plantingDate" className="text-[14px]">Planting Date</Label>
                <Input
                  id="plantingDate"
                  type="date"
                  value={formData.plantingDate}
                  onChange={(e) => setFormData({ ...formData, plantingDate: e.target.value })}
                  className="rounded-xl"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[#16A34A] hover:bg-[#16A34A] rounded-xl text-[14px]">
                  Add Plot
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Plot Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="rounded-[20px] p-8 shadow-[0_8px_20px_rgba(0,0,0,0.15)]">
            <DialogHeader>
              <DialogTitle className="text-[20px]">Edit Plot</DialogTitle>
              <DialogDescription className="text-[14px]">
                Update plot details below.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditPlot} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editPlotName" className="text-[14px]">Plot Name</Label>
                <Input
                  id="editPlotName"
                  placeholder="e.g., Plot D-1"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="rounded-xl"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editCropType" className="text-[14px]">Crop Type</Label>
                <select
                  id="editCropType"
                  value={formData.cropType}
                  onChange={(e) => setFormData({ ...formData, cropType: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-white text-[#111827] text-[14px] focus:border-[#15803D] focus:ring-[#15803D] focus:outline-none"
                  required
                >
                  <option>MD2 Pineapple</option>
                  <option>Queen Pineapple</option>
                  <option>Smooth Cayenne</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editArea" className="text-[14px]">Area (hectares)</Label>
                <Input
                  id="editArea"
                  type="number"
                  step="0.1"
                  placeholder="e.g., 2.5"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  className="rounded-xl"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editPlantingDate" className="text-[14px]">Planting Date</Label>
                <Input
                  id="editPlantingDate"
                  type="date"
                  value={formData.plantingDate}
                  onChange={(e) => setFormData({ ...formData, plantingDate: e.target.value })}
                  className="rounded-xl"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 rounded-xl text-[14px]"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[#15803D] hover:bg-[#16A34A] rounded-xl text-[14px]"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
      <Card className="p-4 rounded-2xl bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]"
              size={18} />
            <Input
              placeholder="Search plots by name or crop type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl border-[#E5E7EB] focus:border-[#15803D] focus:ring-[#15803D]"
              aria-label="Search plots"
            />
          </div>
        </div>
      </Card>

      {/* Plots Table */}
      <Card className="rounded-2xl bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F9FAFB] hover:bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <TableHead className="pl-8 text-[14px]">Plot ID</TableHead>
                <TableHead className="text-[14px]">Name</TableHead>
                <TableHead className="text-[14px]">Crop Type</TableHead>
                <TableHead className="text-[14px]">Area</TableHead>
                <TableHead className="text-[14px]">Planting Date</TableHead>
                <TableHead className="text-[14px]">Status</TableHead>
                <TableHead className="text-[14px]">Progress</TableHead>
                <TableHead className="text-right pr-8 text-[14px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlots.map((plot) => (
                <TableRow
                  key={plot.id}
                  className="cursor-pointer hover:bg-[#F0FDF4] transition-colors border-b border-[#E5E7EB]"
                  onClick={() => onNavigate('plot-details', plot.id)}
                >
                  <TableCell className="pl-8 font-medium text-[14px]">{plot.id}</TableCell>
                  <TableCell className="text-[14px]">{plot.name}</TableCell>
                  <TableCell className="text-[14px]">{plot.crop_type}</TableCell>
                  <TableCell className="text-[14px]">{plot.area_ha} ha</TableCell>
                  <TableCell className="text-[14px]">
                    {new Date(plot.planting_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={plotStatusById.get(plot.id) ?? plot.status} />
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const progress = calcHarvestProgressPercent(plot.planting_date);

                      return (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#2563EB] rounded-full transition-all"
                              style={{ width: `${Math.max(progress, 3)}%` }}
                              role="progressbar"
                              aria-valuenow={progress}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            />
                          </div>
                          <span className="text-[14px] text-[#374151]">{progress}%</span>
                        </div>

                      );
                    })()}
                  </TableCell>

                  <TableCell className="text-right pr-8">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-lg hover:bg-[#15803D]/10 hover:text-[#15803D] transition-colors"
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) =>
                          handleEditClick(plot, e)
                        }
                        aria-label={`Edit ${plot.name}`}
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-lg text-[#DC2626] hover:text-[#991B1B] hover:bg-red-50 transition-colors"
                        onClick={(e) => handleDeletePlot(plot.id, plot.name, e)}
                        aria-label={`Delete ${plot.name}`}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl bg-white shadow-sm p-4">
          <p className="text-[14px] text-[#6B7280] mb-1">Total Plots</p>
          <p className="text-[20px] text-[#111827]">{plots.length}</p>
        </Card>
        <Card className="rounded-2xl bg-white shadow-sm p-4">
          <p className="text-[14px] text-[#6B7280] mb-1">Total Area</p>
          <p className="text-[20px] text-[#111827]">
            {plots.reduce((sum, plot) => sum + (plot.area_ha ?? 0), 0).toFixed(1)} ha
          </p>
        </Card>
        <Card className="rounded-2xl bg-white shadow-sm p-4">
          <p className="text-[14px] text-[#6B7280] mb-1">Avg Progress</p>
          <p className="text-[20px] text-[#111827]">
            {plots.length === 0
              ? "—"
              : `${Math.round(
                plots.reduce((sum, plot) => sum + calcHarvestProgressPercent(plot.planting_date), 0) /
                plots.length,
              )}%`}
          </p>
        </Card>
        <Card className="rounded-2xl bg-white shadow-sm p-4">
          <p className="text-[14px] text-[#6B7280] mb-1">Active Issues</p>
          <p className="text-[20px] text-[#111827]">
            {plots.filter((p) => {
              const status = plotStatusById.get(p.id) ?? p.status;
              return status === 'Stop' || status === 'Pending';
            }).length}
          </p>
        </Card>
      </div>
    </div>
  );
}
