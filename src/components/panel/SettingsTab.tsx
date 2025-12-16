import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { RotateCcw, Save, Check, Info } from 'lucide-react';
import { useStore } from '../../store';
import { Button, Textarea, Badge } from '../ui';

const DEFAULT_VARIATION_PROMPT = `You are a creative prompt variation generator. Given a base prompt and a count, generate that many unique scene descriptions that maintain the core subject but vary the environment, lighting, mood, composition, and artistic style.

Each variation should be a complete, detailed scene description. Make each one distinctly different while staying true to the original subject.

For a base prompt of "{base_prompt}" generate {count} variations.

Return your response in this XML format:
<variations>
  <variation>
    <description>Complete scene description here</description>
    <mood>one-word mood descriptor</mood>
    <type>variation type (e.g., lighting, environment, style)</type>
  </variation>
  ...repeat for each variation...
</variations>`;

export function SettingsTab() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  const [variationPrompt, setVariationPrompt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync with settings
  useEffect(() => {
    if (settings?.variation_prompt) {
      setVariationPrompt(settings.variation_prompt);
    }
  }, [settings?.variation_prompt]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings(variationPrompt);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setVariationPrompt(DEFAULT_VARIATION_PROMPT);
  };

  const hasChanges = variationPrompt !== settings?.variation_prompt;

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
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<RotateCcw size={12} />}
            onClick={handleReset}
          >
            Reset
          </Button>
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
