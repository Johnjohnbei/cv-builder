import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

interface PanelProps {
  children: ReactNode;
  className?: string;
}

interface PanelHeaderProps {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function Panel({ children, className }: PanelProps) {
  return (
    <div className={cn('border border-[var(--border-color)] bg-white rounded', className)}>
      {children}
    </div>
  );
}

export function PanelHeader({ children, className, action }: PanelHeaderProps) {
  return (
    <div className={cn(
      'h-9 border-b border-[var(--border-color)] bg-[var(--bg-side)] flex items-center justify-between px-3',
      'font-mono text-[11px] uppercase tracking-wider text-[var(--text-secondary)]',
      className,
    )}>
      <span>{children}</span>
      {action}
    </div>
  );
}

export function PanelBody({ children, className }: PanelProps) {
  return (
    <div className={cn('p-4', className)}>
      {children}
    </div>
  );
}
