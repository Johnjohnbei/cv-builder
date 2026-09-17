import type { DropzoneState } from 'react-dropzone';
import { Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/src/shared/lib/cn';
import { Button } from '@/src/shared/ui/Button';
import { Input } from '@/src/shared/ui/Input';

interface Props {
  jobUrl: string;
  onJobUrlChange: (url: string) => void;
  onUrlCrawl: () => void;
  isCrawling: boolean;
  jobDropzone: Pick<DropzoneState, 'getRootProps' | 'getInputProps' | 'isDragActive'>;
  isExtractingJob: boolean;
  jobDescription: string;
  onJobDescriptionChange: (text: string) => void;
  hasBaseCV: boolean;
  onOptimize: () => void;
  /** What the tailoring is doing, null when it is not running */
  busyLabel: string | null;
  /** The offer is being read or written for: changing it now would mix two offers */
  offerLocked: boolean;
  /** Rough duration of the tailoring, from the CV size */
  estimateSeconds: number;
}

/** Step 2 of the dashboard: the offer, and the button that tailors the CV to it. Extracted from DashboardPage, over its size limit. */
export function JobOfferPanel({
  jobUrl, onJobUrlChange, onUrlCrawl, isCrawling, jobDropzone, isExtractingJob,
  jobDescription, onJobDescriptionChange, hasBaseCV, onOptimize, busyLabel, offerLocked, estimateSeconds,
}: Props) {
  const { getRootProps, getInputProps, isDragActive } = jobDropzone;
  return (
    <section className="stitch-panel">
      <div className="stitch-panel-header">2. L'offre d'emploi</div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <form
              className="flex space-x-2 items-end"
              onSubmit={(e) => { e.preventDefault(); onUrlCrawl(); }}
            >
              <Input
                id="job-url"
                label="Depuis une URL"
                type="url"
                inputSize="sm"
                containerClassName="flex-1"
                value={jobUrl}
                onChange={(e) => onJobUrlChange(e.target.value)}
                placeholder="https://linkedin.com/jobs/..."
              />
              <Button type="submit" variant="secondary" size="sm" loading={isCrawling} disabled={!jobUrl || offerLocked}>
                Importer
              </Button>
            </form>
            <p className="text-[11px] text-gray-600 italic">Note : Certains sites (LinkedIn, Indeed) bloquent l'accès direct. Copiez-collez le texte si besoin.</p>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] text-gray-600 uppercase block mb-2">Depuis un PDF</label>
            <div
              {...(offerLocked ? { 'aria-disabled': true } : getRootProps())}
              className={cn(
                "border border-dashed border-[#DADCE0] rounded p-2 text-center h-[34px] flex items-center justify-center",
                offerLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50 transition-colors",
                isDragActive && "bg-blue-50 border-blue-400"
              )}
            >
              <input {...getInputProps()} />
              {isExtractingJob ? (
                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
              ) : (
                <span className="text-[11px] font-medium text-gray-500">Déposer le PDF de l'offre</span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="job-description" className="text-[11px] text-gray-600 uppercase block mb-2">Ou collez le texte de l'offre</label>
          <textarea
            id="job-description"
            value={jobDescription}
            onChange={(e) => onJobDescriptionChange(e.target.value)}
            readOnly={offerLocked}
            placeholder="Collez l'offre d'emploi ici..."
            className="stitch-input h-48 resize-none stitch-mono text-xs leading-relaxed"
          />
        </div>
        <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-3">
          <div className="flex flex-col items-end gap-1">
            <Button
              mono={false}
              onClick={onOptimize}
              disabled={!hasBaseCV || jobDescription.length < 50 || busyLabel !== null}
              icon={busyLabel !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            >
              {busyLabel ?? 'Optimiser mon CV pour cette offre'}
            </Button>
            {hasBaseCV && busyLabel === null && (
              <span className="text-[11px] text-gray-500 stitch-mono">~{estimateSeconds}s estimé</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
