import { Loader2 } from 'lucide-react';

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
      <Spinner className="w-8 h-8 text-blue-600" />
    </div>
  );
}
