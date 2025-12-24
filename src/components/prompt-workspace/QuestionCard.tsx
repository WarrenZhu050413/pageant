/**
 * QuestionCard Component
 *
 * Renders a single question with selectable options following the
 * Claude Code AskUserQuestion UI pattern.
 */

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';
import type { PEQuestion, PEOption } from '../../api';

interface Props {
  question: PEQuestion;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
  isHighlighted?: boolean;
  onEnter?: () => void;
}

export function QuestionCard({
  question,
  value,
  onChange,
  isHighlighted = false,
  onEnter,
}: Props) {
  const [additionalText, setAdditionalText] = useState('');

  // Sync additionalText state from value prop (for cases where value is set externally)
  useEffect(() => {
    if (question.multiSelect && Array.isArray(value)) {
      const alsoEntry = value.find((v) => v.startsWith('Also: '));
      setAdditionalText(alsoEntry?.slice(6) || '');
    } else if (typeof value === 'string' && value.includes('. Also: ')) {
      const text = value.split('. Also: ')[1];
      setAdditionalText(text || '');
    }
  }, [value, question.multiSelect]);

  // Helper to get selected options (excluding "Also:" entries)
  const getSelectedOptions = (): string[] => {
    if (question.multiSelect) {
      return Array.isArray(value)
        ? value.filter((v) => !v.startsWith('Also: '))
        : [];
    }
    // For single-select, extract the base option (before ". Also:")
    if (typeof value === 'string') {
      const alsoIndex = value.indexOf('. Also: ');
      return alsoIndex > -1 ? [value.substring(0, alsoIndex)] : [value];
    }
    return [];
  };

  // Build the combined value from selections + additional text
  const buildValue = (selectedOptions: string[], additional: string): string | string[] => {
    if (question.multiSelect) {
      const result = [...selectedOptions];
      if (additional.trim()) {
        result.push(`Also: ${additional.trim()}`);
      }
      return result;
    } else {
      // Single-select: combine as "Option. Also: text"
      const base = selectedOptions[0] || '';
      if (additional.trim() && base) {
        return `${base}. Also: ${additional.trim()}`;
      }
      return base;
    }
  };

  const handleOptionClick = (option: PEOption) => {
    const currentSelected = getSelectedOptions();

    if (question.multiSelect) {
      const isSelected = currentSelected.includes(option.label);
      const newSelected = isSelected
        ? currentSelected.filter((v) => v !== option.label)
        : [...currentSelected, option.label];
      onChange(buildValue(newSelected, additionalText));
    } else {
      // Single-select: replace selection
      onChange(buildValue([option.label], additionalText));
    }
  };

  const handleAdditionalTextChange = (text: string) => {
    setAdditionalText(text);
    const currentSelected = getSelectedOptions();
    onChange(buildValue(currentSelected, text));
  };

  const isOptionSelected = (option: PEOption) => {
    return getSelectedOptions().includes(option.label);
  };

  return (
    <div
      className={clsx(
        'rounded-lg border transition-colors',
        isHighlighted
          ? 'border-brass bg-brass-muted/30'
          : 'border-border bg-canvas-subtle'
      )}
    >
      {/* Question header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-start gap-2">
          <span
            className={clsx(
              'px-2 py-0.5 rounded text-xs font-medium shrink-0',
              isHighlighted
                ? 'bg-brass text-white'
                : 'bg-canvas-muted text-ink-secondary'
            )}
          >
            {question.header}
          </span>
          {question.multiSelect && (
            <span className="text-xs text-ink-tertiary">(select multiple)</span>
          )}
        </div>
        <p className="mt-2 text-sm font-medium text-ink">{question.question}</p>
      </div>

      {/* Options */}
      <div className="p-3 space-y-2">
        {question.options.map((option) => {
          const isSelected = isOptionSelected(option);
          const isRecommended = option.label.includes('(Recommended)');

          return (
            <button
              key={option.label}
              onClick={() => handleOptionClick(option)}
              className={clsx(
                'w-full text-left p-3 rounded-lg border transition-all',
                'flex items-start gap-3 group',
                isSelected
                  ? 'border-brass bg-brass-muted/50 ring-1 ring-brass'
                  : 'border-border hover:border-brass-muted hover:bg-canvas-muted'
              )}
            >
              {/* Selection indicator */}
              <div className="mt-0.5 shrink-0">
                {question.multiSelect ? (
                  <div
                    className={clsx(
                      'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                      isSelected
                        ? 'bg-brass border-brass'
                        : 'border-border-strong group-hover:border-brass-muted'
                    )}
                  >
                    {isSelected && <Check size={12} className="text-white" />}
                  </div>
                ) : (
                  <div
                    className={clsx(
                      'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors',
                      isSelected
                        ? 'border-brass'
                        : 'border-border-strong group-hover:border-brass-muted'
                    )}
                  >
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-brass" />
                    )}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      'text-sm font-medium',
                      isSelected ? 'text-ink' : 'text-ink-secondary'
                    )}
                  >
                    {option.label}
                  </span>
                  {isRecommended && (
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-tertiary mt-0.5">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}

        {/* Additional input - always visible */}
        <div className="pt-2 mt-2 border-t border-border">
          <label className="text-xs text-ink-tertiary mb-1.5 block">
            Anything else? (optional)
          </label>
          <input
            type="text"
            value={additionalText}
            onChange={(e) => handleAdditionalTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onEnter) {
                e.preventDefault();
                onEnter();
              }
            }}
            placeholder="Add more context or combine ideas..."
            className={clsx(
              'w-full px-3 py-2 text-sm',
              'border border-border rounded-lg',
              'bg-surface text-ink',
              'placeholder:text-ink-muted',
              'focus:outline-none focus:border-brass focus:ring-2 focus:ring-brass-muted'
            )}
          />
        </div>
      </div>
    </div>
  );
}
