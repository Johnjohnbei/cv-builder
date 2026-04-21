// ─── TemplateE Block Renderers ───
// Individual block-level renderers for the Elegant template.
// Used by PaginatedCV to render each block independently.

import { cn } from '@/src/shared/lib/cn';
import type { BlockRendererMap, BlockRendererProps, PlacedBlock } from '../../lib/pagination/types';
import { useSectionTitleClasses, renderPhoto, renderContactInfo, renderSkillsATS, isKPIInRange } from '../shared';
import { getIntro, getActionBullets, getVisibleSkills } from '../../lib/displayModes';
import { formatDateShort, normalizeProficiency } from '../../lib/formatting';
import { getSectionTitle, getSkillCategoryTitle } from '../../lib/atsRules';
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

function getSectionHeader(title: string, primaryColor: string, atsMode?: boolean) {
  return (
    <div className="flex items-center gap-4 mb-3">
      <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>{title}</h2>
      <div className="flex-1 h-[2px]" style={{ backgroundColor: atsMode ? '#e5e7eb' : `${primaryColor}20` }} />
    </div>
  );
}

// ─── Block Renderers ───

function HeaderBlock({ block, designSettings }: BlockRendererProps) {
  const data = block.block.data as PersonalInfo;
  const { primaryColor } = designSettings;
  const atsMode = designSettings.atsMode;
  const showPhoto = designSettings.showPhoto;
  const cvDataShim = { personal_info: data } as CVData;

  return (
    <div data-cv-section="header" className="flex justify-between items-start mb-3">
      <div className="flex gap-4 items-center">
        {renderPhoto(cvDataShim, showPhoto, "w-20 h-20 rounded-xl border-2 border-gray-100")}
        <div className="space-y-0.5">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: primaryColor }}>{data?.name}</h1>
          <p className="text-sm font-medium tracking-wide uppercase opacity-80">{data?.title}</p>
        </div>
      </div>
      <div className="text-[10px] text-right space-y-0.5 text-gray-500 shrink-0">
        {data?.email && <p>{data.email}</p>}
        {data?.phone && <p>{data.phone}</p>}
        {data?.location && <p>{data.location}</p>}
        {data?.linkedin && <p>{data.linkedin.replace(/^https?:\/\/(www\.)?/, '')}</p>}
      </div>
    </div>
  );
}

function SummaryBlock({ block, designSettings }: BlockRendererProps) {
  const summary = block.block.data as string;
  const { primaryColor } = designSettings;
  const atsMode = designSettings.atsMode;

  return (
    <section data-cv-section="summary">
      {getSectionHeader('Profil', primaryColor, atsMode)}
      <p className="text-sm text-gray-600 leading-relaxed">{summary}</p>
    </section>
  );
}

function ExperienceBlock({ block, designSettings, language }: BlockRendererProps) {
  const exp = block.block.data as Experience;
  const { primaryColor, secondaryColor } = designSettings;
  const atsMode = designSettings.atsMode;
  const { intro, bullets } = getSlicedBullets(exp, block);
  const isOverflow = (block.startSubBlock ?? 0) > 0;

  return (
    <div data-cv-block="experience" data-measure-id={block.block.id}>
      {!isOverflow && (
        <div className="relative pl-6 border-l-2" style={{ borderColor: atsMode ? '#d1d5db' : `${secondaryColor}30` }} data-sub-id={`${block.block.id}-header`} data-sub-type="exp-header">
          {!atsMode && <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />}
          <div className="flex justify-between items-start gap-4 mb-2">
            <h3 className="font-bold text-gray-900">{exp.position}</h3>
            <div className="text-[10px] font-bold opacity-70 shrink-0 text-right leading-tight">
              <div>{formatDateShort(exp.start_date)}</div>
              <div>{exp.current ? 'PRESENT' : formatDateShort(exp.end_date)}</div>
            </div>
          </div>
          <p className="text-xs font-bold mb-3" style={{ color: secondaryColor }}>{exp.company}</p>
          {intro && <p className="text-sm text-gray-600 leading-relaxed">{intro}</p>}
        </div>
      )}
      {isOverflow && (
        <div className="relative pl-6 border-l-2" style={{ borderColor: atsMode ? '#d1d5db' : `${secondaryColor}30` }}>
          {/* Continuation of experience from previous page */}
        </div>
      )}
      {bullets.length > 0 && (
        <ul className={cn("space-y-1.5 mt-1.5", !isOverflow && "pl-6 border-l-2")} style={!isOverflow ? { borderColor: atsMode ? '#d1d5db' : `${secondaryColor}30` } : undefined}>
          {bullets.map((bullet, bIdx) => (
            <li key={bIdx} className="text-sm text-gray-600 leading-relaxed flex gap-3" data-sub-id={`${block.block.id}-bullet-${bIdx}`} data-sub-type="bullet">
              <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: secondaryColor }} />
              {bullet}
            </li>
          ))}
        </ul>
      )}
      {isKPIInRange(exp, block) && (
        <p className="text-xs font-bold mt-2 pl-6 flex items-center gap-1.5" data-sub-id={`${block.block.id}-kpi`} data-sub-type="kpi" style={{ color: primaryColor }}>
          <span className="text-[10px]">📈</span> {exp.kpi}
        </p>
      )}
    </div>
  );
}

