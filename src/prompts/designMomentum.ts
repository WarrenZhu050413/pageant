/**
 * Design Momentum - Aggregate and apply visual consistency across story chapters
 *
 * Analyzes images in a story to find patterns in liked design dimensions and tags,
 * then includes these preferences in generation context for visual consistency.
 */

import type { Story, ImageData, StoryDesignMomentum, LikedAxes, DesignDimension } from '../types';

/**
 * Aggregate design preferences from all images in a story
 * Returns a computed design momentum based on liked axes and dimensions
 */
export interface AggregateDesignMomentumOptions {
  story: Story;
  getImageData: (imageId: string) => ImageData | null;
}

export interface AggregatedDesignInfo {
  // Count of how many times each tag was liked (axis -> tag -> count)
  likedTagCounts: Record<string, Record<string, number>>;
  // Count of how many times each dimension axis was liked
  likedDimensionCounts: Record<string, number>;
  // Most common dimensions per axis (axis -> dimension)
  topDimensions: Record<string, DesignDimension>;
  // Total images analyzed
  totalImages: number;
  // Images with design data
  imagesWithDesign: number;
}

/**
 * Aggregate design information from all chapter images in a story
 */
export function aggregateStoryDesignInfo(
  options: AggregateDesignMomentumOptions
): AggregatedDesignInfo {
  const { story, getImageData } = options;

  const likedTagCounts: Record<string, Record<string, number>> = {};
  const likedDimensionCounts: Record<string, number> = {};
  const dimensionExamples: Record<string, DesignDimension[]> = {};
  let totalImages = 0;
  let imagesWithDesign = 0;

  // Iterate through all chapter images
  for (const chapter of story.chapters) {
    for (const imageId of chapter.image_ids) {
      const imageData = getImageData(imageId);
      if (!imageData) continue;

      totalImages++;

      // Track liked axes (tags)
      if (imageData.liked_axes) {
        for (const [axis, tags] of Object.entries(imageData.liked_axes)) {
          if (!tags || tags.length === 0) continue;

          if (!likedTagCounts[axis]) {
            likedTagCounts[axis] = {};
          }

          for (const tag of tags) {
            likedTagCounts[axis][tag] = (likedTagCounts[axis][tag] || 0) + 1;
          }
        }
      }

      // Track liked dimension axes
      if (imageData.liked_dimension_axes && imageData.liked_dimension_axes.length > 0) {
        imagesWithDesign++;

        for (const axis of imageData.liked_dimension_axes) {
          likedDimensionCounts[axis] = (likedDimensionCounts[axis] || 0) + 1;

          // Store the dimension example for this axis
          if (imageData.design_dimensions?.[axis]) {
            if (!dimensionExamples[axis]) {
              dimensionExamples[axis] = [];
            }
            dimensionExamples[axis].push(imageData.design_dimensions[axis]);
          }
        }
      }
    }
  }

  // Find top dimension for each axis (use the first example for simplicity)
  const topDimensions: Record<string, DesignDimension> = {};
  for (const [axis, dimensions] of Object.entries(dimensionExamples)) {
    if (dimensions.length > 0) {
      topDimensions[axis] = dimensions[0];
    }
  }

  return {
    likedTagCounts,
    likedDimensionCounts,
    topDimensions,
    totalImages,
    imagesWithDesign,
  };
}

/**
 * Build a design momentum prompt section from aggregated design info
 * This adds style consistency instructions to the generation prompt
 */
export function buildDesignMomentumPrompt(
  designInfo: AggregatedDesignInfo,
  storyMomentum?: StoryDesignMomentum
): string {
  const parts: string[] = [];

  // Add user-defined style prompt if present
  if (storyMomentum?.style_prompt) {
    parts.push(`STORY STYLE: ${storyMomentum.style_prompt}`);
  }

  // Add locked dimensions
  if (storyMomentum?.locked_dimensions && Object.keys(storyMomentum.locked_dimensions).length > 0) {
    parts.push('\nLOCKED DESIGN ELEMENTS (maintain these across all chapters):');
    for (const [axis, dimensionName] of Object.entries(storyMomentum.locked_dimensions)) {
      const dimension = designInfo.topDimensions[axis];
      if (dimension) {
        parts.push(`- ${axis.toUpperCase()}: "${dimensionName}" - ${dimension.description}`);
      } else {
        parts.push(`- ${axis.toUpperCase()}: "${dimensionName}"`);
      }
    }
  }

  // Add aggregated liked tags
  if (Object.keys(designInfo.likedTagCounts).length > 0) {
    parts.push('\nPREFERRED DESIGN ELEMENTS (from liked images):');
    for (const [axis, tagCounts] of Object.entries(designInfo.likedTagCounts)) {
      // Sort by count descending, take top 3
      const sortedTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag]) => tag);

      if (sortedTags.length > 0) {
        parts.push(`- ${axis}: ${sortedTags.join(', ')}`);
      }
    }
  }

  // Add top liked dimensions
  if (Object.keys(designInfo.likedDimensionCounts).length > 0) {
    parts.push('\nPREFERRED DESIGN DIMENSIONS:');
    // Sort by count, take top 3
    const sortedDimensions = Object.entries(designInfo.likedDimensionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    for (const [axis] of sortedDimensions) {
      const dimension = designInfo.topDimensions[axis];
      if (dimension) {
        parts.push(`- ${axis}: "${dimension.name}" - ${dimension.description}`);
      }
    }
  }

  return parts.join('\n');
}

/**
 * Convert aggregated design info to a StoryDesignMomentum for storage
 * Takes the most popular liked items and creates default momentum
 */
export function createDefaultMomentum(
  designInfo: AggregatedDesignInfo
): StoryDesignMomentum {
  // Build aggregated liked axes from top tags
  const aggregated_liked_axes: LikedAxes = {};
  for (const [axis, tagCounts] of Object.entries(designInfo.likedTagCounts)) {
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);

    if (topTags.length > 0) {
      aggregated_liked_axes[axis] = topTags;
    }
  }

  // Build locked dimensions from top liked dimensions
  const locked_dimensions: Record<string, string> = {};
  const topDimensionAxes = Object.entries(designInfo.likedDimensionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  for (const [axis] of topDimensionAxes) {
    const dimension = designInfo.topDimensions[axis];
    if (dimension) {
      locked_dimensions[axis] = dimension.name;
    }
  }

  return {
    locked_dimensions: Object.keys(locked_dimensions).length > 0 ? locked_dimensions : undefined,
    aggregated_liked_axes: Object.keys(aggregated_liked_axes).length > 0 ? aggregated_liked_axes : undefined,
  };
}
