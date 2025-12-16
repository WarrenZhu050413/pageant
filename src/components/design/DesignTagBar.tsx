import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { X, Plus, ChevronDown } from 'lucide-react';
import { DESIGN_AXES } from '../../types';

interface DesignTagBarProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  className?: string;
}

export function DesignTagBar({ tags, onTagsChange, className }: DesignTagBarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [customTag, setCustomTag] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
    }
    setCustomTag('');
    setIsDropdownOpen(false);
  };

  const removeTag = (tag: string) => {
    onTagsChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customTag.trim()) {
      e.preventDefault();
      addTag(customTag);
    }
    if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  // Group available tags by category
  const groupedTags = Object.entries(DESIGN_AXES).reduce(
    (acc, [category, categoryTags]) => {
      const available = categoryTags.filter((t) => !tags.includes(t));
      if (available.length > 0) {
        acc[category] = available;
      }
      return acc;
    },
    {} as Record<string, readonly string[]>
  );

  return (
    <div className={clsx('flex flex-wrap items-center gap-1.5', className)}>
      {/* Existing tags */}
      {tags.map((tag) => (
        <span
          key={tag}
          className={clsx(
            'inline-flex items-center gap-1 px-2 py-0.5',
            'text-xs font-medium',
            'bg-brass-muted text-brass-dark rounded',
            'group'
          )}
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            className="opacity-50 hover:opacity-100 transition-opacity"
            aria-label={`Remove ${tag}`}
          >
            <X size={12} />
          </button>
        </span>
      ))}

      {/* Add tag dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={clsx(
            'inline-flex items-center gap-1 px-2 py-0.5',
            'text-xs font-medium',
            'border border-dashed border-ink-muted/50 rounded',
            'text-ink-muted hover:text-ink hover:border-ink-muted',
            'transition-colors'
          )}
        >
          <Plus size={12} />
          Add tag
          <ChevronDown size={12} />
        </button>

        {isDropdownOpen && (
          <div
            className={clsx(
              'absolute top-full left-0 mt-1 z-50',
              'w-56 max-h-64 overflow-auto',
              'bg-surface rounded-lg shadow-xl border border-border',
              'py-2'
            )}
          >
            {/* Custom tag input */}
            <div className="px-2 pb-2 mb-2 border-b border-border">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type custom tag..."
                className={clsx(
                  'w-full px-2 py-1 text-xs',
                  'bg-canvas-muted rounded',
                  'border border-transparent focus:border-brass',
                  'outline-none'
                )}
                autoFocus
              />
            </div>

            {/* Grouped tags */}
            {Object.entries(groupedTags).map(([category, categoryTags]) => (
              <div key={category} className="mb-2">
                <div className="px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-wider text-ink-muted">
                  {category}
                </div>
                <div className="flex flex-wrap gap-1 px-2">
                  {categoryTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => addTag(tag)}
                      className={clsx(
                        'px-2 py-0.5 text-xs',
                        'bg-canvas-muted hover:bg-brass-muted',
                        'text-ink-secondary hover:text-brass-dark',
                        'rounded transition-colors'
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
