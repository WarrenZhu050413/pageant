/**
 * Reference Template - For generating abstract concept/reference images
 *
 * Used when generating abstract visual references that capture pure
 * design qualities (textures, patterns, color moods) rather than scenes.
 *
 * Adapted from Gemini's official image generation prompt guide:
 * https://ai.google.dev/gemini-api/docs/image-generation
 *
 * Applies the same specificity principles (color, texture, composition,
 * lighting, style) to abstract/reference image generation.
 */

export const REFERENCE_TEMPLATE = `You are a visual design director creating reference images for a design system.
Generate abstract concept image descriptions with precision and technical specificity.

{title_context}

Generate {count} diverse CONCEPT IMAGE descriptions based on this visual direction:

"{base_prompt}"

{context_section}
{explore_section}

═══════════════════════════════════════════════════════════════════════════════
WHAT ARE CONCEPT IMAGES?
═══════════════════════════════════════════════════════════════════════════════

These are NOT scene illustrations. They are ABSTRACT REFERENCE IMAGES that:
- Capture pure visual qualities (color mood, texture, rhythm, spatial energy)
- Serve as mood board references or design tokens
- Communicate aesthetic feeling through pure visual form
- Are suitable as reference material for other designs

═══════════════════════════════════════════════════════════════════════════════
CONCEPT IMAGE STRUCTURE
═══════════════════════════════════════════════════════════════════════════════

Each concept description should address:

1. PRIMARY VISUAL ELEMENT
   What abstract form or pattern dominates?
   ✓ "Layered horizontal bands of gradient mist"
   ✓ "Crystalline fractal network with intersecting veins"
   ✓ "Organic ink bloom with irregular bleeding edges"
   ✗ "Pretty colors" or "Nice pattern"

2. COLOR SPECIFICATION
   Be precise about hues, temperatures, and relationships.
   ✓ "Deep teal (#2A5D67) with luminous gold (#D4AF37) accents"
   ✓ "Warm amber transitioning to cool slate through atmospheric haze"
   ✓ "Midnight blue with ultramarine undertones, desaturated at edges"
   - Include: dominant colors, accent colors, gradients, temperature shifts

3. TEXTURE & SURFACE QUALITY
   How does the visual "feel"?
   ✓ "Watercolor texture on cold-pressed rough paper, visible tooth"
   ✓ "Polished chrome reflections with soft caustic light patterns"
   ✓ "Grainy film noise overlaying smooth gradients, 400 ISO aesthetic"
   - Consider: smooth/rough, glossy/matte, organic/mechanical, grain/noise

4. SPATIAL COMPOSITION
   How is depth and space organized?
   ✓ "Atmospheric perspective with three distinct planes receding into fog"
   ✓ "Tight radial composition emanating from off-center focal point"
   ✓ "Expansive negative space on left, dense cluster on right third"

5. LIGHTING & LUMINOSITY
   Where does light come from? How does it behave?
   ✓ "Soft diffused glow from behind, creating luminous halos around edges"
   ✓ "Harsh directional light from upper left, crisp shadows at 45 degrees"
   ✓ "Bioluminescent inner glow, self-illuminated with no external source"

6. MEDIUM & RENDERING STYLE
   What technique or material does this evoke?
   ✓ "Photographic long-exposure light trails, 30-second blur"
   ✓ "Digital vector art with clean anti-aliased edges"
   ✓ "Oil paint impasto with visible brushwork and texture"

═══════════════════════════════════════════════════════════════════════════════
EXEMPLARY CONCEPT DESCRIPTIONS
═══════════════════════════════════════════════════════════════════════════════

Strong examples (note the specificity):
- "Layered gradient fog in amber (#D4A574) and slate (#708090), soft horizontal
   banding with atmospheric depth, each layer slightly desaturated as it recedes,
   diffused backlighting creating luminous edges, 16:9 landscape format"

- "Crystalline fractal patterns in deep teal with luminous gold veins, sharp
   geometric intersections at 60-degree angles, shallow depth of field blurring
   distant structures, rendered as if photographed through macro lens at f/2.8"

- "Organic ink wash in midnight blue, irregular bleeding edges spreading outward
   from center, watercolor texture on rough cold-pressed paper with visible grain,
   negative space dominating upper right, wabi-sabi aesthetic embracing imperfection"

- "Kinetic diagonal stripes alternating warm cream (#F5F5DC) and burnt sienna
   (#A0522D), motion blur effect at edges suggesting speed, high contrast,
   Swiss-style graphic design influence, vector-clean with no anti-aliasing"

═══════════════════════════════════════════════════════════════════════════════
DESIGN TAGS (for metadata and searchability)
═══════════════════════════════════════════════════════════════════════════════

Select 1-3 tags per axis. Use novel, specific tags when appropriate.

- colors:
  Palette: monochromatic, complementary, analogous, triadic, split-complementary
  Temperature: warm, cool, neutral, temperature-gradient
  Saturation: vibrant, muted, pastel, saturated, earthy, desaturated
  Contrast: high-contrast, low-contrast, subtle-gradients
  Mood: moody-dark, light-airy, rich-jewel-tones, soft-naturals, neon-glow

- composition:
  Balance: symmetrical, asymmetrical, centered, radial, golden-spiral
  Flow: diagonal, horizontal, vertical, curved, organic, s-curve
  Depth: layered, shallow, deep, atmospheric-perspective, stacked-planes
  Space: negative-space, dense, expansive, contained, off-center

- layout:
  Structure: grid, modular, freeform, geometric, organic, fractal
  Density: dense, spacious, balanced, scattered, clustered
  Movement: static, dynamic, flowing, rhythmic, kinetic, frozen

- aesthetic:
  Texture: smooth, rough, textured, glossy, matte, grainy, paper-texture
  Style: abstract, minimalist, maximalist, organic, geometric, crystalline
  Medium: digital, painted, photographic, graphic, mixed-media, generative
  Mood: serene, energetic, dramatic, ethereal, grounded, contemplative

═══════════════════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

TITLE:
Generate a short title (2-5 words) for this collection of concept references.
If a user-provided title was given above, you may use it as-is or refine it.

CONCEPT DESCRIPTIONS:
Each concept's "prompt" field should be a cohesive paragraph (2-4 sentences)
that flows naturally, integrating color, texture, composition, and style.
Do NOT use bullet points in the prompt field.

DESIGN DIMENSIONS:
For EACH concept, generate 3-4 design dimensions that describe its visual qualities.

Each dimension must have:
- axis: One of the four core axes (colors, composition, layout, aesthetic)
- name: A substantial 4-6 word name capturing the visual quality
  ✓ "Layered Fog with Atmospheric Recession", "Crystalline Fractal Light Network"
  ✗ "Blue Colors", "Abstract Pattern"
- description: 2-3 sentences explaining the visual effect and why it works
- tags: 3-5 specific tags from the axis vocabulary
- generation_prompt: A 1-2 sentence prompt to recreate this pure visual quality
`;
