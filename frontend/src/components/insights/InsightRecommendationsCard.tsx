import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock } from "lucide-react";

export type InsightSuggestion = {
  type: string;
  task_name: string;
  task_id?: string;
  original_date: string;
  suggested_date: string;
  reason: string;
};

type InsightRecommendationsCardProps = {
  suggestions: InsightSuggestion[];
  variant: "dashboard" | "analytics";
  onSuggestionClick?: (suggestion: InsightSuggestion) => void;
  onViewAll?: () => void;
};

function getSuggestionIcon(type: string) {
  const iconClass = "w-4 h-4";
  switch (type) {
    case "DELAY":
      return <Clock className={iconClass} />;
    case "TIME_SHIFT":
      return <ArrowRight className={iconClass} />;
    case "TRIGGER":
      return <AlertTriangle className={iconClass} />;
    case "PRIORITY":
      return <CheckCircle2 className={iconClass} />;
    default:
      return null;
  }
}

function cleanTaskName(name: string) {
  return name.replace(/\s*\(ID:.*?\)\s*$/i, "").trim();
}

function isImportantAlert(taskName: string): boolean {
  const importantKeywords = [
    'Waterlogging Risk',
    'Irrigation Needed',
    'Heat Stress Alert',
    'Growth Retardation',
    'Heavy Rain Alert',
    'Rain Warning',
    'Sensor Alert'
  ];
  return importantKeywords.some(keyword => taskName.includes(keyword));
}

function getRecommendationStyle(taskName: string) {
  if (isImportantAlert(taskName)) {
    return {
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      textColor: 'text-orange-900',
      iconColor: 'text-orange-600'
    };
  }
  return {
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-900',
    iconColor: 'text-green-600'
  };
}

export function InsightRecommendationsCard({
  suggestions,
  variant,
  onSuggestionClick,
  onViewAll,
}: InsightRecommendationsCardProps) {
  const isDashboard = variant === "dashboard";
  
  // Sort suggestions: important alerts first, then normal ones
  const sortedSuggestions = [...suggestions].sort((a, b) => {
    const aImportant = isImportantAlert(a.task_name);
    const bImportant = isImportantAlert(b.task_name);
    if (aImportant && !bImportant) return -1;
    if (!aImportant && bImportant) return 1;
    return 0;
  });
  
  const visibleSuggestions = isDashboard ? sortedSuggestions.slice(0, 3) : sortedSuggestions;
  const isInteractive = Boolean(onSuggestionClick);

  return (
    <Card className="p-6 rounded-2xl bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[18px] font-semibold text-gray-900">Insight Recommendation</h3>
      </div>
      <div className="space-y-3">
        {visibleSuggestions.length > 0 ? (
          visibleSuggestions.map((sugg, idx) => {
            const icon = getSuggestionIcon(sugg.type);
            const title = cleanTaskName(sugg.task_name);
            const style = getRecommendationStyle(sugg.task_name);
            return (
              <div
                key={idx}
                className={`${style.bgColor} rounded-xl p-4 shadow-sm border ${style.borderColor}${isInteractive ? " cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
                onClick={() => onSuggestionClick?.(sugg)}
              >
                <div className="flex items-center gap-2 mb-1">
                  {icon ? (
                    <span className={`inline-flex items-center justify-center ${style.iconColor}`}>
                      {icon}
                    </span>
                  ) : null}
                  <p className={`text-[16px] font-medium ${style.textColor}`}>{title}</p>
                </div>
                <p className={`text-[14px] ${style.textColor} leading-relaxed opacity-80`}>
                  {sugg.reason}
                </p>
              </div>
            );
          })
        ) : (
          <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-200">
            <p className="text-gray-700">No Actionable Insight Required</p>
            <p className="text-sm text-gray-500 mt-1">All tasks are safe to proceed.</p>
          </div>
        )}
      </div>

      {isDashboard && suggestions.length > 3 && onViewAll && (
        <div className="mt-3 text-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-700 hover:bg-gray-100 h-8 text-xs w-full"
            onClick={onViewAll}
          >
            View all ({suggestions.length})
          </Button>
        </div>
      )}
    </Card>
  );
}
