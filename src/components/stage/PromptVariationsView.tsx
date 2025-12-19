import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Copy, FileText, Check } from 'lucide-react';
import { useState } from 'react';
import { Button, Badge } from '../ui';
import type { Prompt } from '../../types';

interface PromptVariationsViewProps {
  prompt: Prompt;
  onBack: () => void;
}

export function PromptVariationsView({ prompt, onBack }: PromptVariationsViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Extract unique variations from images
  const variations = prompt.images
    .filter(img => img.varied_prompt)
    .map(img => ({
      id: img.id,
      title: img.variation_title || 'Untitled Variation',
      text: img.varied_prompt!,
      mood: img.mood,
    }));

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-canvas">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft size={14} />}
            onClick={onBack}
          >
            Go to Images
          </Button>
          <div className="w-px h-6 bg-border" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-ink truncate">
                {prompt.title}
              </h2>
              <Badge variant="secondary" size="sm">Variations</Badge>
            </div>
            <p className="text-xs text-ink-muted truncate max-w-md" title={prompt.basePrompt}>
              {variations.length} variation{variations.length !== 1 ? 's' : ''} • Based on: "{prompt.basePrompt?.slice(0, 50)}{(prompt.basePrompt?.length || 0) > 50 ? '...' : ''}"
            </p>
          </div>
        </div>
      </header>

      {/* Base prompt summary */}
      {prompt.basePrompt && (
        <div className="px-4 py-3 border-b border-border bg-canvas-subtle shrink-0">
          <p className="text-xs text-ink-tertiary mb-1">Original prompt:</p>
          <p className="text-sm text-ink-secondary">
            "{prompt.basePrompt}"
          </p>
        </div>
      )}

      {/* Variations list - scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          <AnimatePresence>
            {variations.map((variation, index) => (
              <motion.div
                key={variation.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="rounded-lg border border-border bg-surface overflow-hidden"
              >
                {/* Variation header */}
                <div className="flex items-center justify-between px-4 py-2 bg-canvas-subtle border-b border-border/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-ink-tertiary">
                      #{index + 1}
                    </span>
                    <h3 className="text-sm font-medium text-ink truncate">
                      {variation.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => handleCopy(variation.id, variation.text)}
                    className={clsx(
                      'p-1.5 rounded-md transition-colors',
                      copiedId === variation.id
                        ? 'bg-brass/20 text-brass'
                        : 'hover:bg-canvas-muted text-ink-tertiary hover:text-ink-secondary'
                    )}
                    title="Copy to clipboard"
                  >
                    {copiedId === variation.id ? (
                      <Check size={14} />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>

                {/* Variation content */}
                <div className="p-4">
                  <p className="text-sm text-ink-secondary whitespace-pre-wrap font-mono leading-relaxed">
                    {variation.text}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {variations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-ink-tertiary">
              <FileText className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">No variation prompts available</p>
              <p className="text-xs text-ink-muted mt-1">
                Variations are stored when images are generated from draft prompts
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
