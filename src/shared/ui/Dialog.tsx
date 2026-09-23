import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '../lib/cn';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Visible heading, also the dialog's accessible name */
  title: ReactNode;
  /** Optional icon shown before the title */
  icon?: ReactNode;
  children: ReactNode;
  /** False while an action runs: Escape and backdrop clicks are ignored */
  dismissible?: boolean;
  className?: string;
}

/**
 * Modal dialog on the native <dialog> element.
 *
 * showModal() gives what the hand-made overlays lacked: the rest of the page
 * becomes inert (focus cannot leave the dialog), Escape closes it, focus comes
 * back to the opener on close, and assistive technologies announce a dialog.
 */
export function Dialog({ open, onClose, title, icon, children, dismissible = true, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Escape: the parent decides, so the dialog never closes behind React's back
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      // A click whose target is the <dialog> itself landed on the backdrop
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
      className={cn(
        'm-auto p-0 w-[calc(100%-2rem)] max-w-md rounded-lg bg-white shadow-2xl backdrop:bg-black/50',
        className,
      )}
    >
      {open && (
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            {icon}
            <h2 id={titleId} className="text-lg font-bold text-gray-900">{title}</h2>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
