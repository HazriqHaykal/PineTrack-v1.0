import { CheckCircle2, Clock, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: 'Proceed' | 'Pending' | 'Stop';
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, size: _size = 'md' }: StatusBadgeProps) {
  const config = {
    Proceed: {
      bg: 'bg-[#86EFAC]',
      text: 'text-[#065F46]',
      icon: CheckCircle2,
      label: 'Proceed'
    },
    Pending: {
      bg: 'bg-[#FDE68A]',
      text: 'text-[#92400E]',
      icon: Clock,
      label: 'Pending'
    },
    Stop: {
      bg: 'bg-[#FCA5A5]',
      text: 'text-[#7F1D1D]',
      icon: XCircle,
      label: 'Stop'
    }
  };

  const { bg, text, icon: Icon, label } = config[status];

  // Standardized sizing - all badges same dimensions
  return (
    <div
      className={`${bg} ${text} inline-flex items-center justify-center gap-1.5 rounded-[16px] h-[28px] px-3`}
      style={{ minWidth: '90px' }}
    >
      <Icon size={14} className={text} />
      <span className="text-[14px] font-medium">{label}</span>
    </div>
  );
}
