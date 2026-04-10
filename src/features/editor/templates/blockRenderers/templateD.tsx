// ─── TemplateD Block Renderers ───
// Individual block-level renderers for the Creative template.
// Used by PaginatedCV to render each block independently.

import { cn } from '@/src/shared/lib/cn';
import type { BlockRendererMap, BlockRendererProps, PlacedBlock } from '../../lib/pagination/types';
import { useSectionTitleClasses, renderPhoto, renderContactInfo } from '../shared';
import { getIntro, getActionBullets, shouldShowKPI, getVisibleSkills } from '../../lib/displayModes';
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

// ─── Block Renderers ───

function HeaderBlock({ block, designSettings }: BlockRendererProps) {
  const data = block.block.data as PersonalInfo;
  const { primaryColor, secondaryColor } = designSettings;
  const showPhoto = designSettings.showPhoto;
  const cvDataShim = { personal_info: data } as CVData;
  const nameParts = data?.name?.split(' ') ?? [];

  return (
    <div data-cv-section="header" className="pb-3 mb-2" style={{ backgroundColor: `${primaryColor}10` }}>
      <div className="px-10 py-6 space-y-4">
        {/* Row 1: photo + name | contact */}
        <div className="flex justify-between items-center">
          <div className="flex gap-4 items-center">
            {renderPhoto(cvDataShim, showPhoto, "w-20 h-20 rounded-none border-4 border-black")}
            <h1 className="text-3xl font-black italic tracking-tighter" style={{ color: primaryColor }}>
              {data?.name}
            </h1>
          </div>
          <div className="text-right space-y-0.5 text-[10px] font-bold font-mono shrink-0">
            <p>{data?.email}</p>
            {data?.phone && <p>{data.phone}</p>}
            {data?.location && <p>{data.location}</p>}
            {data?.linkedin && <p>{data.linkedin.replace(/^https?:\/\/(www\.)?/, '')}</p>}
          </div>
        </div>
        {/* Row 2: title full-width */}
        <p className="text-sm font-bold uppercase tracking-widest border-t pt-3" style={{ color: secondaryColor, borderColor: `${primaryColor}20` }}>{data?.title}</p>
      </div>
    </div>
  );
}

function SummaryBlock({ block, designSettings }: BlockRendererProps) {
  const summary = block.block.data as string;
  const { primaryColor, secondaryColor } = designSettings;

  return (
    <section data-cv-section="summary">
      <div className="flex items-center gap-4 mb-6">
        <h2 className="italic text-2xl font-bold" style={{ color: primaryColor }}>Profil</h2>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <p className="text-sm text-gray-700 leading-relaxed font-medium">{summary}</p>
    </section>
  );
}

function ExperienceBlock({ block, designSettings, language }: BlockRendererProps) {
  const exp = block.block.data as Experience;
  const { primaryColor, secondaryColor } = designSettings;
  const { intro, bullets } = getSlicedBullets(exp, block);
  const isOverflow = (block.startSubBlock ?? 0) > 0;

  return (
    <div data-cv-block="experience" data-measure-id={block.block.id}>
      {!isOverflow && (
        <div>
          <div className="flex justify-between items-baseline gap-4 mb-1" data-sub-id={`${block.block.id}-header`} data-sub-type="exp-header">
            <h3 className="text-lg font-black uppercase tracking-tight">{exp.position}</h3>
            <span className="text-[11px] font-bold font-mono px-3 py-1 shrink-0 whitespace-nowrap" style={{ backgroundColor: '#000', color: '#fff' }}>
              {formatDateShort(exp.start_date)} — {exp.current ? 'NOW' : formatDateShort(exp.end_date)}
            </span>
          </div>
          <p className="text-sm font-bold italic mb-2" style={{ color: secondaryColor }}>{exp.company}</p>
          {intro && <p className="text-sm text-gray-600 leading-relaxed">{intro}</p>}
        </div>
      )}
      {bullets.length > 0 && (
        <ul className="space-y-1.5 mt-1.5">
          {bullets.map((bullet, bIdx) => (
            <li key={bIdx} className="text-sm text-gray-600 leading-relaxed flex gap-3" data-sub-id={`${block.block.id}-bullet-${bIdx}`} data-sub-type="bullet">
              <span className="font-bold shrink-0" style={{ color: primaryColor }}>/</span>
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
  const { secondaryColor } = designSettings;
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
    <div className="space-y-2" data-measure-id={block.block.id}>
      {!isOverflow && (
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500" data-sub-id={`${block.block.id}-title`} data-sub-type="skill-title">
          {getSkillCategoryTitle(cat.category as SkillCategoryKey, language)}
        </h3>
      )}
      <div className="flex flex-wrap gap-2">
        {displaySkills.map((skill, i) => (
          <span key={skill} className="px-2 py-1 border-2 border-black text-[10px] font-black uppercase" data-sub-id={`${block.block.id}-item-${i}`} data-sub-type="skill-row">
            {skill}
          </span>
        ))}
      </div>
    </div>
  );
}

function EducationBlock({ block, designSettings, language }: BlockRendererProps) {
  const educations = block.block.data as Education[];
  const { secondaryColor } = designSettings;

  return (
    <section data-cv-section="education" data-measure-id={block.block.id}>
      <h2 className="italic mb-3 underline decoration-4 underline-offset-4 text-lg font-bold uppercase tracking-wider" style={{ textDecorationColor: secondaryColor, color: designSettings.primaryColor }}>Formation</h2>
      <div className="space-y-6">
        {educations.map((edu, idx) => (
          <div key={idx} className="space-y-1" data-cv-block="education">
            <p className="text-sm font-black uppercase">{edu.degree}</p>
            <p className="text-xs font-bold text-gray-500 italic">{edu.school}</p>
            <p className="text-[10px] font-bold font-mono">{edu.end_date}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LanguagesBlock({ block, designSettings, language }: BlockRendererProps) {
  const languages = block.block.data as Language[];
  const { secondaryColor } = designSettings;

  return (
    <section data-cv-section="languages" data-measure-id={block.block.id}>
      <h2 className="italic mb-3 underline decoration-4 underline-offset-4 text-lg font-bold uppercase tracking-wider" style={{ textDecorationColor: secondaryColor, color: designSettings.primaryColor }}>Langues</h2>
      <div className="space-y-4">
        {languages.map((lang, idx) => (
          <div key={idx} className="flex justify-between items-center">
            <span className="text-sm font-black uppercase">{lang.name}</span>
            <span className="text-[10px] font-bold font-mono bg-gray-100 px-2 py-0.5">{normalizeProficiency(lang.proficiency)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Registry ───

export const templateDRenderers: BlockRendererMap = {
  header: (props) => <HeaderBlock {...props} />,
  summary: (props) => <SummaryBlock {...props} />,
  experience: (props) => <ExperienceBlock {...props} />,
  'skill-category': (props) => <SkillCategoryBlock {...props} />,
  education: (props) => <EducationBlock {...props} />,
  languages: (props) => <LanguagesBlock {...props} />,
};
