import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Save, Check, Info, Loader2, Sun, Moon, Monitor, RotateCcw } from 'lucide-react';
import { useStore } from '../../store';
import { useTheme, type ThemePreference } from '../../hooks';
import { Button, Textarea, Badge, Input } from '../ui';
import { fetchDefaultSettings } from '../../api';
import { IMAGE_SIZE_OPTIONS, ASPECT_RATIO_OPTIONS, SAFETY_LEVEL_OPTIONS, THINKING_LEVEL_OPTIONS } from '../../types';

// Price per image for display
const SIZE_PRICES: Record<string, string> = {
  '1K': '$0.039',
  '2K': '$0.134',
  '4K': '$0.24',
};

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export function SettingsTab() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const { preference: themePreference, resolvedTheme, setTheme } = useTheme();

  const [variationPrompt, setVariationPrompt] = useState('');
  const [iterationPrompt, setIterationPrompt] = useState('');
  // Image generation defaults
  const [imageSize, setImageSize] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<string>('');
  const [seed, setSeed] = useState<string>('');
  const [safetyLevel, setSafetyLevel] = useState<string>('');
  // Nano Banana specific
  const [thinkingLevel, setThinkingLevel] = useState<string>('');
  const [temperature, setTemperature] = useState<string>('');
  const [googleSearchGrounding, setGoogleSearchGrounding] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync with settings from backend (backend always returns defaults if not set)
  const serverVariation = settings?.variation_prompt;
  const serverIteration = settings?.iteration_prompt;
  const serverImageSize = settings?.image_size ?? '';
  const serverAspectRatio = settings?.aspect_ratio ?? '';
  const serverSeed = settings?.seed?.toString() ?? '';
  const serverSafetyLevel = settings?.safety_level ?? '';
  // Nano Banana specific
  const serverThinkingLevel = settings?.thinking_level ?? '';
  const serverTemperature = settings?.temperature?.toString() ?? '';
  const serverGoogleSearchGrounding = settings?.google_search_grounding ?? false;

  useEffect(() => {
    if (serverVariation) setVariationPrompt(serverVariation);
  }, [serverVariation]);

  useEffect(() => {
    if (serverIteration) setIterationPrompt(serverIteration);
  }, [serverIteration]);

  useEffect(() => {
    setImageSize(serverImageSize);
  }, [serverImageSize]);

  useEffect(() => {
    setAspectRatio(serverAspectRatio);
  }, [serverAspectRatio]);

  useEffect(() => {
    setSeed(serverSeed);
  }, [serverSeed]);

  useEffect(() => {
    setSafetyLevel(serverSafetyLevel);
  }, [serverSafetyLevel]);

  useEffect(() => {
    setThinkingLevel(serverThinkingLevel);
  }, [serverThinkingLevel]);

  useEffect(() => {
    setTemperature(serverTemperature);
  }, [serverTemperature]);

  useEffect(() => {
    setGoogleSearchGrounding(serverGoogleSearchGrounding);
  }, [serverGoogleSearchGrounding]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        variation_prompt: variationPrompt,
        iteration_prompt: iterationPrompt,
        image_size: imageSize || undefined,
        aspect_ratio: aspectRatio || undefined,
        seed: seed ? parseInt(seed, 10) : undefined,
        safety_level: safetyLevel || undefined,
        // Nano Banana specific
        thinking_level: thinkingLevel || undefined,
        temperature: temperature ? parseFloat(temperature) : undefined,
        google_search_grounding: googleSearchGrounding || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetVariation = async () => {
    try {
      const defaults = await fetchDefaultSettings();
      setVariationPrompt(defaults.variation_prompt);
    } catch (error) {
      console.error('Failed to fetch default prompts:', error);
    }
  };

  const handleResetIteration = async () => {
    try {
      const defaults = await fetchDefaultSettings();
      setIterationPrompt(defaults.iteration_prompt);
    } catch (error) {
      console.error('Failed to fetch default prompts:', error);
    }
  };

  const hasChanges =
    variationPrompt !== serverVariation ||
    iterationPrompt !== serverIteration ||
    imageSize !== serverImageSize ||
    aspectRatio !== serverAspectRatio ||
    seed !== serverSeed ||
    safetyLevel !== serverSafetyLevel ||
    thinkingLevel !== serverThinkingLevel ||
    temperature !== serverTemperature ||
    googleSearchGrounding !== serverGoogleSearchGrounding;
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

      {/* Appearance */}
      <section>
        <h4 className="text-xs font-medium text-ink-tertiary uppercase tracking-wide mb-3">
          Appearance
        </h4>
        <div className="flex gap-2">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={clsx(
                'flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                'border',
                themePreference === value
                  ? 'bg-brass-muted border-brass text-brass-dark'
                  : 'bg-canvas-subtle border-border text-ink-secondary hover:bg-canvas-muted'
              )}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Icon size={14} />
                <span>{label}</span>
              </div>
            </button>
          ))}
        </div>
        <p className="text-[0.625rem] text-ink-muted mt-1.5">
          {themePreference === 'system'
            ? `Following system preference (${resolvedTheme})`
            : `${themePreference.charAt(0).toUpperCase() + themePreference.slice(1)} mode`}
        </p>
      </section>

      {/* Image Generation Defaults */}
      <section>
        <h4 className="text-xs font-medium text-ink-tertiary uppercase tracking-wide mb-3">
          Image Generation Defaults
        </h4>
        <div className="space-y-4">
          {/* Image Size */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-2">
              Image Size
            </label>
            <div className="flex gap-2">
              {IMAGE_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setImageSize(imageSize === size ? '' : size)}
                  className={clsx(
                    'flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                    'border',
                    imageSize === size
                      ? 'bg-brass-muted border-brass text-brass-dark'
                      : 'bg-canvas-subtle border-border text-ink-secondary hover:bg-canvas-muted'
                  )}
                >
                  <div>{size}</div>
                  <div className="text-[0.625rem] text-ink-muted mt-0.5">
                    {SIZE_PRICES[size]}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[0.625rem] text-ink-muted mt-1.5">
              {imageSize ? `Selected: ${imageSize}` : 'Default: 1K (1024px)'}
            </p>
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-2">
              Aspect Ratio
            </label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              className={clsx(
                'w-full px-3 py-2 rounded-lg text-sm',
                'bg-canvas-subtle border border-border',
                'text-ink-primary focus:outline-none focus:ring-2 focus:ring-brass/20'
              )}
            >
              <option value="">Default (1:1)</option>
              {ASPECT_RATIO_OPTIONS.map((ratio) => (
                <option key={ratio} value={ratio}>
                  {ratio}
                </option>
              ))}
            </select>
            <p className="text-[0.625rem] text-ink-muted mt-1.5">
              {aspectRatio ? `Selected: ${aspectRatio}` : 'Default: Matches input image, or 1:1'}
            </p>
          </div>

          {/* Seed */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-2">
              Default Seed
            </label>
            <Input
              type="number"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="Leave empty for random"
              className="text-sm"
            />
            <p className="text-[0.625rem] text-ink-muted mt-1.5">
              {seed ? `Selected: ${seed}` : 'Default: Random (no seed)'}
            </p>
          </div>

          {/* Safety Level */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-2">
              Safety Level
            </label>
            <select
              value={safetyLevel}
              onChange={(e) => setSafetyLevel(e.target.value)}
              className={clsx(
                'w-full px-3 py-2 rounded-lg text-sm',
                'bg-canvas-subtle border border-border',
                'text-ink-primary focus:outline-none focus:ring-2 focus:ring-brass/20'
              )}
            >
              <option value="">Default (Block Medium)</option>
              {SAFETY_LEVEL_OPTIONS.map((level) => (
                <option key={level} value={level}>
                  {level.replace(/_/g, ' ').replace(/BLOCK /i, 'Block ')}
                </option>
              ))}
            </select>
            <p className="text-[0.625rem] text-ink-muted mt-1.5">
              {safetyLevel
                ? `Selected: ${safetyLevel.replace(/_/g, ' ').replace(/BLOCK /i, 'Block ')}`
                : 'Default: Block Medium and Above'}
            </p>
          </div>
        </div>
      </section>

      {/* Advanced (Nano Banana) */}
      <section>
        <h4 className="text-xs font-medium text-ink-tertiary uppercase tracking-wide mb-3">
          Advanced (Nano Banana)
        </h4>
        <div className="space-y-4">
          {/* Thinking Level */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-2">
              Thinking Level
            </label>
            <div className="flex gap-2">
              {THINKING_LEVEL_OPTIONS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setThinkingLevel(thinkingLevel === level ? '' : level)}
                  className={clsx(
                    'flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                    'border',
                    thinkingLevel === level
                      ? 'bg-brass-muted border-brass text-brass-dark'
                      : 'bg-canvas-subtle border-border text-ink-secondary hover:bg-canvas-muted'
                  )}
                >
                  <div className="capitalize">{level}</div>
                  <div className="text-[0.625rem] text-ink-muted mt-0.5">
                    {level === 'low' ? 'Faster' : 'More detailed'}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[0.625rem] text-ink-muted mt-1.5">
              {thinkingLevel ? `Selected: ${thinkingLevel}` : 'Default: High (more reasoning)'}
            </p>
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-2">
              Temperature
            </label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              placeholder="Leave empty for default (1.0)"
              className="text-sm"
            />
            <p className="text-[0.625rem] text-ink-muted mt-1.5">
              {temperature ? `Selected: ${temperature}` : 'Default: 1.0 (Google recommends not changing)'}
            </p>
          </div>

          {/* Google Search Grounding */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={googleSearchGrounding}
                onChange={(e) => setGoogleSearchGrounding(e.target.checked)}
                className="w-4 h-4 rounded border-border text-brass focus:ring-brass/20"
              />
              <span className="text-xs font-medium text-ink-secondary">
                Google Search Grounding
              </span>
            </label>
            <p className="text-[0.625rem] text-ink-muted mt-1.5 ml-6">
              Ground image generation in real-time web data
            </p>
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
          <button
            onClick={handleResetVariation}
            className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink-secondary transition-colors"
            title="Reset to default"
          >
            <RotateCcw size={12} />
            Reset
          </button>
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
          <button
            onClick={handleResetIteration}
            className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink-secondary transition-colors"
            title="Reset to default"
          >
            <RotateCcw size={12} />
            Reset
          </button>
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
