import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { Check, Sparkles } from 'lucide-react';

interface VariationSkeletonProps {
  index: number;
  /** Whether this skeleton has been "completed" (variation received) */
  isComplete?: boolean;
  /** The completed variation data to show */
  completedData?: {
    title?: string;
    text: string;
    design?: Record<string, string[]>;
  };
}

/**
 * Skeleton placeholder for variations during streaming generation.
 * Shows shimmer animation when loading, fades to actual content when complete.
 */
export function VariationSkeleton({
  index,
  isComplete = false,
  completedData,
}: VariationSkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={clsx(
        'border rounded-lg overflow-hidden transition-all duration-300',
        isComplete
          ? 'border-border bg-surface'
          : 'border-border/50 bg-canvas-muted/30'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          {isComplete ? (
            <>
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-success/20 text-success">
                <Check size={12} />
              </span>
              <span className="text-xs font-medium text-ink-tertiary">
                #{index + 1}
              </span>
              {completedData?.title && (
                <span className="text-sm font-medium text-ink truncate">
                  {completedData.title}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-brass/20 text-brass">
                <Sparkles size={12} className="animate-pulse" />
              </span>
              <span className="text-xs font-medium text-ink-tertiary">
                #{index + 1}
              </span>
              <div className="shimmer h-4 w-24 rounded" />
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-3 pb-3">
        {isComplete && completedData ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-ink-secondary line-clamp-3"
          >
            {completedData.text}
          </motion.p>
        ) : (
          <div className="space-y-2">
            <div className="shimmer h-4 w-full rounded" />
            <div className="shimmer h-4 w-4/5 rounded" />
            <div className="shimmer h-4 w-3/5 rounded" />
          </div>
        )}
      </div>

      {/* Tags skeleton or actual tags */}
      <div className="px-3 pb-3 border-t border-border/30 pt-2">
        {isComplete && completedData?.design ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex flex-wrap gap-1"
          >
            {Object.values(completedData.design)
              .flat()
              .slice(0, 5)
              .map((tag, i) => (
                <span
                  key={`${tag}-${i}`}
                  className="px-1.5 py-0.5 rounded text-[0.65rem] bg-canvas-muted text-ink-tertiary"
                >
                  {tag}
                </span>
              ))}
          </motion.div>
        ) : (
          <div className="flex gap-1.5">
            <div className="shimmer h-5 w-16 rounded" />
            <div className="shimmer h-5 w-14 rounded" />
            <div className="shimmer h-5 w-18 rounded" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Rotating status messages for the loading experience
const STATUS_MESSAGES = [
  'Analyzing your style preferences...',
  'Exploring creative directions...',
  'Crafting unique variations...',
  'Refining prompt details...',
  'Adding finishing touches...',
];

interface StreamingLoadingStateProps {
  /** Number of expected variations */
  expectedCount: number;
  /** Already-received partial variations */
  partialVariations: Array<{
    title?: string;
    text: string;
    design?: Record<string, string[]>;
  }>;
  /** Status message to display (optional - will use rotating messages if not provided) */
  statusMessage?: string;
  /** Whether still actively streaming */
  isStreaming: boolean;
}

/**
 * Full loading state component that shows skeletons + progress during streaming.
 */
export function StreamingLoadingState({
  expectedCount,
  partialVariations,
  statusMessage,
  isStreaming,
}: StreamingLoadingStateProps) {
  const completedCount = partialVariations.length;
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  // Rotate through status messages every 2.5 seconds
  useEffect(() => {
    if (!isStreaming || statusMessage) return;

    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [isStreaming, statusMessage]);

  const displayMessage = statusMessage || STATUS_MESSAGES[currentMessageIndex];

  return (
    <div className="space-y-4">
      {/* Status header with animated message */}
      <div className="flex items-center justify-center gap-3 py-4">
        {isStreaming && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-6 h-6 rounded-full border-2 border-brass border-t-transparent"
          />
        )}
        <div className="text-center min-w-[200px]">
          <AnimatePresence mode="wait">
            <motion.p
              key={displayMessage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="text-sm font-medium text-ink-secondary"
            >
              {displayMessage}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Progress indicator dots */}
      <div className="flex justify-center gap-1.5 py-2">
        {Array.from({ length: expectedCount }).map((_, i) => (
          <motion.div
            key={i}
            className={clsx(
              'w-2 h-2 rounded-full transition-colors duration-300',
              i < completedCount
                ? 'bg-success'
                : 'bg-canvas-muted'
            )}
            animate={
              i === completedCount && isStreaming
                ? { scale: [1, 1.3, 1] }
                : {}
            }
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        ))}
      </div>

      {/* Skeleton grid */}
      <div className="space-y-3 pt-2">
        {Array.from({ length: expectedCount }).map((_, i) => (
          <VariationSkeleton
            key={i}
            index={i}
            isComplete={i < completedCount}
            completedData={partialVariations[i]}
          />
        ))}
      </div>
    </div>
  );
}
