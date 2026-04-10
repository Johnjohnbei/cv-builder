// ─── TemplateA Block Renderers ───
// Individual block-level renderers for the Classic template.
// Used by PaginatedCV to render each block independently.

import { cn } from '@/src/shared/lib/cn';
import type { BlockRendererMap, BlockRendererProps, PlacedBlock } from '../../lib/pagination/types';
import { useSectionTitleClasses, getIncludedSections, renderPhoto, renderContactInfo, renderSkillsATS } from '../shared';
import { getIntro, getActionBullets, shouldShowKPI, isHidden, isSkillHidden, getVisibleSkills } from '../../lib/displayModes';
import { formatDateShort, normalizeProficiency } from '../../lib/formatting';
import { getSectionTitle, getSkillCategoryTitle } from '../../lib/atsRules';
import type { SkillCategoryKey } from '../../lib/skillDictionary';
import type { Experience, SkillCategory, Education, Language, PersonalInfo, CVData } from '@/src/shared/types';

// ─── Helpers ───

function getSectionTitleStyle(props: BlockRendererProps) {
  const { designSettings } = props;
  const atsMode = designSettings.atsMode;
  return {
    color: atsMode ? '#000' : designSettings.primaryColor,
    borderColor: atsMode ? '#e5e7eb' : `${designSettings.primaryColor}20`,
  };
}

/** Get the bullet slice for a split experience block */
function getSlicedBullets(exp: Experience, placed: PlacedBlock): { intro: string | null; bullets: string[] } {
  const intro = getIntro(exp);
  const allBullets = getActionBullets(exp);

  if (placed.startSubBlock === undefined || placed.endSubBlock === undefined) {
    return { intro, bullets: allBullets };
  }

  // Sub-blocks: [0] = exp-header (intro), [1..n] = bullets
  const isOverflowPart = placed.startSubBlock > 0;
  if (isOverflowPart) {
    // This is the continuation — no intro, bullets from startSubBlock-1
    const bulletStart = placed.startSubBlock - 1; // -1 because sub-block 0 is exp-header
    const bulletEnd = placed.endSubBlock - 1;
    return { intro: null, bullets: allBullets.slice(bulletStart, bulletEnd) };
  }

  // This is the first part — intro + bullets up to endSubBlock-1
  const bulletEnd = placed.endSubBlock - 1;
  return { intro, bullets: allBullets.slice(0, bulletEnd) };
}

// ─── Block Renderers ───

function HeaderBlock({ block, designSettings }: BlockRendererProps) {
  const data = block.block.data as PersonalInfo;
  const atsMode = designSettings.atsMode;
  const showPhoto = designSettings.showPhoto;

  // We need a minimal CVData wrapper for renderContactInfo/renderPhoto
  const cvDataShim = { personal_info: data } as CVData;

  return (
    <div data-cv-section="header" className={cn("border-b-2 pb-8 mb-8 flex justify-between items-start", atsMode && "border-gray-200")} style={atsMode ? undefined : { borderColor: designSettings.primaryColor }}>
      <div className="flex-1">
        <h1 className="text-4xl font-bold tracking-tighter uppercase" style={{ color: atsMode ? '#000' : designSettings.primaryColor }}>{data?.name}</h1>
        <p className="text-xl font-medium mt-1 text-gray-600">{data?.title}</p>
        {renderContactInfo(cvDataShim, atsMode, "mt-4 text-gray-500 text-xs font-mono")}
      </div>
      {renderPhoto(cvDataShim, showPhoto, "w-28 h-28 rounded-lg border-2 border-gray-100")}
    </div>
  );
}

function SummaryBlock({ block, designSettings }: BlockRendererProps) {
  const summary = block.block.data as string;
  const sectionStyle = getSectionTitleStyle({ block, designSettings, language: 'fr' });

  return (
    <section data-cv-section="summary">
      <h2 className="text-sm border-b pb-2 mb-4 font-bold uppercase tracking-wider" style={sectionStyle}>Profil</h2>
      <p className="text-sm text-gray-600 leading-relaxed">{summary}</p>
    </section>
  );
}

