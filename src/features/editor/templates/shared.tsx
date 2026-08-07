import { Mail, Phone, MapPin } from 'lucide-react';
import type { CVData } from '@/src/shared/types';
import type { SupportedLanguage } from '@/src/lib/languageDetection';
import { cn } from '@/src/shared/lib/cn';
import { getLocalizedStage } from '@/convex/_ai/schemas';
import { shouldShowKPI, getIntro, getActionBullets } from '../lib/displayModes';
import type { PlacedBlock } from '../lib/pagination/types';
import type { Experience } from '@/src/shared/types';

/**
 * Bullet slice for a (possibly split) experience block.
 *
 * Sub-block indices are ABSOLUTE into block.subBlocks: [0] = exp-header,
 * [1..n] = bullets, optional kpi last. `bulletOffset` is the absolute index of
 * the first rendered bullet — renderers must use it when tagging bullets with
 * data-sub-id so live DOM measurements map back to the right sub-block.
 */
export function getSlicedBullets(
  exp: Experience,
  placed: PlacedBlock,
): { intro: string | null; bullets: string[]; bulletOffset: number } {
  const intro = getIntro(exp);
  const allBullets = getActionBullets(exp);

  if (placed.startSubBlock === undefined || placed.endSubBlock === undefined) {
    return { intro, bullets: allBullets, bulletOffset: 0 };
  }

  const isOverflowPart = placed.startSubBlock > 0;
  if (isOverflowPart) {
    // Continuation — no intro, bullets resume mid-list (-1 skips exp-header)
    const bulletStart = placed.startSubBlock - 1;
    const bulletEnd = placed.endSubBlock - 1;
    return { intro: null, bullets: allBullets.slice(bulletStart, bulletEnd), bulletOffset: bulletStart };
  }

  // First part — intro + bullets up to endSubBlock-1
  const bulletEnd = placed.endSubBlock - 1;
  return { intro, bullets: allBullets.slice(0, bulletEnd), bulletOffset: 0 };
}

/**
 * Whether the KPI sub-block falls within the current page's slice.
 * Prevents KPI from appearing on both the kept portion (page 1) and the
 * overflow continuation (page 2+) when an experience block is split.
 */
export function isKPIInRange(exp: Experience, placed: PlacedBlock): boolean {
  if (!shouldShowKPI(exp)) return false;
  const { startSubBlock, endSubBlock, block } = placed;
  if (startSubBlock === undefined || endSubBlock === undefined) return true;
  const subBlocks = block.subBlocks;
  if (!subBlocks) return true;
  const kpiIdx = subBlocks.findIndex(s => s.type === 'kpi');
  if (kpiIdx === -1) return false;
  return kpiIdx >= startSubBlock && kpiIdx < endSubBlock;
}

/**
 * Discreet inline tags rendered next to a company name to indicate its
 * maturity stage (Startup, Scaleup, ...) and business model (B2C, SaaS, ...).
 * Returns null when both are absent — no extra DOM for plain CVs.
 *
 * Stage is translated programmatically via getLocalizedStage (FR ↔ EN).
 * Business models are international shorthand (B2C, SaaS…) — no translation.
 */
export function CompanyTags({
  stage,
  businessModel,
  atsMode,
  language = 'fr',
}: {
  stage?: string;
  businessModel?: string;
  atsMode?: boolean;
  language?: SupportedLanguage;
}) {
  const localizedStage = getLocalizedStage(stage, language);
  const tags = [localizedStage, businessModel].filter((t): t is string => Boolean(t && t.trim()));
  if (tags.length === 0) return null;
  // ATS mode → plain inline text (no decorative chips that PDF parsers might choke on)
  if (atsMode) {
    return <span className="text-[10px] text-gray-500 ml-1.5">({tags.join(' · ')})</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 ml-1.5 align-middle">
      {tags.map((t, i) => (
        <span
          key={i}
          className="text-[8px] uppercase tracking-wider font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded px-1.5 py-[1px] leading-tight"
        >
          {t}
        </span>
      ))}
    </span>
  );
}

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

export function getFontClass(fontFamily: string) {
  switch (fontFamily) {
    case 'serif': return 'font-serif';
    case 'mono': return 'font-mono';
    case 'playfair': return 'font-playfair';
    case 'outfit': return 'font-outfit';
    default: return 'font-sans';
  }
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
 * Shared contact renderer — replaces SVG icons with text labels when atsMode is true.
 * Labels are bilingual-safe (Email/Tel/LinkedIn are universal).
 */
export function renderContactInfo(
  cvData: CVData,
  atsMode?: boolean,
  className?: string,
) {
  const labels = { email: 'Email:', phone: 'Tel:', location: 'Location:', linkedin: 'LinkedIn:' };

  const items: { label: string; icon: React.ReactNode; value: string }[] = [];
  if (cvData.personal_info?.email) {
    items.push({ label: labels.email, icon: <Mail className="w-3 h-3" />, value: cvData.personal_info.email });
  }
  if (cvData.personal_info?.phone) {
    items.push({ label: labels.phone, icon: <Phone className="w-3 h-3" />, value: cvData.personal_info.phone });
  }
  if (cvData.personal_info?.location) {
    items.push({ label: labels.location, icon: <MapPin className="w-3 h-3" />, value: cvData.personal_info.location });
  }
  if (cvData.personal_info?.linkedin) {
    items.push({ label: labels.linkedin, icon: <LinkedinIcon className="w-3 h-3" />, value: cvData.personal_info.linkedin.replace(/^https?:\/\/(www\.)?/, '') });
  }

  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-1 text-sm", className)}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {atsMode ? <span className="font-semibold">{item.label}</span> : item.icon}
          {' '}{item.value}
        </span>
      ))}
    </div>
  );
}

