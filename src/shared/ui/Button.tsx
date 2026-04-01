import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  mono?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-[--google-blue] text-white hover:bg-[--google-blue-hover] shadow-sm',
  secondary: 'border border-[--border-color] bg-white text-[--google-blue] hover:bg-gray-50',
  ghost: 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[10px] gap-1.5',
  md: 'px-4 py-2 text-xs gap-2',
  lg: 'px-6 py-3 text-sm gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', loading, icon, mono = true, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-bold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        mono && 'font-mono uppercase tracking-wider',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="w-3.5 h-3.5" /> : icon}
      {children && <span>{children}</span>}
    </button>
  ),
);

Button.displayName = 'Button';
