import { useRef, useState } from 'react';
import type { EditTarget, InPlaceEditing } from '../lib/in-place-edit';

interface Props {
  /** The text as the CV stores it: what the field opens on, markdown included */
  value: string;
  /** Where in the CV this text lives */
  target: EditTarget;
  /** Absent outside the editor's preview: the text then renders exactly as before */
  editing?: InPlaceEditing;
  /** What this text is, for the screen reader, the tooltip and the empty field */
  label: string;
  /** A paragraph, which takes the whole width over several lines. A title, a chip or a bullet is one line. */
  block?: boolean;
  /** The text as the template renders it (markdown applied) */
  children: React.ReactNode;
}

/**
 * A text of the CV, editable where it is read (arbitrage of 2026-11-06).
 *
 * Clicking opens a field over the text itself, instead of sending the user
 * hunting for it in the sidebar. The edit is written to `cvData` through
 * `in-place-edit.ts`, never to the rendered text, so the fit pass and the
 * pagination keep measuring the same source.
 *
 * It is committed on blur, not on every keystroke: a letter typed would
 * otherwise re-paginate the whole CV under the cursor.
 *
 * Without `editing` it renders its children and nothing else, which is what
 * the print, the PDF export and the thumbnails get.
 */
export function EditableText({ value, target, editing, label, block, children }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  // Escape unmounts the field, and a browser fires its blur on the way out:
  // without this the cancelled text would be saved by the blur handler
  const cancelled = useRef(false);

  if (!editing) return <>{children}</>;

  if (draft === null) {
    // An empty text leaves an empty slot, which cannot be clicked: the field
    // says what belongs there instead, and prints nowhere (data-preview-only is
    // dropped by @media print and by serializeCV, which builds the PDF).
    const empty = value.trim().length === 0;
    return (
      <span
        role="button"
        tabIndex={0}
        className="cv-editable"
        title={`Modifier : ${label}`}
        aria-label={`Modifier : ${label}`}
        onClick={() => setDraft(value)}
        onKeyDown={event => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          setDraft(value);
        }}
      >
        {empty ? <span data-preview-only className="cv-placeholder">{label}</span> : children}
      </span>
    );
  }

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    editing.onEdit(target, draft);
    setDraft(null);
  };

  return (
    <textarea
      aria-label={label}
      autoFocus
      value={draft}
      placeholder={label}
      rows={block ? 3 : 1}
      className="cv-editing"
      // Inherited, so the field reads at the size and in the font of the CV itself
      style={{ font: 'inherit', color: 'inherit', lineHeight: 'inherit', width: block ? '100%' : `${Math.max(draft.length + 2, 8)}ch` }}
      onChange={event => setDraft(event.target.value)}
      onFocus={event => event.currentTarget.setSelectionRange(draft.length, draft.length)}
      onBlur={commit}
      onKeyDown={event => {
        // Shift+Enter is a line break in a paragraph; Enter alone is "done"
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          commit();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          cancelled.current = true;
          setDraft(null);
        }
      }}
    />
  );
}
