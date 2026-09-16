import type { ATSReport } from '@/src/shared/types';
import { isWritable } from '@/src/features/editor/lib/keywordAnalysis';
import { GAP_TITLE, ScoreSummary, gapsOf } from '@/src/features/editor/components/ATSPanel';
import { Button } from '@/src/shared/ui/Button';

interface Props {
  report: ATSReport;
  onOpenEditor: () => void;
}

/**
 * The end of a tailoring on the dashboard (plan section 5.2): the score and the
 * gaps before the editor opens, so a gap is seen where it is decided. The score
 * and its sentence come from the ATS panel: one owner, one wording.
 */
export function TailorResultPanel({ report, onOpenEditor }: Props) {
  const gaps = gapsOf(report);
  // A degree, a language or years of experience: no rewrite writes those, so the
  // editor offers nothing for them and the hint must not send the user looking
  const writable = gaps.filter(c => isWritable(c.requirement));
  return (
    <section className="stitch-panel" aria-labelledby="tailor-result-title">
      <div id="tailor-result-title" className="stitch-panel-header">CV adapté à l'offre</div>
      <div className="p-4 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        {report.score !== null && (
          <div className="flex flex-col items-center">
            <ScoreSummary score={report.score} />
          </div>
        )}
        <div className="flex-1 space-y-3 text-sm">
          {gaps.length > 0 ? (
            <div className="space-y-1.5">
              <p className={GAP_TITLE}>Écarts ({gaps.length})</p>
              <ul className="flex flex-wrap gap-1.5">
                {gaps.map(c => (
                  <li key={c.requirement.id} className="text-[11px] px-2 py-0.5 rounded border bg-red-50 text-red-800 border-red-200">{c.requirement.label}</li>
                ))}
              </ul>
              <p className="text-[11px] text-gray-600">
                {writable.length > 0
                  ? "Dans l'éditeur, onglet ATS : dites où vous avez mis en œuvre une exigence, ou écartez celles que vous n'avez pas."
                  : "Ces exigences (diplôme, langue, années d'expérience) s'ajoutent dans l'onglet Contenu de l'éditeur."}
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-green-700">Toutes les exigences de l'offre sont dans votre CV.</p>
          )}
          <Button mono={false} onClick={onOpenEditor}>Ouvrir dans l'éditeur</Button>
        </div>
      </div>
    </section>
  );
}
