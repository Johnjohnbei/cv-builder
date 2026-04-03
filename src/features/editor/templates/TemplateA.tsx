import { Mail, Phone, MapPin, Linkedin } from 'lucide-react';
import { cn } from '@/src/shared/lib/cn';
import type { TemplateProps } from './shared';
import { useSectionTitleClasses, getFontClass, getIncludedSections, renderPhoto } from './shared';
import { getVisibleBullets, getIntro, getActionBullets, shouldShowKPI, isCompact, isHidden, isSkillHidden, getVisibleSkills } from '../lib/displayModes';
import { formatDateShort, normalizeProficiency } from '../lib/scoring';
import type { Experience } from '@/src/shared/types';

export function TemplateA({ cvData, designSettings }: TemplateProps) {
  const { primaryColor, secondaryColor } = designSettings;
  const fontClass = getFontClass(designSettings.fontFamily);
  const sectionTitleClasses = useSectionTitleClasses(designSettings);
  const includedSections = getIncludedSections(designSettings);
  const showPhoto = designSettings.showPhoto;

  const commonStyles = {
    '--primary': primaryColor,
    '--secondary': secondaryColor,
  } as React.CSSProperties;

  // ─── Reusable experience block ───
  const renderExperience = (exp: Experience, idx: number) => {
    const intro = getIntro(exp);
    const bullets = getActionBullets(exp);
    return (
      <div key={idx} data-cv-block="experience">
        <div className="flex justify-between items-baseline gap-4 mb-1">
          <h3 className="font-bold text-gray-900 min-w-0">{exp.position}</h3>
          <span className="text-xs text-gray-500 font-mono shrink-0 whitespace-nowrap">{formatDateShort(exp.start_date)} — {exp.current ? 'Présent' : formatDateShort(exp.end_date)}</span>
        </div>
        <p className="text-sm font-bold mb-2" style={{ color: secondaryColor }}>{exp.company}</p>
        {intro && (
          <p className="text-sm text-gray-600 leading-relaxed">{intro}</p>
        )}
        {bullets.length > 0 && (
          <ul className="space-y-1.5 mt-1.5">
            {bullets.map((bullet, bIdx) => (
              <li key={bIdx} className="text-sm text-gray-600 leading-relaxed flex gap-3">
                <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: secondaryColor }} />
                {bullet}
              </li>
            ))}
          </ul>
        )}
        {shouldShowKPI(exp) && (
          <p className="text-xs font-bold mt-2 flex items-center gap-1.5" style={{ color: primaryColor }}>
            <span className="text-[10px]">📈</span> {exp.kpi}
              </p>
            )}
      </div>
    );
  };

  // ─── Section fragments ───
  const experienceSection = includedSections.includes('experience') && (
    <section data-cv-section="experience">
      <h2 className={cn("text-sm border-b pb-2 mb-4", sectionTitleClasses)} style={{ color: primaryColor, borderColor: `${primaryColor}20` }}>Expérience Professionnelle</h2>
      <div className="space-y-6">
        {cvData.experience?.filter(exp => !isHidden(exp)).map((exp, idx) => renderExperience(exp, idx))}
      </div>
    </section>
  );

  const summarySection = includedSections.includes('summary') && cvData.personal_info?.summary && (
    <section data-cv-section="summary">
      <h2 className={cn("text-sm border-b pb-2 mb-4", sectionTitleClasses)} style={{ color: primaryColor, borderColor: `${primaryColor}20` }}>Profil</h2>
      <p className="text-sm text-gray-600 leading-relaxed">{cvData.personal_info.summary}</p>
    </section>
  );

  const sidebarContent = (
    <div className="space-y-8">
      {includedSections.includes('skills') && (
        <section data-cv-section="skills">
          <h2 className={cn("text-sm border-b pb-2 mb-4", sectionTitleClasses)} style={{ color: primaryColor, borderColor: `${primaryColor}20` }}>Compétences</h2>
          <div className="space-y-4">
            {cvData.skills?.filter(cat => !isSkillHidden(cat)).map((cat, idx) => (
              <div key={idx} className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: secondaryColor }}>{cat.category}</h3>
                <div className="flex flex-wrap gap-2">
                  {getVisibleSkills(cat).map(skill => (
                    <span key={skill} className="px-2 py-1 bg-gray-100 text-gray-700 text-[10px] font-bold rounded uppercase tracking-wider">{skill}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {includedSections.includes('education') && (
        <section data-cv-section="education">
          <h2 className={cn("text-sm border-b pb-2 mb-4", sectionTitleClasses)} style={{ color: primaryColor, borderColor: `${primaryColor}20` }}>Formation</h2>
          <div className="space-y-4">
            {cvData.education?.map((edu, idx) => (
              <div key={idx} className="space-y-1" data-cv-block="education">
                <p className="text-xs font-bold">{edu.degree}</p>
                <p className="text-[10px] text-gray-500">{edu.school} • {edu.end_date}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {includedSections.includes('languages') && (cvData.languages?.length || 0) > 0 && (
        <section data-cv-section="languages">
          <h2 className={cn("text-sm border-b pb-2 mb-4", sectionTitleClasses)} style={{ color: primaryColor, borderColor: `${primaryColor}20` }}>Langues</h2>
          <div className="space-y-2">
            {cvData.languages?.map((lang, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="text-xs font-medium text-gray-700">{lang.name}</span>
                <span className="text-[10px] text-gray-500 font-mono uppercase tracking-tighter">{normalizeProficiency(lang.proficiency)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  // ─── Layout: conditional on pageLimit ───
  return (
    <div style={commonStyles} className={cn("w-full h-full bg-white px-16 pt-16 pb-20 pdf-safe", fontClass)}>
      {/* Header */}
      {includedSections.includes('personal') && (
        <div data-cv-section="header" className="border-b-2 pb-8 mb-8 flex justify-between items-start" style={{ borderColor: primaryColor }}>
          <div className="flex-1">
            <h1 className="text-4xl font-bold tracking-tighter uppercase" style={{ color: primaryColor }}>{cvData.personal_info?.name}</h1>
            <p className="text-xl font-medium mt-1 text-gray-600">{cvData.personal_info?.title}</p>
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-500 font-mono">
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {cvData.personal_info?.email}</span>
              {cvData.personal_info?.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {cvData.personal_info?.phone}</span>}
              {cvData.personal_info?.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {cvData.personal_info?.location}</span>}
              {cvData.personal_info?.linkedin && <span className="flex items-center gap-1"><Linkedin className="w-3 h-3" /> {cvData.personal_info?.linkedin.replace(/^https?:\/\/(www\.)?/, '')}</span>}
            </div>
          </div>
          {renderPhoto(cvData, showPhoto, "w-28 h-28 rounded-lg border-2 border-gray-100")}
        </div>
      )}

      {/* Grid layout: profil + experiences left, sidebar right */}
      <div className="grid grid-cols-3 gap-12">
        <div className="col-span-2 space-y-8">
          {summarySection}
          {experienceSection}
        </div>
        <div className="col-span-1">{sidebarContent}</div>
      </div>
    </div>
  );
}
