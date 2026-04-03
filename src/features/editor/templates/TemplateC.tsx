import { Mail, Phone, MapPin, Linkedin, User } from 'lucide-react';
import { cn } from '@/src/shared/lib/cn';
import type { TemplateProps } from './shared';
import { useSectionTitleClasses, getFontClass, getIncludedSections, renderPhoto, renderExperienceContent } from './shared';
import { getIntro, getActionBullets, isHidden, isSkillHidden, getVisibleSkills } from '../lib/displayModes';
import { formatDateShort, normalizeProficiency } from '../lib/scoring';

export function TemplateC({ cvData, designSettings }: TemplateProps) {
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
    <div style={commonStyles} className={cn("w-full h-full bg-white px-16 pt-16 pb-20 space-y-8 pdf-safe", fontClass)}>
      {includedSections.includes('personal') && (
        <header className="text-center space-y-4 flex flex-col items-center">
          {renderPhoto(cvData, showPhoto, "w-24 h-24 rounded-full mb-2 border-2 border-gray-100")}
          <h1 className="text-5xl font-light tracking-tight" style={{ color: primaryColor }}>{cvData.personal_info?.name}</h1>
          <p className="text-sm uppercase tracking-[0.3em] text-gray-500">{cvData.personal_info?.title}</p>
          <div className="flex justify-center gap-6 text-[10px] font-mono text-gray-400 uppercase tracking-widest">
            <span>{cvData.personal_info?.email}</span>
            {cvData.personal_info?.phone && <span>{cvData.personal_info?.phone}</span>}
            {cvData.personal_info?.location && <span>{cvData.personal_info?.location}</span>}
          </div>
        </header>
      )}

      <div className="space-y-8">
        {includedSections.includes('summary') && cvData.personal_info?.summary && (
          <section data-cv-section="summary" className="max-w-2xl mx-auto text-center">
            <h2 className={cn("text-gray-300 mb-4", sectionTitleClasses)} style={{ fontSize: '11px' }}>Profil</h2>
            <p className="text-sm text-gray-600 leading-relaxed italic">"{cvData.personal_info?.summary}"</p>
          </section>
        )}

        {includedSections.includes('experience') && (
          <section data-cv-section="experience">
            <h2 className={cn("text-gray-300 mb-8 text-center", sectionTitleClasses)} style={{ fontSize: '11px' }}>Expérience</h2>
            <div className="space-y-10">
              {cvData.experience?.filter(e => (e.displayMode || "normal") !== "hidden").map((exp, idx) => (
                <div key={idx} data-cv-block="experience" className="grid grid-cols-[120px_1fr] gap-8">
                  <div className="text-[10px] font-mono text-gray-400 pt-1">
                    {formatDateShort(exp.start_date)} — {exp.current ? 'PRESENT' : formatDateShort(exp.end_date)}
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-gray-900 uppercase tracking-tight">{exp.position}</h3>
                    <p className="text-xs font-medium" style={{ color: secondaryColor }}>{exp.company}</p>
                    <div className="pt-2">
                      {renderExperienceContent(
                        exp,
                        getIntro(exp),
                    getActionBullets(exp),
                        <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: secondaryColor }} />,
                        primaryColor,
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section data-cv-section="skills" className="grid grid-cols-2 gap-8">
          {includedSections.includes('skills') && cvData.skills?.some(cat => (cat.displayMode || 'normal') !== 'hidden') && (
            <div>
              <h2 className={cn("text-gray-300 mb-4", sectionTitleClasses)} style={{ fontSize: '11px' }}>Compétences</h2>
              <div className="space-y-3">
                {cvData.skills?.filter(cat => (cat.displayMode || "normal") !== "hidden").map((cat, idx) => (
                  <div key={idx} className="space-y-1">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{cat.category}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {getVisibleSkills(cat).map(skill => (
                        <span key={skill} className="text-[10px] text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{skill}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {includedSections.includes('education') && (
            <div>
              <h2 className={cn("text-gray-300 mb-6", sectionTitleClasses)} style={{ fontSize: '11px' }}>Formation</h2>
              <div className="space-y-4">
                {cvData.education?.map((edu, idx) => (
                  <div key={idx}>
                    <p className="text-xs font-bold text-gray-900 uppercase">{edu.degree}</p>
                    <p className="text-[10px] text-gray-500">{edu.school} • {edu.end_date}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {includedSections.includes('languages') && (cvData.languages?.length || 0) > 0 && (
          <section data-cv-section="languages">
            <h2 className={cn("text-gray-300 mb-6 text-center", sectionTitleClasses)} style={{ fontSize: '11px' }}>Langues</h2>
            <div className="flex justify-center gap-12">
              {cvData.languages?.map((lang, idx) => (
                <div key={idx} className="text-center">
                  <p className="text-xs font-bold text-gray-900 uppercase">{lang.name}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest">{normalizeProficiency(lang.proficiency)}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
