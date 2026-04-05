import { Mail, Phone, MapPin, User } from 'lucide-react';
import { LinkedinIcon } from './shared';
import { cn } from '@/src/shared/lib/cn';
import type { TemplateProps } from './shared';
import { useSectionTitleClasses, getFontClass, getIncludedSections, renderPhoto, renderExperienceContent } from './shared';
import { getIntro, getActionBullets, isHidden, isSkillHidden, getVisibleSkills } from '../lib/displayModes';
import { formatDateShort, normalizeProficiency } from '../lib/scoring';

export function TemplateE({ cvData, designSettings }: TemplateProps) {
  const { primaryColor, secondaryColor } = designSettings;
  const fontClass = getFontClass(designSettings.fontFamily);
  const sectionTitleClasses = useSectionTitleClasses(designSettings);
  const includedSections = getIncludedSections(designSettings);
  const showPhoto = designSettings.showPhoto;

  const commonStyles = {
    '--primary': primaryColor,
    '--secondary': secondaryColor,
  } as React.CSSProperties;

  return (
    <div style={commonStyles} className={cn("w-full h-full bg-white px-16 pt-16 pb-20 pdf-safe", fontClass)}>
      {includedSections.includes('personal') && (
        <div className="flex justify-between items-start mb-12">
          <div className="flex gap-8 items-start">
            {renderPhoto(cvData, showPhoto, "w-24 h-24 rounded-xl border-2 border-gray-100")}
            <div className="space-y-1">
              <h1 className="text-5xl font-extrabold tracking-tight" style={{ color: primaryColor }}>{cvData.personal_info?.name}</h1>
              <p className="text-lg font-medium tracking-wide uppercase opacity-70">{cvData.personal_info?.title}</p>
            </div>
          </div>
          <div className="text-right text-xs space-y-1 opacity-60">
            <p>{cvData.personal_info?.email}</p>
            {cvData.personal_info?.phone && <p>{cvData.personal_info?.phone}</p>}
            {cvData.personal_info?.location && <p>{cvData.personal_info?.location}</p>}
            {cvData.personal_info?.linkedin && <p>{cvData.personal_info?.linkedin.replace(/^https?:\/\/(www\.)?/, '')}</p>}
          </div>
        </div>
      )}

      <div className="space-y-8">
        {includedSections.includes('summary') && cvData.personal_info?.summary && (
          <section data-cv-section="summary">
            <div className="flex items-center gap-4 mb-6">
              <h2 className={cn(sectionTitleClasses)} style={{ color: primaryColor, fontSize: '0.75rem' }}>Profil</h2>
              <div className="flex-1 h-[2px]" style={{ backgroundColor: `${primaryColor}20` }} />
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{cvData.personal_info?.summary}</p>
          </section>
        )}

        {includedSections.includes('experience') && (
          <section data-cv-section="experience">
            <div className="flex items-center gap-4 mb-6">
              <h2 className={cn(sectionTitleClasses)} style={{ color: primaryColor, fontSize: '0.75rem' }}>Expérience</h2>
              <div className="flex-1 h-[2px]" style={{ backgroundColor: `${primaryColor}20` }} />
            </div>
            <div className="space-y-8">
              {cvData.experience?.filter(e => (e.displayMode || "normal") !== "hidden").map((exp, idx) => (
                <div key={idx} data-cv-block="experience" className="relative pl-6 border-l-2" style={{ borderColor: `${secondaryColor}30` }}>
                  <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                  <div className="flex justify-between items-baseline gap-4 mb-2">
                    <h3 className="font-bold text-gray-900">{exp.position}</h3>
                    <span className="text-[10px] font-bold opacity-50 shrink-0 whitespace-nowrap">{formatDateShort(exp.start_date)} — {exp.current ? 'PRESENT' : formatDateShort(exp.end_date)}</span>
                  </div>
                  <p className="text-xs font-bold mb-3" style={{ color: secondaryColor }}>{exp.company}</p>
                  {renderExperienceContent(
                    exp,
                    getIntro(exp),
                    getActionBullets(exp),
                    <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: secondaryColor }} />,
                    primaryColor,
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-2 gap-12">
          {includedSections.includes('skills') && cvData.skills?.some(cat => (cat.displayMode || 'normal') !== 'hidden') && (
            <section data-cv-section="skills">
              <div className="flex items-center gap-4 mb-6">
                <h2 className={cn(sectionTitleClasses)} style={{ color: primaryColor, fontSize: '0.75rem' }}>Compétences</h2>
                <div className="flex-1 h-[2px]" style={{ backgroundColor: `${primaryColor}20` }} />
              </div>
              <div className="space-y-4">
                {cvData.skills?.filter(cat => (cat.displayMode || "normal") !== "hidden").map((cat, idx) => (
                  <div key={idx}>
                    <p className="text-[10px] font-bold uppercase mb-1 opacity-40">{cat.category}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {getVisibleSkills(cat).map(skill => (
                        <span key={skill} className="text-xs text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">{skill}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {includedSections.includes('education') && (
            <section data-cv-section="education">
              <div className="flex items-center gap-4 mb-6">
                <h2 className={cn(sectionTitleClasses)} style={{ color: primaryColor, fontSize: '0.75rem' }}>Formation</h2>
                <div className="flex-1 h-[2px]" style={{ backgroundColor: `${primaryColor}20` }} />
              </div>
              <div className="space-y-4">
                {cvData.education?.map((edu, idx) => (
                  <div key={idx}>
                    <p className="text-sm font-bold text-gray-900">{edu.degree}</p>
                    <p className="text-xs text-gray-500">{edu.school} | {edu.end_date}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {includedSections.includes('languages') && (cvData.languages?.length || 0) > 0 && (
          <section data-cv-section="languages">
            <div className="flex items-center gap-4 mb-6">
              <h2 className={cn(sectionTitleClasses)} style={{ color: primaryColor, fontSize: '0.75rem' }}>Langues</h2>
              <div className="flex-1 h-[2px]" style={{ backgroundColor: `${primaryColor}20` }} />
            </div>
            <div className="flex flex-wrap gap-x-12 gap-y-4">
              {cvData.languages?.map((lang, idx) => (
                <div key={idx} className="flex flex-col">
                  <span className="text-sm font-bold text-gray-900">{lang.name}</span>
                  <span className="text-[10px] font-bold uppercase opacity-40">{normalizeProficiency(lang.proficiency)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
