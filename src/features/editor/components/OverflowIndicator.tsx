import { cn } from '@/src/shared/lib/cn';

interface Props {
  actualPageCount: number;
  /** Page budget the fit pass targets */
  targetPages: number;
  hasCvData: boolean;
  /** A block taller than a page, cut at the page edge in the PDF */
  hasClippedContent?: boolean;
  /** Blank left at the bottom of the last page, in millimetres */
  lastPageFreeMm?: number;
}

/**
 * Blank worth telling about: a third of a page. Below that, the bottom of a
 * page is just where the text stops.
 */
const ROOM_TO_SAY_MM = 90;

export function OverflowIndicator({ actualPageCount, targetPages, hasCvData, hasClippedContent = false, lastPageFreeMm = 0 }: Props) {
  if (!hasCvData) return null;

  const overBudget = actualPageCount > targetPages;
  const roomLeft = !overBudget && lastPageFreeMm >= ROOM_TO_SAY_MM;

  return (
    <div className="space-y-1.5">
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
      {roomLeft && (
        <p className="px-3 py-1.5 rounded-lg text-[11px] border bg-gray-50 border-gray-200 text-gray-600">
          Il reste {Math.round(lastPageFreeMm / 10)} cm en bas de la dernière page : une expérience peut passer en détail.
        </p>
      )}
      {hasClippedContent && (
        <p role="alert" className="px-3 py-1.5 rounded-lg text-[11px] border bg-red-50 border-red-200 text-red-700">
          Un bloc est plus haut qu'une page et sera coupé à l'export : raccourcissez le résumé ou l'expérience concernée.
        </p>
      )}
    </div>
  );
}
