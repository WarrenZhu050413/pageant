import { useState } from 'react';
import { clsx } from 'clsx';
import { Heart, Plus, X } from 'lucide-react';
import { DESIGN_AXES, type LikedAxes, type DesignAxis } from '../../types';

interface AxisPreferenceButtonsProps {
  tags: string[];  // Current design_tags on the image
  likedAxes: LikedAxes;  // { axis: ["tag1", "tag2"] }
  onTagToggle: (axis: DesignAxis, tag: string, liked: boolean) => void;
  onAddTag: (tag: string) => void;
  className?: string;
}

const AXIS_LABELS: Record<DesignAxis, string> = {
  typeface: 'Typeface',
  colors: 'Colors',
  layout: 'Layout',
  mood: 'Mood',
  composition: 'Composition',
  style: 'Style',
};

// Get which axis a tag belongs to
function getTagAxis(tag: string): DesignAxis | null {
  for (const [axis, axisTags] of Object.entries(DESIGN_AXES)) {
    if ((axisTags as readonly string[]).includes(tag)) {
      return axis as DesignAxis;
    }
  }
  return null;
}

// Group tags by their axis
function groupTagsByAxis(tags: string[]): Record<DesignAxis, string[]> {
  const grouped: Record<DesignAxis, string[]> = {
    typeface: [],
    colors: [],
    layout: [],
    mood: [],
    composition: [],
    style: [],
  };

  for (const tag of tags) {
    const axis = getTagAxis(tag);
    if (axis) {
      grouped[axis].push(tag);
    }
  }

  return grouped;
}

export function AxisPreferenceButtons({
  tags,
  likedAxes,
  onTagToggle,
  onAddTag,
  className,
}: AxisPreferenceButtonsProps) {
  const [showAddFor, setShowAddFor] = useState<DesignAxis | null>(null);

  const groupedTags = groupTagsByAxis(tags);
  const axesWithTags = (Object.entries(groupedTags) as [DesignAxis, string[]][]).filter(
    ([, axisTags]) => axisTags.length > 0
  );

  // Check if a tag is liked
  const isTagLiked = (axis: DesignAxis, tag: string): boolean => {
    return likedAxes[axis]?.includes(tag) ?? false;
  };

  // Get available tags for quick-add (not already added)
  const getAvailableTags = (axis: DesignAxis): string[] => {
    const axisTags = DESIGN_AXES[axis] as readonly string[];
    return axisTags.filter((t) => !tags.includes(t));
  };

  if (tags.length === 0) {
    return (
      <div className={clsx('text-xs text-ink-muted italic', className)}>
        Add tags above to rate design decisions
      </div>
    );
  }

  return (
    <div className={clsx('space-y-2', className)}>
      <div className="text-[0.6rem] font-medium uppercase tracking-wider text-ink-muted">
        What do you like about this?
      </div>

      {axesWithTags.map(([axis, axisTags]) => (
        <div key={axis} className="flex items-start gap-2">
          {/* Axis label */}
          <span className="text-[0.6rem] font-medium text-ink-muted uppercase w-16 pt-1.5 flex-shrink-0">
            {AXIS_LABELS[axis]}
          </span>

          {/* Tag buttons */}
          <div className="flex flex-wrap gap-1.5 flex-1">
            {axisTags.map((tag) => {
              const liked = isTagLiked(axis, tag);
              return (
                <button
                  key={tag}
                  onClick={() => onTagToggle(axis, tag, !liked)}
                  className={clsx(
                    'inline-flex items-center gap-1 px-2 py-1',
                    'text-xs font-medium rounded-full',
                    'transition-all duration-150',
                    liked
                      ? 'bg-favorite/15 text-favorite border border-favorite/30'
                      : 'bg-canvas-muted text-ink-secondary border border-transparent hover:text-ink hover:bg-canvas-subtle'
                  )}
                >
                  <Heart
                    size={11}
                    fill={liked ? 'currentColor' : 'none'}
                    className={clsx('transition-transform', liked && 'scale-110')}
                  />
                  {tag}
                </button>
              );
            })}

            {/* Quick add button */}
            {showAddFor === axis ? (
              <div className="relative">
                <div className="flex items-center gap-1 bg-surface border border-border rounded-full px-2 py-0.5">
                  <select
                    autoFocus
                    onChange={(e) => {
                      if (e.target.value) {
                        onAddTag(e.target.value);
                        setShowAddFor(null);
                      }
                    }}
                    onBlur={() => setShowAddFor(null)}
                    className="text-xs bg-transparent outline-none cursor-pointer"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select...
                    </option>
                    {getAvailableTags(axis).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowAddFor(null)}
                    className="text-ink-muted hover:text-ink"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ) : (
              getAvailableTags(axis).length > 0 && (
                <button
                  onClick={() => setShowAddFor(axis)}
                  className={clsx(
                    'inline-flex items-center gap-0.5 px-2 py-1',
                    'text-xs text-ink-muted rounded-full',
                    'border border-dashed border-ink-muted/40',
                    'hover:border-ink-muted hover:text-ink',
                    'transition-colors'
                  )}
                >
                  <Plus size={10} />
                </button>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
