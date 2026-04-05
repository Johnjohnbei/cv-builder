interface Props {
  overflowPx: number;
  pageLimit: number;
  userModified: boolean;
  hasCvData: boolean;
}

export function OverflowIndicator({ overflowPx, pageLimit, userModified, hasCvData }: Props) {
  if (!hasCvData) return null;

  if (overflowPx > 0) {
    return (
      <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[9px] stitch-mono text-red-600 space-y-1">
        <p className="font-bold uppercase tracking-wider">
          ⚠ DÉPASSE DE ~{Math.round(overflowPx / 11.23 * 10) / 10}mm
        </p>
        <p className="text-red-500">
          {userModified
            ? "Passez des blocs en compact ou augmentez les pages."
            : "Lancez l'auto-assignation ou augmentez le nombre de pages."}
        </p>
      </div>
    );
  }

  return (
    <div className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-[9px] stitch-mono text-green-600 font-bold uppercase tracking-wider">
      ✓ Contenu tient sur {pageLimit} page(s)
    </div>
  );
}
