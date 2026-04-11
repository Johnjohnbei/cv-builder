import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

type SelectSize = 'xs' | 'sm' | 'md';
type SelectVariant = 'default' | 'bare';

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  options?: { value: string; label: string }[];
  mono?: boolean;
  inputSize?: SelectSize;
  variant?: SelectVariant;
  containerClassName?: string;
  children?: React.ReactNode;
}

const sizePadding: Record<SelectSize, string> = {
  xs: 'px-2 py-1',
  sm: 'px-2 py-1',
  md: 'px-3 py-2',
};

const sizeText: Record<SelectSize, string> = {
  xs: 'text-[9px]',
  sm: 'text-[10px]',
  md: 'text-xs',
};

const defaultVariantBase =
  'border border-[var(--border-color)] rounded bg-white focus:outline-none focus:border-[var(--google-blue)] focus:ring-1 focus:ring-[var(--google-blue)]';

const bareVariantBase =
  'bg-transparent border-0 p-0 focus:outline-none';

export const Select = forwardRef<HTMLSelectElement, Props>(
  (
    {
      label,
      options,
      mono = true,
      inputSize = 'md',
      variant = 'default',
      containerClassName,
      className,
      id,
      children,
      ...props
    },
    ref,
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const selectEl = (
      <select
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
      >
        {options
          ? options.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
    );

    if (!label) {
      return containerClassName ? <div className={containerClassName}>{selectEl}</div> : selectEl;
    }

    return (
      <div className={cn('space-y-1', containerClassName)}>
        <label
          htmlFor={inputId}
          className="text-[9px] font-mono text-gray-500 uppercase block tracking-wider"
        >
          {label}
        </label>
        {selectEl}
      </div>
    );
  },
);

Select.displayName = 'Select';
