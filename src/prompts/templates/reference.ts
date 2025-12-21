/**
 * Reference Template - For generating abstract concept/reference images
 *
 * Used when generating abstract visual references that capture pure
 * design qualities (textures, patterns, color moods) rather than scenes.
 */

export const REFERENCE_TEMPLATE = `You are a visual design director creating reference/concept images for a design system.
Generate abstract concept image descriptions for AI image generation.

{title_context}

Generate {count} diverse CONCEPT IMAGE descriptions based on this visual direction:

"{base_prompt}"

{context_section}

CONCEPT IMAGE REQUIREMENTS:
These are NOT scene illustrations. They are ABSTRACT REFERENCE IMAGES that capture pure visual qualities.

Each description should create an image that:
1. Is abstract, textural, or pattern-based - NOT depicting recognizable objects or scenes
2. Captures a specific visual quality (color mood, texture, rhythm, spatial energy)
3. Could serve as a mood board reference or design token
4. Strongly communicates aesthetic feeling through pure visual form
5. Is suitable as reference material for other designs

EXAMPLES of good concept images:
- "Layered gradient fog in amber and slate, with soft horizontal banding and atmospheric depth"
- "Crystalline fractal patterns in deep teal with luminous gold veins, sharp geometric intersections"
- "Organic ink wash in midnight blue, irregular bleeding edges, watercolor texture on rough paper"
- "Kinetic diagonal stripes alternating warm cream and burnt sienna, motion blur effect at edges"

Each variation needs a SHORT, EVOCATIVE TITLE (2-5 words) that names the visual concept.

Design tag guidelines (select 1-3 per axis based on the concept):

- colors:
  Palette type: monochromatic, complementary, analogous, triadic, split-complementary
  Temperature: warm, cool, neutral
  Saturation: vibrant, muted, pastel, saturated, earthy
  Contrast: high-contrast, low-contrast, subtle-gradients
  Mood-based: moody-dark, light-airy, rich-jewel-tones, soft-naturals

- composition:
  Balance: symmetrical, asymmetrical, centered, radial
  Flow: diagonal, horizontal, vertical, curved, organic
  Depth: layered, shallow, deep, atmospheric-perspective
  Space: negative-space, dense, expansive, contained

- layout:
  Structure: grid, modular, freeform, geometric, organic
  Density: dense, spacious, balanced, scattered
  Movement: static, dynamic, flowing, rhythmic

- aesthetic:
  Texture: smooth, rough, textured, glossy, matte, grainy
  Style: abstract, minimalist, maximalist, organic, geometric
  Medium: digital, painted, photographic, graphic, mixed-media
  Mood: serene, energetic, dramatic, ethereal, grounded

TITLE:
Generate a short title (2-5 words) for this collection of concept references.

DESIGN DIMENSIONS:
For EACH concept, generate 3-4 design dimensions that describe its visual qualities.

Each dimension must have:
- axis: One of the four core axes (colors, composition, layout, aesthetic)
- name: A substantial 4-6 word name capturing the visual quality
- description: 2-3 sentences explaining the visual effect
- tags: 3-5 specific tags from the axis vocabulary
- generation_prompt: A detailed prompt (1-2 sentences) to recreate this pure visual quality
`;
