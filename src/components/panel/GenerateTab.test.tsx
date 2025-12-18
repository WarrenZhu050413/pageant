import { describe, it, expect } from 'vitest'
import type { LibraryItem } from '../../types'

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
      expect(null == undefined).toBe(true)

      // null === undefined is false (strict equality)
      expect(null === undefined).toBe(false)

      // null !== undefined is true - this was the bug!
      expect(null !== undefined).toBe(true)

      // null != null is false - this is the fix
      expect(null != null).toBe(false)
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
 * The concept picker allows users to select design concepts from the library
 * and have their tags included in the generation prompt.
 */
describe('GenerateTab concept picker', () => {
  // Mock concept data
  const mockConcepts: LibraryItem[] = [
    {
      id: 'concept-1',
      type: 'design-token',
      name: 'Warm Tones',
      style_tags: ['warm', 'golden', 'sunset'],
      text: 'warm color palette',
      created_at: '2025-01-01',
      use_count: 0,
    },
    {
      id: 'concept-2',
      type: 'design-token',
      name: 'Dramatic Mood',
      style_tags: ['dramatic', 'moody', 'cinematic'],
      created_at: '2025-01-01',
      use_count: 0,
    },
    {
      id: 'concept-3',
      type: 'design-token',
      name: 'Text Only',
      text: 'minimalist aesthetic',
      created_at: '2025-01-01',
      use_count: 0,
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
    // Replicate the tag extraction logic from GenerateTab
    const getSelectedConceptTags = (
      concepts: LibraryItem[],
      selectedIds: string[]
    ): string[] => {
      const selected = concepts.filter((c) => selectedIds.includes(c.id))
      const allTags: string[] = []
      selected.forEach((concept) => {
        if (concept.style_tags) allTags.push(...concept.style_tags)
        if (concept.text) allTags.push(concept.text)
      })
      return [...new Set(allTags)]
    }

    it('should return empty array when no concepts selected', () => {
      const result = getSelectedConceptTags(mockConcepts, [])
      expect(result).toEqual([])
    })

    it('should return style_tags from selected concept', () => {
      const result = getSelectedConceptTags(mockConcepts, ['concept-2'])
      expect(result).toEqual(['dramatic', 'moody', 'cinematic'])
    })

    it('should combine tags and text from concept', () => {
      const result = getSelectedConceptTags(mockConcepts, ['concept-1'])
      expect(result).toContain('warm')
      expect(result).toContain('golden')
      expect(result).toContain('warm color palette')
    })

    it('should deduplicate tags across multiple concepts', () => {
      // Add a concept with overlapping tag
      const conceptsWithOverlap: LibraryItem[] = [
        ...mockConcepts,
        {
          id: 'concept-4',
          type: 'design-token',
          name: 'Also Warm',
          style_tags: ['warm', 'cozy'], // 'warm' overlaps with concept-1
          created_at: '2025-01-01',
          use_count: 0,
        },
      ]

      const result = getSelectedConceptTags(
        conceptsWithOverlap,
        ['concept-1', 'concept-4']
      )

      // Count occurrences of 'warm' - should be exactly 1
      const warmCount = result.filter((t) => t === 'warm').length
      expect(warmCount).toBe(1)
    })

    it('should handle concept with only text (no style_tags)', () => {
      const result = getSelectedConceptTags(mockConcepts, ['concept-3'])
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
