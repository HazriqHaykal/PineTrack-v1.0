import React from 'react';
import { Card } from './ui/card';
import { Cloud, CloudRain, Sun, CloudSun } from 'lucide-react';

interface WeatherCardProps {
  temperature: number;
  condition: string;
}

export function WeatherCard({ temperature, condition }: WeatherCardProps) {
  const getWeatherIcon = (condition: string) => {
    const iconClass = 'text-white'; // Change to white to stand out on green bg
    switch (condition.toLowerCase()) {
      case 'sunny':
        return <Sun size={64} className={iconClass} />;
      case 'rainy':
        return <CloudRain size={64} className={iconClass} />;
      case 'partly cloudy':
        return <CloudSun size={64} className={iconClass} />;
      case 'cloudy':
        return <Cloud size={64} className={iconClass} />;
      default:
        return <CloudSun size={64} className={iconClass} />;
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-[#15803D] to-[#16A34A] text-white rounded-2xl h-full flex flex-col justify-between">
      <div>
         <p className="text-sm opacity-90 mb-1">Current Weather</p>
         <div className="flex items-center justify-between">
            <h2 className="text-6xl font-bold">{temperature}°C</h2>
            <div className="bg-white/20 rounded-2xl p-4">
              {getWeatherIcon(condition)}
            </div>
         </div>
         <p className="text-xl mt-4 font-medium opacity-90">{condition}</p>
      </div>
      
      {/* Removed Humidity and Wind Speed as requested */}
    </Card>
  );
}
