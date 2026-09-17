// ─── TemplateE Block Renderers ───
// Individual block-level renderers for the Elegant template.
// Used by PaginatedCV to render each block independently.

import { cn } from '@/src/shared/lib/cn';
import { renderInlineMarkdown } from '@/src/shared/lib/inlineMarkdown';
import type { BlockRendererMap, BlockRendererProps } from '../../lib/pagination/types';
import { renderPhoto, isKPIInRange, CompanyTags, getSlicedBullets, getContactEntries, renderContactValue, getEducationLines } from '../shared';
import { getVisibleSkills } from '../../lib/displayModes';
import { formatDateShort, getCurrentLabel, localizeLanguageName, normalizeProficiency } from '../../lib/formatting';
import { getShortSectionTitle, getSkillCategoryTitle } from '../../lib/atsRules';
import type { SkillCategoryKey } from '../../lib/skillDictionary';
import type { Experience, SkillCategory, Education, Language, PersonalInfo, CVData } from '@/src/shared/types';

// ─── Helpers ───

function getSectionHeader(title: string, primaryColor: string) {
  return (
    <div className="flex items-center gap-4 mb-3">
      <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>{title}</h2>
      <div className="flex-1 h-[2px]" style={{ backgroundColor: `${primaryColor}20` }} />
    </div>
  );
}

// ─── Block Renderers ───

function HeaderBlock({ block, designSettings }: BlockRendererProps) {
  const data = block.block.data as PersonalInfo;
  const { primaryColor } = designSettings;
  const showPhoto = designSettings.showPhoto;
  const cvDataShim = { personal_info: data } as CVData;

  return (
    <div data-cv-section="header" className="flex justify-between items-start mb-3">
      <div className="flex gap-4 items-center">
        {renderPhoto(cvDataShim, showPhoto, "w-20 h-20 rounded-xl border-2 border-gray-100")}
        <div className="space-y-0.5">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: primaryColor }}>{data?.name}</h1>
          {/* A colour, never opacity: a transparent box is painted after its
              in-flow siblings, and the PDF then carries its text out of order */}
          <p className="text-sm font-medium tracking-wide uppercase text-gray-700">{data?.title}</p>
        </div>
      </div>
      {/* gray-600, not gray-500: 10px text below 4.5:1 is unreadable printed */}
      <div className="text-[10px] text-right space-y-0.5 text-gray-600 shrink-0">
        {getContactEntries(data).map(entry => (
          <p key={entry.key}>
            {renderContactValue(entry, { color: primaryColor })}
          </p>
        ))}
      </div>
    </div>
  );
}

function SummaryBlock({ block, designSettings, language }: BlockRendererProps) {
  const summary = block.block.data as string;
  const { primaryColor } = designSettings;

  return (
    <section data-cv-section="summary">
      {getSectionHeader(getShortSectionTitle('summary', language), primaryColor)}
      <p className="text-sm text-gray-600 leading-relaxed">{renderInlineMarkdown(summary)}</p>
    </section>
  );
}

function ExperienceBlock({ block, designSettings, language }: BlockRendererProps) {
  const exp = block.block.data as Experience;
  const { primaryColor, secondaryColor } = designSettings;
  const { intro, bullets, bulletOffset } = getSlicedBullets(exp, block);
  const isOverflow = (block.startSubBlock ?? 0) > 0;

  return (
    <div data-cv-block="experience" data-measure-id={block.block.id}>
      {!isOverflow && (
        <div className="pl-6 border-l-2" style={{ borderColor: `${secondaryColor}30` }} data-sub-id={`${block.block.id}-header`} data-sub-type="exp-header">
          {/* The timeline dot hangs off an empty box of its own: positioning the
              header itself made the PDF carry the position, employer and dates
              after every bullet of the job */}
          <div className="relative">
            <div className="absolute -left-[29px] top-0 w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
          </div>
          <div className="flex justify-between items-start gap-4 mb-2">
            <h3 className="font-bold text-gray-900">{exp.position}</h3>
            <div className="text-[10px] font-bold text-gray-600 shrink-0 text-right leading-tight">
              <div>{formatDateShort(exp.start_date, language)}</div>
              <div>{exp.current ? getCurrentLabel(language).toUpperCase() : formatDateShort(exp.end_date, language)}</div>
            </div>
          </div>
          <p className="text-xs font-bold mb-3" style={{ color: secondaryColor }}>
            {exp.company}
            <CompanyTags stage={exp.companyStage} businessModel={exp.companyBusinessModel} language={language} />
          </p>
          {intro && <p className="text-sm text-gray-600 leading-relaxed">{renderInlineMarkdown(intro)}</p>}
        </div>
      )}
      {isOverflow && (
        <div className="pl-6 border-l-2" style={{ borderColor: `${secondaryColor}30` }}>
          {/* Continuation of experience from previous page */}
        </div>
      )}
      {bullets.length > 0 && (
        <ul className={cn("space-y-1.5 mt-1.5", !isOverflow && "pl-6 border-l-2")} style={!isOverflow ? { borderColor: `${secondaryColor}30` } : undefined}>
          {bullets.map((bullet, bIdx) => (
            <li key={bIdx} className="text-sm text-gray-600 leading-relaxed flex gap-3" data-sub-id={`${block.block.id}-bullet-${bulletOffset + bIdx}`} data-sub-type="bullet">
              <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: secondaryColor }} />
              {renderInlineMarkdown(bullet)}
            </li>
          ))}
        </ul>
      )}
      {isKPIInRange(exp, block) && (
        <p className="text-xs font-bold mt-2 pl-6 flex items-center gap-1.5" data-sub-id={`${block.block.id}-kpi`} data-sub-type="kpi" style={{ color: primaryColor }}>
          <span className="text-[10px]">📈</span> {renderInlineMarkdown(exp.kpi)}
        </p>
      )}
    </div>
  );
}

function SkillCategoryBlock({ block, designSettings, language }: BlockRendererProps) {
  const cat = block.block.data as SkillCategory;
  const visibleSkills = getVisibleSkills(cat);

  if (visibleSkills.length === 0) return null;

  return (
    <div data-measure-id={block.block.id}>
      <p className="text-[10px] font-bold uppercase mb-1 text-gray-600">
        {getSkillCategoryTitle(cat.category as SkillCategoryKey, language)}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {visibleSkills.map((skill) => (
          <span key={skill} className="text-xs text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
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

  return (
    <section data-cv-section="education" data-measure-id={block.block.id}>
      {getSectionHeader(getShortSectionTitle('education', language), primaryColor)}
      <div className="space-y-4">
        {educations.map((edu, idx) => {
          const lines = getEducationLines(edu, language);
          return (
            <div key={idx} data-cv-block="education">
              <p className="text-sm font-bold text-gray-900">{lines.degree}</p>
              <p className="text-xs text-gray-500">{[lines.school, lines.date].filter(Boolean).join(' | ')}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LanguagesBlock({ block, designSettings, language }: BlockRendererProps) {
  const languages = block.block.data as Language[];
  const { primaryColor } = designSettings;

  return (
    <section data-cv-section="languages" data-measure-id={block.block.id}>
      {getSectionHeader(getShortSectionTitle('languages', language), primaryColor)}
      <div className="flex flex-wrap gap-x-12 gap-y-4">
        {languages.map((lang, idx) => (
          <div key={idx} className="flex flex-col">
            <span className="text-sm font-bold text-gray-900">{localizeLanguageName(lang.name, language)}</span>
            <span className="text-[10px] font-bold uppercase text-gray-600">{normalizeProficiency(lang.proficiency, language)}</span>
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
