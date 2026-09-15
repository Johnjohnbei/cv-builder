import type { DropzoneState } from 'react-dropzone';
import { Loader2, Plus, Upload } from 'lucide-react';
import { cn } from '@/src/shared/lib/cn';
import { Button } from '@/src/shared/ui/Button';
import type { CVData } from '@/src/shared/types';

interface Props {
  baseCV: CVData | null;
  isUploading: boolean;
  dropzone: Pick<DropzoneState, 'getRootProps' | 'getInputProps' | 'isDragActive'>;
  onStartEmpty: () => void;
  onReplace: () => void;
  /** Length of the offer typed so far: step 2 is done from 50 characters */
  offerLength: number;
  /** A guest without access code is told one will be asked */
  showAccessHint: boolean;
}

/** Step 1 of the dashboard (the CV) and the three-step guide. Extracted from DashboardPage, over its size limit. */
export function CvImportPanel({ baseCV, isUploading, dropzone, onStartEmpty, onReplace, offerLength, showAccessHint }: Props) {
  const { getRootProps, getInputProps, isDragActive } = dropzone;
  return (
    <>
      <section className="stitch-panel">
        <div className="stitch-panel-header">1. Votre CV</div>
        <div className="p-4">
          {!baseCV ? (
            <div className="space-y-3">
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed border-[#DADCE0] rounded p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors",
                  isDragActive && "bg-blue-50 border-blue-400"
                )}
              >
                <input {...getInputProps()} />
                {isUploading ? (
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                ) : (
                  <>
                    <Upload className="w-6 h-6 mx-auto text-gray-600 mb-2" />
                    <p className="text-xs font-medium">Importer un CV (PDF)</p>
                  </>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                icon={<Plus className="w-3 h-3" />}
                className="border-dashed border-blue-300"
                onClick={onStartEmpty}
              >
                Créer un CV vide
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 border border-[#DADCE0] rounded">
                <p className="text-xs font-bold">{baseCV.personal_info.name}</p>
                <p className="text-[11px] text-gray-500">{baseCV.personal_info.title}</p>
              </div>
              <Button variant="ghost" size="xs" mono={false} className="text-blue-600" onClick={onReplace}>
                Remplacer le CV importé
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Parcours en 3 étapes (remplace l'ancien faux terminal SYSTEM_LOGS) */}
      <section className="stitch-panel">
        <div className="stitch-panel-header">Comment ça marche</div>
        <div className="p-4 space-y-3">
          {[
            { n: 1, label: 'Importez votre CV (PDF ou LinkedIn)', done: !!baseCV },
            { n: 2, label: 'Collez l\'offre d\'emploi visée', done: offerLength >= 50 },
            { n: 3, label: 'Lancez l\'optimisation, puis peaufinez dans l\'éditeur', done: false },
          ].map(step => (
            <div key={step.n} className="flex items-center gap-3">
              <span className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                step.done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              )}>
                {step.done ? '✓' : step.n}
              </span>
              <span className={cn("text-[12px]", step.done ? "text-gray-800" : "text-gray-600")}>{step.label}</span>
            </div>
          ))}
          <p className="text-[11px] text-gray-500 pt-1">
            Votre CV sera adapté à l'offre pour passer les ATS, les logiciels qui trient les candidatures avant qu'un recruteur ne les lise.
          </p>
          {showAccessHint && (
            <p className="text-[11px] text-gray-600">
              Bêta privée : un code d'accès vous sera demandé pour les fonctions IA.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
