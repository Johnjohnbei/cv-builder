import { Mail, Phone, MapPin, Linkedin, User } from 'lucide-react';
import { cn } from '@/src/shared/lib/cn';
import type { TemplateProps } from './shared';
import { useSectionTitleClasses, getFontClass, getIncludedSections, renderPhoto, renderExperienceContent } from './shared';
import { getIntro, getActionBullets, isHidden, isSkillHidden, getVisibleSkills } from '../lib/displayModes';
import { formatDateShort, normalizeProficiency } from '../lib/scoring';

export function TemplateF({ cvData, designSettings }: TemplateProps) {
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
    <div style={commonStyles} className={cn("w-full h-full bg-white grid grid-cols-[260px_1fr] pdf-safe", fontClass)}>
      <aside className="p-12 border-r border-gray-100 space-y-8" style={{ backgroundColor: `${primaryColor}05` }}>
        {includedSections.includes('personal') && (
          <div className="space-y-4">
            {showPhoto && cvData.personal_info?.photo_url ? (
              renderPhoto(cvData, showPhoto, "w-20 h-20 rounded-full border-2 border-white")
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                <User className="w-10 h-10 text-gray-400" />
              </div>
            )}
            <div className="space-y-1">
              <h1 className="text-2xl font-bold leading-tight" style={{ color: primaryColor }}>{cvData.personal_info?.name}</h1>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">{cvData.personal_info?.title}</p>
            </div>
          </div>
        )}

        {includedSections.includes('personal') && (
          <section data-cv-section="contact" className="space-y-4">
            <h2 className={cn("border-b pb-2", sectionTitleClasses)} style={{ color: primaryColor, borderColor: `${primaryColor}20`, fontSize: '10px' }}>Contact</h2>
            <div className="space-y-3 text-[11px] text-gray-600">
              <p className="flex items-center gap-2"><Mail className="w-3 h-3" /> {cvData.personal_info?.email}</p>
              {cvData.personal_info?.phone && <p className="flex items-center gap-2"><Phone className="w-3 h-3" /> {cvData.personal_info?.phone}</p>}
              {cvData.personal_info?.location && <p className="flex items-center gap-2"><MapPin className="w-3 h-3" /> {cvData.personal_info?.location}</p>}
            </div>
          </section>
        )}

        {includedSections.includes('skills') && cvData.skills?.some(cat => (cat.displayMode || 'normal') !== 'hidden') && (
          <section data-cv-section="skills" className="space-y-4">
            <h2 className={cn("border-b pb-2", sectionTitleClasses)} style={{ color: primaryColor, borderColor: `${primaryColor}20`, fontSize: '10px' }}>Compétences</h2>
            <div className="space-y-4">
              {cvData.skills?.filter(cat => (cat.displayMode || "normal") !== "hidden").map((cat, idx) => (
                <div key={idx} className="space-y-1">
                  <p className="text-[9px] font-bold text-gray-400 uppercase">{cat.category}</p>
                  <div className="flex flex-wrap gap-1">
                    {getVisibleSkills(cat).map(skill => (
                      <span key={skill} className="px-2 py-0.5 bg-white border border-gray-200 rounded-full text-[9px] text-gray-600">{skill}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {includedSections.includes('education') && (
          <section data-cv-section="education" className="space-y-4">
            <h2 className={cn("border-b pb-2", sectionTitleClasses)} style={{ color: primaryColor, borderColor: `${primaryColor}20`, fontSize: '10px' }}>Formation</h2>
            <div className="space-y-4">
              {cvData.education?.map((edu, idx) => (
                <div key={idx} className="space-y-0.5">
                  <p className="text-[11px] font-bold text-gray-900">{edu.degree}</p>
                  <p className="text-[10px] text-gray-500">{edu.school}</p>
                  <p className="text-[9px] font-mono text-gray-400">{edu.end_date}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {includedSections.includes('languages') && (cvData.languages?.length || 0) > 0 && (
          <section data-cv-section="languages" className="space-y-4">
            <h2 className={cn("border-b pb-2", sectionTitleClasses)} style={{ color: primaryColor, borderColor: `${primaryColor}20`, fontSize: '10px' }}>Langues</h2>
            <div className="space-y-3">
              {cvData.languages?.map((lang, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-gray-900">{lang.name}</span>
                  <span className="text-[9px] uppercase tracking-widest text-gray-400">{normalizeProficiency(lang.proficiency)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>

      <main className="p-12 space-y-8">
        {includedSections.includes('summary') && cvData.personal_info?.summary && (
          <section data-cv-section="summary" className="space-y-4">
            <div className="flex items-center gap-4">
              <h2 className={cn(sectionTitleClasses)} style={{ color: primaryColor, fontSize: '0.875rem' }}>Profil</h2>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{cvData.personal_info?.summary}</p>
          </section>
        )}

        {includedSections.includes('experience') && (
          <section data-cv-section="experience" className="space-y-8">
            <div className="flex items-center gap-4">
              <h2 className={cn(sectionTitleClasses)} style={{ color: primaryColor, fontSize: '0.875rem' }}>Expérience</h2>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="space-y-10">
              {cvData.experience?.filter(e => (e.displayMode || "normal") !== "hidden").map((exp, idx) => (
                <div key={idx} data-cv-block="experience" className="space-y-3">
                  <div className="flex justify-between items-baseline gap-4">
                    <h3 className="text-lg font-bold text-gray-900 min-w-0">{exp.position}</h3>
                    <span className="text-[10px] font-bold text-gray-400 shrink-0 whitespace-nowrap">{formatDateShort(exp.start_date)} — {exp.current ? 'PRESENT' : formatDateShort(exp.end_date)}</span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: secondaryColor }}>{exp.company}</p>
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
      </main>
    </div>
  );
}
