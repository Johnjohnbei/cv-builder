// ─── TemplateB Block Renderers ───
// Individual block-level renderers for the Modern template (sidebar LEFT).
// Used by PaginatedCV to render each block independently.

import { cn } from '@/src/shared/lib/cn';
import { renderInlineMarkdown } from '@/src/shared/lib/inlineMarkdown';
import { getContrastTextColor, getContrastMutedColor } from '@/src/shared/lib/colorContrast';
import type { BlockRendererMap, BlockRendererProps, PlacedBlock } from '../../lib/pagination/types';
import { renderPhoto, renderContactInfo, isKPIInRange, CompanyTags } from '../shared';
import { getIntro, getActionBullets, getVisibleSkills } from '../../lib/displayModes';
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
        renderPhoto(cvDataShim, showPhoto, "w-24 h-24 rounded-full mb-6 border-2 border-white/20")
      ) : (
        <div className="w-20 h-20 rounded-full mb-6 flex items-center justify-center text-2xl font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: textColor }}>
          {data?.name?.charAt(0)}
        </div>
      )}
      <h1 className="text-xl font-bold leading-tight mb-1" style={{ color: textColor }}>{data?.name}</h1>
      <p className="text-xs font-medium mb-6 leading-relaxed" style={{ color: mutedColor }}>{data?.title}</p>
      {/* Contact info separator */}
      <div className="border-t pt-4 space-y-1.5 text-[10px]" style={{ borderColor: 'rgba(255,255,255,0.2)', color: mutedColor }}>
        {data?.email && <p>{data.email}</p>}
        {data?.phone && <p>{data.phone}</p>}
        {data?.location && <p>{data.location}</p>}
      </div>
    </div>
  );
}

function SummaryBlock({ block, designSettings }: BlockRendererProps) {
  const summary = block.block.data as string;
  const { secondaryColor } = designSettings;

  return (
    <section data-cv-section="summary" className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-6 h-0.5 rounded-full" style={{ backgroundColor: secondaryColor }} />
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900">Profil</h2>
      </div>
      <p className="text-[11px] leading-relaxed text-gray-600">{renderInlineMarkdown(summary)}</p>
    </section>
  );
}

function ExperienceBlock({ block, designSettings }: BlockRendererProps) {
  const exp = block.block.data as Experience;
  const { primaryColor, secondaryColor, atsMode } = designSettings;
  const { intro, bullets } = getSlicedBullets(exp, block);
  const isOverflow = (block.startSubBlock ?? 0) > 0;

  return (
    <div data-cv-block="experience" data-measure-id={block.block.id} className={cn("relative pl-6 border-l-2", atsMode && "pl-0 border-l-0")} style={!atsMode ? { borderColor: `${secondaryColor}30` } : undefined}>
      {!atsMode && <div className="absolute -left-[4px] top-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: secondaryColor }} />}
      {!isOverflow && (
        <div data-sub-id={`${block.block.id}-header`} data-sub-type="exp-header">
          <div className="flex justify-between items-baseline gap-4 mb-1">
            <h3 className="font-bold text-gray-900 text-sm">{exp.position}</h3>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded uppercase shrink-0 whitespace-nowrap" style={{ color: secondaryColor, backgroundColor: `${secondaryColor}10` }}>
              {formatDateShort(exp.start_date)} — {exp.current ? 'Present' : formatDateShort(exp.end_date)}
            </span>
          </div>
          <p className="text-xs font-semibold mb-2" style={{ color: secondaryColor }}>
            {exp.company}
            <CompanyTags stage={exp.companyStage} businessModel={exp.companyBusinessModel} atsMode={designSettings.atsMode} />
          </p>
          {intro && <p className="text-[11px] text-gray-500 leading-relaxed">{renderInlineMarkdown(intro)}</p>}
        </div>
      )}
      {bullets.length > 0 && (
        <ul className="space-y-1.5 mt-2">
          {bullets.map((bullet, bIdx) => (
            <li key={bIdx} className="text-[11px] text-gray-600 leading-relaxed flex gap-2" data-sub-id={`${block.block.id}-bullet-${bIdx}`} data-sub-type="bullet">
              <span className="mt-[6px] w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: secondaryColor }} />
              {renderInlineMarkdown(bullet)}
            </li>
          ))}
        </ul>
      )}
      {isKPIInRange(exp, block) && (
        <p className="text-xs font-bold mt-2 flex items-center gap-1.5" data-sub-id={`${block.block.id}-kpi`} data-sub-type="kpi" style={{ color: primaryColor }}>
          <span className="text-[10px]">📈</span> {exp.kpi}
        </p>
      )}
    </div>
  );
}

function SkillCategoryBlock({ block, designSettings, language, isPage2Plus }: BlockRendererProps) {
  const cat = block.block.data as SkillCategory;
  const { primaryColor } = designSettings;
  const visibleSkills = getVisibleSkills(cat);
  const onSidebar = !isPage2Plus;
  const textColor = onSidebar ? getContrastTextColor(primaryColor) : '#1f2937';
  const mutedColor = onSidebar ? getContrastMutedColor(primaryColor) : '#6b7280';

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
        <h3 className="text-[8px] font-bold uppercase tracking-[0.2em] pb-1 border-b" style={{ color: mutedColor, borderColor: onSidebar ? 'rgba(255,255,255,0.15)' : '#e5e7eb' }} data-sub-id={`${block.block.id}-title`} data-sub-type="skill-title">
          {getSkillCategoryTitle(cat.category as SkillCategoryKey, language)}
        </h3>
      )}
      <div className="flex flex-wrap gap-1.5">
        {displaySkills.map((skill, i) => (
          <span key={skill} className="px-2 py-0.5 text-[9px] font-medium rounded" style={{ backgroundColor: onSidebar ? 'rgba(255,255,255,0.12)' : '#f3f4f6', color: textColor }} data-sub-id={`${block.block.id}-item-${i}`} data-sub-type="skill-row">
            {skill}
          </span>
        ))}
      </div>
    </div>
  );
}

