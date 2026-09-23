import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, FileText, PenTool, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { useDocumentTitle } from '@/src/shared/hooks';
import { writeStoredText } from '@/src/shared/lib/storage';
import { Button } from '@/src/shared/ui/Button';

export default function HomePage() {
  useDocumentTitle('Adaptez votre CV à chaque offre');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#202124]">
      {/* Hero */}
      <section className="pt-32 pb-24 border-b border-[#DADCE0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-5xl md:text-6xl font-bold tracking-tight mb-8 leading-[1.1]"
              >
                Adaptez votre CV à chaque offre,<br />
                <span className="text-[#1A73E8]">sans rien inventer.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="max-w-xl text-lg text-gray-600 mb-10 leading-relaxed"
              >
                Importez votre CV (PDF ou export LinkedIn) et collez l'offre. Calibre mesure la part
                des exigences que votre CV couvre, puis réécrit seulement ce que votre parcours prouve.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center gap-4"
              >
                <Link
                  to="/auth"
                  className="w-full sm:w-auto bg-[#1A73E8] text-white flex items-center justify-center gap-3 px-8 py-4 rounded font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#174EA6] transition-colors"
                >
                  <span>Commencer gratuitement</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto px-8 py-4 text-gray-700"
                  onClick={() => {
                    // Same guest flow as AuthPage: try the product without an account.
                    // Storage blocked: guest mode cannot work; AuthPage says why on arrival.
                    if (writeStoredText('guest_access', 'true', 'session')) navigate('/dashboard');
                    else navigate('/auth', { state: { guestUnavailable: true } });
                  }}
                >
                  Essayer sans compte
                </Button>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-4 text-xs text-gray-600"
              >
                Fonctions IA : avec un compte, ou avec un code d'accès en mode invité.
              </motion.p>
            </div>

            {/* Preview card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="hidden lg:block"
            >
              <div className="border border-[#DADCE0] bg-white rounded">
                <div className="h-9 border-b border-[#DADCE0] bg-[#F8F9FA] flex items-center px-3">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Aperçu CV</span>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center space-x-4 border-b border-[#DADCE0] pb-4">
                    <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                      <FileText className="text-gray-600 w-6 h-6" />
                    </div>
                    <div>
                      <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
                      <div className="h-3 w-48 bg-gray-100 rounded" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 w-full bg-gray-100 rounded" />
                    <div className="h-2 w-full bg-gray-100 rounded" />
                    <div className="h-2 w-3/4 bg-gray-100 rounded" />
                  </div>
                  <div className="pt-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-16 bg-green-100 rounded" />
                      <span className="text-[11px] font-mono text-green-600 font-bold">ATS: 94%</span>
                    </div>
                    <div className="h-8 w-24 bg-[#1A73E8] rounded" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 border-b border-[#DADCE0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-[#DADCE0]">
            {[
              { num: '01', title: 'Import intelligent', desc: 'Importez votre CV en PDF ou votre export LinkedIn. Chaque section (expériences, compétences, formations) est extraite en quelques secondes.' },
              { num: '02', title: 'Adaptation IA', desc: 'Collez une offre d\'emploi. L\'IA reformule votre CV avec le vocabulaire de l\'offre, sans ajouter ce que votre parcours ne prouve pas.' },
              { num: '03', title: 'Score ATS', desc: 'Voyez quelles exigences de l\'offre votre CV couvre, et lesquelles il ne mentionne pas encore.' },
            ].map((f, i) => (
              <div key={i} className={`p-10 ${i < 2 ? 'border-b md:border-b-0 md:border-r border-[#DADCE0]' : ''}`}>
                <h3 className="text-sm font-bold font-mono uppercase tracking-widest mb-4">{f.num}. {f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Extras row */}
      <section className="py-16 border-b border-[#DADCE0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: <PenTool className="w-5 h-5" />, title: 'Lettre de motivation', desc: 'Générée par l\'IA, alignée sur votre CV et l\'offre ciblée.' },
              { icon: <Download className="w-5 h-5" />, title: 'Export PDF & DOCX', desc: 'Téléchargez dans le format demandé par le recruteur.' },
              { icon: <FileText className="w-5 h-5" />, title: '2 templates une colonne', desc: 'Lisibles par les ATS, couleurs et typographie personnalisables.' },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-4">
                <span className="mt-0.5 text-[#1A73E8] shrink-0">{f.icon}</span>
                <div>
                  <h4 className="text-sm font-bold mb-1">{f.title}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="font-mono text-[11px] text-gray-600 uppercase tracking-[0.2em]">
            Calibre © 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
