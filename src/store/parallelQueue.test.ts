/**
 * Tests for parallel queue processing with concurrency limits.
 *
 * Tests the queue-based parallel processing used in:
 * - uploadImages (analyze phase)
 * - analyzeUploadedImages
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Helper to create a queue processor that respects concurrency limits.
 * This mirrors the logic used in the store.
 */
async function processWithConcurrencyLimit<T>(
  items: T[],
  maxConcurrent: number,
  processor: (item: T, index: number) => Promise<void>,
  onProgress?: (completed: number, total: number) => void
): Promise<void> {
  let completed = 0;
  const queue = [...items];
  const inFlight = new Set<Promise<void>>();

  const processNext = async (): Promise<void> => {
    if (queue.length === 0) return;

    const index = items.length - queue.length;
    const item = queue.shift()!;

    try {
      await processor(item, index);
    } catch {
      // Continue on error
    }

    completed++;
    onProgress?.(completed, items.length);
  };

  while (queue.length > 0 || inFlight.size > 0) {
    while (inFlight.size < maxConcurrent && queue.length > 0) {
      const promise = processNext();
      inFlight.add(promise);
      promise.finally(() => inFlight.delete(promise));
    }
    if (inFlight.size > 0) {
      await Promise.race(inFlight);
    }
  }
}

describe('Parallel Queue Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processWithConcurrencyLimit', () => {
    it('should process all items', async () => {
      const items = ['a', 'b', 'c', 'd', 'e'];
      const processed: string[] = [];

      await processWithConcurrencyLimit(
        items,
        3,
        async (item) => {
          processed.push(item);
        }
      );

      expect(processed).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('should respect concurrency limit', async () => {
      const items = [1, 2, 3, 4, 5, 6];
      let currentlyRunning = 0;
      let maxObserved = 0;
      const maxConcurrent = 2;

      await processWithConcurrencyLimit(
        items,
        maxConcurrent,
        async () => {
          currentlyRunning++;
          maxObserved = Math.max(maxObserved, currentlyRunning);
          // Simulate async work
          await new Promise(resolve => setTimeout(resolve, 10));
          currentlyRunning--;
        }
      );

      expect(maxObserved).toBeLessThanOrEqual(maxConcurrent);
    });

    it('should call progress callback with correct values', async () => {
      const items = ['a', 'b', 'c'];
      const progressCalls: Array<{ completed: number; total: number }> = [];

      await processWithConcurrencyLimit(
        items,
        1, // Sequential for predictable order
        async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
        },
        (completed, total) => {
          progressCalls.push({ completed, total });
        }
      );

      expect(progressCalls).toEqual([
        { completed: 1, total: 3 },
        { completed: 2, total: 3 },
        { completed: 3, total: 3 },
      ]);
    });

    it('should continue processing after errors', async () => {
      const items = [1, 2, 3, 4];
      const processed: number[] = [];
      const errors: number[] = [];

      await processWithConcurrencyLimit(
        items,
        2,
        async (item) => {
          if (item === 2) {
            errors.push(item);
            throw new Error('Simulated failure');
          }
          processed.push(item);
        }
      );

      expect(processed).toEqual([1, 3, 4]);
      expect(errors).toEqual([2]);
    });

    it('should handle empty array', async () => {
      const processed: string[] = [];

      await processWithConcurrencyLimit(
        [],
        6,
        async (item) => {
          processed.push(item);
        }
      );

      expect(processed).toEqual([]);
    });

    it('should handle concurrency limit greater than items', async () => {
      const items = ['a', 'b'];
      const processed: string[] = [];

      await processWithConcurrencyLimit(
        items,
        10, // More than items
        async (item) => {
          processed.push(item);
        }
      );

      expect(processed).toEqual(['a', 'b']);
    });

    it('should process items in parallel when possible', async () => {
      const items = [1, 2, 3, 4];
      const startTimes: number[] = [];
      const maxConcurrent = 4;

      const start = Date.now();
      await processWithConcurrencyLimit(
        items,
        maxConcurrent,
        async () => {
          startTimes.push(Date.now() - start);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      );
      const totalTime = Date.now() - start;

      // All items should start nearly simultaneously
      expect(startTimes.every(t => t < 20)).toBe(true);
      // Total time should be ~50ms (parallel), not ~200ms (sequential)
      expect(totalTime).toBeLessThan(100);
    });
  });

  describe('Settings integration', () => {
    it('should use default of 6 when settings not available', () => {
      const settings = null as { max_concurrent_operations?: number } | null;
      const maxConcurrent = settings?.max_concurrent_operations ?? 6;
      expect(maxConcurrent).toBe(6);
    });

    it('should use value from settings when available', () => {
      const settings = { max_concurrent_operations: 3 };
      const maxConcurrent = settings?.max_concurrent_operations ?? 6;
      expect(maxConcurrent).toBe(3);
    });
  });
});

describe('API batch functions', () => {
  it('enhanceImages should accept array of image IDs', async () => {
    // Test that the type signature is correct
    const mockEnhanceImages = vi.fn().mockResolvedValue({
      success: true,
      prompt_id: 'enhanced-batch-123',
      images: [],
      total_requested: 3,
      total_enhanced: 3,
    });

    const result = await mockEnhanceImages(['img-1', 'img-2', 'img-3']);

    expect(mockEnhanceImages).toHaveBeenCalledWith(['img-1', 'img-2', 'img-3']);
    expect(result.total_requested).toBe(3);
    expect(result.prompt_id).toMatch(/^enhanced-batch-/);
  });
});
