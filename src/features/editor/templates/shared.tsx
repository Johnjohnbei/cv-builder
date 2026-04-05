import type { CVData, DesignSettings } from '@/src/shared/types';
import { cn } from '@/src/shared/lib/cn';

/** LinkedIn brand icon — lucide-react 1.x removed brand icons */
export function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

export interface TemplateProps {
  cvData: CVData;
  designSettings: DesignSettings;
}

export function useSectionTitleClasses(settings: DesignSettings) {
  return cn(
    settings.sectionTitleWeight === 'normal' && "font-normal",
    settings.sectionTitleWeight === 'medium' && "font-medium",
    settings.sectionTitleWeight === 'semibold' && "font-semibold",
    settings.sectionTitleWeight === 'bold' && "font-bold",
    settings.sectionTitleWeight === 'black' && "font-black",
    settings.sectionTitleTransform === 'none' && "normal-case",
    settings.sectionTitleTransform === 'uppercase' && "uppercase",
    settings.sectionTitleTransform === 'capitalize' && "capitalize",
    settings.sectionTitleSpacing === 'tight' && "tracking-tight",
    settings.sectionTitleSpacing === 'normal' && "tracking-normal",
    settings.sectionTitleSpacing === 'wide' && "tracking-wide",
    settings.sectionTitleSpacing === 'wider' && "tracking-wider",
    settings.sectionTitleSpacing === 'widest' && "tracking-widest",
  );
}

export function getFontClass(fontFamily: string) {
  switch (fontFamily) {
    case 'serif': return 'font-serif';
    case 'mono': return 'font-mono';
    case 'playfair': return 'font-playfair';
    case 'outfit': return 'font-outfit';
    default: return 'font-sans';
  }
}

export function getIncludedSections(settings: DesignSettings) {
  return settings.includedSections ?? ['personal', 'summary', 'experience', 'education', 'skills', 'languages'];
}

export function renderPhoto(cvData: CVData, showPhoto?: boolean, className = "w-24 h-24 rounded-full object-cover") {
  if (!showPhoto || !cvData.personal_info?.photo_url) return null;
  return (
    <div className={cn("overflow-hidden shrink-0", className)}>
      <img
        src={cvData.personal_info.photo_url}
        alt={cvData.personal_info.name}
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
        loading="lazy"
      />
    </div>
  );
}

/**
 * Render experience content: intro + action bullets + KPI.
 * 
 * compact: intro paragraph only
 * normal: intro + 2 action bullets
 * extended: intro + 4 action bullets + KPI
 */
export function renderExperienceContent(
  exp: import('@/src/shared/types').Experience,
  intro: string | null,
  bullets: string[],
  bulletMarker: React.ReactNode,
  kpiColor: string,
) {
  const mode = exp.displayMode || 'normal';
  
  return (
    <>
      {intro && (
        <p className="text-sm text-gray-600 leading-relaxed">{intro}</p>
      )}
      {bullets.length > 0 && (
        <ul className="space-y-1.5 mt-1.5">
          {bullets.map((bullet, bIdx) => (
            <li key={bIdx} className="text-sm text-gray-600 leading-relaxed flex gap-3">
              {bulletMarker}
              {bullet}
            </li>
          ))}
        </ul>
      )}
      {mode === 'extended' && exp.kpi && (
        <p className="text-xs font-bold mt-2 flex items-center gap-1.5" style={{ color: kpiColor }}>
          <span className="text-[10px]">📈</span> {exp.kpi}
        </p>
      )}
    </>
  );
}

// Keep old name as alias for backward compat during migration
export const renderExperienceBullets = renderExperienceContent;
