import { cn } from '../lib/cn';

interface Props {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function Toggle({ label, checked, onChange, className }: Props) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'w-full px-3 py-2 rounded border text-[9px] font-mono transition-colors flex items-center justify-between',
        checked
          ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold'
          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
        className,
      )}
    >
      <span className="uppercase tracking-wider">{label}</span>
      <div className={cn('w-8 h-4 rounded-full relative transition-colors', checked ? 'bg-blue-600' : 'bg-gray-300')}>
        <div className={cn('absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </div>
    </button>
  );
}
