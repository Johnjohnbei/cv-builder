// ─── TemplateF Block Renderers ───
// Individual block-level renderers for the Sidebar template.
// Used by PaginatedCV to render each block independently.

import { Mail, Phone, MapPin, User } from 'lucide-react';
import { LinkedinIcon } from '../shared';
import { cn } from '@/src/shared/lib/cn';
import type { BlockRendererMap, BlockRendererProps, PlacedBlock } from '../../lib/pagination/types';
import { renderPhoto } from '../shared';
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

function getSidebarSectionHeader(title: string, primaryColor: string) {
  return (
    <h2 className="border-b pb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: primaryColor, borderColor: `${primaryColor}20` }}>
      {title}
    </h2>
  );
}

// ─── Block Renderers ───

function HeaderBlock({ block, designSettings }: BlockRendererProps) {
  const data = block.block.data as PersonalInfo;
  const { primaryColor } = designSettings;
  const showPhoto = designSettings.showPhoto;
  const cvDataShim = { personal_info: data } as CVData;

  return (
    <div data-cv-section="header" className="space-y-3">
      {showPhoto && data?.photo_url ? (
        renderPhoto(cvDataShim, showPhoto, "w-20 h-20 rounded-full border-2 border-white")
      ) : (
        <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
          <User className="w-10 h-10 text-gray-500" />
        </div>
      )}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold leading-tight" style={{ color: primaryColor }}>{data?.name}</h1>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">{data?.title}</p>
      </div>

      {/* Contact info in sidebar with icons */}
      <div className="space-y-2 text-[11px] text-gray-600 pt-2">
        {getSidebarSectionHeader('Contact', primaryColor)}
        <div className="space-y-2 pt-1">
          {data?.email && <p className="flex items-center gap-2"><Mail className="w-3 h-3" /> {data.email}</p>}
          {data?.phone && <p className="flex items-center gap-2"><Phone className="w-3 h-3" /> {data.phone}</p>}
          {data?.location && <p className="flex items-center gap-2"><MapPin className="w-3 h-3" /> {data.location}</p>}
          {data?.linkedin && <p className="flex items-center gap-2"><LinkedinIcon className="w-3 h-3" /> {data.linkedin.replace(/^https?:\/\/(www\.)?/, '')}</p>}
        </div>
      </div>
    </div>
  );
}

function SummaryBlock({ block, designSettings }: BlockRendererProps) {
  const summary = block.block.data as string;
  const { primaryColor } = designSettings;

  return (
    <section data-cv-section="summary" className="space-y-2">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: primaryColor }}>{getSectionTitle('summary', 'fr')}</h2>
        <div className="flex-1 h-px bg-gray-100" />
      </div>
      <p className="text-sm text-gray-600 leading-relaxed">{summary}</p>
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
        <div className="space-y-3">
          <div className="flex justify-between items-baseline gap-4" data-sub-id={`${block.block.id}-header`} data-sub-type="exp-header">
            <h3 className="text-lg font-bold text-gray-900 min-w-0">{exp.position}</h3>
            <span className="text-[10px] font-bold text-gray-500 shrink-0 whitespace-nowrap">
              {formatDateShort(exp.start_date)} — {exp.current ? 'PRESENT' : formatDateShort(exp.end_date)}
            </span>
          </div>
          <p className="text-sm font-medium" style={{ color: secondaryColor }}>{exp.company}</p>
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
    <div className="space-y-1" data-measure-id={block.block.id}>
      {!isOverflow && (
        <p className="text-[9px] font-bold text-gray-500 uppercase" data-sub-id={`${block.block.id}-title`} data-sub-type="skill-title">
          {getSkillCategoryTitle(cat.category as SkillCategoryKey, language)}
        </p>
      )}
      <div className="flex flex-wrap gap-1">
        {displaySkills.map((skill, i) => (
          <span key={skill} className="px-2 py-0.5 bg-white border border-gray-200 rounded-full text-[9px] text-gray-600" data-sub-id={`${block.block.id}-item-${i}`} data-sub-type="skill-row">
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
      {getSidebarSectionHeader(getSectionTitle('education', language), primaryColor)}
      <div className="space-y-4 pt-2">
        {educations.map((edu, idx) => (
          <div key={idx} className="space-y-0.5" data-cv-block="education">
            <p className="text-[11px] font-bold text-gray-900">{edu.degree}</p>
            <p className="text-[10px] text-gray-500">{edu.school}</p>
            <p className="text-[9px] font-mono text-gray-500">{edu.end_date}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LanguagesBlock({ block, designSettings, language }: BlockRendererProps) {
  const languages = block.block.data as Language[];
  const { primaryColor } = designSettings;

  return (
    <section data-cv-section="languages" data-measure-id={block.block.id}>
      {getSidebarSectionHeader(getSectionTitle('languages', language), primaryColor)}
      <div className="space-y-3 pt-2">
        {languages.map((lang, idx) => (
          <div key={idx} className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-gray-900">{lang.name}</span>
            <span className="text-[9px] uppercase tracking-widest text-gray-500">{normalizeProficiency(lang.proficiency)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Registry ───

export const templateFRenderers: BlockRendererMap = {
  header: (props) => <HeaderBlock {...props} />,
  summary: (props) => <SummaryBlock {...props} />,
  experience: (props) => <ExperienceBlock {...props} />,
  'skill-category': (props) => <SkillCategoryBlock {...props} />,
  education: (props) => <EducationBlock {...props} />,
  languages: (props) => <LanguagesBlock {...props} />,
};
