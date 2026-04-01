import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, FileText, Sparkles, Zap, ShieldCheck, Chrome, Terminal, Cpu } from 'lucide-react';
import { motion } from 'motion/react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#202124]">
      {/* Hero Section - Stitch Style */}
      <section className="relative pt-32 pb-24 border-b border-[#DADCE0] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="inline-flex items-center space-x-2 px-3 py-1 bg-[#E8F0FE] text-[#1A73E8] rounded-full text-[10px] stitch-mono font-bold mb-6"
              >
                <Cpu className="w-3 h-3" />
                <span>ENGINE: GEMINI_3.1_PRO_ACTIVE</span>
              </motion.div>
              
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-5xl md:text-6xl font-bold tracking-tight mb-8 leading-[1.1]"
              >
                Optimisation ATS <br />
                <span className="text-[#1A73E8]">par Intelligence Artificielle.</span>
              </motion.h1>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="max-w-xl text-lg text-gray-600 mb-10 leading-relaxed"
              >
                Analysez votre profil LinkedIn et adaptez-le instantanément à n'importe quelle offre d'emploi. 
                Une approche technique pour des résultats concrets.
              </motion.p>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4"
              >
                <Link 
                  to="/auth" 
                  className="w-full sm:w-auto stitch-button-primary flex items-center justify-center space-x-3 px-8 py-4"
                >
                  <span className="stitch-mono text-xs">INITIALIZE_BUILDER</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button className="w-full sm:w-auto stitch-button-secondary flex items-center justify-center space-x-2 px-8 py-4">
                  <Terminal className="w-4 h-4" />
                  <span className="stitch-mono text-xs">VIEW_DOCUMENTATION</span>
                </button>
              </motion.div>
            </div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="hidden lg:block"
            >
              <div className="stitch-panel shadow-2xl bg-white rotate-1">
                <div className="stitch-panel-header flex justify-between items-center">
                  <span>PREVIEW_CONSOLE_V2.0</span>
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
                      <div className="h-4 w-32 bg-gray-100 rounded mb-2" />
                      <div className="h-3 w-48 bg-gray-50 rounded" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 w-full bg-gray-50 rounded" />
                    <div className="h-2 w-full bg-gray-50 rounded" />
                    <div className="h-2 w-3/4 bg-gray-50 rounded" />
                  </div>
                  <div className="pt-4 flex justify-between items-center">
                    <div className="h-6 w-20 bg-[#E8F0FE] rounded" />
                    <div className="h-8 w-24 bg-[#1A73E8] rounded" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Background Grid */}
        <div className="absolute inset-0 -z-10 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      </section>

      {/* Features - Technical Grid */}
      <section className="py-24 border-b border-[#DADCE0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-[#DADCE0]">
            <div className="p-10 border-b md:border-b-0 md:border-r border-[#DADCE0] hover:bg-white transition-colors group">
              <div className="w-10 h-10 bg-[#F8F9FA] border border-[#DADCE0] rounded flex items-center justify-center mb-6 group-hover:border-[#1A73E8] transition-colors">
                <Zap className="text-[#1A73E8] w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold stitch-mono uppercase tracking-widest mb-4">01. DATA_EXTRACTION</h3>
              <p className="text-sm text-gray-500 leading-relaxed">Importez votre PDF LinkedIn. Notre moteur extrait chaque segment de votre parcours avec une précision de 99%.</p>
            </div>
            
            <div className="p-10 border-b md:border-b-0 md:border-r border-[#DADCE0] hover:bg-white transition-colors group">
              <div className="w-10 h-10 bg-[#F8F9FA] border border-[#DADCE0] rounded flex items-center justify-center mb-6 group-hover:border-[#1A73E8] transition-colors">
                <Sparkles className="text-[#1A73E8] w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold stitch-mono uppercase tracking-widest mb-4">02. AI_ADAPTATION</h3>
              <p className="text-sm text-gray-500 leading-relaxed">L'IA réécrit vos expériences pour qu'elles s'alignent parfaitement avec les exigences techniques du poste visé.</p>
            </div>
            
            <div className="p-10 hover:bg-white transition-colors group">
              <div className="w-10 h-10 bg-[#F8F9FA] border border-[#DADCE0] rounded flex items-center justify-center mb-6 group-hover:border-[#1A73E8] transition-colors">
                <ShieldCheck className="text-[#1A73E8] w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold stitch-mono uppercase tracking-widest mb-4">03. ATS_COMPLIANCE</h3>
              <p className="text-sm text-gray-500 leading-relaxed">Des formats optimisés pour les systèmes de recrutement modernes, garantissant une lecture parfaite par les algorithmes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Minimal Stitch */}
      <footer className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="stitch-mono text-[10px] text-gray-400 uppercase tracking-[0.2em]">
            CV_BUILDER_SYSTEM // VERSION_2.5.0 // © 2026_VIBECODE_ACADEMY
          </p>
        </div>
      </footer>
    </div>
  );
}
