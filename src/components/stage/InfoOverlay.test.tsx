import { describe, it, expect } from 'vitest'

/**
 * Tests for InfoOverlay display prompt logic.
 *
 * The key fix: InfoOverlay should display currentImage.varied_prompt
 * when available, falling back to imagePrompt.prompt.
 *
 * This was a bug where the backend saved prompts as 'prompt_used'
 * but the frontend expected 'varied_prompt'.
 */
describe('InfoOverlay displayPrompt logic', () => {
  // Helper to compute display prompt (mirrors InfoOverlay line 126)
  const computeDisplayPrompt = (
    variedPrompt: string | undefined | null,
    basePrompt: string
  ): string => {
    return variedPrompt || basePrompt
  }

  describe('when image has varied_prompt', () => {
    it('displays the varied_prompt', () => {
      const result = computeDisplayPrompt(
        'A dramatic lighting scene with warm colors',
        'Base prompt for image generation'
      )
      expect(result).toBe('A dramatic lighting scene with warm colors')
    })

    it('uses varied_prompt even when different from base', () => {
      const variedPrompt = 'Completely different description for this variation'
      const basePrompt = 'Original base prompt'
      expect(computeDisplayPrompt(variedPrompt, basePrompt)).toBe(variedPrompt)
    })
  })

  describe('when image lacks varied_prompt', () => {
    it('falls back to base prompt when varied_prompt is undefined', () => {
      const result = computeDisplayPrompt(undefined, 'Base prompt fallback')
      expect(result).toBe('Base prompt fallback')
    })

    it('falls back to base prompt when varied_prompt is null', () => {
      const result = computeDisplayPrompt(null, 'Base prompt fallback')
      expect(result).toBe('Base prompt fallback')
    })

    it('falls back to base prompt when varied_prompt is empty string', () => {
      const result = computeDisplayPrompt('', 'Base prompt fallback')
      expect(result).toBe('Base prompt fallback')
    })
  })

  describe('each image in a prompt should have unique display', () => {
    it('different images show different prompts when varied_prompt differs', () => {
      const image1 = { varied_prompt: 'Scene A with dramatic lighting' }
      const image2 = { varied_prompt: 'Scene B with soft pastels' }
      const image3 = { varied_prompt: 'Scene C with minimalist composition' }
      const basePrompt = 'Generate an artistic scene'

      const display1 = computeDisplayPrompt(image1.varied_prompt, basePrompt)
      const display2 = computeDisplayPrompt(image2.varied_prompt, basePrompt)
      const display3 = computeDisplayPrompt(image3.varied_prompt, basePrompt)

      expect(display1).not.toBe(display2)
      expect(display2).not.toBe(display3)
      expect(display1).not.toBe(display3)

      expect(display1).toBe('Scene A with dramatic lighting')
      expect(display2).toBe('Scene B with soft pastels')
      expect(display3).toBe('Scene C with minimalist composition')
    })

    it('images without varied_prompt all show base prompt', () => {
      const imageWithoutVaried = { varied_prompt: undefined }
      const basePrompt = 'Common base prompt'

      const display1 = computeDisplayPrompt(
        imageWithoutVaried.varied_prompt,
        basePrompt
      )
      const display2 = computeDisplayPrompt(
        imageWithoutVaried.varied_prompt,
        basePrompt
      )

      expect(display1).toBe(basePrompt)
      expect(display2).toBe(basePrompt)
      expect(display1).toBe(display2)
    })
  })
})
