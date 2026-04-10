interface Props {
  actualPageCount: number;
  hasCvData: boolean;
}

export function OverflowIndicator({ actualPageCount, hasCvData }: Props) {
  if (!hasCvData) return null;

  return (
    <div className="px-3 py-1.5 rounded-lg text-[9px] stitch-mono font-bold uppercase tracking-wider border bg-blue-50 border-blue-200 text-blue-600">
      CV sur {actualPageCount} page{actualPageCount > 1 ? 's' : ''}
      {actualPageCount > 2 && (
        <span className="text-amber-600 font-normal normal-case ml-1">— les recruteurs preferent 1-2 pages</span>
      )}
    </div>
  );
}
