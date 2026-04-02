import { Mail, Phone, MapPin, Linkedin, User } from 'lucide-react';
import type { CVData, DesignSettings } from '@/src/shared/types';
import { cn } from '@/src/shared/lib/cn';
import { useSectionTitleClasses, getFontClass, getIncludedSections, renderPhoto } from './shared';

interface Props {
  cvData: CVData;
  designSettings: DesignSettings;
  selectedTemplate: string;
}

export function CVRenderer({ cvData, designSettings, selectedTemplate }: Props) {
  const { primaryColor, secondaryColor } = designSettings;
  const fontClass = getFontClass(designSettings.fontFamily);
  const sectionTitleClasses = useSectionTitleClasses(designSettings);
  const includedSections = getIncludedSections(designSettings);
  const showPhoto = designSettings.showPhoto;

  const commonStyles = {
    '--primary': primaryColor,
    '--secondary': secondaryColor,
  } as React.CSSProperties;

  // ─── TEMPLATE A: Classic ───
  if (selectedTemplate === 'TEMPLATE_A') {
    return (
      <div style={commonStyles} className={cn("w-full h-full bg-white p-16 pdf-safe", fontClass)}>
        {includedSections.includes('personal') && (
          <div className="border-b-2 pb-8 mb-8 flex justify-between items-start" style={{ borderColor: primaryColor }}>
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
        <div className="grid grid-cols-3 gap-12">
          <div className="col-span-2 space-y-8">
            {includedSections.includes('summary') && cvData.personal_info?.summary && (
              <section>
                <h2 className={cn("text-sm border-b pb-2 mb-4", sectionTitleClasses)} style={{ color: primaryColor, borderColor: `${primaryColor}20` }}>Profil</h2>
                <p className="text-sm text-gray-600 leading-relaxed">{cvData.personal_info?.summary}</p>
              </section>
            )}
            {includedSections.includes('experience') && (
              <section>
                <h2 className={cn("text-sm border-b pb-2 mb-4", sectionTitleClasses)} style={{ color: primaryColor, borderColor: `${primaryColor}20` }}>Expérience Professionnelle</h2>
                <div className="space-y-6">
                  {cvData.experience?.map((exp, idx) => (
                    <div key={idx} data-cv-block="experience">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-gray-900">{exp.position}</h3>
                        <span className="text-xs text-gray-500 font-mono">{exp.start_date} — {exp.current ? 'Présent' : exp.end_date}</span>
                      </div>
                      <p className="text-sm font-bold mb-2" style={{ color: secondaryColor }}>{exp.company}</p>
                      <ul className="space-y-2">
                        {exp.description?.map((bullet, bIdx) => (
                          <li key={bIdx} className="text-sm text-gray-600 leading-relaxed flex gap-3">
                            <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: secondaryColor }} />
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
          <div className="col-span-1 space-y-8">
            {includedSections.includes('skills') && (
              <section>
                <h2 className={cn("text-sm border-b pb-2 mb-4", sectionTitleClasses)} style={{ color: primaryColor, borderColor: `${primaryColor}20` }}>Compétences</h2>
                <div className="space-y-4">
                  {cvData.skills?.map((cat, idx) => (
                    <div key={idx} className="space-y-2">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: secondaryColor }}>{cat.category}</h3>
                      <div className="flex flex-wrap gap-2">
                        {cat.items?.map(skill => (
                          <span key={skill} className="px-2 py-1 bg-gray-100 text-gray-700 text-[10px] font-bold rounded uppercase tracking-wider">{skill}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {includedSections.includes('education') && (
              <section>
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
              <section>
                <h2 className={cn("text-sm border-b pb-2 mb-4", sectionTitleClasses)} style={{ color: primaryColor, borderColor: `${primaryColor}20` }}>Langues</h2>
                <div className="space-y-2">
                  {cvData.languages?.map((lang, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-xs font-medium text-gray-700">{lang.name}</span>
                      <span className="text-[10px] text-gray-500 font-mono uppercase tracking-tighter">{lang.proficiency}</span>
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

  // ─── TEMPLATE B–F: Kept in original EditorPage for now ───
  // TODO: Extract remaining templates into individual files
  // For now, return a fallback that renders Template A structure
  return (
    <div className={cn("w-full h-full bg-white p-16 pdf-safe", fontClass)}>
      <p className="text-gray-400 font-mono text-sm">Template {selectedTemplate} — rendering via legacy path</p>
    </div>
  );
}
