import { Plus, Trash2 } from 'lucide-react';
import { Input } from '../../../../shared/ui/Input';
import type { WeakBulletResult } from '../../lib/weakBulletDetection';
import type { Experience } from '../../../../shared/types';

interface Props {
  exp: Experience;
  idx: number;
  weakBullets: WeakBulletResult[];
  updateExperience: (idx: number, change: (exp: Experience) => Experience) => void;
}

/** The bullets of one experience, or its single summary line in compact mode. Extracted from ExperienceSection, over its size limit. */
export function ExperienceBullets({ exp, idx, weakBullets, updateExperience }: Props) {
  if ((exp.displayMode || 'normal') === 'compact') {
    return (
      <div className="mt-2">
        <Input
          inputSize="xs"
          mono={false}
          className="border-amber-200 focus:border-amber-500"
          value={exp.description?.[0] || ''}
          placeholder="Description synthétique du poste..."
          onChange={(e) => {
            const text = e.target.value;
            updateExperience(idx, x => ({
              ...x,
              description: x.description?.length
                ? x.description.map((b, i) => (i === 0 ? text : b))
                : [text],
            }));
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1 mt-2">
      {exp.description?.map((bullet, bIdx) => {
        const weak = weakBullets.find(w => w.expIndex === idx && w.bulletIndex === bIdx);
        return (
          <div key={bIdx} className="space-y-1">
            <div className="flex items-center gap-1 group/bullet">
              <Input
                inputSize="xs"
                mono={false}
                className="flex-1 focus:border-blue-600"
                value={bullet}
                onChange={(e) => {
                  const text = e.target.value;
                  updateExperience(idx, x => ({
                    ...x,
                    description: x.description.map((b, i) => (i === bIdx ? text : b)),
                  }));
                }}
              />
              {weak && (
                <span
                  className="shrink-0 w-2 h-2 rounded-full bg-orange-400"
                  title={weak.issues.map(i => i.label).join(', ')}
                />
              )}
              <button
                onClick={() => updateExperience(idx, x => ({
                  ...x,
                  description: x.description.filter((_, i) => i !== bIdx),
                }))}
                aria-label="Supprimer ce point"
                className="p-1 text-gray-600 hover:text-red-500 opacity-0 group-hover/bullet:opacity-100 focus-visible:opacity-100 transition-opacity"
              >
                <Trash2 className="w-2 h-2" />
              </button>
            </div>
          </div>
        );
      })}
      <button
        onClick={() => updateExperience(idx, x => ({
          ...x,
          description: [...(x.description || []), 'Nouvelle responsabilité...'],
        }))}
        className="text-[11px] stitch-mono text-blue-600 hover:underline flex items-center gap-1"
      >
        <Plus className="w-2 h-2" /> Ajouter un point
      </button>
    </div>
  );
}
