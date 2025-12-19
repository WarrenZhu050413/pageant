import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { motion, type HTMLMotionProps } from 'framer-motion';

type IconButtonVariant = 'default' | 'ghost' | 'danger';
type IconButtonSize = 'sm' | 'md' | 'lg';
type TooltipPosition = 'top' | 'bottom';
type TooltipAlign = 'center' | 'left' | 'right';

interface IconButtonProps extends Omit<HTMLMotionProps<'button'>, 'size' | 'children'> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  tooltip?: string;
  tooltipHint?: string;  // Secondary hint text (smaller, muted)
  shortcut?: string;     // Keyboard shortcut (e.g., "A", "⌘D")
  tooltipPosition?: TooltipPosition;  // Vertical position (default: 'top')
  tooltipAlign?: TooltipAlign;        // Horizontal alignment (default: 'center')
  children?: React.ReactNode;
}

const variantStyles: Record<IconButtonVariant, string> = {
  default: 'bg-surface text-ink-secondary hover:bg-canvas-muted hover:text-ink',
  ghost: 'bg-transparent text-ink-tertiary hover:bg-canvas-muted hover:text-ink-secondary',
  danger: 'bg-transparent text-ink-tertiary hover:bg-error/10 hover:text-error',
};

const sizeStyles: Record<IconButtonSize, string> = {
  sm: 'p-1.5',
  md: 'p-2',
  lg: 'p-2.5',
};

const getTooltipPositionClasses = (position: TooltipPosition, align: TooltipAlign): string => {
  const vertical = position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';

  const horizontal = {
    center: 'left-1/2 -translate-x-1/2',
    left: 'left-0',
    right: 'right-0',
  }[align];

  return `${vertical} ${horizontal}`;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'default', size = 'md', tooltip, tooltipHint, shortcut, tooltipPosition = 'top', tooltipAlign = 'center', children, ...props }, ref) => {
    // Use tooltip as aria-label if no explicit aria-label is provided
    const ariaLabel = props['aria-label'] || tooltip;

    const button = (
      <motion.button
        ref={ref}
        aria-label={ariaLabel}
        whileHover={{ scale: props.disabled ? 1 : 1.05 }}
        whileTap={{ scale: props.disabled ? 1 : 0.95 }}
        className={clsx(
          'inline-flex items-center justify-center rounded-lg',
          'transition-colors duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brass',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </motion.button>
    );

    if (tooltip) {
      return (
        <div className="relative group">
          {button}
          <div
            className={clsx(
              'absolute px-2.5 py-1.5',
              getTooltipPositionClasses(tooltipPosition, tooltipAlign),
              'text-xs bg-[var(--color-tooltip-bg)] text-[var(--color-tooltip-text)] rounded-lg shadow-lg',
              'opacity-0 group-hover:opacity-100 pointer-events-none',
              'transition-opacity duration-150 whitespace-nowrap z-[100]'
            )}
          >
            <div className="font-medium">{tooltip}</div>
            {tooltipHint && (
              <div className="text-[0.65rem] text-[var(--color-tooltip-hint)] mt-0.5">
                {tooltipHint}
              </div>
            )}
            {shortcut && (
              <div className="mt-1.5 flex items-center gap-1">
                <kbd className={clsx(
                  'inline-flex items-center justify-center',
                  'min-w-[1.25rem] h-5 px-1.5',
                  'text-[0.65rem] font-mono font-medium',
                  'bg-white/10 text-[var(--color-tooltip-text)]',
                  'rounded border border-white/20'
                )}>
                  {shortcut}
                </kbd>
              </div>
            )}
          </div>
        </div>
      );
    }

    return button;
  }
);

IconButton.displayName = 'IconButton';
