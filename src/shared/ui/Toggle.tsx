import { cn } from '../lib/cn';

interface Props {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** `emphasis` highlights the row when on; `visibility` strikes the label through when off (hidden section). */
  variant?: 'emphasis' | 'visibility';
  className?: string;
}

const ROW = {
  emphasis: { on: 'bg-blue-50 border-blue-200 text-blue-700 font-bold', off: 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50' },
  visibility: { on: 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50', off: 'bg-gray-100 border-gray-200 text-gray-600 line-through' },
};

export function Toggle({ label, checked, onChange, variant = 'emphasis', className }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'w-full px-3 py-2 rounded border text-[11px] stitch-mono transition-colors flex items-center justify-between',
        checked ? ROW[variant].on : ROW[variant].off,
        className,
      )}
    >
      <span>{label}</span>
      <span aria-hidden className={cn('w-8 h-4 rounded-full relative transition-colors', checked ? 'bg-blue-600' : 'bg-gray-300')}>
        <span className={cn('absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all', checked ? 'left-4.5' : 'left-0.5')} />
      </span>
    </button>
  );
}
