import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/src/shared/ui/Button';
import { useDocumentTitle } from '@/src/shared/hooks';

export default function NotFoundPage() {
  useDocumentTitle('Page introuvable');
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <p className="text-[11px] font-mono text-gray-600 uppercase tracking-[0.3em] mb-4">Erreur 404</p>
        <h1 className="text-6xl font-bold tracking-tighter text-gray-900 mb-2">Page introuvable</h1>
        <p className="text-sm text-gray-500 mb-8">
          Cette page n'existe pas ou a été déplacée.
        </p>
        {/* A button, not a button nested in a link: two interactive elements in one */}
        <Button variant="secondary" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate('/')}>
          Retour à l'accueil
        </Button>
      </div>
    </div>
  );
}
