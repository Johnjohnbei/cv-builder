import { Mail, Phone, MapPin, Linkedin, User } from 'lucide-react';
import { cn } from '@/src/shared/lib/cn';
import type { TemplateProps } from './shared';
import { useSectionTitleClasses, getFontClass, getIncludedSections, renderPhoto, renderExperienceContent } from './shared';
import { getIntro, getActionBullets, isHidden, isSkillHidden, getVisibleSkills } from '../lib/displayModes';
import { formatDateShort, normalizeProficiency } from '../lib/scoring';

export function TemplateB({ cvData, designSettings }: TemplateProps) {
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
    <div style={commonStyles} className={cn("w-full h-full bg-white grid grid-cols-[1fr_2fr] pdf-safe", fontClass)}>
      <div className="p-12 flex flex-col justify-between" style={{ backgroundColor: primaryColor, color: '#ffffff' }}>
        <div>
          {includedSections.includes('personal') && (
            <>
              {showPhoto && cvData.personal_info?.photo_url ? (
                renderPhoto(cvData, showPhoto, "w-24 h-24 rounded-full mb-8 border-2 border-white/20")
              ) : (
                <div className="w-24 h-24 rounded-full mb-8 flex items-center justify-center text-3xl font-bold bg-white/20">
                  {cvData.personal_info?.name?.charAt(0)}
                </div>
              )}
              <h1 className="text-2xl font-bold leading-tight mb-2">{cvData.personal_info?.name}</h1>
              <p className="font-medium text-sm mb-12 opacity-80">{cvData.personal_info?.title}</p>
            </>
          )}

          {includedSections.includes('summary') && cvData.personal_info?.summary && (
            <section data-cv-section="summary" className="mb-12">
              <h2 className={cn("opacity-60 mb-4", sectionTitleClasses)} style={{ fontSize: '10px' }}>Profil</h2>
              <p className="text-[11px] leading-relaxed opacity-90">{cvData.personal_info?.summary}</p>
            </section>
          )}

          <div className="space-y-6">
            {includedSections.includes('personal') && (
              <section data-cv-section="contact">
                <h2 className={cn("opacity-60 mb-4", sectionTitleClasses)} style={{ fontSize: '10px' }}>Contact</h2>
                <div className="space-y-3 text-[11px] opacity-90">
                  <div className="flex items-center gap-3"><Mail className="w-3 h-3" /> {cvData.personal_info?.email}</div>
                  {cvData.personal_info?.phone && <div className="flex items-center gap-3"><Phone className="w-3 h-3" /> {cvData.personal_info?.phone}</div>}
                  {cvData.personal_info?.location && <div className="flex items-center gap-3"><MapPin className="w-3 h-3" /> {cvData.personal_info?.location}</div>}
                </div>
              </section>
            )}

            {includedSections.includes('languages') && (cvData.languages?.length || 0) > 0 && (
              <section data-cv-section="languages">
                <h2 className={cn("opacity-60 mb-4", sectionTitleClasses)} style={{ fontSize: '10px' }}>Langues</h2>
                <div className="space-y-2">
                  {cvData.languages?.map((lang, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px]">
                      <span className="opacity-90">{lang.name}</span>
                      <span className="opacity-60 text-[9px] uppercase tracking-wider">{normalizeProficiency(lang.proficiency)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {includedSections.includes('skills') && (
              <section data-cv-section="skills">
                <h2 className={cn("opacity-60 mb-4", sectionTitleClasses)} style={{ fontSize: '10px' }}>Expertise</h2>
                <div className="space-y-4">
                  {cvData.skills?.filter(cat => (cat.displayMode || "normal") !== "hidden").map((cat, idx) => (
                    <div key={idx} className="space-y-2">
                      <h3 className="text-[9px] font-bold uppercase tracking-widest opacity-80">{cat.category}</h3>
                      <div className="flex flex-wrap gap-2">
                        {getVisibleSkills(cat).map(skill => (
                          <span key={skill} className="px-2 py-1 bg-white/10 text-white text-[9px] font-medium rounded">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <div className="p-16 space-y-12">
        {includedSections.includes('experience') && (
          <section data-cv-section="experience">
            <h2 className={cn("text-gray-900 flex items-center gap-3 mb-8", sectionTitleClasses)} style={{ fontSize: '1.125rem' }}>
              <span className="w-8 h-1 rounded-full" style={{ backgroundColor: secondaryColor }} />
              Expérience
            </h2>
            <div className="space-y-8">
              {cvData.experience?.filter(e => (e.displayMode || "normal") !== "hidden").map((exp, idx) => (
                <div key={idx} data-cv-block="experience" className="relative pl-8 border-l border-gray-100">
                  <div className="absolute -left-[5px] top-2 w-2 h-2 rounded-full" style={{ backgroundColor: secondaryColor }} />
                  <div className="flex justify-between items-baseline gap-4 mb-1">
                    <h3 className="font-bold text-gray-900">{exp.position}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 whitespace-nowrap" style={{ color: secondaryColor, backgroundColor: `${secondaryColor}10` }}>{formatDateShort(exp.start_date)} — {exp.current ? 'Présent' : formatDateShort(exp.end_date)}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-500 mb-3">{exp.company}</p>
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

        {includedSections.includes('education') && (
          <section data-cv-section="education">
            <h2 className={cn("text-gray-900 flex items-center gap-3 mb-8", sectionTitleClasses)} style={{ fontSize: '1.125rem' }}>
              <span className="w-8 h-1 rounded-full" style={{ backgroundColor: secondaryColor }} />
              Formation
            </h2>
            <div className="space-y-6">
              {cvData.education?.map((edu, idx) => (
                <div key={idx} className="space-y-1">
                  <p className="text-sm font-bold text-gray-900">{edu.degree}</p>
                  <p className="text-xs text-gray-500">{edu.school} • {edu.end_date}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
