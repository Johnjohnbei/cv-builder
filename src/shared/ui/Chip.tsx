import { cn } from '../lib/cn';

interface Props {
  value: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}

/** Small selectable chip — used for template options, weight pickers, etc. */
export function Chip({ value, selected, onClick, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-2 py-1 rounded border text-[9px] font-mono transition-colors capitalize',
        selected
          ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold'
          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
        className,
      )}
    >
      {value}
    </button>
  );
}
