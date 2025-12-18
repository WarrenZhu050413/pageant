# Fixed

BUG:

When I switch between different images, the Prompt Section of the Info Panel does not udpate to reflect the prompt of the currently selected image. It continues to display the prompt of the previously selected image until I manually refresh or reselect the image. This leads to confusion as the displayed prompt does not match the actual prompt used for the current image.

Feature:

Bug: The floating directives for the /Users/wz/Desktop/Captura de pantalla 2025-12-18 a la(s) 12.11.53 a.m..png here floats out of the user's screen upon hover.

Feature Deletion:  Don't have the side by side mod for the View Mode Toggles. It is useless and not used.

## Small

<bug>
    aesthetic
photorealistic
film-noir
analog-grain
typeface feel
bold
grotesque
Click to like for taste profile

Generate
Settings
Title (optional)
Auto-generate from prompt
Number of Images
1
2
3
4
5
6

Include style preferences
extreme-close-up
Context Images
From Selection
From Favorites
From Collection
Current Image
Prompt
Describe the image you want to generate...

Advanced Options
Generate Variations

Upload Images
Files
Folder
Active Models
Text Model

gemini-3-pro-preview

Active
Image Model

gemini-3-pro-image-preview

Active
Appearance

System

Light

Dark
Following system preference (dark)

Image Generation Defaults
Image Size

1K
$0.039

2K
$0.134

4K
$0.24
Selected: 1K

Aspect Ratio

Default (1:1)
Default: Matches input image, or 1:1

Default Seed
Leave empty for random
Default: Random (no seed)

Safety Level

Block NONE
Selected: Block NONE

Advanced (Nano Banana)
Thinking Level

low
Faster

high
More detailed
Selected: high

Temperature
Leave empty for default (1.0)
Default: 1.0 (Google recommends not changing)

Google Search Grounding
Ground image generation in real-time web data

Variation System Prompt
Controls how image variations are generated

You are a creative director for visual imagery exploration.
Generate scene descriptions for AI image generation, balancing the user's vision with creative exploration.

Generate {count} diverse scene descriptions based on this prompt:

"{base_prompt}"

Requirements:

1. Each scene must be vivid and detailed for AI image generation
2. Vary lighting, mood, composition, and style across scenes
3. Some scenes should faithfully interpret the prompt
4. Some scenes should explore unexpected creative directions
5. All scenes should be visually striking and interesting

Balance:

- About half should be "faithful" - closely matching the user's intent
- About half should be "exploration" - creative interpretations and variations

Mood options: warm, cool, dramatic, serene, energetic, mysterious, playful, elegant, contemplative, whimsical, bold, intimate, grand, nostalgic, futuristic

Design tag guidelines (select 1-3 per axis based on the scene):
NOTE: These are SUGGESTED tags. You may use novel, specific tags when they better describe the scene.
For example, "film-noir" for style, "golden-hour" for colors, or "dutch-angle" for composition are valid.
The system learns from your tags, so be precise and descriptive.

- colors:
  Palette type: monochromatic, complementary, analogous, triadic, split-complementary, tetradic
  Temperature: warm, cool, neutral
  Saturation: vibrant, muted, pastel, saturated, desaturated, earthy
  Contrast: high-contrast, low-contrast, subtle-gradients
  Mood-based: moody-dark, light-airy, rich-jewel-tones, soft-naturals

- composition:
  Framing: close-up, medium-shot, wide-angle, extreme-close-up, bird's-eye, worm's-eye
  Balance: rule-of-thirds, symmetrical, asymmetrical, centered, golden-ratio
  Lines: diagonal, horizontal, vertical, curved, leading-lines
  Depth: layered, shallow-depth, deep-focus, foreground-focus, atmospheric-perspective
  Space: negative-space, framed, contained, expansive, cropped-tight

- layout:
  Structure: centered, asymmetric, grid, modular, freeform
  Density: dense, spacious, balanced, clustered, scattered
  Flow: dynamic, static, radial, linear, organic
  Hierarchy: focal-point, distributed, progressive, nested

- aesthetic:
  Realism: photorealistic, hyperrealistic, stylized-realism
  Illustration: illustrated, flat-design, line-art, hand-drawn, vector
  Digital: 3D-rendered, CGI, digital-painting, pixel-art, low-poly
  Movement: art-nouveau, art-deco, bauhaus, swiss-style, brutalist
  Era: retro, vintage, mid-century, 80s-aesthetic, Y2K, modern, futuristic
  Approach: minimalist, maximalist, abstract, surreal, collage, mixed-media

- typeface_feel:
  Category: sans-serif, serif, slab-serif, monospace, display, script
  Weight: light, regular, medium, bold, black, variable
  Style: geometric, humanist, grotesque, transitional, modern, old-style
  Character: elegant, playful, technical, editorial, friendly, authoritative
  Mood: refined, casual, dramatic, neutral, quirky, classical

Available placeholders:

