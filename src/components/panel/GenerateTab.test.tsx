import { describe, it, expect } from 'vitest'
import type { DesignToken } from '../../types'

/**
 * Test for the null seed handling fix.
 *
 * The bug: settings.seed can be null (from Python None → JSON null),
 * and calling null.toString() crashes with:
 * "Cannot read properties of null (reading 'toString')"
 *
 * The fix: Use `!= null` (loose equality) which catches both null and undefined.
 */
describe('GenerateTab settings initialization', () => {
  describe('seed null handling', () => {
    it('should not crash when settings.seed is null', () => {
      // Simulate the original buggy code that used !== undefined
      const buggyCheck = (seed: number | null | undefined) => {
        if (seed !== undefined) {
          // This crashes when seed is null!
          return seed!.toString()
        }
        return ''
      }

      // The fix: use != null (loose equality)
      const fixedCheck = (seed: number | null | undefined) => {
        if (seed != null) {
          return seed.toString()
        }
        return ''
      }

      // Test cases
      const testCases: Array<number | null | undefined> = [null, undefined, 0, 12345]

      for (const input of testCases) {
        // Fixed version should never crash
        expect(() => fixedCheck(input)).not.toThrow()

        if (input === null) {
          // Buggy version crashes on null
          expect(() => buggyCheck(input)).toThrow()
        }
      }
    })

    it('should correctly handle loose equality for null check', () => {
      // null == undefined is true (loose equality)
      // eslint-disable-next-line no-constant-binary-expression
      expect(null == undefined).toBe(true)

      // null === undefined is false (strict equality)
      // eslint-disable-next-line no-constant-binary-expression
      expect(null === undefined).toBe(false)

      // null !== undefined is true - this was the bug!
      // eslint-disable-next-line no-constant-binary-expression
      expect(null !== undefined).toBe(true)

      // null != null is false - this is the fix
      // eslint-disable-next-line no-constant-binary-expression
      expect(null != null).toBe(false)
      // eslint-disable-next-line no-constant-binary-expression
      expect(undefined != null).toBe(false)
    })

    it('should handle settings with various seed values', () => {
      type Settings = { seed?: number | null }

      const getSeedString = (settings: Settings | null) => {
        if (settings?.seed != null) {
          return settings.seed.toString()
        }
        return ''
      }

      // All these should work without crashing
      expect(getSeedString(null)).toBe('')
      expect(getSeedString({})).toBe('')
      expect(getSeedString({ seed: null })).toBe('')
      expect(getSeedString({ seed: undefined })).toBe('')
      expect(getSeedString({ seed: 0 })).toBe('0')
      expect(getSeedString({ seed: 42 })).toBe('42')
    })
  })
})

/**
 * Tests for Design Concepts picker functionality.
 *
 * The concept picker allows users to select design tokens from the library
 * and have their tags/prompts included in the generation prompt.
 */
