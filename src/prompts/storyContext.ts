/**
 * Story Context Builder - Assembles context images for story chapter generation
 *
 * This module builds the context for generating images in a story chapter,
 * including character references with labels and previous/next chapter context.
 *
 * The annotation override pattern adds semantic labels like:
 * - [CHARACTER: Luna] front view, red hair
 * - [PREVIOUS: The Forest] Luna discovers the hidden path
 * - [2 CHAPTERS BACK: The Beginning] introducing the world
 * - [NEXT: The Cave] approaching the entrance
 * - [2 CHAPTERS AHEAD: The Finale] the final confrontation
 *
 * PRIORITIZATION (when context exceeds 14 image limit):
 * 1. Character references (most important for visual consistency)
 * 2. Previous chapters, ordered by proximity (closest first, furthest dropped first)
 * 3. Next chapters, ordered by proximity (closest first, furthest dropped first)
 *
 * This ensures narrative continuity with adjacent chapters while still
 * including broader context from the full story when space permits.
 */

import type { Story, CharacterReference, ImageData } from '../types';

/**
 * Maximum number of context images the backend accepts
 */
export const MAX_CONTEXT_IMAGES = 14;

/**
 * Context image with annotation override for story generation
 */
export interface StoryContextImage {
  imageId: string;
  annotation: string;  // Combined label + existing annotation
  category: 'character' | 'previous' | 'next';  // For prioritization
}

/**
 * Result of building story context with truncation info
 */
export interface StoryContextResult {
  images: StoryContextImage[];
  truncated: boolean;
  originalCount: number;
  /** Breakdown of what was included/dropped */
  breakdown: {
    characters: { included: number; total: number };
    previous: { included: number; total: number };
    next: { included: number; total: number };
  };
}

/**
 * Options for building story chapter context
 */
export interface BuildStoryContextOptions {
  story: Story;
  chapterIndex: number;
  characters: CharacterReference[];
  /**
   * Function to get image data by ID (including its existing annotation)
   */
  getImageData: (imageId: string) => ImageData | null;
  /**
   * Maximum context images (defaults to MAX_CONTEXT_IMAGES)
   */
  maxImages?: number;
}

/**
 * Build annotation override by combining a semantic label with existing annotation
 */
function buildAnnotationOverride(
  label: string,
  existingAnnotation?: string
): string {
  if (existingAnnotation) {
    return `${label} ${existingAnnotation}`;
  }
  return label;
}

/**
 * Build story chapter context with semantic labels for characters and chapter continuity.
 *
 * Returns context images with annotation overrides, respecting the MAX_CONTEXT_IMAGES limit.
 * Priority order when truncating:
 * 1. Character references (most important for consistency)
 * 2. Previous chapter images (continuity)
 * 3. Next chapter images (least important, dropped first)
 *
 * @example
 * ```typescript
 * const result = buildStoryChapterContext({
 *   story,
 *   chapterIndex: 2,
 *   characters: [lunaCharacter, wizardCharacter],
 *   getImageData: (id) => getImage(id),
 * });
 *
 * if (result.truncated) {
 *   console.warn(`Context truncated: ${result.originalCount} → ${result.images.length}`);
 * }
 *
 * // Set context images and overrides
 * for (const { imageId, annotation } of result.images) {
 *   setContextAnnotationOverride(imageId, annotation);
 * }
 * setContextImages(result.images.map(c => c.imageId));
 * ```
 */
