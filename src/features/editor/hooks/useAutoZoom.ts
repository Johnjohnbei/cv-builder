import { useState, useEffect, type RefObject } from 'react';

const CV_WIDTH_PX = 794; // 210mm in pixels approx
const PADDING = 64;

/**
 * Auto-zoom the CV preview to fit the container width.
 * Returns [zoom, setZoom, isAutoZoom, setIsAutoZoom].
 */
export function useAutoZoom(
  containerRef: RefObject<HTMLDivElement | null>,
  enabled: boolean = true,
) {
  const [zoom, setZoom] = useState(85);
  const [isAutoZoom, setIsAutoZoom] = useState(enabled);

  // Compute zoom from container width
  const computeZoom = () => {
    const containerWidth = containerRef.current?.clientWidth || 0;
    if (!containerWidth) return;
    const newZoom = Math.floor(((containerWidth - PADDING) / CV_WIDTH_PX) * 100);
    setZoom(Math.min(100, Math.max(30, newZoom)));
  };

  // Recompute on relevant changes
  useEffect(() => {
    if (isAutoZoom) computeZoom();
  }, [isAutoZoom]);

  // Handle window resize
  useEffect(() => {
    if (!isAutoZoom) return;
    const handleResize = () => computeZoom();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isAutoZoom]);

  return { zoom, setZoom, isAutoZoom, setIsAutoZoom, recomputeZoom: computeZoom } as const;
}
