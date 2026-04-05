import { Link } from 'react-router-dom';
import { ArrowRight, FileText, Sparkles, Zap, ShieldCheck, PenTool, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { useDocumentTitle } from '@/src/shared/hooks';

export default function HomePage() {
  useDocumentTitle('Optimisez votre CV avec l\'IA');

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#202124]">
      {/* Hero */}
      <section className="relative pt-32 pb-24 border-b border-[#DADCE0] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="inline-flex items-center space-x-2 px-3 py-1 bg-[#E8F0FE] text-[#1A73E8] rounded-full text-[10px] font-mono font-bold mb-6"
              >
                <Sparkles className="w-3 h-3" />
                <span>Propulsé par NVIDIA NIM</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-5xl md:text-6xl font-bold tracking-tight mb-8 leading-[1.1]"
              >
                Votre CV,<br />
                <span className="text-[#1A73E8]">optimisé par l'IA.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="max-w-xl text-lg text-gray-600 mb-10 leading-relaxed"
              >
                Importez votre CV, collez une offre d'emploi. L'IA adapte votre parcours
                pour maximiser votre score ATS et décrocher l'entretien.
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
                <Link
                  to="/auth"
                  className="w-full sm:w-auto border border-[#DADCE0] bg-white text-gray-700 flex items-center justify-center gap-2 px-8 py-4 rounded font-mono text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors"
                >
                  <span>Voir la démo</span>
                </Link>
              </motion.div>
            </div>

            {/* Preview card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="hidden lg:block"
            >
              <div className="border border-[#DADCE0] bg-white rounded shadow-2xl rotate-1">
                <div className="h-9 border-b border-[#DADCE0] bg-[#F8F9FA] flex items-center justify-between px-3">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-gray-500">Aperçu CV</span>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <div className="w-2 h-2 rounded-full bg-yellow-400" />
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center space-x-4 border-b border-[#DADCE0] pb-4">
                    <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                      <FileText className="text-gray-400 w-6 h-6" />
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
                      <span className="text-[9px] font-mono text-green-600 font-bold">ATS: 94%</span>
                    </div>
                    <div className="h-8 w-24 bg-[#1A73E8] rounded" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="absolute inset-0 -z-10 opacity-[0.03] pointer-events-none"
             style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      </section>

      {/* Features */}
      <section className="py-24 border-b border-[#DADCE0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-[#DADCE0]">
            {[
              { icon: <Zap className="text-[#1A73E8] w-5 h-5" />, num: '01', title: 'Import intelligent', desc: 'Importez votre CV en PDF. L\'IA extrait chaque section — expériences, compétences, formations — en quelques secondes.' },
              { icon: <Sparkles className="text-[#1A73E8] w-5 h-5" />, num: '02', title: 'Adaptation IA', desc: 'Collez une offre d\'emploi. L\'IA réécrit votre CV avec les bons mots-clés et des résultats quantifiables.' },
              { icon: <ShieldCheck className="text-[#1A73E8] w-5 h-5" />, num: '03', title: 'Score ATS', desc: 'Obtenez un score de compatibilité ATS, les mots-clés manquants et des conseils d\'amélioration personnalisés.' },
            ].map((f, i) => (
              <div key={i} className={`p-10 hover:bg-white transition-colors group ${i < 2 ? 'border-b md:border-b-0 md:border-r border-[#DADCE0]' : ''}`}>
                <div className="w-10 h-10 bg-[#F8F9FA] border border-[#DADCE0] rounded flex items-center justify-center mb-6 group-hover:border-[#1A73E8] transition-colors">
                  {f.icon}
                </div>
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
              { icon: <FileText className="w-5 h-5" />, title: '6 templates pro', desc: 'Du classique au créatif, personnalisables couleurs et typographie.' },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-50 rounded flex items-center justify-center text-blue-600 shrink-0">
                  {f.icon}
                </div>
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
          <p className="font-mono text-[10px] text-gray-400 uppercase tracking-[0.2em]">
            Calibre © 2026 — Propulsé par NVIDIA NIM
          </p>
        </div>
      </footer>
    </div>
  );
}
