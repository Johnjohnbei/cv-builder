import { cn } from '@/src/shared/lib/cn';

interface Props {
  pageIndex: number;
  /** Accent color for the left border on pages 2+ */
  accentColor?: string;
  /** Font class from template */
  fontClass?: string;
  /** CSS variables for colors */
  style?: React.CSSProperties;
  children: React.ReactNode;
  /** Padding classes; must match what templateLayouts.ts allocates (no default to drift from it) */
  paddingClass: string;
}

/**
 * A single A4 page — exactly 297mm tall, 210mm wide.
 * Used both in preview (stacked with gaps) and export (with page-break-after).
 * Pages 2+ carry an optional accent color left border.
 */
export function CVPage({ pageIndex, accentColor, fontClass, style, children, paddingClass }: Props) {
  const isPage2Plus = pageIndex > 0;

  return (
    <div
      className={cn('cv-page w-full bg-white', fontClass)}
      style={{
        width: '210mm',
        height: '297mm',
        overflow: 'visible',
        position: 'relative',
        ...style,
      }}
    >
      {/* Accent border for pages 2+ */}
      {isPage2Plus && accentColor && (
        <div
          className="absolute left-0 top-0 bottom-0"
          style={{ width: '3px', backgroundColor: accentColor }}
        />
      )}

      <div className={cn('h-full', paddingClass, isPage2Plus && accentColor && 'pl-20')}>
        <div className="flex flex-col gap-4 h-full">{children}</div>
      </div>
    </div>
  );
}
