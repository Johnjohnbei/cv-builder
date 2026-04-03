import { Mail, Phone, MapPin, Linkedin, User } from 'lucide-react';
import { cn } from '@/src/shared/lib/cn';
import type { TemplateProps } from './shared';
import { useSectionTitleClasses, getFontClass, getIncludedSections, renderPhoto, renderExperienceBullets } from './shared';
import { getVisibleBullets, isHidden, isSkillHidden, getVisibleSkills } from '../lib/displayModes';
import { formatDateShort } from '../lib/scoring';

export function TemplateD({ cvData, designSettings }: TemplateProps) {
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
    <div style={commonStyles} className={cn("w-full h-full bg-[#FDFCFB] p-0 pdf-safe", fontClass)}>
      {includedSections.includes('personal') && (
        <div className="p-16 pb-8" style={{ backgroundColor: `${primaryColor}10` }}>
          <div className="flex justify-between items-start">
            <div className="flex gap-8 items-start">
              {renderPhoto(cvData, showPhoto, "w-32 h-32 rounded-none border-4 border-black")}
              <div className="space-y-2">
                <h1 className="text-6xl font-black italic tracking-tighter" style={{ color: primaryColor }}>{cvData.personal_info?.name?.split(' ')[0]}<br/>{cvData.personal_info?.name?.split(' ')[1]}</h1>
                <p className="text-xl font-bold uppercase tracking-widest" style={{ color: secondaryColor }}>{cvData.personal_info?.title}</p>
              </div>
            </div>
            <div className="text-right space-y-1 text-xs font-bold stitch-mono">
              <p>{cvData.personal_info?.email}</p>
              {cvData.personal_info?.phone && <p>{cvData.personal_info?.phone}</p>}
              {cvData.personal_info?.location && <p>{cvData.personal_info?.location}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="p-16 pt-12 grid grid-cols-[2fr_1fr] gap-16">
        <div className="space-y-12">
          {includedSections.includes('summary') && cvData.personal_info?.summary && (
            <section data-cv-section="summary">
              <div className="flex items-center gap-4 mb-6">
                <h2 className={cn("italic", sectionTitleClasses)} style={{ color: primaryColor, fontSize: '1.5rem' }}>Profil</h2>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <p className="text-sm text-gray-700 leading-relaxed font-medium">{cvData.personal_info?.summary}</p>
            </section>
          )}

          {includedSections.includes('experience') && (
            <section data-cv-section="experience">
              <div className="flex items-center gap-4 mb-8">
                <h2 className={cn("italic", sectionTitleClasses)} style={{ color: primaryColor, fontSize: '1.5rem' }}>Expérience</h2>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="space-y-12">
                {cvData.experience?.filter(e => (e.displayMode || "normal") !== "hidden").map((exp, idx) => (
                  <div key={idx} data-cv-block="experience" className="space-y-3">
                    <div className="flex justify-between items-baseline">
                      <h3 className="text-lg font-black uppercase tracking-tight">{exp.position}</h3>
                      <span className="text-[11px] font-bold stitch-mono px-3 py-1 shrink-0 whitespace-nowrap" style={{ backgroundColor: '#000', color: '#fff' }}>{formatDateShort(exp.start_date)} — {exp.current ? 'NOW' : formatDateShort(exp.end_date)}</span>
                    </div>
                    <p className="text-sm font-bold italic" style={{ color: secondaryColor }}>{exp.company}</p>
                    {renderExperienceBullets(
                      exp,
                      getVisibleBullets(exp),
                      <span className="font-bold" style={{ color: primaryColor }}>/</span>,
                      primaryColor,
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-12">
          {includedSections.includes('skills') && (
            <section data-cv-section="skills">
              <h2 className={cn("italic mb-6 underline decoration-4 underline-offset-4", sectionTitleClasses)} style={{ textDecorationColor: secondaryColor, fontSize: '1.125rem' }}>Compétences</h2>
              <div className="space-y-6">
                {cvData.skills?.filter(cat => (cat.displayMode || "normal") !== "hidden").map((cat, idx) => (
                  <div key={idx} className="space-y-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{cat.category}</h3>
                    <div className="flex flex-wrap gap-2">
                      {getVisibleSkills(cat).map(skill => (
                        <span key={skill} className="px-2 py-1 border-2 border-black text-[10px] font-black uppercase hover:bg-black hover:text-white transition-colors">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {includedSections.includes('education') && (
            <section data-cv-section="education">
              <h2 className={cn("italic mb-6 underline decoration-4 underline-offset-4", sectionTitleClasses)} style={{ textDecorationColor: secondaryColor, fontSize: '1.125rem' }}>Formation</h2>
              <div className="space-y-6">
                {cvData.education?.map((edu, idx) => (
                  <div key={idx} className="space-y-1">
                    <p className="text-sm font-black uppercase">{edu.degree}</p>
                    <p className="text-xs font-bold text-gray-500 italic">{edu.school}</p>
                    <p className="text-[10px] font-bold stitch-mono">{edu.end_date}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {includedSections.includes('languages') && (cvData.languages?.length || 0) > 0 && (
            <section data-cv-section="languages">
              <h2 className={cn("italic mb-6 underline decoration-4 underline-offset-4", sectionTitleClasses)} style={{ textDecorationColor: secondaryColor, fontSize: '1.125rem' }}>Langues</h2>
              <div className="space-y-4">
                {cvData.languages?.map((lang, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="text-sm font-black uppercase">{lang.name}</span>
                    <span className="text-[10px] font-bold stitch-mono bg-gray-100 px-2 py-0.5">{lang.proficiency}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
