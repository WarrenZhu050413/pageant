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
    titleContext = `<user_title>
"${title}"
You may refine this title or use it as-is for the output.
</user_title>`;
  }

  // Build context section
  let contextSection = '';
  if (contextImageCount > 0) {
    // The image model (Nano Banana Pro / gemini-2.0-flash-preview-image-generation) can only use 14 images max
    const maxImagesPerVariation = Math.min(14, contextImageCount);
    contextSection = `
<context_images>
You have access to ${contextImageCount} reference images (shown below with their IDs and captions).

IMAGE MODEL CONSTRAINT: The image generation model can use at most 14 reference images per variation.
${contextImageCount > 14 ? `You have ${contextImageCount} images available - select the ${maxImagesPerVariation} most appropriate ones per variation.` : ''}

For EACH variation:
1. SELECT images that align with THIS specific variation (0-${maxImagesPerVariation} max)
2. Consider: Does the image's mood, style, composition match THIS variation's intent?
3. Put selected image IDs in recommended_context_ids (empty if none fit)
4. Explain selection in context_reasoning
5. IMPORTANT: Never recommend more than 14 images per variation (image model limit)

Different variations SHOULD use different images. Not every variation needs context images.
</context_images>
`;
  }

  // Build explore ratio section
  // Calculate how many should explore vs be faithful (round up for explore)
  const exploreCount = Math.ceil(count * exploreRatio / 100);
  const faithfulCount = count - exploreCount;
  let exploreSection = '';
  if (exploreRatio === 0) {
    exploreSection = `
<variation_style>
ALL ${count} scenes: FAITHFUL
- Interpret the prompt exactly as written
- Vary only technical aspects: lighting, camera, color grading
- Same subject, mood, and intent
- Think of these as ${count} different "takes" of the same scene
</variation_style>`;
  } else if (exploreRatio === 100) {
    exploreSection = `
<variation_style>
ALL ${count} scenes: EXPLORATORY
- Push boundaries and surprise the user
- Take artistic liberties with the prompt
- Reinterpret the concept in unexpected ways
- Think of these as ${count} different "remixes" of the original idea
</variation_style>`;
  } else {
    exploreSection = `
<variation_style>
MIXED APPROACH:
- ${faithfulCount} scene(s) FAITHFUL: interpret exactly, vary only technical aspects
- ${exploreCount} scene(s) EXPLORATORY: creative liberties, reinterpret, surprise

Clearly distinguish faithful takes vs exploratory remixes.
</variation_style>`;
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
