import { cn } from '@/src/shared/lib/cn';

interface Props {
  pageIndex: number;
  /** Whether this page uses two-column layout */
  twoColumn: boolean;
  /** Accent color for the left border on pages 2+ */
  accentColor?: string;
  /** Font class from template */
  fontClass?: string;
  /** CSS variables for colors */
  style?: React.CSSProperties;
  children: React.ReactNode;
  /** Sidebar content (only for page 0 with twoColumn) */
  sidebar?: React.ReactNode;
  /** Padding classes */
  paddingClass?: string;
}

/**
 * A single A4 page — exactly 297mm tall, 210mm wide.
 * Used both in preview (stacked with gaps) and export (with page-break-after).
 *
 * Page 0 with twoColumn: renders a grid with main content + sidebar.
 * Pages 1+: full-width with an optional accent color left border.
 */
export function CVPage({
  pageIndex,
  twoColumn,
  accentColor,
  fontClass,
  style,
  children,
  sidebar,
  paddingClass = 'px-16 pt-16 pb-10',
}: Props) {
  const isPage2Plus = pageIndex > 0;
  const showSidebar = twoColumn && pageIndex === 0 && sidebar;

  return (
    <div
      className={cn('cv-page w-full bg-white', fontClass)}
      style={{
        width: '210mm',
        height: '297mm',
        overflow: 'hidden',
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

      <div className={cn(paddingClass, isPage2Plus && accentColor && 'pl-20')}>
        {showSidebar ? (
          <div className="grid grid-cols-3 gap-12 h-full">
            <div className="col-span-2 space-y-6">{children}</div>
            <div className="col-span-1 space-y-8">{sidebar}</div>
          </div>
        ) : (
          <div className="space-y-6">{children}</div>
        )}
      </div>
    </div>
  );
}
