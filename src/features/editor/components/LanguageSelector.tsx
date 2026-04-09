import { cn } from '@/src/shared/lib/cn';

interface Props {
  value: 'fr' | 'en';
  onChange: (lang: 'fr' | 'en') => void;
}

export function LanguageSelector({ value, onChange }: Props) {
  const langs = ['fr', 'en'] as const;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] stitch-mono text-gray-400 uppercase">Lang:</span>
      <div className="flex items-center gap-1">
        {langs.map((lang) => (
          <button
            key={lang}
            onClick={() => onChange(lang)}
            className={cn(
              'text-[10px] stitch-mono font-bold px-1.5 py-0.5 rounded transition-colors',
              value === lang
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
            )}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
