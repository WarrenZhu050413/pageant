import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { Loader2, ImageIcon } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';

export function PromptsTab() {
  const prompts = useStore((s) => s.prompts);
  const pendingPrompts = useStore((s) => s.pendingPrompts);
  const currentPromptId = useStore((s) => s.currentPromptId);
  const setCurrentPrompt = useStore((s) => s.setCurrentPrompt);

  // Combine pending and actual prompts
  type PromptItem = {
    id: string;
    title: string;
    count: number;
    isPending: boolean;
    created_at: string;
    prompt?: string;
    category?: string;
    thumbnail?: string;
  };

  const allItems: PromptItem[] = [
    ...Array.from(pendingPrompts.entries()).map(([id, data]) => ({
      id,
      title: data.title,
      count: data.count,
      isPending: true as const,
      created_at: new Date().toISOString(),
    })),
    ...prompts.map((p) => ({
      id: p.id,
      title: p.title,
      prompt: p.prompt,
      category: p.category,
      count: p.images.length,
      isPending: false as const,
      created_at: p.created_at,
      thumbnail: p.images[0]?.image_path,
    })),
  ];

  if (allItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="w-12 h-12 rounded-full bg-canvas-muted flex items-center justify-center mb-3">
          <ImageIcon size={20} className="text-ink-muted" />
        </div>
        <p className="text-sm text-ink-secondary">No prompts yet</p>
        <p className="text-xs text-ink-muted mt-1">
          Generate your first images to get started
        </p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {allItems.map((item, index) => {
        const isActive = item.id === currentPromptId;

        return (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
            onClick={() => !item.isPending && setCurrentPrompt(item.id)}
            disabled={item.isPending}
            className={clsx(
              'w-full text-left rounded-lg overflow-hidden',
              'transition-all duration-150',
              item.isPending && 'shimmer cursor-wait',
              isActive
                ? 'bg-brass-muted ring-1 ring-brass/30'
                : 'hover:bg-canvas-subtle'
            )}
          >
            <div className="flex gap-3 p-2.5">
              {/* Thumbnail */}
              <div
                className={clsx(
                  'w-12 h-12 rounded-md flex-shrink-0 overflow-hidden',
                  'bg-canvas-muted'
                )}
              >
                {item.isPending ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 size={16} className="text-ink-muted animate-spin" />
                  </div>
                ) : item.thumbnail ? (
                  <img
                    src={getImageUrl(item.thumbnail)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon size={16} className="text-ink-muted" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className={clsx(
                      'text-sm font-medium truncate',
                      isActive ? 'text-ink' : 'text-ink-secondary'
                    )}
                  >
                    {item.title}
                  </h3>
                  <span
                    className={clsx(
                      'flex-shrink-0 text-[0.625rem] font-medium px-1.5 py-0.5 rounded',
                      item.isPending
                        ? 'bg-generating/15 text-generating'
                        : 'bg-canvas-muted text-ink-tertiary'
                    )}
                  >
                    {item.count}
                  </span>
                </div>

                {item.prompt && (
                  <p className="text-xs text-ink-muted truncate mt-0.5 font-[family-name:var(--font-mono)]">
                    {item.prompt.slice(0, 50)}...
                  </p>
                )}

                <p className="text-[0.625rem] text-ink-muted mt-1">
                  {item.isPending
                    ? 'Generating...'
                    : new Date(item.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                </p>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
