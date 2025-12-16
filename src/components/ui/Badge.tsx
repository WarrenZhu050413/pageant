import { clsx } from 'clsx';

export type BadgeVariant = 'default' | 'brass' | 'success' | 'error' | 'generating' | 'secondary' | 'outline';
type BadgeSize = 'sm' | 'default';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-canvas-muted text-ink-secondary',
  brass: 'bg-brass-muted text-brass-dark',
  success: 'bg-success/15 text-success',
  error: 'bg-error/15 text-error',
  generating: 'bg-generating/15 text-generating',
  secondary: 'bg-canvas-subtle text-ink-tertiary border border-border/50',
  outline: 'bg-transparent text-ink-muted border border-border',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[0.6rem]',
  default: 'px-2 py-0.5 text-[0.6875rem]',
};

export function Badge({ children, variant = 'default', size = 'default', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center',
        'font-medium uppercase tracking-wider',
        'rounded',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}
