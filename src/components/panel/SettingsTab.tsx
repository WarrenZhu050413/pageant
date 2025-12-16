import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Save, Check, Info, Loader2 } from 'lucide-react';
import { useStore } from '../../store';
import { Button, Textarea, Badge } from '../ui';

export function SettingsTab() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  const [variationPrompt, setVariationPrompt] = useState('');
  const [iterationPrompt, setIterationPrompt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync with settings from backend (backend always returns defaults if not set)
  const serverVariation = settings?.variation_prompt;
  const serverIteration = settings?.iteration_prompt;

  useEffect(() => {
    if (serverVariation) setVariationPrompt(serverVariation);
  }, [serverVariation]);

  useEffect(() => {
    if (serverIteration) setIterationPrompt(serverIteration);
  }, [serverIteration]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings(variationPrompt, iterationPrompt);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = variationPrompt !== serverVariation || iterationPrompt !== serverIteration;
  const isLoading = !settings;

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-ink-muted" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Model Info */}
      <section>
        <h4 className="text-xs font-medium text-ink-tertiary uppercase tracking-wide mb-3">
          Active Models
        </h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-canvas-subtle">
            <div>
              <p className="text-sm font-medium text-ink-secondary">Text Model</p>
              <p className="text-xs text-ink-muted font-[family-name:var(--font-mono)]">
                {settings?.text_model || 'gemini-3-pro-preview'}
              </p>
            </div>
            <Badge variant="brass">Active</Badge>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-canvas-subtle">
            <div>
              <p className="text-sm font-medium text-ink-secondary">Image Model</p>
              <p className="text-xs text-ink-muted font-[family-name:var(--font-mono)]">
                {settings?.image_model || 'gemini-3-pro-image-preview'}
              </p>
            </div>
            <Badge variant="brass">Active</Badge>
          </div>
        </div>
      </section>

      {/* Variation System Prompt */}
      <section>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="text-xs font-medium text-ink-tertiary uppercase tracking-wide">
              Variation System Prompt
            </h4>
            <p className="text-[0.625rem] text-ink-muted mt-0.5">
              Controls how image variations are generated
            </p>
          </div>
        </div>

        <Textarea
          value={variationPrompt}
          onChange={(e) => setVariationPrompt(e.target.value)}
          placeholder="Enter variation system prompt..."
          className={clsx(
            'min-h-[300px] text-xs font-[family-name:var(--font-mono)]',
            'leading-relaxed'
          )}
        />

        {/* Info box */}
        <div className="mt-3 p-3 rounded-lg bg-brass-muted/50 flex gap-2">
          <Info size={14} className="flex-shrink-0 text-brass-dark mt-0.5" />
          <div className="text-xs text-brass-dark">
            <p className="font-medium mb-1">Available placeholders:</p>
            <ul className="space-y-0.5">
              <li>
                <code className="px-1 py-0.5 rounded bg-brass-muted">{'{base_prompt}'}</code>{' '}
                - The user's original prompt
              </li>
              <li>
                <code className="px-1 py-0.5 rounded bg-brass-muted">{'{count}'}</code>{' '}
                - Number of variations to generate
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Iteration System Prompt (More Like This) */}
      <section>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="text-xs font-medium text-ink-tertiary uppercase tracking-wide">
              Iteration Prompt ("More Like This")
            </h4>
            <p className="text-[0.625rem] text-ink-muted mt-0.5">
              Controls how image-to-image variations are generated
            </p>
          </div>
        </div>

        <Textarea
          value={iterationPrompt}
          onChange={(e) => setIterationPrompt(e.target.value)}
          placeholder="Enter iteration prompt..."
          className={clsx(
            'min-h-[150px] text-xs font-[family-name:var(--font-mono)]',
            'leading-relaxed'
          )}
        />

        {/* Info box */}
        <div className="mt-3 p-3 rounded-lg bg-brass-muted/50 flex gap-2">
          <Info size={14} className="flex-shrink-0 text-brass-dark mt-0.5" />
          <div className="text-xs text-brass-dark">
            <p className="font-medium mb-1">Available placeholders:</p>
            <ul className="space-y-0.5">
              <li>
                <code className="px-1 py-0.5 rounded bg-brass-muted">{'{original_prompt}'}</code>{' '}
                - The original image's prompt
              </li>
              <li>
                <code className="px-1 py-0.5 rounded bg-brass-muted">{'{focus}'}</code>{' '}
                - What to focus on in the variation
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Save Button */}
      <Button
        variant={saved ? 'secondary' : 'brass'}
        leftIcon={saved ? <Check size={16} /> : <Save size={16} />}
        onClick={handleSave}
        disabled={!hasChanges || isSaving}
        className="w-full"
      >
        {saved ? 'Saved!' : isSaving ? 'Saving...' : 'Save Settings'}
      </Button>

      {/* Keyboard Shortcuts */}
      <section className="pt-4 border-t border-border">
        <h4 className="text-xs font-medium text-ink-tertiary uppercase tracking-wide mb-3">
          Keyboard Shortcuts
        </h4>
        <div className="space-y-2">
          {[
            { keys: ['←', '→'], action: 'Navigate images' },
            { keys: ['1'], action: 'Single view' },
            { keys: ['2'], action: 'Grid view' },
            { keys: ['3'], action: 'Compare view' },
            { keys: ['F'], action: 'Toggle favorite' },
            { keys: ['G'], action: 'Go to Generate' },
            { keys: ['S'], action: 'Select mode' },
            { keys: ['B'], action: 'Batch mode' },
            { keys: ['⌘', 'S'], action: 'Save as template' },
            { keys: ['Esc'], action: 'Exit mode' },
          ].map(({ keys, action }) => (
            <div key={action} className="flex items-center justify-between">
              <span className="text-xs text-ink-secondary">{action}</span>
              <div className="flex gap-1">
                {keys.map((key) => (
                  <kbd
                    key={key}
                    className={clsx(
                      'px-1.5 py-0.5 rounded',
                      'text-[0.625rem] font-medium',
                      'bg-canvas-muted text-ink-secondary',
                      'border border-border'
                    )}
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
