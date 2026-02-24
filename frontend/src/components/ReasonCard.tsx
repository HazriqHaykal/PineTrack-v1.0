type ReasonParseResult = {
  title: string;
  details: string[];
  outcome: string | null;
  raw: string;
  fallbackSummary: string;
};

type ReasonCardProps = {
  reasonText: string;
  status?: string;
};

const summarizeReason = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 90) return trimmed;
  return `${trimmed.slice(0, 87)}...`;
};

const parseReason = (reasonText: string): ReasonParseResult => {
  const raw = reasonText.trim();
  const fallbackSummary = summarizeReason(raw);
  let title = "Threshold triggered";

  if (/temperature/i.test(raw)) {
    title = "Temperature exceeded limit";
  } else if (/soil moisture/i.test(raw)) {
    title = "Soil moisture out of range";
  } else if (/rain/i.test(raw)) {
    title = "Rain forecast risk";
  }

  const details: string[] = [];
  const tempMatch = raw.match(/Temperature\s+([\d.]+)C/i);
  if (tempMatch?.[1]) details.push(`Temp: ${tempMatch[1]}C`);

  const tempMaxMatch = raw.match(/max\s+([\d.]+)C/i);
  if (tempMatch?.[1] && tempMaxMatch?.[1]) details.push(`Max: ${tempMaxMatch[1]}C`);

  const moistureMatch = raw.match(/Soil moisture\s+([\d.]+)%/i);
  if (moistureMatch?.[1]) details.push(`Moisture: ${moistureMatch[1]}%`);

  const moistureFieldMaxMatch = raw.match(/field max\s+([\d.]+)%/i);
  const moistureMaxMatch = moistureFieldMaxMatch ?? raw.match(/max\s+([\d.]+)%/i);
  if (moistureMatch?.[1] && moistureMaxMatch?.[1]) {
    const label = moistureFieldMaxMatch ? "Field max" : "Max";
    details.push(`${label}: ${moistureMaxMatch[1]}%`);
  }

  const profileMatch = raw.match(/threshold profile:\s*([^)]+)\)/i);
  if (profileMatch?.[1]) details.push(`Profile: ${profileMatch[1].trim()}`);

  if (/rain/i.test(raw) && !details.some((d) => d.startsWith("Rain"))) {
    details.push("Rain forecast considered");
  }

  const safeDayMatch = raw.match(/next safe day\s*\((\d{4}-\d{2}-\d{2})\)/i);
  const genericDateMatch = raw.match(/(\d{4}-\d{2}-\d{2})/);
  const offsetMatch = raw.match(/Proposed date\s*\+(\d+)\s*days/i);
  let outcome: string | null = null;

  if (safeDayMatch?.[1]) {
    outcome = `Rescheduled to ${safeDayMatch[1]}`;
  } else if (/rescheduled/i.test(raw) && genericDateMatch?.[1]) {
    outcome = `Rescheduled to ${genericDateMatch[1]}`;
  } else if (offsetMatch?.[1]) {
    outcome = `Proposed date +${offsetMatch[1]} days`;
  }

  return {
    title,
    details,
    outcome,
    raw,
    fallbackSummary,
  };
};

export function ReasonCard({ reasonText, status }: ReasonCardProps) {
  const parsed = parseReason(reasonText ?? "");
  const details = parsed.details.slice(0, 3);
  const title = parsed.title || parsed.fallbackSummary || "Reason";
  const showFallback = details.length === 0 && parsed.fallbackSummary && parsed.fallbackSummary !== title;

  return (
    <div
      className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-2 space-y-1"
      title={parsed.raw}
    >
      <div className="text-[14px] font-semibold text-[#111827] leading-snug">
        {title}
      </div>
      {details.length > 0 && (
        <div className="space-y-0.5">
          {details.map((detail) => (
            <div key={detail} className="text-[12px] text-[#6B7280] leading-snug">
              {detail}
            </div>
          ))}
          {status && (
            <div className="text-[12px] text-[#6B7280] leading-snug">
              Status: {status}
            </div>
          )}
        </div>
      )}
      {showFallback && (
        <div className="text-[12px] text-[#6B7280] leading-snug">
          {parsed.fallbackSummary}
        </div>
      )}
      {parsed.outcome && (
        <div className="inline-flex items-center rounded-full bg-[#DCFCE7] text-[#166534] text-[11px] px-2 py-0.5">
          {parsed.outcome}
        </div>
      )}
    </div>
  );
}