{base_prompt} - The user's original prompt
{count} - Number of variations to generate
Iteration Prompt ("More Like This")
Controls how image-to-image variations are generated

Create a variation of this image while maintaining its core essence.
Focus on: {focus}
Original concept: {original_prompt}

Generate a new scene description that explores this direction while keeping the fundamental visual identity.
Available placeholders:

{original_prompt} - The original image's prompt
{focus} - What to focus on in the variation
Save Settings
Keyboard Shortcuts
Navigate images
←
→
Single view
1
Grid view
2
Compare view
3
Toggle favorite
F
Go to Generate
G
Select mode
S
Batch mode
B
Save as template
⌘
S
Exit mode
Esc
{"detail":"Invalid axis. Must be one of: ['typeface', 'colors', 'layout', 'mood', 'composition', 'style']"

</bug>
I get the above error when I try to add Aesthetics to it (note that no axis should be invalid, since gemini can add new axis).

3. I want the per-prompt "Advanced Options"'s default to be set to the selected settings in the "Settings" view, not the general defaults.

4.

Prompt
Original User Prompt
Gemini Generated

An extreme close-up of full lips, slightly parted, captured in the style of 1950s French New Wave cinema. The image is strictly black and white with heavy, organic film grain. High-contrast chiaroscuro lighting sculpts the volume of the lips and the curve of the cupid's bow, casting the corners of the mouth into deep shadow. The texture of the skin is detailed and raw, conveying a mood of melancholic longing and timeless elegance without explicit context.

Make this to be above the image, under the Top bar in the main UI, so that it is super easy for the user to understand the prompt that this image is corresponding to.

Further, not te that that original user prompt:

"An extreme close-up of full lips, slightly parted, captured in the style of 1950s French New Wave cinema. The image is strictly black and white with heavy, organic film grain. High-contrast chiaroscur --- A graphic, high-impact composition focusing on a hand gently pressing against the lower lip. The image applies a distinct halftone dot texture, mimicking the look of vintage newsprint or an undergroun --- A hyper-textural study of lips and skin, glistening with beads of moisture (sweat or rain). The lighting is harsh and directional, creating bright, silvery specular highlights on the wet skin texture ... and 1 more"

which is what I currently see, is just not correct. i want the orignial user prompt to be what the user inputs in the prompt box in the generate tab. here it is displaying the full gemini generated variations!

5. Name the images much more intelligents. First, name it by yyyy-mm-dd-hh-mm-ss in terms of time generated, then + the title of the image, then the number (1-n)

6. I want Use as Context from the Select stage to be "Add to Context", and also change the frontend logic to actually make it add rather than replace the context. Thanks!

7. I want the add to context for a single image to not replace the existing image context that is already there in the generationb bar.

8. To enable more rapid design, I want to be able to generate multiple batches of images at once. The generate images only shows the indicator inside the prompt where the images are being generated, but not the generated image itself. Thanks!

9. Change the name "Caption (SENT TO AI)" to just "Annotation (SENT TO AI)"

## Large

1.  Change the UI layout, so that the bottom InfoPanel is actually just a separate part of the left side panel. After Style, it should be a Info section. Arrange it so it has

Prompt

Original User Prompt (collapsed by default)

Actual Prompt (Gemini Generated)

---

Caption

---

Design

As the three sections. 2.

I want the gemini text model to also select what exact image to sent to the backend nano-banana-pro model. Further, I want it to even think about whether the current caption for the image is appropriate, or whether there would be a more appropriate caption.

Then, I want this to be displayed in the prompt preview UI, where for each prompt you can see the different images that are related to it, along with the prompt.

# TODO

## Small

1. I want the PROMPT section to also include the input images. Also, I want it to be up to 50% of the column. it is currently at most only 1/3 of the column

## Medieum

1. When generating the prompts, I want you to use the synchronous streaming generation for gemini https://googleapis.github.io/python-genai/index.html#generate-content-synchronous-streaming in order to stream the thoughts/texts of the gemini model to the user to help the user make sense of the model's decisions.

2. I want the ability to design prompt fragments. Not just currently with design variations, although those are interesting. I want to be able to tell the AI what I like about the image, tick the different design axes and avriations, along with my own generated input, and for it to generate a) a refernece image, and b) annotations to that reference image as prompt snippets/design tokesn that I can reuse.

3. I want the ability to have multiple prompts being generated at the same time. So when I click "generating variation", we have a new prompt tab that comes out. But immediatetly the user should be able to generate more variations. Also, call the "Generate Variations" part "Generate Prompts", but also have a button that is directly generatet image.

## Big

3. Prompt Preview UI Change: Prompt Iteration workflow.

I want to be able to iterate more on the prompt stage. I should be able to a) add comments to each prompts (add this section to them), and b) directly add to each prompt, and the send a backend request to rewrite the prompts into a proper "prompt for a image generation model" format based on the new, probably much messier prompt. Thanks!
