/**
 * Concept Template - For generating concept images from design tokens
 *
 * Used when extracting a design dimension from an existing image and
 * generating a pure abstract representation of that dimension.
 *
 * Adapted from Gemini's official image generation prompt guide:
 * https://ai.google.dev/gemini-api/docs/image-generation
 *
 * Applies specificity principles (color, texture, lighting, style)
 * to design token extraction and abstract concept generation.
 */

export const CONCEPT_TEMPLATE = `Generate a pure abstract concept image that extracts and amplifies the following design dimension from the attached source image.

═══════════════════════════════════════════════════════════════════════════════
DIMENSION TO EXTRACT
═══════════════════════════════════════════════════════════════════════════════

Dimension: {dimension_name}
Axis: {axis}
Description: {description}

Visual direction:
{generation_prompt}

═══════════════════════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════════════════════

Study the attached source image carefully. Create an ABSTRACT concept image that:

1. DISTILLS the "{dimension_name}" quality into pure visual essence
   - Identify what makes this dimension present in the source
   - Abstract it away from the specific subject matter
   - Capture the underlying visual principle, not the content

2. AMPLIFIES this specific design dimension
   - Make this quality the dominant feature of your concept image
   - Intensify or clarify what may be subtle in the source
   - Create a reference that embodies this quality in concentrated form

3. REMAINS ABSTRACT
   - No recognizable objects, people, or scenes
   - Use texture, color, form, rhythm, and spatial relationships
   - Think: mood board swatch, design token visualization, pure visual quality

═══════════════════════════════════════════════════════════════════════════════
CONCEPT IMAGE STRUCTURE
═══════════════════════════════════════════════════════════════════════════════

Your abstract concept should address:

COLORS & TONES
- Extract the exact color relationships from the source
- Note: hue values, temperature, saturation levels, contrast ratios
- Preserve or amplify the color mood

TEXTURE & SURFACE
- Capture the tactile quality (smooth/rough, glossy/matte, organic/mechanical)
- Include grain, noise, or texture patterns if present
- Specify the "feel" of the visual

SPATIAL ORGANIZATION
- How is depth created? (layered, flat, atmospheric perspective)
- What is the compositional rhythm? (centered, diagonal, scattered)
- How does negative space function?

LIGHTING & LUMINOSITY
- Direction and quality of light
- How do highlights and shadows behave?
- Is there self-illumination, backlighting, diffused glow?

RENDERING STYLE
- What medium does this evoke? (photographic, painted, digital, graphic)
- What era or movement does it reference?
- What production technique is implied?

═══════════════════════════════════════════════════════════════════════════════
OUTPUT
═══════════════════════════════════════════════════════════════════════════════

Generate a single cohesive prompt (3-5 sentences) that could recreate the "{dimension_name}" quality as pure abstract visual art. The prompt should be specific enough that someone unfamiliar with the source image could generate a concept that captures this same visual quality.

Do NOT describe the source image. Describe the abstract concept that extracts its essential design quality.
`;

/**
 * Build concept generation prompt from a design dimension
 */
export interface ConceptPromptOptions {
  dimensionName: string;
  axis: string;
  description: string;
  generationPrompt: string;
}

export function buildConceptPrompt(options: ConceptPromptOptions): string {
  const { dimensionName, axis, description, generationPrompt } = options;

  return CONCEPT_TEMPLATE
    .replace(/{dimension_name}/g, dimensionName)
    .replace('{axis}', axis)
    .replace('{description}', description)
    .replace('{generation_prompt}', generationPrompt);
}
