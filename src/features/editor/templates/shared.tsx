import type { CVData, DesignSettings } from '@/src/shared/types';
import { cn } from '@/src/shared/lib/cn';

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
      />
    </div>
  );
}

/**
 * Render experience bullets with proper compact/normal/extended handling.
 * compact: single paragraph (no bullet marker)
 * normal/extended: <ul> with bullets and optional KPI
 * 
 * @param bulletMarker - JSX element for the bullet marker (dot, slash, etc.)
 */
export function renderExperienceBullets(
  exp: import('@/src/shared/types').Experience,
  bullets: string[],
  bulletMarker: React.ReactNode,
  kpiColor: string,
) {
  const mode = exp.displayMode || 'normal';
  
  if (mode === 'compact') {
    return bullets[0] ? (
      <p className="text-sm text-gray-600 leading-relaxed">{bullets[0]}</p>
    ) : null;
  }
  
  return (
    <>
      <ul className="space-y-2">
        {bullets.map((bullet, bIdx) => (
          <li key={bIdx} className="text-sm text-gray-600 leading-relaxed flex gap-3">
            {bulletMarker}
            {bullet}
          </li>
        ))}
      </ul>
      {mode === 'extended' && exp.kpi && (
        <p className="text-xs font-bold mt-2 flex items-center gap-1.5" style={{ color: kpiColor }}>
          <span className="text-[10px]">📈</span> {exp.kpi}
        </p>
      )}
    </>
  );
}