function ExperienceBlock({ block, designSettings, language, isPage2Plus }: BlockRendererProps) {
  const exp = block.block.data as Experience;
  const { primaryColor, secondaryColor } = designSettings;
  const { intro, bullets } = getSlicedBullets(exp, block);
  const isOverflow = (block.startSubBlock ?? 0) > 0;
  const sectionStyle = getSectionTitleStyle({ block, designSettings, language });

  return (
    <div data-cv-block="experience" data-measure-id={block.block.id}>
      {/* Show section title only for the first experience on each page */}
      {!isOverflow && (
        <div>
          <div className="flex justify-between items-baseline gap-4 mb-1" data-sub-id={`${block.block.id}-header`} data-sub-type="exp-header">
            <h3 className="font-bold text-gray-900 min-w-0">{exp.position}</h3>
            <span className="text-xs text-gray-500 font-mono shrink-0 whitespace-nowrap">
              {formatDateShort(exp.start_date)} — {exp.current ? 'Présent' : formatDateShort(exp.end_date)}
            </span>
          </div>
          <p className="text-sm font-bold mb-2" style={{ color: secondaryColor }}>{exp.company}</p>
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
  const { secondaryColor, atsMode } = designSettings;
  const sectionStyle = getSectionTitleStyle({ block, designSettings, language });
  const visibleSkills = getVisibleSkills(cat);

  if (visibleSkills.length === 0) return null;

  // Handle slice for split skill categories
  let displaySkills = visibleSkills;
  if (block.startSubBlock !== undefined && block.endSubBlock !== undefined && block.block.subBlocks) {
    const isOverflow = block.startSubBlock > 0;
    if (isOverflow) {
      // Skip title sub-block count
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
        <h3 className="text-[10px] font-bold uppercase tracking-wider" data-sub-id={`${block.block.id}-title`} data-sub-type="skill-title" style={{ color: secondaryColor }}>
          {getSkillCategoryTitle(cat.category as SkillCategoryKey, language)}
        </h3>
      )}
      <div className="flex flex-wrap gap-2">
        {displaySkills.map((skill, i) => (
          <span key={skill} className="px-2 py-1 bg-gray-100 text-gray-700 text-[10px] font-bold rounded uppercase tracking-wider" data-sub-id={`${block.block.id}-item-${i}`} data-sub-type="skill-row">
            {skill}
          </span>
        ))}
      </div>
    </div>
  );
}

function EducationBlock({ block, designSettings, language }: BlockRendererProps) {
  const educations = block.block.data as Education[];
  const sectionStyle = getSectionTitleStyle({ block, designSettings, language });

  return (
    <section data-cv-section="education" data-measure-id={block.block.id}>
      <h2 className="text-sm border-b pb-2 mb-4 font-bold uppercase tracking-wider" style={sectionStyle}>Formation</h2>
      <div className="space-y-4">
        {educations.map((edu, idx) => (
          <div key={idx} className="space-y-1" data-cv-block="education">
            <p className="text-xs font-bold">{edu.degree}</p>
            <p className="text-[10px] text-gray-500">{edu.school} • {edu.end_date}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LanguagesBlock({ block, designSettings, language }: BlockRendererProps) {
  const languages = block.block.data as Language[];
  const sectionStyle = getSectionTitleStyle({ block, designSettings, language });

  return (
    <section data-cv-section="languages" data-measure-id={block.block.id}>
      <h2 className="text-sm border-b pb-2 mb-4 font-bold uppercase tracking-wider" style={sectionStyle}>Langues</h2>
      <div className="space-y-2">
        {languages.map((lang, idx) => (
          <div key={idx} className="flex justify-between items-center">
            <span className="text-xs font-medium text-gray-700">{lang.name}</span>
            <span className="text-[10px] text-gray-500 font-mono uppercase tracking-tighter">{normalizeProficiency(lang.proficiency)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Registry ───

export const templateARenderers: BlockRendererMap = {
  header: (props) => <HeaderBlock {...props} />,
  summary: (props) => <SummaryBlock {...props} />,
  experience: (props) => <ExperienceBlock {...props} />,
  'skill-category': (props) => <SkillCategoryBlock {...props} />,
  education: (props) => <EducationBlock {...props} />,
  languages: (props) => <LanguagesBlock {...props} />,
};
