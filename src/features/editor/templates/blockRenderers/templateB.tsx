// ─── TemplateB Block Renderers ───
// Individual block-level renderers for the Modern template (sidebar LEFT).
// Used by PaginatedCV to render each block independently.

import { cn } from '@/src/shared/lib/cn';
import { getContrastTextColor, getContrastMutedColor } from '@/src/shared/lib/colorContrast';
import type { BlockRendererMap, BlockRendererProps, PlacedBlock } from '../../lib/pagination/types';
import { renderPhoto, renderContactInfo } from '../shared';
import { getIntro, getActionBullets, shouldShowKPI, getVisibleSkills } from '../../lib/displayModes';
import { formatDateShort, normalizeProficiency } from '../../lib/formatting';
import { getSkillCategoryTitle } from '../../lib/atsRules';
import type { SkillCategoryKey } from '../../lib/skillDictionary';
import type { Experience, SkillCategory, Education, Language, PersonalInfo, CVData } from '@/src/shared/types';

// ─── Helpers ───

/** Get the bullet slice for a split experience block */
function getSlicedBullets(exp: Experience, placed: PlacedBlock): { intro: string | null; bullets: string[] } {
  const intro = getIntro(exp);
  const allBullets = getActionBullets(exp);

  if (placed.startSubBlock === undefined || placed.endSubBlock === undefined) {
    return { intro, bullets: allBullets };
  }

  const isOverflowPart = placed.startSubBlock > 0;
  if (isOverflowPart) {
    const bulletStart = placed.startSubBlock - 1;
    const bulletEnd = placed.endSubBlock - 1;
    return { intro: null, bullets: allBullets.slice(bulletStart, bulletEnd) };
  }

  const bulletEnd = placed.endSubBlock - 1;
  return { intro, bullets: allBullets.slice(0, bulletEnd) };
}

// ─── Block Renderers ───

function HeaderBlock({ block, designSettings }: BlockRendererProps) {
  const data = block.block.data as PersonalInfo;
  const { primaryColor } = designSettings;
  const showPhoto = designSettings.showPhoto;
  const cvDataShim = { personal_info: data } as CVData;
  const textColor = getContrastTextColor(primaryColor);
  const mutedColor = getContrastMutedColor(primaryColor);

  return (
    <div data-cv-section="header">
      {showPhoto && data?.photo_url ? (
        renderPhoto(cvDataShim, showPhoto, "w-24 h-24 rounded-full mb-8 border-2 border-white/20")
      ) : (
        <div className="w-24 h-24 rounded-full mb-8 flex items-center justify-center text-3xl font-bold bg-white/20">
          {data?.name?.charAt(0)}
        </div>
      )}
      <h1 className="text-2xl font-bold leading-tight mb-2" style={{ color: textColor }}>{data?.name}</h1>
      <p className="font-medium text-sm mb-12" style={{ color: mutedColor }}>{data?.title}</p>
    </div>
  );
}

function SummaryBlock({ block }: BlockRendererProps) {
  const summary = block.block.data as string;

  return (
    <section data-cv-section="summary" className="mb-12">
      <h2 className="mb-4 font-bold uppercase tracking-wider text-gray-500" style={{ fontSize: '10px' }}>Profil</h2>
      <p className="text-[11px] leading-relaxed text-gray-700">{summary}</p>
    </section>
  );
}

function ExperienceBlock({ block, designSettings }: BlockRendererProps) {
  const exp = block.block.data as Experience;
  const { primaryColor, secondaryColor, atsMode } = designSettings;
  const { intro, bullets } = getSlicedBullets(exp, block);
  const isOverflow = (block.startSubBlock ?? 0) > 0;

  return (
    <div data-cv-block="experience" data-measure-id={block.block.id} className={cn("relative pl-8 border-l border-gray-100", atsMode && "pl-0 border-l-0")}>
      {!atsMode && <div className="absolute -left-[5px] top-2 w-2 h-2 rounded-full" style={{ backgroundColor: secondaryColor }} />}
      {!isOverflow && (
        <div>
          <div className="flex justify-between items-baseline gap-4 mb-1" data-sub-id={`${block.block.id}-header`} data-sub-type="exp-header">
            <h3 className="font-bold text-gray-900">{exp.position}</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 whitespace-nowrap" style={{ color: secondaryColor, backgroundColor: `${secondaryColor}10` }}>
              {formatDateShort(exp.start_date)} — {exp.current ? 'Present' : formatDateShort(exp.end_date)}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-3">{exp.company}</p>
          {intro && <p className="text-sm text-gray-600 leading-relaxed">{intro}</p>}
        </div>
      )}
      {bullets.length > 0 && (
        <ul className="space-y-1.5 mt-1.5">
          {bullets.map((bullet, bIdx) => (
            <li key={bIdx} className="text-sm text-gray-600 leading-relaxed flex gap-3" data-sub-id={`${block.block.id}-bullet-${bIdx}`} data-sub-type="bullet">
              <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: secondaryColor }} />
              {bullet}
            </li>
          ))}
        </ul>
      )}
      {shouldShowKPI(exp) && (
        <p className="text-xs font-bold mt-2 flex items-center gap-1.5" data-sub-id={`${block.block.id}-kpi`} data-sub-type="kpi" style={{ color: primaryColor }}>
          <span className="text-[10px]">📈</span> {exp.kpi}
        </p>
      )}
    </div>
  );
}

