import { cn } from '@/src/shared/lib/cn';

interface Props {
  actualPageCount: number;
  /** Page budget the fit pass targets */
  targetPages: number;
  hasCvData: boolean;
}

export function OverflowIndicator({ actualPageCount, targetPages, hasCvData }: Props) {
  if (!hasCvData) return null;

  const overBudget = actualPageCount > targetPages;

  return (
    <div
      className={cn(
        'px-3 py-1.5 rounded-lg text-[11px] stitch-mono font-bold uppercase tracking-wider border',
        overBudget ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-blue-50 border-blue-200 text-blue-600',
      )}
    >
      CV sur {actualPageCount} page{actualPageCount > 1 ? 's' : ''}
      {overBudget && (
        <span className="font-normal normal-case ml-1">
          : {actualPageCount - targetPages} de plus que votre format
        </span>
      )}
    </div>
  );
}