function SkillCategoryBlock({ block, designSettings, language }: BlockRendererProps) {
  const cat = block.block.data as SkillCategory;
  const visibleSkills = getVisibleSkills(cat);

  if (visibleSkills.length === 0) return null;

  let displaySkills = visibleSkills;
  if (block.startSubBlock !== undefined && block.endSubBlock !== undefined && block.block.subBlocks) {
    const isOverflow = block.startSubBlock > 0;
    const titleCount = block.block.subBlocks.filter(s => s.type === 'skill-title').length;
    if (isOverflow) {
      const itemStart = block.startSubBlock - titleCount;
      const itemEnd = block.endSubBlock - titleCount;
      displaySkills = visibleSkills.slice(itemStart, itemEnd);
    } else {
      const itemEnd = block.endSubBlock - titleCount;
      displaySkills = visibleSkills.slice(0, itemEnd);
    }
  }

  const isOverflow = (block.startSubBlock ?? 0) > 0;

  return (
    <div data-measure-id={block.block.id}>
      {!isOverflow && (
        <p className="text-[10px] font-bold uppercase mb-1 opacity-60" data-sub-id={`${block.block.id}-title`} data-sub-type="skill-title">
          {getSkillCategoryTitle(cat.category as SkillCategoryKey, language)}
        </p>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {displaySkills.map((skill, i) => (
          <span key={skill} className="text-xs text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-200" data-sub-id={`${block.block.id}-item-${i}`} data-sub-type="skill-row">
            {skill}
          </span>
        ))}
      </div>
    </div>
  );
}

function EducationBlock({ block, designSettings, language }: BlockRendererProps) {
  const educations = block.block.data as Education[];
  const { primaryColor } = designSettings;
  const atsMode = designSettings.atsMode;

  return (
    <section data-cv-section="education" data-measure-id={block.block.id}>
      {getSectionHeader('Formation', primaryColor, atsMode)}
      <div className="space-y-4">
        {educations.map((edu, idx) => (
          <div key={idx} data-cv-block="education">
            <p className="text-sm font-bold text-gray-900">{edu.degree}</p>
            <p className="text-xs text-gray-500">{edu.school} | {edu.end_date}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LanguagesBlock({ block, designSettings, language }: BlockRendererProps) {
  const languages = block.block.data as Language[];
  const { primaryColor } = designSettings;
  const atsMode = designSettings.atsMode;

  return (
    <section data-cv-section="languages" data-measure-id={block.block.id}>
      {getSectionHeader('Langues', primaryColor, atsMode)}
      <div className="flex flex-wrap gap-x-12 gap-y-4">
        {languages.map((lang, idx) => (
          <div key={idx} className="flex flex-col">
            <span className="text-sm font-bold text-gray-900">{lang.name}</span>
            <span className="text-[10px] font-bold uppercase opacity-60">{normalizeProficiency(lang.proficiency)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Registry ───

export const templateERenderers: BlockRendererMap = {
  header: (props) => <HeaderBlock {...props} />,
  summary: (props) => <SummaryBlock {...props} />,
  experience: (props) => <ExperienceBlock {...props} />,
  'skill-category': (props) => <SkillCategoryBlock {...props} />,
  education: (props) => <EducationBlock {...props} />,
  languages: (props) => <LanguagesBlock {...props} />,
};
