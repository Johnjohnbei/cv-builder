// ─── TemplateC Block Renderers ───
// Individual block-level renderers for the Minimal template (single-column centered).
// Used by PaginatedCV to render each block independently.

import { cn } from '@/src/shared/lib/cn';
import type { BlockRendererMap, BlockRendererProps, PlacedBlock } from '../../lib/pagination/types';
import { renderPhoto, renderContactInfo } from '../shared';
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
  const { primaryColor } = designSettings;
  const showPhoto = designSettings.showPhoto;
  const cvDataShim = { personal_info: data } as CVData;

  return (
    <header data-cv-section="header" className="text-center space-y-4 flex flex-col items-center">
      {renderPhoto(cvDataShim, showPhoto, "w-24 h-24 rounded-full mb-2 border-2 border-gray-100")}
      <h1 className="text-5xl font-light tracking-tight" style={{ color: primaryColor }}>{data?.name}</h1>
      <p className="text-sm uppercase tracking-[0.3em] text-gray-500">{data?.title}</p>
      {renderContactInfo(cvDataShim, designSettings.atsMode, "justify-center text-[10px] font-mono text-gray-400 uppercase tracking-widest")}
    </header>
  );
}

function SummaryBlock({ block, designSettings, language }: BlockRendererProps) {
  const summary = block.block.data as string;

  return (
    <section data-cv-section="summary" className="max-w-2xl mx-auto text-center">
      <h2 className="text-gray-300 mb-4 font-bold uppercase tracking-wider" style={{ fontSize: '11px' }}>{getSectionTitle('summary', language)}</h2>
      <p className="text-sm text-gray-600 leading-relaxed italic">"{summary}"</p>
    </section>
  );
}

function ExperienceBlock({ block, designSettings }: BlockRendererProps) {
  const exp = block.block.data as Experience;
  const { primaryColor, secondaryColor } = designSettings;
  const { intro, bullets } = getSlicedBullets(exp, block);
  const isOverflow = (block.startSubBlock ?? 0) > 0;

  return (
    <div data-cv-block="experience" data-measure-id={block.block.id} className="grid grid-cols-[120px_1fr] gap-8">
      {!isOverflow ? (
        <>
          <div className="text-[10px] font-mono text-gray-400 pt-1" data-sub-id={`${block.block.id}-header`} data-sub-type="exp-header">
            {formatDateShort(exp.start_date)} — {exp.current ? 'PRESENT' : formatDateShort(exp.end_date)}
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-gray-900 uppercase tracking-tight">{exp.position}</h3>
            <p className="text-xs font-medium" style={{ color: secondaryColor }}>{exp.company}</p>
            <div className="pt-2">
              {intro && <p className="text-sm text-gray-600 leading-relaxed">{intro}</p>}
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
          </div>
        </>
      ) : (
        <>
          <div />
          <div>
            {bullets.length > 0 && (
              <ul className="space-y-1.5">
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
        </>
      )}
    </div>
  );
}

function SkillCategoryBlock({ block, designSettings, language }: BlockRendererProps) {
  const cat = block.block.data as SkillCategory;
  const visibleSkills = getVisibleSkills(cat);

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
    <div className="space-y-1" data-measure-id={block.block.id}>
      {!isOverflow && (
        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400" data-sub-id={`${block.block.id}-title`} data-sub-type="skill-title">
          {getSkillCategoryTitle(cat.category as SkillCategoryKey, language)}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {displaySkills.map((skill, i) => (
          <span key={skill} className="text-[10px] text-gray-700 bg-gray-100 px-2 py-0.5 rounded" data-sub-id={`${block.block.id}-item-${i}`} data-sub-type="skill-row">
            {skill}
          </span>
        ))}
      </div>
    </div>
  );
}

function EducationBlock({ block, designSettings, language }: BlockRendererProps) {
  const educations = block.block.data as Education[];

  return (
    <section data-cv-section="education" data-measure-id={block.block.id}>
      <h2 className="text-gray-300 mb-6 font-bold uppercase tracking-wider" style={{ fontSize: '11px' }}>{getSectionTitle('education', language)}</h2>
      <div className="space-y-4">
        {educations.map((edu, idx) => (
          <div key={idx} data-cv-block="education">
            <p className="text-xs font-bold text-gray-900 uppercase">{edu.degree}</p>
            <p className="text-[10px] text-gray-500">{edu.school} • {edu.end_date}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LanguagesBlock({ block, designSettings, language }: BlockRendererProps) {
  const languages = block.block.data as Language[];

  return (
    <section data-cv-section="languages" data-measure-id={block.block.id}>
      <h2 className="text-gray-300 mb-6 text-center font-bold uppercase tracking-wider" style={{ fontSize: '11px' }}>{getSectionTitle('languages', language)}</h2>
      <div className="flex justify-center gap-12">
        {languages.map((lang, idx) => (
          <div key={idx} className="text-center">
            <p className="text-xs font-bold text-gray-900 uppercase">{lang.name}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">{normalizeProficiency(lang.proficiency)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Registry ───

export const templateCRenderers: BlockRendererMap = {
  header: (props) => <HeaderBlock {...props} />,
  summary: (props) => <SummaryBlock {...props} />,
  experience: (props) => <ExperienceBlock {...props} />,
  'skill-category': (props) => <SkillCategoryBlock {...props} />,
  education: (props) => <EducationBlock {...props} />,
  languages: (props) => <LanguagesBlock {...props} />,
};
