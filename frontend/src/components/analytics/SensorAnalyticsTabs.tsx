import React, { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { ForecastFilter } from '../ForecastFilter';

export type ForecastRange = '1W';

export interface AnalyticsData {
  date: string;
  temperature_raw: number;
  temperature_clean: number;
  moisture_raw: number;
  moisture_clean: number;
  nitrogen_raw: number;
  nitrogen_clean: number;
  [key: string]: unknown;
}

export interface WeatherAnalyticsItem {
  date: string;
  time?: string;
  type?: string;
  rain?: number;
  [key: string]: unknown;
}

type SensorAnalyticsTabsProps = {
  historicalData: AnalyticsData[];
  forecastData: unknown[];
  weatherData: WeatherAnalyticsItem[];
  forecastRange: ForecastRange;
  onForecastRangeChange: (value: ForecastRange) => void;
};

export function SensorAnalyticsTabs({
  historicalData,
  forecastData,
  weatherData,
  forecastRange,
  onForecastRangeChange
}: SensorAnalyticsTabsProps) {
  // Format date for x-axis
  const formatXAxis = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    // Jan 12 (5PM)
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' }).replace(',', ' (').replace(/ AM| PM/, '') + (date.getHours() >= 12 ? 'PM)' : 'AM)');
  };

  const formatDailyAxis = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  };

  // Split and aggregate weather data for Historical (Daily Sum)
  const weatherHistorical = useMemo(() => {
    const rawData = weatherData.filter(d => d.type === 'Historical');

    // Aggregate by day
    const dailyMap = new Map<string, number>();

    rawData.forEach(item => {
      // Assuming item.time is ISO string like "2025-01-17T00:00"
      // Take first 10 chars (YYYY-MM-DD)
      const dateStr = String(item.time).substring(0, 10);
      const rain = item.rain || 0;

      if (dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, dailyMap.get(dateStr)! + rain);
      } else {
        dailyMap.set(dateStr, rain);
      }
    });

    // Convert back to array
    const aggregated = Array.from(dailyMap.entries()).map(([date, rain]) => ({
      time: date,
      rain: rain
    })).sort((a, b) => a.time.localeCompare(b.time));

    console.log("Historical Weather (Daily):", aggregated);
    return aggregated;
  }, [weatherData]);

  const weatherForecast = useMemo(() => {
    const data = weatherData.filter(d => d.type === 'Forecast');
    console.log("Forecast Weather:", data);
    return data;
  }, [weatherData]);

  return (
    <Tabs defaultValue="moisture" className="w-full">
      <TabsList
        className="
    grid w-full grid-cols-4 gap-2
    bg-transparent rounded-2xl mb-6
  "
      >
        <TabsTrigger
          value="moisture"
          className="
      rounded-xl px-3 py-2 text-sm
      text-[#6B7280]
      hover:bg-[#F3FFF7]
      data-[state=active]:bg-[#DCFCE7]
      data-[state=active]:text-[#15803D]
      data-[state=active]:shadow-sm
      transition-colors
    "
        >
          Moisture
        </TabsTrigger>

        <TabsTrigger
          value="nitrogen"
          className="
      rounded-xl px-3 py-2 text-sm
      text-[#6B7280]
      hover:bg-[#F3FFF7]
      data-[state=active]:bg-[#DCFCE7]
      data-[state=active]:text-[#15803D]
      data-[state=active]:shadow-sm
      transition-colors
    "
        >
          Nitrogen
        </TabsTrigger>

        <TabsTrigger
          value="temp"
          className="
      rounded-xl px-3 py-2 text-sm
      text-[#6B7280]
      hover:bg-[#F3FFF7]
      data-[state=active]:bg-[#DCFCE7]
      data-[state=active]:text-[#15803D]
      data-[state=active]:shadow-sm
      transition-colors
    "
        >
          Temperature
        </TabsTrigger>

        <TabsTrigger
          value="weather"
          className="
      rounded-xl px-3 py-2 text-sm
      text-[#6B7280]
      hover:bg-[#F3FFF7]
      data-[state=active]:bg-[#DCFCE7]
      data-[state=active]:text-[#15803D]
      data-[state=active]:shadow-sm
      transition-colors
    "
        >
          Weather
        </TabsTrigger>
      </TabsList>

      <TabsContent value="moisture" className="mt-0">
        <h3 className="text-[20px] text-[#111827] mb-6">Soil Moisture Analysis</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Historical Data Chart */}
          <div className="bg-[#F9FAFB] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col">
            <div className="h-[60px] flex items-start mb-4">
              <h4 className="text-[18px] text-[#111827]">Historical Data (Last 20 Days)</h4>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={historicalData}>
                <defs>
                  <linearGradient id="moistureCleanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={formatXAxis}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#6B7280"
                  fontSize={12}
                  label={{ value: '%', angle: -90, position: 'insideLeft', style: { fontSize: 14, fill: '#6B7280' } }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: 14 }}
                  labelStyle={{ color: '#111827' }}
                  labelFormatter={formatXAxis}
                />
                <Legend verticalAlign="top" height={36} />
                {/* Render Cleaned Data FIRST (Background Area) */}
                <Area
                  type="monotone"
                  dataKey="moisture_clean"
                  stroke="#16A34A"
                  fill="url(#moistureCleanGradient)"
                  strokeWidth={2}
                  name="Cleaned Data"
                />
                {/* Render Raw Data SECOND (Foreground Line) - Red for visibility */}
                <Area
                  type="monotone"
                  dataKey="moisture_raw"
                  stroke="#DC2626"
                  fill="none"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  name="Raw Reading"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Forecast Data Chart */}
          <div className="bg-[#F9FAFB] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col">
            <div className="h-[60px] flex flex-col mb-4">
              <h4 className="text-[18px] text-[#111827] mb-2">Forecast Data (Next 7 Days)</h4>
              <ForecastFilter selected={forecastRange} onChange={onForecastRangeChange} />
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={forecastData} key={forecastRange}>
                <defs>
                  <linearGradient id="moistureForeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#86EFAC" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#86EFAC" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={formatXAxis}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#6B7280"
                  fontSize={12}
                  label={{ value: '%', angle: -90, position: 'insideLeft', style: { fontSize: 14, fill: '#6B7280' } }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: 14 }}
                  labelStyle={{ color: '#111827' }}
                  labelFormatter={formatXAxis}
                />
                <Area
                  type="monotone"
                  dataKey="soil_moisture"
                  stroke="#86EFAC"
                  fill="url(#moistureForeGradient)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Moisture (%)"
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-2 mt-3 text-[14px] text-[#6B7280]">
              <div className="w-4 h-0.5 border-t-2 border-dashed border-[#86EFAC]"></div>
              <span>Forecast (dashed)</span>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="nitrogen" className="mt-0">
        <h3 className="text-[20px] text-[#111827] mb-6">Nitrogen Content Analysis</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Historical Data Chart */}
          <div className="bg-[#F9FAFB] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col">
            <div className="h-[60px] flex items-start mb-4">
              <h4 className="text-[18px] text-[#111827]">Historical Data (Last 20 Days)</h4>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={historicalData}>
                <defs>
                  <linearGradient id="nitrogenCleanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={formatXAxis}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#6B7280"
                  fontSize={12}
                  label={{ value: 'mg/kg', angle: -90, position: 'insideLeft', style: { fontSize: 14, fill: '#6B7280' } }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: 14 }}
                  labelFormatter={formatXAxis}
                  labelStyle={{ color: '#111827' }}
                />
                <Legend verticalAlign="top" height={36} />
                {/* Render Cleaned Data FIRST (Background Area) */}
                <Area
                  type="monotone"
                  dataKey="nitrogen_clean"
                  stroke="#16A34A"
                  fill="url(#nitrogenCleanGradient)"
                  strokeWidth={2}
                  name="Cleaned Data"
                />
                {/* Render Raw Data SECOND (Foreground Line) - Red for visibility */}
                <Area
                  type="monotone"
                  dataKey="nitrogen_raw"
                  stroke="#DC2626"
                  fill="none"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  name="Raw Reading"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Forecast Data Chart */}
          <div className="bg-[#F9FAFB] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col">
            <div className="h-[60px] flex flex-col mb-4">
              <h4 className="text-[18px] text-[#111827] mb-2">Forecast Data (Next 7 Days)</h4>
              <ForecastFilter selected={forecastRange} onChange={onForecastRangeChange} />
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={forecastData} key={forecastRange}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={formatXAxis}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#6B7280"
                  fontSize={12}
                  label={{ value: 'mg/kg', angle: -90, position: 'insideLeft', style: { fontSize: 14, fill: '#6B7280' } }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: 14 }}
                  labelFormatter={formatXAxis}
                  labelStyle={{ color: '#111827' }}
                />
                <Bar
                  dataKey="nitrogen"
                  fill="#86EFAC"
                  radius={[8, 8, 0, 0]}
                  name="Nitrogen (mg/kg)"
                />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-2 mt-3 text-[14px] text-[#6B7280]">
              <div className="w-4 h-3 bg-[#86EFAC] rounded-t"></div>
              <span>Forecast (lighter tone)</span>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="temp" className="mt-0">
        <h3 className="text-[20px] text-[#111827] mb-6">Temperature Analysis</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Historical Data Chart */}
          <div className="bg-[#F9FAFB] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col">
            <div className="h-[60px] flex items-start mb-4">
              <h4 className="text-[18px] text-[#111827]">Historical Data (Last 20 Days)</h4>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={historicalData}>
                <defs>
                  <linearGradient id="tempCleanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={formatXAxis}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#6B7280"
                  fontSize={12}
                  label={{ value: 'AøC', angle: -90, position: 'insideLeft', style: { fontSize: 14, fill: '#6B7280' } }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: 14 }}
                  labelFormatter={formatXAxis}
                  labelStyle={{ color: '#111827' }}
                />
                <Legend verticalAlign="top" height={36} />
                {/* Render Cleaned Data FIRST (Background Area) */}
                <Area
                  type="monotone"
                  dataKey="temperature_clean"
                  stroke="#16A34A"
                  fill="url(#tempCleanGradient)"
                  strokeWidth={2}
                  name="Cleaned Data"
                />
                {/* Render Raw Data SECOND (Foreground Line) - Red for visibility */}
                <Area
                  type="monotone"
                  dataKey="temperature_raw"
                  stroke="#DC2626"
                  fill="none"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  name="Raw Reading"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Forecast Data Chart */}
          <div className="bg-[#F9FAFB] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col">
            <div className="h-[60px] flex flex-col mb-4">
              <h4 className="text-[18px] text-[#111827] mb-2">Forecast Data (Next 7 Days)</h4>
              <ForecastFilter selected={forecastRange} onChange={onForecastRangeChange} />
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={forecastData} key={forecastRange}>
                <defs>
                  <linearGradient id="tempForeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#86EFAC" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#86EFAC" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={formatXAxis}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#6B7280"
                  fontSize={12}
                  label={{ value: 'AøC', angle: -90, position: 'insideLeft', style: { fontSize: 14, fill: '#6B7280' } }}
                />
                <Tooltip
                  labelFormatter={formatXAxis}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: 14 }}
                  labelStyle={{ color: '#111827' }}
                />
                <Area
                  type="monotone"
                  dataKey="temperature"
                  stroke="#86EFAC"
                  fill="url(#tempForeGradient)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Temperature (AøC)"
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-2 mt-3 text-[14px] text-[#6B7280]">
              <div className="w-4 h-0.5 border-t-2 border-dashed border-[#86EFAC]"></div>
              <span>Forecast (dashed)</span>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="weather" className="mt-0">
        <h3 className="text-[20px] text-[#111827] mb-6">Local Weather Conditions (Open-Meteo)</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Historical Weather Chart */}
          <div className="bg-[#F9FAFB] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col">
            <div className="h-[60px] flex items-start mb-4">
              <h4 className="text-[18px] text-[#111827]">Historical Rainfall (Daily Sum - Last 20 Days)</h4>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={weatherHistorical}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="time"
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={formatDailyAxis}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#6B7280"
                  fontSize={12}
                  label={{ value: 'mm', angle: -90, position: 'insideLeft', style: { fontSize: 14, fill: '#6B7280' } }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: 14 }}
                  labelStyle={{ color: '#111827' }}
                  formatter={(value: unknown) => [`${Number(value).toFixed(1)} mm`, 'Rain']}
                  labelFormatter={formatDailyAxis}
                />
                <Legend verticalAlign="top" height={36} />
                <Bar
                  dataKey="rain"
                  fill="#3B82F6"
                  radius={[4, 4, 0, 0]}
                  name="Rain (mm)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Forecast Weather Chart */}
          <div className="bg-[#F9FAFB] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col">
            <div className="h-[60px] flex flex-col mb-4">
              <h4 className="text-[18px] text-[#111827] mb-2">Rainfall Forecast (Next 7 Days)</h4>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={weatherForecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="time"
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={formatXAxis}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#6B7280"
                  fontSize={12}
                  domain={[0, 16]}
                  label={{ value: 'mm', angle: -90, position: 'insideLeft', style: { fontSize: 14, fill: '#6B7280' } }}
                />
                <Tooltip
                  labelFormatter={formatXAxis}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: 14 }}
                  labelStyle={{ color: '#111827' }}
                />
                <Legend verticalAlign="top" height={36} />
                <Bar
                  dataKey="rain"
                  fill="#93C5FD"
                  radius={[4, 4, 0, 0]}
                  name="Rain (mm)"
                />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-2 mt-3 text-[14px] text-[#6B7280]">
              {/* Legend description if needed, logic for 'Forecast (dashed)' removed as bar chart doesn't use dashes */}
              <div className="w-4 h-4 bg-[#93C5FD] rounded-sm"></div>
              <span>Forecast</span>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
