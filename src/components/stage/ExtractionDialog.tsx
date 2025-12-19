import { clsx } from 'clsx';
import { Loader2, Check } from 'lucide-react';
import { useStore } from '../../store';
import { Dialog, Button } from '../ui';

/**
 * Shared extraction dialog for design token extraction.
 * Used by both SingleView (single image) and SelectionTray (multi-select).
 * State is managed in the store so it can be triggered from anywhere.
 */
export function ExtractionDialog() {
  const extractionDialog = useStore((s) => s.extractionDialog);
  const closeExtractionDialog = useStore((s) => s.closeExtractionDialog);
  const selectExtractionDimension = useStore((s) => s.selectExtractionDimension);
  const createTokenFromExtraction = useStore((s) => s.createTokenFromExtraction);

  const {
    isOpen,
    isExtracting,
    imageIds,
    suggestedDimensions,
    selectedDimensionIndex,
  } = extractionDialog;

  const imageCount = imageIds.length;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={closeExtractionDialog}
      title="Extract Design Token"
    >
      <div className="space-y-4">
        {/* Context message - changes based on state */}
        {isExtracting && suggestedDimensions.length === 0 ? (
          <p className="text-sm text-ink-secondary">
            Analyzing {imageCount} image{imageCount !== 1 ? 's' : ''} for design dimensions...
          </p>
        ) : suggestedDimensions.length > 0 ? (
          <p className="text-sm text-ink-secondary">
            Found {suggestedDimensions.length} design dimension{suggestedDimensions.length !== 1 ? 's' : ''} from {imageCount} image{imageCount !== 1 ? 's' : ''}.
          </p>
        ) : null}

        {/* Loading state */}
        {isExtracting && suggestedDimensions.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-brass" />
          </div>
        )}

        {/* Dimension suggestions */}
        {suggestedDimensions.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-ink-secondary">
              Select a design dimension to extract
            </label>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {suggestedDimensions.map((dim, index) => (
                <button
                  key={`${dim.axis}-${index}`}
                  onClick={() => selectExtractionDimension(index)}
                  className={clsx(
                    'w-full text-left p-3 rounded-lg border transition-colors relative',
                    selectedDimensionIndex === index
                      ? 'border-brass bg-brass-muted'
                      : 'border-border hover:bg-canvas-muted'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-ink">{dim.name}</span>
                    <span className="text-xs text-ink-muted capitalize px-2 py-0.5 bg-canvas-subtle rounded">
                      {dim.axis}
                    </span>
                  </div>
                  <p className="text-xs text-ink-secondary line-clamp-2 mb-2">
                    {dim.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {dim.tags.slice(0, 5).map((tag) => (
                      <span
                        key={tag}
                        className="text-[0.65rem] px-1.5 py-0.5 bg-canvas-subtle text-ink-muted rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {dim.tags.length > 5 && (
                      <span className="text-[0.65rem] text-ink-muted">
                        +{dim.tags.length - 5} more
                      </span>
                    )}
                  </div>
                  {selectedDimensionIndex === index && (
                    <Check size={16} className="absolute top-3 right-3 text-brass-dark" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isExtracting && suggestedDimensions.length === 0 && (
          <p className="text-sm text-ink-muted text-center py-4">
            No design dimensions could be detected. Try selecting different images.
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={closeExtractionDialog}>
            Cancel
          </Button>
          <Button
            variant="brass"
            onClick={createTokenFromExtraction}
            disabled={selectedDimensionIndex === null || isExtracting}
            leftIcon={isExtracting ? <Loader2 size={14} className="animate-spin" /> : undefined}
          >
            {isExtracting ? 'Creating...' : 'Create Token'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
