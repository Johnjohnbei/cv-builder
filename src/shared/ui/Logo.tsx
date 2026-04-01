import { cn } from '../lib/cn';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { icon: 20, text: 14, gap: 6 },
  md: { icon: 28, text: 18, gap: 8 },
  lg: { icon: 36, text: 24, gap: 10 },
};

function CalibreSymbol({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="6" stroke="currentColor" strokeWidth="2" />
      <line x1="16" y1="0" x2="16" y2="8" stroke="currentColor" strokeWidth="2" />
      <line x1="16" y1="24" x2="16" y2="32" stroke="currentColor" strokeWidth="2" />
      <line x1="0" y1="16" x2="8" y2="16" stroke="currentColor" strokeWidth="2" />
      <line x1="24" y1="16" x2="32" y2="16" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="2" fill="currentColor" />
    </svg>
  );
}

export function Logo({ size = 'md', showText = true, className }: Props) {
  const s = sizes[size];
  return (
    <div className={cn('flex items-center text-[#1A73E8]', className)} style={{ gap: s.gap }}>
      <CalibreSymbol size={s.icon} />
      {showText && (
        <span
          className="font-mono font-bold tracking-tight text-gray-900"
          style={{ fontSize: s.text }}
        >
          Calibre
        </span>
      )}
    </div>
  );
}

export { CalibreSymbol };