export function buildStoryChapterContext(
  options: BuildStoryContextOptions
): StoryContextResult {
  const { story, chapterIndex, characters, getImageData, maxImages = MAX_CONTEXT_IMAGES } = options;

  // Collect images by category for prioritization
  const characterImages: StoryContextImage[] = [];
  const previousImages: StoryContextImage[] = [];
  const nextImages: StoryContextImage[] = [];

  // 1. Character references with their annotations
  const storyCharacterIds = story.character_ids || [];
  for (const char of characters) {
    // Only include characters that are part of this story
    if (!storyCharacterIds.includes(char.id)) continue;

    for (const ref of char.reference_images) {
      const imageData = getImageData(ref.image_id);
      if (!imageData) continue;

      // Build label: [CHARACTER: Name] + optional description
      let label = `[CHARACTER: ${char.name}]`;
      if (char.description) {
        label += ` ${char.description}.`;
      }

      // Combine: character label + per-ref annotation or image annotation
      const perImageAnnotation = ref.annotation || imageData.annotation;
      const fullAnnotation = buildAnnotationOverride(label, perImageAnnotation);

      characterImages.push({
        imageId: ref.image_id,
        annotation: fullAnnotation,
        category: 'character',
      });
    }
  }

  // 2. Previous chapter images - ordered by proximity (closest first, furthest last)
  // This ensures when truncating, furthest chapters are dropped first
  for (let prevIdx = chapterIndex - 1; prevIdx >= 0; prevIdx--) {
    const prevChapter = story.chapters[prevIdx];
    if (!prevChapter) continue;

    const distance = chapterIndex - prevIdx;
    const distanceLabel = distance === 1 ? 'PREVIOUS' : `${distance} CHAPTERS BACK`;

    for (const imageId of prevChapter.image_ids) {
      const imageData = getImageData(imageId);
      if (!imageData) continue;

      const label = `[${distanceLabel}: ${prevChapter.title || 'Untitled'}]`;
      const fullAnnotation = buildAnnotationOverride(label, imageData.annotation);

      previousImages.push({
        imageId,
        annotation: fullAnnotation,
        category: 'previous',
      });
    }
  }

  // 3. Next chapter images - ordered by proximity (closest first, furthest last)
  for (let nextIdx = chapterIndex + 1; nextIdx < story.chapters.length; nextIdx++) {
    const nextChapter = story.chapters[nextIdx];
    if (!nextChapter) continue;

    const distance = nextIdx - chapterIndex;
    const distanceLabel = distance === 1 ? 'NEXT' : `${distance} CHAPTERS AHEAD`;

    for (const imageId of nextChapter.image_ids) {
      const imageData = getImageData(imageId);
      if (!imageData) continue;

      const label = `[${distanceLabel}: ${nextChapter.title || 'Untitled'}]`;
      const fullAnnotation = buildAnnotationOverride(label, imageData.annotation);

      nextImages.push({
        imageId,
        annotation: fullAnnotation,
        category: 'next',
      });
    }
  }

  // Calculate totals
  const totalCharacters = characterImages.length;
  const totalPrevious = previousImages.length;
  const totalNext = nextImages.length;
  const originalCount = totalCharacters + totalPrevious + totalNext;

  // Apply prioritization if over limit
  // Priority: characters > previous > next
  const result: StoryContextImage[] = [];
  let remaining = maxImages;

  // 1. Add character images first (up to limit)
  const includedCharacters = characterImages.slice(0, remaining);
  result.push(...includedCharacters);
  remaining -= includedCharacters.length;

  // 2. Add previous chapter images (up to remaining)
  const includedPrevious = previousImages.slice(0, remaining);
  result.push(...includedPrevious);
  remaining -= includedPrevious.length;

  // 3. Add next chapter images (up to remaining)
  const includedNext = nextImages.slice(0, remaining);
  result.push(...includedNext);

  return {
    images: result,
    truncated: originalCount > maxImages,
    originalCount,
    breakdown: {
      characters: { included: includedCharacters.length, total: totalCharacters },
      previous: { included: includedPrevious.length, total: totalPrevious },
      next: { included: includedNext.length, total: totalNext },
    },
  };
}

/**
 * Legacy function that returns just the images array (for backward compatibility)
 * @deprecated Use buildStoryChapterContext which returns StoryContextResult
 */
export function buildStoryChapterContextSimple(
  options: BuildStoryContextOptions
): StoryContextImage[] {
  return buildStoryChapterContext(options).images;
}

/**
 * Build a narrative prompt section for story chapter generation.
 * This adds story/chapter context to the user's base prompt.
 */
export function buildStoryNarrativeSection(
  story: Story,
  chapterIndex: number,
  characters: CharacterReference[]
): string {
  const chapter = story.chapters[chapterIndex];
  if (!chapter) return '';

  const parts: string[] = [];

  // Story context
  parts.push(`STORY: "${story.title}"`);
  if (story.description) {
    parts.push(`Story description: ${story.description}`);
  }

  // Chapter context
  parts.push(`\nCURRENT CHAPTER: "${chapter.title || 'Untitled'}"`);
  if (chapter.text) {
    parts.push(`Chapter narrative: ${chapter.text}`);
  }
  parts.push(`Chapter position: ${chapterIndex + 1} of ${story.chapters.length}`);

  // Character context
  const storyCharacterIds = story.character_ids || [];
  const storyCharacters = characters.filter(c => storyCharacterIds.includes(c.id));
  if (storyCharacters.length > 0) {
    parts.push('\nCHARACTERS IN THIS STORY:');
    for (const char of storyCharacters) {
      let charDesc = `- ${char.name}`;
      if (char.description) {
        charDesc += `: ${char.description}`;
      }
      charDesc += ` (${char.reference_images.length} reference images provided)`;
      parts.push(charDesc);
    }
  }

  // Previous chapter summary for continuity
  if (chapterIndex > 0) {
    const prevChapter = story.chapters[chapterIndex - 1];
    if (prevChapter) {
      parts.push(`\nPREVIOUS CHAPTER: "${prevChapter.title || 'Untitled'}"`);
      if (prevChapter.text) {
        parts.push(`Previous narrative: ${prevChapter.text}`);
      }
    }
  }

  return parts.join('\n');
}
