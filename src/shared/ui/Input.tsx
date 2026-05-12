import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

type InputSize = 'xs' | 'sm' | 'md';
type InputVariant = 'default' | 'bare';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  mono?: boolean;
  inputSize?: InputSize;
  variant?: InputVariant;
  containerClassName?: string;
}

const sizePadding: Record<InputSize, string> = {
  xs: 'px-2 py-1',
  sm: 'px-2 py-1',
  md: 'px-3 py-2',
};

const sizeText: Record<InputSize, string> = {
  xs: 'text-[9px]',
  sm: 'text-[10px]',
  md: 'text-xs',
};

const defaultVariantBase =
  'border border-[var(--border-color)] rounded bg-white focus:outline-none focus:border-[var(--google-blue)] focus:ring-1 focus:ring-[var(--google-blue)] placeholder:text-gray-400';

// Bare variant: looks like plain text but is editable. Hover + focus states
// surface a subtle background so users discover it's an input. cursor-text
// always shows the caret cursor on hover.
const bareVariantBase =
  'bg-transparent border border-transparent rounded px-1 -mx-1 cursor-text ' +
  'hover:bg-gray-50 hover:border-gray-200 ' +
  'focus:outline-none focus:bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-200 ' +
  'placeholder:text-gray-400 placeholder:italic transition-colors';

export const Input = forwardRef<HTMLInputElement, Props>(
  (
    {
      label,
      mono = true,
      inputSize = 'md',
      variant = 'default',
      containerClassName,
      className,
      id,
      ...props
    },
    ref,
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const inputEl = (
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'w-full',
          variant === 'default' ? defaultVariantBase : bareVariantBase,
          // bare skips padding; default applies both padding + text
          variant === 'default' && sizePadding[inputSize],
          sizeText[inputSize],
          mono && 'font-mono',
          className,
        )}
        {...props}
      />
    );

    if (!label) {
      return containerClassName ? <div className={containerClassName}>{inputEl}</div> : inputEl;
    }

    return (
      <div className={cn('space-y-1', containerClassName)}>
        <label
          htmlFor={inputId}
          className="text-[9px] font-mono text-gray-500 uppercase block tracking-wider"
        >
          {label}
        </label>
        {inputEl}
      </div>
    );
  },
);

Input.displayName = 'Input';
