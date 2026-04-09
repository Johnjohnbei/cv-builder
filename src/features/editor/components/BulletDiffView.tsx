// ─── BulletDiffView ───
// Inline diff component showing before/after bullet text with Accept/Reject actions.

interface BulletDiffViewProps {
  original: string;
  rewritten: string;
  onAccept: () => void;
  onReject: () => void;
}

export function BulletDiffView({ original, rewritten, onAccept, onReject }: BulletDiffViewProps) {
  return (
    <div className="p-2 bg-amber-50 border border-amber-200 rounded mt-1 space-y-1">
      <p className="text-xs text-red-600 line-through">{original}</p>
      <p className="text-xs text-green-700 font-medium">{rewritten}</p>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onAccept}
          className="text-[9px] font-mono px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
        >
          Accepter
        </button>
        <button
          onClick={onReject}
          className="text-[9px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          Rejeter
        </button>
      </div>
    </div>
  );
}
