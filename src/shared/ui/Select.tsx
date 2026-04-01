import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  mono?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, Props>(
  ({ label, options, mono = true, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="text-[9px] font-mono text-gray-500 uppercase block tracking-wider">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'w-full border border-[--border-color] rounded px-3 py-2 text-sm bg-white',
            'focus:outline-none focus:border-[--google-blue] focus:ring-1 focus:ring-[--google-blue]',
            mono && 'font-mono text-xs',
            className,
          )}
          {...props}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  },
);

Select.displayName = 'Select';
