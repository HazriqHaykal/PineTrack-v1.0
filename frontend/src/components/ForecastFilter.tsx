
interface ForecastFilterProps {
  selected: '1W';
  onChange: (value: '1W') => void;
}

export function ForecastFilter({ selected: _selected, onChange }: ForecastFilterProps) {
  const options: Array<{ value: '1W'; label: string }> = [
    { value: '1W', label: '1 Week' }
  ];

  return (
    <div className="flex items-center gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-4 py-1.5 rounded-lg border text-[14px] transition-all bg-[#DCFCE7] border-[#16A34A] text-[#15803D] cursor-default`}
          aria-label={`Select ${option.label} forecast`}
          aria-pressed={true}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}