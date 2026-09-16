import type { ATSReport } from '@/src/shared/types';
import { Button } from '@/src/shared/ui/Button';
import { ScoreGauge } from '@/src/shared/ui/ScoreGauge';

interface Props {
  report: ATSReport;
  onOpenEditor: () => void;
}

/**
 * The end of a tailoring on the dashboard (plan § 5.2): the score and the gaps
 * before the editor opens, so a gap is seen where it is decided.
 */
export function TailorResultPanel({ report, onOpenEditor }: Props) {
  const gaps = report.requirements.filter(c => !c.found);
  return (
    <section className="stitch-panel" aria-labelledby="tailor-result-title">
      <div id="tailor-result-title" className="stitch-panel-header">CV adapté à l'offre</div>
      <div className="p-4 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        {report.score !== null && <ScoreGauge score={report.score} size={120} label="Score ATS" />}
        <div className="flex-1 space-y-3 text-sm">
          <p className="text-gray-700">Part des exigences de l'offre présentes dans votre CV, comme un ATS les recherche.</p>
          {gaps.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-mono text-red-600">Écarts ({gaps.length})</p>
              <ul className="flex flex-wrap gap-1.5">
                {gaps.map(c => (
                  <li key={c.requirement.id} className="text-[11px] px-2 py-0.5 rounded border bg-red-50 text-red-800 border-red-200">{c.requirement.label}</li>
                ))}
              </ul>
              <p className="text-[11px] text-gray-600">Dans l'éditeur, onglet ATS : ajoutez une compétence que votre CV ne mentionne pas, ou écartez celles que vous n'avez pas.</p>
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
