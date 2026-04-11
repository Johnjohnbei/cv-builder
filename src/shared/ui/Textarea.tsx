import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

type TextareaSize = 'xs' | 'sm' | 'md';
type TextareaVariant = 'default' | 'bare';

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  mono?: boolean;
  inputSize?: TextareaSize;
  variant?: TextareaVariant;
  containerClassName?: string;
}

const sizePadding: Record<TextareaSize, string> = {
  xs: 'px-2 py-1',
  sm: 'px-2 py-1',
  md: 'px-3 py-2',
};

const sizeText: Record<TextareaSize, string> = {
  xs: 'text-[9px]',
  sm: 'text-[10px]',
  md: 'text-xs',
};

const defaultVariantBase =
  'border border-[var(--border-color)] rounded bg-white resize-none focus:outline-none focus:border-[var(--google-blue)] focus:ring-1 focus:ring-[var(--google-blue)] placeholder:text-gray-400';

const bareVariantBase =
  'bg-transparent border-0 p-0 resize-none focus:outline-none placeholder:text-gray-400';

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(
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
    const textareaEl = (
      <textarea
        ref={ref}
        id={inputId}
        className={cn(
          'w-full',
          variant === 'default' ? defaultVariantBase : bareVariantBase,
          variant === 'default' && sizePadding[inputSize],
          sizeText[inputSize],
          mono && 'font-mono',
          className,
        )}
        {...props}
      />
    );

    if (!label) {
      return containerClassName ? <div className={containerClassName}>{textareaEl}</div> : textareaEl;
    }

    return (
      <div className={cn('space-y-1', containerClassName)}>
        <label
          htmlFor={inputId}
          className="text-[9px] font-mono text-gray-500 uppercase block tracking-wider"
        >
          {label}
        </label>
        {textareaEl}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