function SkillCategoryBlock({ block, designSettings, language }: BlockRendererProps) {
  const cat = block.block.data as SkillCategory;
  const { primaryColor } = designSettings;
  const visibleSkills = getVisibleSkills(cat);
  const textColor = getContrastTextColor(primaryColor);
  const mutedColor = getContrastMutedColor(primaryColor);

  if (visibleSkills.length === 0) return null;

  // Handle slice for split skill categories
  let displaySkills = visibleSkills;
  if (block.startSubBlock !== undefined && block.endSubBlock !== undefined && block.block.subBlocks) {
    const isOverflow = block.startSubBlock > 0;
    if (isOverflow) {
      const titleCount = block.block.subBlocks.filter(s => s.type === 'skill-title').length;
      const itemStart = block.startSubBlock - titleCount;
      const itemEnd = block.endSubBlock - titleCount;
      displaySkills = visibleSkills.slice(itemStart, itemEnd);
    } else {
      const titleCount = block.block.subBlocks.filter(s => s.type === 'skill-title').length;
      const itemEnd = block.endSubBlock - titleCount;
      displaySkills = visibleSkills.slice(0, itemEnd);
    }
  }

  const isOverflow = (block.startSubBlock ?? 0) > 0;

  return (
    <div className="space-y-2" data-measure-id={block.block.id}>
      {!isOverflow && (
        <h3 className="text-[9px] font-bold uppercase tracking-widest" style={{ color: mutedColor }} data-sub-id={`${block.block.id}-title`} data-sub-type="skill-title">
          {getSkillCategoryTitle(cat.category as SkillCategoryKey, language)}
        </h3>
      )}
      <div className="flex flex-wrap gap-2">
        {displaySkills.map((skill, i) => (
          <span key={skill} className="px-2 py-1 text-[9px] font-bold rounded" style={{ color: textColor }} data-sub-id={`${block.block.id}-item-${i}`} data-sub-type="skill-row">
            {skill}
          </span>
        ))}
      </div>
    </div>
  );
}

function EducationBlock({ block, designSettings }: BlockRendererProps) {
  const educations = block.block.data as Education[];
  const { primaryColor } = designSettings;
  const textColor = getContrastTextColor(primaryColor);
  const mutedColor = getContrastMutedColor(primaryColor);

  return (
    <section data-cv-section="education" data-measure-id={block.block.id}>
      <h2 className="mb-4 font-bold uppercase tracking-wider" style={{ fontSize: '10px', color: mutedColor }}>Formation</h2>
      <div className="space-y-4">
        {educations.map((edu, idx) => (
          <div key={idx} className="space-y-1" data-cv-block="education">
            <p className="text-sm font-bold" style={{ color: textColor }}>{edu.degree}</p>
            <p className="text-xs" style={{ color: mutedColor }}>{edu.school} • {edu.end_date}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LanguagesBlock({ block, designSettings }: BlockRendererProps) {
  const languages = block.block.data as Language[];
  const { primaryColor } = designSettings;
  const textColor = getContrastTextColor(primaryColor);
  const mutedColor = getContrastMutedColor(primaryColor);

  return (
    <section data-cv-section="languages" data-measure-id={block.block.id}>
      <h2 className="mb-4 font-bold uppercase tracking-wider" style={{ fontSize: '10px', color: mutedColor }}>Langues</h2>
      <div className="space-y-2">
        {languages.map((lang, idx) => (
          <div key={idx} className="flex justify-between items-center text-[11px]">
            <span style={{ color: textColor }}>{lang.name}</span>
            <span className="text-[9px] uppercase tracking-wider" style={{ color: mutedColor }}>{normalizeProficiency(lang.proficiency)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Registry ───

export const templateBRenderers: BlockRendererMap = {
  header: (props) => <HeaderBlock {...props} />,
  summary: (props) => <SummaryBlock {...props} />,
  experience: (props) => <ExperienceBlock {...props} />,
  'skill-category': (props) => <SkillCategoryBlock {...props} />,
  education: (props) => <EducationBlock {...props} />,
  languages: (props) => <LanguagesBlock {...props} />,
};
