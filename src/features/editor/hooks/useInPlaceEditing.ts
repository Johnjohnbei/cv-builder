import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CVData } from '@/src/shared/types';
import { applyEdit, type EditTarget, type InPlaceEditing } from '../lib/in-place-edit';

/** How many steps back the editor can go. Each step holds a whole CV, which is a few tens of kB. */
const UNDO_DEPTH = 20;

interface Options {
  cvData: CVData | null;
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>;
}

export interface InPlaceEditingResult {
  /** Handed to the preview's block renderers: what makes the CV's texts editable */
  editing: InPlaceEditing;
  /** Undoes the last edit made in the preview */
  undo: () => void;
  canUndo: boolean;
}

/**
 * Editing the CV in the preview, and taking it back.
 *
 * The editor had no undo at all, while the auto-save persists every change a
 * second later: a text replaced by mistake was gone. Every write that goes
 * through here keeps the CV as it stood, so Ctrl+Z and the header's button
 * bring it back.
 *
 * Only the edits made in the preview are stacked. A keystroke in the sidebar
 * is not: the browser already undoes the field being typed in, and stacking a
 * whole CV per letter would keep hundreds of copies in memory.
 */
export function useInPlaceEditing({ cvData, setCvData }: Options): InPlaceEditingResult {
  const history = useRef<CVData[]>([]);
  const [depth, setDepth] = useState(0);

  // Read from cvData rather than from an updater: an updater runs twice in
  // development (StrictMode), which would stack the same CV twice
  const onEdit = useCallback((target: EditTarget, text: string) => {
    if (!cvData) return;
    const updated = applyEdit(cvData, target, text);
    // The same object back: the text did not change, so there is nothing to undo
    if (updated === cvData) return;
    history.current = [...history.current, cvData].slice(-UNDO_DEPTH);
    setDepth(history.current.length);
    setCvData(updated);
  }, [cvData, setCvData]);

  const undo = useCallback(() => {
    const previous = history.current[history.current.length - 1];
    if (!previous) return;
    history.current = history.current.slice(0, -1);
    setDepth(history.current.length);
    setCvData(previous);
  }, [setCvData]);

  // Ctrl+Z / Cmd+Z, except inside a field, where the browser's own undo wins
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z' || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) return;
      event.preventDefault();
      undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo]);

  // A CV that leaves (another one loaded, a translation that replaces it) takes its history with it
  useEffect(() => {
    if (cvData) return;
    history.current = [];
    setDepth(0);
  }, [cvData]);

  const editing = useMemo<InPlaceEditing>(() => ({ onEdit }), [onEdit]);
  return { editing, undo, canUndo: depth > 0 };
}
