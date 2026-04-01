import { useState } from 'react';
import { FileText, Sparkles, Copy, Download, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAction, useMutation, useQuery } from 'convex/react';
import { useUser } from '@clerk/clerk-react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/src/shared/ui/Button';
import { Textarea } from '@/src/shared/ui/Textarea';
import { Input } from '@/src/shared/ui/Input';
import { Panel, PanelHeader, PanelBody } from '@/src/shared/ui/Panel';
import { Notification } from '@/src/shared/ui/Notification';
import { useAutoNotification } from '@/src/shared/hooks';
import type { CVData } from '@/src/shared/types';

interface CoverLetterData {
  subject: string;
  greeting: string;
  body: string;
  closing: string;
}

export default function CoverLetterPage() {
  const { user } = useUser();
  const isGuest = sessionStorage.getItem('guest_access') === 'true';
  const userData = useQuery(api.users.getMe, user ? undefined : "skip");

  const generateCoverLetter = useAction(api.ai.generateCoverLetter);
  const saveCoverLetter = useMutation(api.coverLetters.save);

  const [jobDescription, setJobDescription] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [tone, setTone] = useState('professionnel et engagé');
  const [letter, setLetter] = useState<CoverLetterData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { notification, notify, clearNotification } = useAutoNotification();

  const cvData: CVData | null = user && userData?.lastGeneratedCV
    ? userData.lastGeneratedCV
    : isGuest
      ? JSON.parse(localStorage.getItem('guest_last_optimized') || 'null')
      : null;

  const handleGenerate = async () => {
    if (!cvData || jobDescription.length < 50) return;
    setIsGenerating(true);
    try {
      const result = await generateCoverLetter({
        cvData,
        jobDescription,
        companyName: companyName || undefined,
        tone,
      });
      setLetter(result);
    } catch (e) {
      console.error(e);
      notify({ message: "Erreur lors de la génération. Réessayez.", type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!letter || !user) return;
    setIsSaving(true);
    try {
      await saveCoverLetter({
        jobDescription,
        companyName: companyName || undefined,
        ...letter,
      });
      notify({ message: 'Lettre sauvegardée !', type: 'success' });
    } catch (e) {
      notify({ message: 'Erreur lors de la sauvegarde.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = () => {
    if (!letter) return;
    const text = `${letter.greeting}\n\n${letter.body}\n\n${letter.closing}`;
    navigator.clipboard.writeText(text);
    notify({ message: 'Copié dans le presse-papier !', type: 'success' });
  };

  const fullText = letter ? `${letter.greeting}\n\n${letter.body}\n\n${letter.closing}` : '';

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </Link>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-sm">Lettre de motivation</span>
            </div>
          </div>
          {letter && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" icon={<Copy className="w-3.5 h-3.5" />} onClick={handleCopy}>
                Copier
              </Button>
              {user && (
                <Button variant="secondary" size="sm" loading={isSaving} onClick={handleSave}>
                  Sauvegarder
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: inputs */}
          <div className="space-y-6">
            <Panel>
              <PanelHeader>Configuration</PanelHeader>
              <PanelBody className="space-y-4">
                {!cvData && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                    <strong>CV requis</strong> — Importez ou créez d'abord un CV depuis le{' '}
                    <Link to="/dashboard" className="underline">dashboard</Link>.
                  </div>
                )}
                {cvData && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded">
                    <p className="text-xs font-bold text-blue-700">{cvData.personal_info?.name || 'CV chargé'}</p>
                    <p className="text-[10px] text-blue-500 font-mono">{cvData.personal_info?.title}</p>
                  </div>
                )}

                <Input
                  label="Nom de l'entreprise"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ex: Google, Airbus..."
                />

                <Textarea
                  label="Offre d'emploi"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Collez l'offre d'emploi ici (min. 50 caractères)..."
                  rows={8}
                />

                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Ton</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'professionnel et engagé', label: 'Pro & engagé' },
                      { value: 'formel et académique', label: 'Formel' },
                      { value: 'dynamique et startup', label: 'Startup' },
                      { value: 'créatif et original', label: 'Créatif' },
                    ].map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setTone(t.value)}
                        className={`px-2 py-1.5 rounded border text-[9px] font-mono transition-colors ${
                          tone === t.value
                            ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  loading={isGenerating}
                  icon={<Sparkles className="w-4 h-4" />}
                  disabled={!cvData || jobDescription.length < 50}
                  onClick={handleGenerate}
                >
                  Générer la lettre
                </Button>
              </PanelBody>
            </Panel>
          </div>

          {/* Right: preview */}
          <div>
            <Panel>
              <PanelHeader>Aperçu</PanelHeader>
              <PanelBody>
                {!letter ? (
                  <div className="py-16 text-center">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">Générez une lettre pour la visualiser ici</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {letter.subject && (
                      <div className="pb-3 border-b border-gray-100">
                        <p className="text-[9px] font-mono text-gray-400 uppercase mb-1">Objet</p>
                        <p className="text-sm font-medium">{letter.subject}</p>
                      </div>
                    )}
                    <div className="prose prose-sm max-w-none">
                      <p className="font-medium">{letter.greeting}</p>
                      {letter.body.split('\n\n').map((para, i) => (
                        <p key={i} className="text-gray-700 leading-relaxed">{para}</p>
                      ))}
                      <p className="font-medium mt-4">{letter.closing}</p>
                      {cvData?.personal_info?.name && (
                        <p className="font-bold">{cvData.personal_info.name}</p>
                      )}
                    </div>
                  </div>
                )}
              </PanelBody>
            </Panel>
          </div>
        </div>
      </div>

      {notification && (
        <Notification message={notification.message} type={notification.type} onClose={clearNotification} />
      )}
    </div>
  );
}
