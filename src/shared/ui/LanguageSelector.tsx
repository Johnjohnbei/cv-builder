import { useId } from 'react';
import { cn } from '../lib/cn';

interface Props {
  value: 'fr' | 'en';
  onChange: (lang: 'fr' | 'en') => void;
  disabled?: boolean;
  /** What is being chosen, printed before the buttons and read as the group's name */
  label?: string;
  /** Id of a text that says more about the choice (where the value comes from) */
  describedBy?: string;
}

const LANGUAGES = [
  { value: 'fr', short: 'FR', name: 'Français' },
  { value: 'en', short: 'EN', name: 'English' },
] as const;

/** FR / EN: the CV's language, in the editor's header and on the dashboard before the generation */
export function LanguageSelector({ value, onChange, disabled, label = 'Lang:', describedBy }: Props) {
  const labelId = useId();
  return (
    <div className="flex items-center gap-2" role="group" aria-labelledby={labelId} aria-describedby={describedBy}>
      <span id={labelId} className="text-[11px] stitch-mono text-gray-600 uppercase">{label}</span>
      <div className="flex items-center gap-1">
        {LANGUAGES.map(({ value: lang, short, name }) => (
          <button
            key={lang}
            type="button"
            onClick={() => onChange(lang)}
            disabled={disabled}
            aria-pressed={value === lang}
            aria-label={name}
            lang={lang}
            className={cn(
              'text-[11px] stitch-mono font-bold px-1.5 py-0.5 rounded transition-colors disabled:opacity-40',
              value === lang
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-600 hover:bg-gray-50'
            )}
          >
            {short}
          </button>
        ))}
      </div>
    </div>
  );
}
