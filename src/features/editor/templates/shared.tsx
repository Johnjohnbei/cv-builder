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
