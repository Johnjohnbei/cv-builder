import { forwardRef } from 'react';

interface Props {
  /** Width in mm for the measurement context */
  widthMm: number;
  /** Additional CSS classes for font/style inheritance */
  className?: string;
  /** Inline styles (CSS variables, font overrides) */
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Hidden off-screen container for measuring block heights.
 * Renders children at the specified width with all template styles applied,
 * but invisible to the user. Each child should have a `data-measure-id` attribute.
 */
export const MeasurementContainer = forwardRef<HTMLDivElement, Props>(
  function MeasurementContainer({ widthMm, className, style, children }, ref) {
    return (
      <div
        ref={ref}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: `${widthMm}mm`,
          visibility: 'hidden',
          pointerEvents: 'none',
          ...style,
        }}
        className={className}
        aria-hidden
      >
        {children}
      </div>
    );
  },
);
