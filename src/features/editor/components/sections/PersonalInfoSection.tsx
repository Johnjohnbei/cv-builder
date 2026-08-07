import { memo } from 'react';
import { User, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Input } from '../../../../shared/ui/Input';
import { downscaleImageToDataURI } from '../../../../shared/lib/imageResize';
import type { CVData, PersonalInfo } from '../../../../shared/types';

interface Props {
  personalInfo: PersonalInfo | undefined;
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>;
  expanded: boolean;
  onToggle: () => void;
  setUserModified: React.Dispatch<React.SetStateAction<boolean>>;
  notify: (n: { message: string; type: 'success' | 'error' }) => void;
}

export const PersonalInfoSection = memo(function PersonalInfoSection({
  personalInfo, setCvData, expanded, onToggle, setUserModified, notify,
}: Props) {
  return (
    <section className="stitch-panel overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full stitch-panel-header flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <User className="w-3 h-3" />
          <span>Infos personnelles</span>
        </div>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {expanded && (
        <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <Input
            label="Nom complet"
            type="text"
            value={personalInfo?.name || ''}
            onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, name: e.target.value}} : null)}
          />
          <Input
            label="Titre pro"
            type="text"
            value={personalInfo?.title || ''}
            onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, title: e.target.value}} : null)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Email"
              type="email"
              className="text-[10px]"
              value={personalInfo?.email || ''}
              onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, email: e.target.value}} : null)}
            />
            <Input
              label="Téléphone"
              type="text"
              className="text-[10px]"
              value={personalInfo?.phone || ''}
              onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, phone: e.target.value}} : null)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Localisation"
              type="text"
              className="text-[10px]"
              placeholder="Ex: Paris, France"
              value={personalInfo?.location || ''}
              onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, location: e.target.value}} : null)}
            />
            <Input
              label="LinkedIn URL"
              type="text"
              className="text-[10px]"
              value={personalInfo?.linkedin || ''}
              onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, linkedin: e.target.value}} : null)}
            />
          </div>
          <div>
            <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-1">Photo de profil (URL ou Upload)</label>
            <div className="flex gap-2">
              <Input
                type="text"
                className="text-[10px] flex-1"
                placeholder="https://..."
                value={personalInfo?.photo_url || ''}
                onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, photo_url: e.target.value}} : null)}
              />
              <label className="px-3 py-1 bg-gray-100 border border-gray-200 rounded text-[9px] stitch-mono cursor-pointer hover:bg-gray-200 transition-colors flex items-center">
                UPLOAD
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 10 * 1024 * 1024) {
                      notify({ message: 'Photo trop volumineuse (max 10 MB).', type: 'error' });
                      return;
                    }
                    if (!file.type.startsWith('image/')) {
                      notify({ message: 'Fichier non reconnu comme image.', type: 'error' });
                      return;
                    }
                    try {
                      // Downscaled to ~512px JPEG: the photo lives in
                      // every auto-save payload (Convex doc cap ~1 MiB)
                      const dataUri = await downscaleImageToDataURI(file);
                      setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, photo_url: dataUri}} : null);
                      setUserModified(true);
                    } catch {
                      notify({ message: 'Impossible de lire cette image.', type: 'error' });
                    }
                  }}
                />
              </label>
              {personalInfo?.photo_url && (
                <button
                  onClick={() => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, photo_url: ''}} : null)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Supprimer la photo"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
});
