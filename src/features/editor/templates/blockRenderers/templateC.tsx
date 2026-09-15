// ─── TemplateC Block Renderers ───
// Individual block-level renderers for the Minimal template (single-column centered).
// Used by PaginatedCV to render each block independently.

import { cn } from '@/src/shared/lib/cn';
import { renderInlineMarkdown } from '@/src/shared/lib/inlineMarkdown';
import type { BlockRendererMap, BlockRendererProps } from '../../lib/pagination/types';
import { renderPhoto, renderContactInfo, isKPIInRange, CompanyTags, getSlicedBullets, getEducationLines } from '../shared';
import { getVisibleSkills } from '../../lib/displayModes';
import { formatDateShort, getCurrentLabel, normalizeProficiency } from '../../lib/formatting';
import { getSectionTitle, getSkillCategoryTitle } from '../../lib/atsRules';
import type { SkillCategoryKey } from '../../lib/skillDictionary';
import type { Experience, SkillCategory, Education, Language, PersonalInfo, CVData } from '@/src/shared/types';

// ─── Block Renderers ───

function HeaderBlock({ block, designSettings }: BlockRendererProps) {
  const data = block.block.data as PersonalInfo;
  const { primaryColor } = designSettings;
  const showPhoto = designSettings.showPhoto;
  const cvDataShim = { personal_info: data } as CVData;

  return (
    <header data-cv-section="header" className="text-center space-y-2 flex flex-col items-center">
      {renderPhoto(cvDataShim, showPhoto, "w-20 h-20 rounded-full mb-1 border-2 border-gray-100")}
      <h1 className="text-3xl font-light tracking-tight" style={{ color: primaryColor }}>{data?.name}</h1>
      <p className="text-xs uppercase tracking-[0.3em] text-gray-500">{data?.title}</p>
      {renderContactInfo(cvDataShim, "justify-center text-[9px] font-mono text-gray-500 uppercase tracking-widest")}
    </header>
  );
}

function SummaryBlock({ block, designSettings, language }: BlockRendererProps) {
  const summary = block.block.data as string;

  return (
    <section data-cv-section="summary" className="max-w-2xl mx-auto text-center">
      <h2 className="text-gray-400 mb-2 font-bold uppercase tracking-wider" style={{ fontSize: '11px' }}>{getSectionTitle('summary', language)}</h2>
      <p className="text-sm text-gray-600 leading-relaxed italic">"{renderInlineMarkdown(summary)}"</p>
    </section>
  );
}

function ExperienceBlock({ block, designSettings, language }: BlockRendererProps) {
  const exp = block.block.data as Experience;
  const { primaryColor, secondaryColor } = designSettings;
  const { intro, bullets, bulletOffset } = getSlicedBullets(exp, block);
  const isOverflow = (block.startSubBlock ?? 0) > 0;

  return (
    <div data-cv-block="experience" data-measure-id={block.block.id} className="grid grid-cols-[120px_1fr] gap-8">
      {!isOverflow ? (
        <>
          <div className="text-[10px] font-mono text-gray-500 pt-1">
            {formatDateShort(exp.start_date, language)} – {exp.current ? getCurrentLabel(language).toUpperCase() : formatDateShort(exp.end_date, language)}
          </div>
          <div className="space-y-2">
            <div data-sub-id={`${block.block.id}-header`} data-sub-type="exp-header">
              <h3 className="font-bold text-gray-900 uppercase tracking-tight">{exp.position}</h3>
              <p className="text-xs font-medium mt-2" style={{ color: secondaryColor }}>
                {exp.company}
                <CompanyTags stage={exp.companyStage} businessModel={exp.companyBusinessModel} language={language} />
              </p>
              {intro && <p className="text-sm text-gray-600 leading-relaxed pt-2">{renderInlineMarkdown(intro)}</p>}
            </div>
            <div>
              {bullets.length > 0 && (
                <ul className="space-y-1.5 mt-1.5">
                  {bullets.map((bullet, bIdx) => (
                    <li key={bIdx} className="text-sm text-gray-600 leading-relaxed flex gap-3" data-sub-id={`${block.block.id}-bullet-${bulletOffset + bIdx}`} data-sub-type="bullet">
                      <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: secondaryColor }} />
                      {renderInlineMarkdown(bullet)}
                    </li>
                  ))}
                </ul>
              )}
              {isKPIInRange(exp, block) && (
                <p className="text-xs font-bold mt-2 flex items-center gap-1.5" data-sub-id={`${block.block.id}-kpi`} data-sub-type="kpi" style={{ color: primaryColor }}>
                  <span className="text-[10px]">📈</span> {renderInlineMarkdown(exp.kpi)}
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
                  <li key={bIdx} className="text-sm text-gray-600 leading-relaxed flex gap-3" data-sub-id={`${block.block.id}-bullet-${bulletOffset + bIdx}`} data-sub-type="bullet">
                    <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: secondaryColor }} />
                    {renderInlineMarkdown(bullet)}
                  </li>
                ))}
              </ul>
            )}
            {isKPIInRange(exp, block) && (
              <p className="text-xs font-bold mt-2 flex items-center gap-1.5" data-sub-id={`${block.block.id}-kpi`} data-sub-type="kpi" style={{ color: primaryColor }}>
                <span className="text-[10px]">📈</span> {renderInlineMarkdown(exp.kpi)}
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

  return (
    <div className="space-y-1" data-measure-id={block.block.id}>
      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
        {getSkillCategoryTitle(cat.category as SkillCategoryKey, language)}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {visibleSkills.map((skill) => (
          <span key={skill} className="text-[10px] text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
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
      <h2 className="text-gray-400 mb-3 font-bold uppercase tracking-wider" style={{ fontSize: '11px' }}>{getSectionTitle('education', language)}</h2>
      <div className="space-y-4">
        {educations.map((edu, idx) => {
          const lines = getEducationLines(edu, language);
          return (
            <div key={idx} data-cv-block="education">
              <p className="text-xs font-bold text-gray-900 uppercase">{lines.degree}</p>
              <p className="text-[10px] text-gray-500">{[lines.school, lines.date].filter(Boolean).join(' • ')}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LanguagesBlock({ block, designSettings, language }: BlockRendererProps) {
  const languages = block.block.data as Language[];

  return (
    <section data-cv-section="languages" data-measure-id={block.block.id} className="mt-auto">
      <h2 className="text-gray-400 mb-3 text-center font-bold uppercase tracking-wider" style={{ fontSize: '11px' }}>{getSectionTitle('languages', language)}</h2>
      <div className="flex justify-center gap-12">
        {languages.map((lang, idx) => (
          <div key={idx} className="text-center">
            <p className="text-xs font-bold text-gray-900 uppercase">{lang.name}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">{normalizeProficiency(lang.proficiency, language)}</p>
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
