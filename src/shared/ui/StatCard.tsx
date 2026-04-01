import { cn } from '../lib/cn';

interface Props {
  label: string;
  value: string;
  color?: string;
  className?: string;
}

export function StatCard({ label, value, color = 'text-gray-400', className }: Props) {
  return (
    <div className={cn('border border-[--border-color] bg-white rounded p-3', className)}>
      <p className="text-[9px] font-mono text-gray-500 mb-1 uppercase tracking-wider">{label}</p>
      <p className={cn('text-lg font-bold font-mono', color)}>{value}</p>
    </div>
  );
}
