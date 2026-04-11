import type { DistributionProposal } from '../hooks/useKeywordDistribution';

interface Props {
  proposals: DistributionProposal[];
  onAcceptOne: (keyword: string) => void;
  onRejectOne: (keyword: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

/**
 * Review panel for AI-generated keyword distribution proposals.
 * Each proposal is an amber card with before/after bullet diff + Accept/Reject.
 * A header row exposes bulk Accept-all / Reject-all actions.
 *
 * ARIA: wrapped in role=region + aria-live=polite so AT users are notified
 * when the AI returns new proposals.
 */
export function DistributionProposalsPanel({
  proposals,
  onAcceptOne,
  onRejectOne,
  onAcceptAll,
  onRejectAll,
}: Props) {
  if (proposals.length === 0) return null;

  return (
    <section
      role="region"
      aria-label="Propositions d'intégration automatique"
      aria-live="polite"
      className="flex flex-col gap-2 mt-3 border-t border-gray-200 pt-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-wider text-gray-500">
          Propositions ({proposals.length})
        </span>
        <div className="flex gap-1">
          <button
            onClick={onAcceptAll}
            className="text-[9px] font-mono px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
            aria-label="Accepter toutes les propositions"
          >
            Tout accepter
          </button>
          <button
            onClick={onRejectAll}
            className="text-[9px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
            aria-label="Rejeter toutes les propositions"
          >
            Tout rejeter
          </button>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {proposals.map((p) => (
          <ProposalCard
            key={p.keyword}
            proposal={p}
            onAccept={() => onAcceptOne(p.keyword)}
            onReject={() => onRejectOne(p.keyword)}
          />
        ))}
      </ul>
    </section>
  );
}

// ─── Internal card component ───

interface CardProps {
  proposal: DistributionProposal;
  onAccept: () => void;
  onReject: () => void;
}

function ProposalCard({ proposal: p, onAccept, onReject }: CardProps) {
  const canAccept = p.expIndex !== null && p.bulletIndex !== null;
  return (
    <li className="p-2 bg-amber-50 border border-amber-200 rounded space-y-1">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-semibold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">
          {p.keyword}
        </span>
        <span
          className="text-[9px] text-gray-500 truncate max-w-[160px]"
          title={p.expLabel}
        >
          → {p.expLabel}
        </span>
      </div>
      {p.originalBullet && (
        <p className="text-[10px] text-red-600 line-through">{p.originalBullet}</p>
      )}
      {p.rewrittenBullet && (
        <p className="text-[10px] text-green-700 font-medium">{p.rewrittenBullet}</p>
      )}
      {p.reason && <p className="text-[9px] text-gray-500 italic">{p.reason}</p>}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onAccept}
          disabled={!canAccept}
          className="text-[9px] font-mono px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
          aria-label={`Accepter l'intégration de ${p.keyword}`}
        >
          Accepter
        </button>
        <button
          onClick={onReject}
          className="text-[9px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          aria-label={`Rejeter l'intégration de ${p.keyword}`}
        >
          Rejeter
        </button>
      </div>
    </li>
  );
}
