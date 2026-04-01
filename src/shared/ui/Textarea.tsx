import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  mono?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(
  ({ label, mono = true, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="text-[9px] font-mono text-gray-500 uppercase block tracking-wider">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'w-full border border-[--border-color] rounded px-3 py-2 text-sm bg-white resize-none',
            'focus:outline-none focus:border-[--google-blue] focus:ring-1 focus:ring-[--google-blue]',
            'placeholder:text-gray-400',
            mono && 'font-mono text-xs',
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
