import { useEffect } from 'react';
import { clsx } from 'clsx';
import { BarChart3, Trash2, RefreshCw } from 'lucide-react';
import { useStore } from '../../store';
import { Button } from '../ui';

export function PreferencesTab() {
  const designPreferences = useStore((s) => s.designPreferences);
  const totalRated = useStore((s) => s.totalRated);
  const fetchDesignPreferences = useStore((s) => s.fetchDesignPreferences);
  const resetDesignPreferences = useStore((s) => s.resetDesignPreferences);

  // Fetch preferences on mount
  useEffect(() => {
    fetchDesignPreferences();
  }, [fetchDesignPreferences]);

  // Get top preferences for each axis
  const getTopPreferences = (axis: string) => {
    const prefs = designPreferences?.[axis as keyof typeof designPreferences] || {};
    const entries = Object.entries(prefs);
    if (entries.length === 0) return [];

    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    return entries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag, count]) => ({
        tag,
        count,
        percentage: Math.round((count / total) * 100),
      }));
  };

  // Build preference summary string for generation
  const getPreferenceSummary = () => {
    if (!designPreferences) return '';

    const summaryParts: string[] = [];
    const axes = ['mood', 'typeface', 'colors', 'layout', 'style', 'composition'];

    for (const axis of axes) {
      const top = getTopPreferences(axis);
      if (top.length > 0 && top[0].percentage >= 40) {
        summaryParts.push(top[0].tag);
      }
    }

    return summaryParts.join(', ');
  };

  if (totalRated === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="w-12 h-12 rounded-full bg-canvas-muted flex items-center justify-center mb-3">
          <BarChart3 size={20} className="text-ink-muted" />
        </div>
        <p className="text-sm text-ink-secondary">No preferences yet</p>
        <p className="text-xs text-ink-muted mt-1">
          Rate images using the heart buttons to build your style profile
        </p>
      </div>
    );
  }

  const axes = [
    { key: 'mood', label: 'Mood' },
    { key: 'typeface', label: 'Typeface' },
    { key: 'colors', label: 'Colors' },
    { key: 'layout', label: 'Layout' },
    { key: 'style', label: 'Style' },
    { key: 'composition', label: 'Composition' },
  ];

  const preferenceSummary = getPreferenceSummary();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-ink">Your Preferences</span>
          <span className="text-xs text-ink-muted">
            {totalRated} image{totalRated !== 1 ? 's' : ''} rated
          </span>
        </div>
        {preferenceSummary && (
          <div className="p-2 bg-brass-muted/50 rounded text-xs text-brass-dark">
            <span className="font-medium">Style summary:</span> {preferenceSummary}
          </div>
        )}
      </div>

      {/* Preference Bars */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {axes.map(({ key, label }) => {
          const topPrefs = getTopPreferences(key);
          if (topPrefs.length === 0) return null;

          return (
            <div key={key}>
              <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-ink-muted mb-1.5">
                {label}
              </div>
              <div className="space-y-1">
                {topPrefs.map(({ tag, percentage }) => (
                  <div key={tag} className="flex items-center gap-2">
                    <span className="text-xs text-ink-secondary w-20 truncate">
                      {tag}
                    </span>
                    <div className="flex-1 h-2 bg-canvas-muted rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all',
                          percentage >= 60
                            ? 'bg-brass'
                            : percentage >= 40
                            ? 'bg-brass/70'
                            : 'bg-brass/40'
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-[0.6rem] text-ink-muted w-8 text-right">
                      {percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-border flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<RefreshCw size={14} />}
          onClick={() => fetchDesignPreferences()}
          className="flex-1"
        >
          Refresh
        </Button>
        <Button
          size="sm"
          variant="danger"
          leftIcon={<Trash2 size={14} />}
          onClick={() => {
            if (confirm('Reset all design preferences? This cannot be undone.')) {
              resetDesignPreferences();
            }
          }}
          className="flex-1"
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
