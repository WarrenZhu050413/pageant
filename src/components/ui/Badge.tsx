import { clsx } from 'clsx';

type BadgeVariant = 'default' | 'brass' | 'success' | 'error' | 'generating';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-canvas-muted text-ink-secondary',
  brass: 'bg-brass-muted text-brass-dark',
  success: 'bg-success/15 text-success',
  error: 'bg-error/15 text-error',
  generating: 'bg-generating/15 text-generating',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5',
        'text-[0.6875rem] font-medium uppercase tracking-wider',
        'rounded',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