describe('GenerateTab concept picker', () => {
  // Mock design token data
  const mockTokens: DesignToken[] = [
    {
      id: 'concept-1',
      name: 'Warm Tones',
      tags: ['warm', 'golden', 'sunset'],
      prompts: ['warm color palette'],
      images: [],
      created_at: '2025-01-01',
      use_count: 0,
      creation_method: 'ai-extraction',
    },
    {
      id: 'concept-2',
      name: 'Dramatic Mood',
      tags: ['dramatic', 'moody', 'cinematic'],
      prompts: [],
      images: [],
      created_at: '2025-01-01',
      use_count: 0,
      creation_method: 'ai-extraction',
    },
    {
      id: 'concept-3',
      name: 'Prompt Only',
      tags: [],
      prompts: ['minimalist aesthetic'],
      images: [],
      created_at: '2025-01-01',
      use_count: 0,
      creation_method: 'manual',
    },
  ]

  describe('toggleConcept', () => {
    // Replicate the toggle logic from GenerateTab
    const toggleConcept = (
      prev: string[],
      id: string
    ): string[] => {
      return prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    }

    it('should add concept id when not selected', () => {
      const result = toggleConcept([], 'concept-1')
      expect(result).toEqual(['concept-1'])
    })

    it('should remove concept id when already selected', () => {
      const result = toggleConcept(['concept-1', 'concept-2'], 'concept-1')
      expect(result).toEqual(['concept-2'])
    })

    it('should handle multiple toggles', () => {
      let selected: string[] = []
      selected = toggleConcept(selected, 'concept-1')
      selected = toggleConcept(selected, 'concept-2')
      expect(selected).toEqual(['concept-1', 'concept-2'])

      selected = toggleConcept(selected, 'concept-1')
      expect(selected).toEqual(['concept-2'])
    })
  })

  describe('getSelectedConceptTags', () => {
    // Replicate the tag extraction logic from GenerateTab (now uses DesignToken)
    const getSelectedConceptTags = (
      tokens: DesignToken[],
      selectedIds: string[]
    ): string[] => {
      const selected = tokens.filter((c) => selectedIds.includes(c.id))
      const allTags: string[] = []
      selected.forEach((token) => {
        if (token.tags) allTags.push(...token.tags)
        if (token.prompts) allTags.push(...token.prompts)
      })
      return [...new Set(allTags)]
    }

    it('should return empty array when no tokens selected', () => {
      const result = getSelectedConceptTags(mockTokens, [])
      expect(result).toEqual([])
    })

    it('should return tags from selected token', () => {
      const result = getSelectedConceptTags(mockTokens, ['concept-2'])
      expect(result).toEqual(['dramatic', 'moody', 'cinematic'])
    })

    it('should combine tags and prompts from token', () => {
      const result = getSelectedConceptTags(mockTokens, ['concept-1'])
      expect(result).toContain('warm')
      expect(result).toContain('golden')
      expect(result).toContain('warm color palette')
    })

    it('should deduplicate tags across multiple tokens', () => {
      // Add a token with overlapping tag
      const tokensWithOverlap: DesignToken[] = [
        ...mockTokens,
        {
          id: 'concept-4',
          name: 'Also Warm',
          tags: ['warm', 'cozy'], // 'warm' overlaps with concept-1
          prompts: [],
          images: [],
          created_at: '2025-01-01',
          use_count: 0,
          creation_method: 'manual',
        },
      ]

      const result = getSelectedConceptTags(
        tokensWithOverlap,
        ['concept-1', 'concept-4']
      )

      // Count occurrences of 'warm' - should be exactly 1
      const warmCount = result.filter((t) => t === 'warm').length
      expect(warmCount).toBe(1)
    })

    it('should handle token with only prompts (no tags)', () => {
      const result = getSelectedConceptTags(mockTokens, ['concept-3'])
      expect(result).toEqual(['minimalist aesthetic'])
    })
  })

  describe('buildFinalPrompt with concepts', () => {
    // Replicate the prompt building logic from GenerateTab
    const buildFinalPrompt = (
      prompt: string,
      conceptTags: string[]
    ): string => {
      let finalPrompt = prompt.trim()
      if (conceptTags.length > 0) {
        finalPrompt = `${finalPrompt}\n\nDesign concepts: ${conceptTags.join(', ')}`
      }
      return finalPrompt
    }

    it('should return prompt unchanged when no concepts selected', () => {
      const result = buildFinalPrompt('A beautiful sunset', [])
      expect(result).toBe('A beautiful sunset')
    })

    it('should append concept tags to prompt', () => {
      const result = buildFinalPrompt('A beautiful sunset', ['warm', 'golden'])
      expect(result).toBe('A beautiful sunset\n\nDesign concepts: warm, golden')
    })

    it('should trim whitespace from prompt', () => {
      const result = buildFinalPrompt('  A beautiful sunset  ', ['warm'])
      expect(result).toBe('A beautiful sunset\n\nDesign concepts: warm')
    })
  })
})
