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
}

/**
 * Build a complete prompt for the generate-prompts endpoint.
 * The backend receives this as-is without any template processing.
 */
export function buildPrompt(options: PromptBuildOptions): string {
  const { basePrompt, count, title, contextImageCount = 0, template = 'variation' } = options;

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

For EACH variation you generate:
1. Select which images from the pool would be most helpful as generation context
2. Consider: Does the image's mood, style, composition, or color palette align with THIS variation?
3. Assign 0-3 images per variation via the recommended_context_ids field
4. Explain your reasoning in context_reasoning

Different variations may use different images - match context to each variation's specific needs.

If any image's caption is inadequate for generation context, suggest improvements in caption_suggestions.
`;
  }

  // Substitute placeholders
  return templateText
    .replace('{base_prompt}', basePrompt)
    .replace('{count}', String(count))
    .replace('{title_context}', titleContext)
    .replace('{context_section}', contextSection);
}

/**
 * Template type for API requests
 */
export type PromptTemplate = 'variation' | 'reference';
