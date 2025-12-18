import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { motion, type HTMLMotionProps } from 'framer-motion';

type IconButtonVariant = 'default' | 'ghost' | 'danger';
type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps extends Omit<HTMLMotionProps<'button'>, 'size' | 'children'> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  tooltip?: string;
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

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'default', size = 'md', tooltip, children, ...props }, ref) => {
    const button = (
      <motion.button
        ref={ref}
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
              'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1',
              'text-xs text-surface bg-ink rounded shadow-lg',
              'opacity-0 group-hover:opacity-100 pointer-events-none',
              'transition-opacity duration-150 whitespace-nowrap z-[100]'
            )}
          >
            {tooltip}
          </div>
        </div>
      );
    }

    return button;
  }
);

IconButton.displayName = 'IconButton';
