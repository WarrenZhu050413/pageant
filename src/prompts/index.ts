/**
 * Prompt Templates - Frontend constructs the full prompt
 *
 * The backend receives the complete prompt text and doesn't load any templates.
 * This gives full transparency and allows instant iteration.
 *
 * Templates are organized in ./templates/ for easy editing.
 */

// Re-export templates for direct access if needed
export { VARIATION_TEMPLATE } from './templates/variation';
export { REFERENCE_TEMPLATE } from './templates/reference';
export { CONCEPT_TEMPLATE, buildConceptPrompt } from './templates/concept';
export type { ConceptPromptOptions } from './templates/concept';

// Story context building for sequential generation
export {
  buildStoryChapterContext,
  buildStoryNarrativeSection,
  MAX_CONTEXT_IMAGES,
} from './storyContext';
export type {
  StoryContextImage,
  StoryContextResult,
  BuildStoryContextOptions,
} from './storyContext';

// Design momentum for visual consistency across story chapters
export {
  aggregateStoryDesignInfo,
  buildDesignMomentumPrompt,
  createDefaultMomentum,
} from './designMomentum';
export type { AggregatedDesignInfo, AggregateDesignMomentumOptions } from './designMomentum';

// Import for internal use
import { VARIATION_TEMPLATE } from './templates/variation';
import { REFERENCE_TEMPLATE } from './templates/reference';

// ============================================================
// Prompt Builder - Constructs the full prompt from template
// ============================================================

export interface PromptBuildOptions {
  basePrompt: string;
  count: number;
  title?: string;
  contextImageCount?: number;
  template?: 'variation' | 'reference';
  exploreRatio?: number;  // 0-100, percentage of variations that explore creative directions
}

/**
 * Build a complete prompt for the generate-prompts endpoint.
 * The backend receives this as-is without any template processing.
 */
export function buildPrompt(options: PromptBuildOptions): string {
  const { basePrompt, count, title, contextImageCount = 0, template = 'variation', exploreRatio = 50 } = options;

  // Select template
  const templateText = template === 'reference' ? REFERENCE_TEMPLATE : VARIATION_TEMPLATE;

  // Build title context
  let titleContext = '';
  if (title) {
    titleContext = `USER-PROVIDED TITLE: "${title}"
Use this title as context for your variations. You may refine it or use it as-is for the output title.`;
  }

  // Build context section
  let contextSection = '';
  if (contextImageCount > 0) {
    contextSection = `
CONTEXT IMAGE POOL:
You have access to ${contextImageCount} reference images (shown below with their IDs and captions).

CRITICAL: For EACH variation, SELECT 0-3 images that BEST match that specific variation.
DO NOT include all ${contextImageCount} images - be selective!

For EACH variation you generate:
1. Review the pool and SELECT only 0-3 images that align with THIS specific variation
2. Consider: Does the image's mood, style, composition, or color palette match THIS variation's intent?
3. Put ONLY the selected image IDs in recommended_context_ids (leave empty if none are good matches)
4. Explain your selection reasoning in context_reasoning

Different variations SHOULD use different images. Not every variation needs context images.
If an image doesn't enhance a particular variation, don't include it.

If any image's caption is inadequate for generation context, suggest improvements in caption_suggestions.
`;
  }

  // Build explore ratio section
  // Calculate how many should explore vs be faithful (round up for explore)
  const exploreCount = Math.ceil(count * exploreRatio / 100);
  const faithfulCount = count - exploreCount;
  let exploreSection = '';
  if (exploreRatio === 0) {
    exploreSection = `
CRITICAL - VARIATION STYLE: FAITHFUL
ALL ${count} scenes must faithfully interpret the prompt exactly as written.
- DO NOT add unexpected elements, themes, or creative departures
- DO NOT reinterpret or transform the core concept
- Vary only technical aspects: lighting angles, camera positions, color grading
- Keep the same subject, mood, and intent the user specified
- Think of these as ${count} different "takes" of the same scene`;
  } else if (exploreRatio === 100) {
    exploreSection = `
CRITICAL - VARIATION STYLE: EXPLORATORY
ALL ${count} scenes should explore unexpected creative directions.
- Push boundaries and surprise the user
- Take artistic liberties with the prompt
- Reinterpret the concept in unexpected ways
- Vary subjects, moods, styles, and themes dramatically
- Think of these as ${count} different "remixes" of the original idea`;
  } else {
    exploreSection = `
CRITICAL - VARIATION STYLE: MIXED
- ${faithfulCount} scene(s): FAITHFUL - interpret the prompt exactly, vary only technical aspects (lighting, angle, color grading)
- ${exploreCount} scene(s): EXPLORATORY - take creative liberties, reinterpret, surprise

Clearly distinguish between faithful takes and exploratory remixes in your ${count} variations.`;
  }

  // Substitute placeholders
  return templateText
    .replace('{base_prompt}', basePrompt)
    .replace('{count}', String(count))
    .replace('{title_context}', titleContext)
    .replace('{context_section}', contextSection)
    .replace('{explore_section}', exploreSection);
}

/**
 * Template type for API requests
 */
export type PromptTemplate = 'variation' | 'reference';
