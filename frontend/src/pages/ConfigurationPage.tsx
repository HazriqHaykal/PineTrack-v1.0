import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  getThresholds,
  updateThresholds,
  resetThresholds,
  getTaskEvalThresholds,
  updateTaskEvalThresholds,
  evaluateStatusThreshold,
  listPlots,
} from '../lib/api';
import type { TaskEvalThresholdUpdate } from '../lib/api';
import { toast } from 'sonner';
import {
  Save,
  RotateCcw,
  Settings,
  Database,
  ClipboardList,
  Droplet,
  Thermometer,
  CloudRain,
  Waves,
} from 'lucide-react';

const TASK_EVAL_DEFAULTS: TaskEvalThresholdUpdate = {
  soil_moisture_min: 15,
  soil_moisture_max: 25,
  temperature_min: 22,
  temperature_max: 32,
  rain_mm_min: 2,
  rain_mm_heavy: 10,
  waterlogging_hours: 24,
};

type TaskEvalThresholdErrors = Partial<Record<keyof TaskEvalThresholdUpdate, string>>;

export function ConfigurationPage() {
  const [thresholds, setThresholds] = useState({
    temperature: { min: 0, max: 60 },
    moisture: { min: 1, max: 100 }
  });
  const [taskEvalThresholds, setTaskEvalThresholds] =
    useState<TaskEvalThresholdUpdate>(TASK_EVAL_DEFAULTS);
  const [taskEvalErrors, setTaskEvalErrors] = useState<TaskEvalThresholdErrors>({});
  const [loading, setLoading] = useState(true);
  const [savingTaskEval, setSavingTaskEval] = useState(false);

  // Fetch thresholds on component mount
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchThresholds(), fetchTaskEvalThresholds()]);
      setLoading(false);
    };
    load();
  }, []);

  const fetchThresholds = async () => {
    try {
      const data = await getThresholds();
      setThresholds({
        temperature: { min: data.temperature_min, max: data.temperature_max },
        moisture: { min: data.soil_moisture_min, max: data.soil_moisture_max }
      });
    } catch (error) {
      toast.error('Failed to load thresholds');
      console.error(error);
    }
  };

  const fetchTaskEvalThresholds = async () => {
    try {
      const data = await getTaskEvalThresholds();
      setTaskEvalThresholds({
        soil_moisture_min: data.soil_moisture_min,
        soil_moisture_max: data.soil_moisture_max,
        temperature_min: data.temperature_min,
        temperature_max: data.temperature_max,
        rain_mm_min: data.rain_mm_min,
        rain_mm_heavy: data.rain_mm_heavy,
        waterlogging_hours: data.waterlogging_hours,
      });
    } catch (error) {
      toast.error('Failed to load task evaluation thresholds');
      console.error(error);
      setTaskEvalThresholds(TASK_EVAL_DEFAULTS);
    }
  };

  const handleSaveThresholds = async () => {
    try {
      await updateThresholds({
        temperature_min: thresholds.temperature.min,
        temperature_max: thresholds.temperature.max,
        soil_moisture_min: thresholds.moisture.min,
        soil_moisture_max: thresholds.moisture.max
      });
      toast.success('Configuration saved successfully');
    } catch (error) {
      toast.error('Failed to save configuration');
      console.error(error);
    }
  };

  const validateTaskEvalThresholds = (values: TaskEvalThresholdUpdate) => {
    const errors: TaskEvalThresholdErrors = {};

    if (values.soil_moisture_min < 0) {
      errors.soil_moisture_min = 'Must be 0 or higher';
    }
    if (values.soil_moisture_max < 0) {
      errors.soil_moisture_max = 'Must be 0 or higher';
    }
    if (values.temperature_min < 0) {
      errors.temperature_min = 'Must be 0 or higher';
    }
    if (values.temperature_max < 0) {
      errors.temperature_max = 'Must be 0 or higher';
    }
    if (values.rain_mm_min < 0) {
      errors.rain_mm_min = 'Must be 0 or higher';
    }
    if (values.rain_mm_heavy < 0) {
      errors.rain_mm_heavy = 'Must be 0 or higher';
    }
    if (values.waterlogging_hours < 1) {
      errors.waterlogging_hours = 'Must be at least 1';
    }
    if (values.soil_moisture_min > values.soil_moisture_max) {
      errors.soil_moisture_max = 'Max must be greater than min';
    }
    if (values.temperature_min > values.temperature_max) {
      errors.temperature_max = 'Max must be greater than min';
    }
    if (values.rain_mm_min >= values.rain_mm_heavy) {
      errors.rain_mm_min = 'Must be lower than heavy rain threshold';
      errors.rain_mm_heavy = 'Must be higher than rain threshold';
    }

    return errors;
  };

  const handleSaveTaskEvalThresholds = async () => {
    const errors = validateTaskEvalThresholds(taskEvalThresholds);
    setTaskEvalErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error('Fix the highlighted fields before saving');
      return;
    }

    try {
      setSavingTaskEval(true);
      await updateTaskEvalThresholds(taskEvalThresholds);
      toast.success('Task evaluation thresholds saved');
      const plotId = await resolveEvaluationPlotId();
      if (!plotId) {
        toast.info('No plots available for evaluation.');
        return;
      }
      const date = formatLocalDate(new Date());
      try {
        const result = await evaluateStatusThreshold({
          plot_id: plotId,
          date,
          device_id: 205,
          reschedule_days: 2,
        });
        if (result.updated === 0) {
          toast.info('No task status changes detected.');
        } else {
          toast.success(`Task statuses updated (${result.updated} tasks).`);
        }
        window.dispatchEvent(new Event('tasks:refresh'));
      } catch (evalError) {
        toast.error('Saved, but evaluation failed');
        console.error(evalError);
      }
    } catch (error) {
      toast.error('Failed to save task evaluation thresholds');
      console.error(error);
    } finally {
      setSavingTaskEval(false);
    }
  };

  const handleResetTaskEvalThresholds = () => {
    setTaskEvalThresholds(TASK_EVAL_DEFAULTS);
    setTaskEvalErrors({});
    toast.info('Task evaluation thresholds reset to defaults');
  };

  const handleResetThresholds = async () => {
    try {
      await resetThresholds();
      await fetchThresholds(); // Refresh data
      toast.info('Thresholds reset to default values');
    } catch (error) {
      toast.error('Failed to reset thresholds');
      console.error(error);
    }
  };

  const formatLocalDate = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const resolveEvaluationPlotId = async () => {
    const storedId = localStorage.getItem('selected_plot_id');
    if (storedId) return storedId;
    try {
      const plotsRes = await listPlots();
      return plotsRes.data?.[0]?.id ?? null;
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] text-[#111827]">System Configuration</h2>
        <p className="text-[16px] text-[#374151]">Manage thresholds and system preferences</p>
      </div>

      <Tabs defaultValue="sensor-thresholds" className="w-full">
        <TabsList className="grid w-full grid-cols-3 rounded-xl bg-transparent">
          <TabsTrigger
            value="sensor-thresholds"
            className="rounded-lg gap-2 data-[state=active]:bg-[#B9EEC9] data-[state=active]:text-[#065F46] hover:bg-[#DFF7E8] transition"
          >
            <Settings size={16} />
            Sensor Health Thresholds
          </TabsTrigger>

          <TabsTrigger
            value="task-thresholds"
            className="rounded-lg gap-2 data-[state=active]:bg-[#B9EEC9] data-[state=active]:text-[#065F46] hover:bg-[#DFF7E8] transition"
          >
            <ClipboardList size={16} />
            Task Evaluation Thresholds
          </TabsTrigger>

          <TabsTrigger
            value="system"
            className="rounded-lg gap-2 data-[state=active]:bg-[#B9EEC9] data-[state=active]:text-[#065F46] hover:bg-[#DFF7E8] transition"
          >
            <Database size={16} />
            System
          </TabsTrigger>
        </TabsList>





        {/* Thresholds Tab */}
        <TabsContent value="sensor-thresholds" className="mt-6 space-y-6">
          <Card className="p-6 rounded-2xl bg-white">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-[#111827] mb-1">Sensor Health Thresholds</h3>
                <p className="text-sm text-[#6B7280]">
                  Define acceptable ranges for soil and environmental parameters
                </p>
              </div>
              <Button
                variant="outline"
                className="rounded-xl gap-2"
                onClick={handleResetThresholds}
              >
                <RotateCcw size={16} />
                Reset to Default
              </Button>
            </div>

            <div className="space-y-6">
              {/* Moisture */}
              <div className="p-5 bg-[#F9FAFB] rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-[#16A34A] rounded-lg flex items-center justify-center text-white">
                    💧
                  </div>
                  <div>
                    <h4 className="text-[#111827]">Soil Moisture</h4>
                    <p className="text-xs text-[#6B7280]">Optimal range for pineapple growth</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="moistureMin">Minimum (%)</Label>
                    <Input
                      id="moistureMin"
                      type="number"
                      value={thresholds.moisture.min}
                      onChange={(e) =>
                        setThresholds({
                          ...thresholds,
                          moisture: { ...thresholds.moisture, min: Number(e.target.value) }
                        })
                      }
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="moistureMax">Maximum (%)</Label>
                    <Input
                      id="moistureMax"
                      type="number"
                      value={thresholds.moisture.max}
                      onChange={(e) =>
                        setThresholds({
                          ...thresholds,
                          moisture: { ...thresholds.moisture, max: Number(e.target.value) }
                        })
                      }
                      className="rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Temperature */}
              <div className="p-5 bg-[#F9FAFB] rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-[#DC2626] rounded-lg flex items-center justify-center text-white">
                    🌡️
                  </div>
                  <div>
                    <h4 className="text-[#111827]">Temperature</h4>
                    <p className="text-xs text-[#6B7280]">Optimal temperature range</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tempMin">Minimum (°C)</Label>
                    <Input
                      id="tempMin"
                      type="number"
                      value={thresholds.temperature.min}
                      onChange={(e) =>
                        setThresholds({
                          ...thresholds,
                          temperature: { ...thresholds.temperature, min: Number(e.target.value) }
                        })
                      }
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tempMax">Maximum (°C)</Label>
                    <Input
                      id="tempMax"
                      type="number"
                      value={thresholds.temperature.max}
                      onChange={(e) =>
                        setThresholds({
                          ...thresholds,
                          temperature: { ...thresholds.temperature, max: Number(e.target.value) }
                        })
                      }
                      className="rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                className="flex-1 bg-[#16A34A] hover:bg-[#16A34A] rounded-xl gap-2"
                onClick={handleSaveThresholds}
              >
                <Save size={16} />
                Save Thresholds
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Task Evaluation Thresholds Tab */}
        <TabsContent value="task-thresholds" className="mt-6 space-y-6">
          <Card className="p-6 rounded-2xl bg-white">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-[#111827] mb-1">Task Evaluation Thresholds</h3>
                <p className="text-sm text-[#6B7280]">
                  Configure daily task evaluation rules for moisture, temperature, and rain
                </p>
              </div>
              <Button
                variant="outline"
                className="rounded-xl gap-2"
                onClick={handleResetTaskEvalThresholds}
              >
                <RotateCcw size={16} />
                Reset to Default
              </Button>
            </div>

            <div className="space-y-6">
              <div className="p-5 bg-[#F9FAFB] rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-[#16A34A] rounded-lg flex items-center justify-center text-white">
                    <Droplet size={16} />
                  </div>
                  <div>
                    <h4 className="text-[#111827]">Soil Moisture</h4>
                    <p className="text-xs text-[#6B7280]">Used to defer field tasks when soil is wet</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="taskMoistureMin">Minimum (%)</Label>
                    <Input
                      id="taskMoistureMin"
                      type="number"
                      value={taskEvalThresholds.soil_moisture_min}
                      onChange={(e) => {
                        const next = {
                          ...taskEvalThresholds,
                          soil_moisture_min: Number(e.target.value),
                        };
                        setTaskEvalThresholds(next);
                        setTaskEvalErrors(validateTaskEvalThresholds(next));
                      }}
                      className="rounded-xl"
                    />
                    {taskEvalErrors.soil_moisture_min && (
                      <p className="text-xs text-[#DC2626]">{taskEvalErrors.soil_moisture_min}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taskMoistureMax">Maximum (%)</Label>
                    <Input
                      id="taskMoistureMax"
                      type="number"
                      value={taskEvalThresholds.soil_moisture_max}
                      onChange={(e) => {
                        const next = {
                          ...taskEvalThresholds,
                          soil_moisture_max: Number(e.target.value),
                        };
                        setTaskEvalThresholds(next);
                        setTaskEvalErrors(validateTaskEvalThresholds(next));
                      }}
                      className="rounded-xl"
                    />
                    {taskEvalErrors.soil_moisture_max && (
                      <p className="text-xs text-[#DC2626]">{taskEvalErrors.soil_moisture_max}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-5 bg-[#F9FAFB] rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-[#DC2626] rounded-lg flex items-center justify-center text-white">
                    <Thermometer size={16} />
                  </div>
                  <div>
                    <h4 className="text-[#111827]">Temperature</h4>
                    <p className="text-xs text-[#6B7280]">Used to delay tasks during heat or cold stress</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="taskTempMin">Minimum (AøC)</Label>
                    <Input
                      id="taskTempMin"
                      type="number"
                      value={taskEvalThresholds.temperature_min}
                      onChange={(e) => {
                        const next = {
                          ...taskEvalThresholds,
                          temperature_min: Number(e.target.value),
                        };
                        setTaskEvalThresholds(next);
                        setTaskEvalErrors(validateTaskEvalThresholds(next));
                      }}
                      className="rounded-xl"
                    />
                    {taskEvalErrors.temperature_min && (
                      <p className="text-xs text-[#DC2626]">{taskEvalErrors.temperature_min}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taskTempMax">Maximum (AøC)</Label>
                    <Input
                      id="taskTempMax"
                      type="number"
                      value={taskEvalThresholds.temperature_max}
                      onChange={(e) => {
                        const next = {
                          ...taskEvalThresholds,
                          temperature_max: Number(e.target.value),
                        };
                        setTaskEvalThresholds(next);
                        setTaskEvalErrors(validateTaskEvalThresholds(next));
                      }}
                      className="rounded-xl"
                    />
                    {taskEvalErrors.temperature_max && (
                      <p className="text-xs text-[#DC2626]">{taskEvalErrors.temperature_max}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-5 bg-[#F9FAFB] rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-[#0EA5E9] rounded-lg flex items-center justify-center text-white">
                    <CloudRain size={16} />
                  </div>
                  <div>
                    <h4 className="text-[#111827]">Rain Thresholds</h4>
                    <p className="text-xs text-[#6B7280]">Used to delay field tasks during rain events</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rainMin">Rain Threshold (mm)</Label>
                    <Input
                      id="rainMin"
                      type="number"
                      value={taskEvalThresholds.rain_mm_min}
                      onChange={(e) => {
                        const next = {
                          ...taskEvalThresholds,
                          rain_mm_min: Number(e.target.value),
                        };
                        setTaskEvalThresholds(next);
                        setTaskEvalErrors(validateTaskEvalThresholds(next));
                      }}
                      className="rounded-xl"
                    />
                    {taskEvalErrors.rain_mm_min && (
                      <p className="text-xs text-[#DC2626]">{taskEvalErrors.rain_mm_min}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rainHeavy">Heavy Rain Threshold (mm)</Label>
                    <Input
                      id="rainHeavy"
                      type="number"
                      value={taskEvalThresholds.rain_mm_heavy}
                      onChange={(e) => {
                        const next = {
                          ...taskEvalThresholds,
                          rain_mm_heavy: Number(e.target.value),
                        };
                        setTaskEvalThresholds(next);
                        setTaskEvalErrors(validateTaskEvalThresholds(next));
                      }}
                      className="rounded-xl"
                    />
                    {taskEvalErrors.rain_mm_heavy && (
                      <p className="text-xs text-[#DC2626]">{taskEvalErrors.rain_mm_heavy}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-5 bg-[#F9FAFB] rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-[#6366F1] rounded-lg flex items-center justify-center text-white">
                    <Waves size={16} />
                  </div>
                  <div>
                    <h4 className="text-[#111827]">Waterlogging Duration</h4>
                    <p className="text-xs text-[#6B7280]">Hours of wet soil before tasks are postponed</p>
                  </div>
                </div>
                <div className="space-y-2 max-w-[240px]">
                  <Label htmlFor="waterloggingHours">Waterlogging duration (hours)</Label>
                  <Input
                    id="waterloggingHours"
                    type="number"
                    value={taskEvalThresholds.waterlogging_hours}
                    onChange={(e) => {
                      const next = {
                        ...taskEvalThresholds,
                        waterlogging_hours: Number(e.target.value),
                      };
                      setTaskEvalThresholds(next);
                      setTaskEvalErrors(validateTaskEvalThresholds(next));
                    }}
                    className="rounded-xl"
                  />
                  {taskEvalErrors.waterlogging_hours && (
                    <p className="text-xs text-[#DC2626]">{taskEvalErrors.waterlogging_hours}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                className="flex-1 bg-[#16A34A] hover:bg-[#16A34A] rounded-xl gap-2"
                onClick={handleSaveTaskEvalThresholds}
                disabled={loading || savingTaskEval}
              >
                <Save size={16} />
                {savingTaskEval ? 'Saving...' : 'Save Thresholds'}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="mt-6 space-y-6">
          <Card className="p-6 rounded-2xl bg-white">
            <h3 className="text-[#111827] mb-1">System Information</h3>
            <p className="text-sm text-[#6B7280] mb-6">Application and data management</p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-xl">
                <div>
                  <p className="text-sm text-[#111827]">Application Version</p>
                  <p className="text-xs text-[#6B7280]">PineTrack AgroPlanner</p>
                </div>
                <span className="text-sm text-[#6B7280]">v2.1.0</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-xl">
                <div>
                  <p className="text-sm text-[#111827]">Last Backup</p>
                  <p className="text-xs text-[#6B7280]">Automatic daily backups</p>
                </div>
                <span className="text-sm text-[#6B7280]">Nov 5, 2025 02:00 AM</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-xl">
                <div>
                  <p className="text-sm text-[#111827]">Data Storage</p>
                  <p className="text-xs text-[#6B7280]">Local and cloud sync</p>
                </div>
                <span className="text-sm text-[#6B7280]">2.4 GB / 10 GB</span>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => toast.info('Backup initiated')}>
                Backup Data
              </Button>
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => toast.info('Export initiated')}>
                Export Reports
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
