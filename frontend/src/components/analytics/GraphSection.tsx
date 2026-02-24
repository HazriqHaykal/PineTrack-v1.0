import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Card } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { CloudRain, Droplets, Thermometer } from 'lucide-react';
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
import { getAnalyticsHistory, getAnalyticsForecast, getWeatherAnalytics } from '../../lib/api';

type AnalyticsData = {
  date: string;
  temperature_raw: number;
  temperature_clean: number;
  moisture_raw: number;
  moisture_clean: number;
  [key: string]: unknown;
};

type WeatherAnalyticsItem = {
  date: string;
  time?: string;
  type?: string;
  rain?: number;
  [key: string]: unknown;
};

type GraphSectionProps = {
  plotId?: string | null;
  selectedTab?: 'moisture' | 'temp' | 'weather';
  onTabChange?: (value: 'moisture' | 'temp' | 'weather') => void;
  renderBetween?: ReactNode;
};

export function GraphSection({
  plotId,
  selectedTab,
  onTabChange,
  renderBetween,
}: GraphSectionProps) {
  const [forecastRange, setForecastRange] = useState<'1W'>('1W');
  const [historicalData, setHistoricalData] = useState<AnalyticsData[]>([]);
  const [forecastData, setForecastData] = useState<unknown[]>([]);
  const [weatherData, setWeatherData] = useState<WeatherAnalyticsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const safeFetch = async <T,>(promise: Promise<T>, fallback: T): Promise<T> => {
        try {
          return await promise;
        } catch (e) {
          console.error('Partial fetch error:', e);
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
          [key: string]: unknown;
        }

        const plotFilter = plotId && plotId !== 'all' ? plotId : undefined;
        const history = await safeFetch<RawBackendHistory[]>(
          getAnalyticsHistory(30, plotFilter) as unknown as Promise<RawBackendHistory[]>,
          []
        );
        const processedHistory: AnalyticsData[] = history.map((item) => ({
          ...item,
          date: item.data_added,
          temperature_raw: item.temperature,
          temperature_clean: item.cleaned_temperature,
          moisture_raw: item.soil_moisture,
          moisture_clean: item.cleaned_soil_moisture
        }));
        setHistoricalData(processedHistory);

        const days = 7;
        const forecast = await safeFetch<unknown[]>(
          getAnalyticsForecast(days, plotFilter),
          []
        );
        setForecastData(forecast);

        const weather = await safeFetch<WeatherAnalyticsItem[]>(
          getWeatherAnalytics(plotFilter),
          []
        );
        setWeatherData(weather);
      } catch (err) {
        console.error('Critical error in analytics graphs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [forecastRange, plotId]);

  const todayMoisture = useMemo(() => {
    if (historicalData.length === 0) return 0;
    const latest = historicalData[historicalData.length - 1];
    return Number(latest.moisture_clean) || 0;
  }, [historicalData]);

  const todayTemperature = useMemo(() => {
    if (historicalData.length === 0) return 0;
    const latest = historicalData[historicalData.length - 1];
    return Number(latest.temperature_clean) || 0;
  }, [historicalData]);

  const todayWeatherRain = useMemo(() => {
    if (weatherData.length === 0) return 0;
    const latestDate = weatherData
      .filter(d => d.time || d.date)
      .map(d => String(d.time || d.date).substring(0, 10))
      .sort()
      .reverse()[0];
    if (!latestDate) return 0;
    return weatherData
      .filter(d => String(d.time || d.date).substring(0, 10) === latestDate)
      .reduce((sum, item) => sum + (Number(item.rain) || 0), 0);
  }, [weatherData]);

  const weatherHistorical = useMemo(() => {
    const rawData = weatherData.filter(d => d.type === 'Historical');
    const dailyMap = new Map<string, number>();
    rawData.forEach(item => {
      const dateStr = String(item.time).substring(0, 10);
      const rain = item.rain || 0;
      if (dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, dailyMap.get(dateStr)! + rain);
      } else {
        dailyMap.set(dateStr, rain);
      }
    });
    return Array.from(dailyMap.entries()).map(([date, rain]) => ({
      time: date,
      rain: rain
    })).sort((a, b) => a.time.localeCompare(b.time));
  }, [weatherData]);

  const weatherForecast = useMemo(() => {
    return weatherData.filter(d => d.type === 'Forecast');
  }, [weatherData]);

  const formatXAxis = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' }).replace(',', ' (').replace(/ AM| PM/, '') + (date.getHours() >= 12 ? 'PM)' : 'AM)');
  };

  const formatDailyAxis = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  };

  const renderChartPlaceholder = (message: string) => (
    <div className="h-[320px] flex items-center justify-center text-[14px] text-[#9CA3AF]">
      {message}
    </div>
  );

  const tabProps = selectedTab
    ? { value: selectedTab, onValueChange: onTabChange }
    : { defaultValue: 'moisture' as const };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[14px] text-[#6B7280]">Soil Moisture</p>
            <div className="w-8 h-8 bg-[#16A34A] rounded-lg flex items-center justify-center text-white">
              <Droplets className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[28px] font-semibold text-[#111827] mb-1">
            {todayMoisture.toFixed(1)}%
          </p>
          <p className="text-[12px] text-[#6B7280]">Latest reading</p>
        </Card>

        <Card className="p-5 rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[14px] text-[#6B7280]">Temperature</p>
            <div className="w-8 h-8 bg-[#DC2626] rounded-lg flex items-center justify-center text-white">
              <Thermometer className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[28px] font-semibold text-[#111827] mb-1">
            {todayTemperature.toFixed(1)} C
          </p>
          <p className="text-[12px] text-[#6B7280]">Latest reading</p>
        </Card>

        <Card className="p-5 rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[14px] text-[#6B7280]">Rainfall Today</p>
            <div className="w-8 h-8 bg-[#3B82F6] rounded-lg flex items-center justify-center text-white">
              <CloudRain className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[28px] font-semibold text-[#111827] mb-1">
            {todayWeatherRain.toFixed(1)} mm
          </p>
          <p className="text-[12px] text-[#6B7280]">Total rainfall</p>
        </Card>
      </div>

      {renderBetween}

      <Card className="p-6 rounded-2xl bg-white shadow-sm">
        <Tabs {...tabProps} className="w-full">
          <TabsList
            className="
    grid w-full grid-cols-3 gap-2
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
              <div className="bg-[#F9FAFB] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col">
                <div className="h-[60px] flex items-start mb-4">
                  <h4 className="text-[18px] text-[#111827]">Historical Data (Last 20 Days)</h4>
                </div>
                {loading && renderChartPlaceholder('Loading data...')}
                {!loading && historicalData.length === 0 && renderChartPlaceholder('No data available')}
                {!loading && historicalData.length > 0 && (
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
                      <Area
                        type="monotone"
                        dataKey="moisture_clean"
                        stroke="#16A34A"
                        fill="url(#moistureCleanGradient)"
                        strokeWidth={2}
                        name="Cleaned Data"
                      />
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
                )}
              </div>

              <div className="bg-[#F9FAFB] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col">
                <div className="h-[60px] flex flex-col mb-4">
                  <h4 className="text-[18px] text-[#111827] mb-2">Forecast Data (Next 7 Days)</h4>
                  <ForecastFilter selected={forecastRange} onChange={setForecastRange} />
                </div>
                {loading && renderChartPlaceholder('Loading forecast...')}
                {!loading && forecastData.length === 0 && renderChartPlaceholder('No forecast data')}
                {!loading && forecastData.length > 0 && (
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
                )}
                <div className="flex items-center gap-2 mt-3 text-[14px] text-[#6B7280]">
                  <div className="w-4 h-0.5 border-t-2 border-dashed border-[#86EFAC]"></div>
                  <span>Forecast (dashed)</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="temp" className="mt-0">
            <h3 className="text-[20px] text-[#111827] mb-6">Temperature Analysis</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#F9FAFB] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col">
                <div className="h-[60px] flex items-start mb-4">
                  <h4 className="text-[18px] text-[#111827]">Historical Data (Last 20 Days)</h4>
                </div>
                {loading && renderChartPlaceholder('Loading data...')}
                {!loading && historicalData.length === 0 && renderChartPlaceholder('No data available')}
                {!loading && historicalData.length > 0 && (
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
                        label={{ value: 'C', angle: -90, position: 'insideLeft', style: { fontSize: 14, fill: '#6B7280' } }}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: 14 }}
                        labelFormatter={formatXAxis}
                        labelStyle={{ color: '#111827' }}
                      />
                      <Legend verticalAlign="top" height={36} />
                      <Area
                        type="monotone"
                        dataKey="temperature_clean"
                        stroke="#16A34A"
                        fill="url(#tempCleanGradient)"
                        strokeWidth={2}
                        name="Cleaned Data"
                      />
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
                )}
              </div>

              <div className="bg-[#F9FAFB] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col">
                <div className="h-[60px] flex flex-col mb-4">
                  <h4 className="text-[18px] text-[#111827] mb-2">Forecast Data (Next 7 Days)</h4>
                  <ForecastFilter selected={forecastRange} onChange={setForecastRange} />
                </div>
                {loading && renderChartPlaceholder('Loading forecast...')}
                {!loading && forecastData.length === 0 && renderChartPlaceholder('No forecast data')}
                {!loading && forecastData.length > 0 && (
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
                        label={{ value: 'C', angle: -90, position: 'insideLeft', style: { fontSize: 14, fill: '#6B7280' } }}
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
                        name="Temperature (C)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
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
              <div className="bg-[#F9FAFB] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col">
                <div className="h-[60px] flex items-start mb-4">
                  <h4 className="text-[18px] text-[#111827]">Historical Rainfall (Daily Sum - Last 20 Days)</h4>
                </div>
                {loading && renderChartPlaceholder('Loading data...')}
                {!loading && weatherHistorical.length === 0 && renderChartPlaceholder('No data available')}
                {!loading && weatherHistorical.length > 0 && (
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
                )}
              </div>

              <div className="bg-[#F9FAFB] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col">
                <div className="h-[60px] flex flex-col mb-4">
                  <h4 className="text-[18px] text-[#111827] mb-2">Rainfall Forecast (Next 7 Days)</h4>
                </div>
                {loading && renderChartPlaceholder('Loading forecast...')}
                {!loading && weatherForecast.length === 0 && renderChartPlaceholder('No forecast data')}
                {!loading && weatherForecast.length > 0 && (
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
                )}
                <div className="flex items-center gap-2 mt-3 text-[14px] text-[#6B7280]">
                  <div className="w-4 h-4 bg-[#93C5FD] rounded-sm"></div>
                  <span>Forecast</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