function EducationBlock({ block, designSettings, isPage2Plus }: BlockRendererProps) {
  const educations = block.block.data as Education[];
  const { primaryColor } = designSettings;
  const onSidebar = !isPage2Plus;
  const textColor = onSidebar ? getContrastTextColor(primaryColor) : '#1f2937';
  const mutedColor = onSidebar ? getContrastMutedColor(primaryColor) : '#6b7280';

  return (
    <section data-cv-section="education" data-measure-id={block.block.id}>
      <h2 className="text-[8px] font-bold uppercase tracking-[0.2em] pb-1 mb-3 border-b" style={{ color: mutedColor, borderColor: onSidebar ? 'rgba(255,255,255,0.15)' : '#e5e7eb' }}>Formation</h2>
      <div className="space-y-3">
        {educations.map((edu, idx) => (
          <div key={idx} className="space-y-0.5" data-cv-block="education">
            <p className="text-[11px] font-bold" style={{ color: textColor }}>{edu.degree}</p>
            <p className="text-[9px]" style={{ color: mutedColor }}>{edu.school}</p>
            <p className="text-[8px] font-mono" style={{ color: mutedColor }}>{edu.end_date}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LanguagesBlock({ block, designSettings, isPage2Plus }: BlockRendererProps) {
  const languages = block.block.data as Language[];
  const { primaryColor } = designSettings;
  const onSidebar = !isPage2Plus;
  const textColor = onSidebar ? getContrastTextColor(primaryColor) : '#1f2937';
  const mutedColor = onSidebar ? getContrastMutedColor(primaryColor) : '#4b5563';

  return (
    <section data-cv-section="languages" data-measure-id={block.block.id}>
      <h2 className="text-[8px] font-bold uppercase tracking-[0.2em] pb-1 mb-3 border-b" style={{ color: mutedColor, borderColor: onSidebar ? 'rgba(255,255,255,0.15)' : '#e5e7eb' }}>Langues</h2>
      <div className="space-y-2">
        {languages.map((lang, idx) => (
          <div key={idx} className="flex justify-between items-center">
            <span className="text-[11px] font-medium" style={{ color: textColor }}>{lang.name}</span>
            <span className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ color: mutedColor, backgroundColor: onSidebar ? 'rgba(255,255,255,0.1)' : '#f3f4f6' }}>{normalizeProficiency(lang.proficiency)}</span>
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
