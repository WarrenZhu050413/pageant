import { describe, it, expect } from 'vitest'
import type { DesignToken } from '../../types'

/**
 * Tests for generation mode toggle functionality.
 *
 * The system supports two generation modes:
 * - Plan mode: Preview and edit prompts before generating images
 * - Auto mode: Generate images directly with optional prompt optimization
 *
 * And two output types:
 * - Normal: Final images
 * - Reference: Mood/concept images
 */
describe('GenerateTab generation mode', () => {
  type GenerationMode = 'plan' | 'auto'
  type OutputType = 'normal' | 'reference'

  describe('toggleGenerationMode', () => {
    const toggleGenerationMode = (current: GenerationMode): GenerationMode => {
      return current === 'plan' ? 'auto' : 'plan'
    }

    it('should toggle from plan to auto', () => {
      expect(toggleGenerationMode('plan')).toBe('auto')
    })

    it('should toggle from auto to plan', () => {
      expect(toggleGenerationMode('auto')).toBe('plan')
    })

    it('should be idempotent after two toggles', () => {
      const initial: GenerationMode = 'plan'
      const afterFirstToggle = toggleGenerationMode(initial)
      const afterSecondToggle = toggleGenerationMode(afterFirstToggle)
      expect(afterSecondToggle).toBe(initial)
    })
  })

  describe('getButtonLabel', () => {
    // Replicate the button label logic from GenerateTab
    const getButtonLabel = (
      generationMode: GenerationMode,
      outputType: OutputType
    ): string => {
      if (generationMode === 'plan') {
        return 'Generate Prompts'
      }
      return outputType === 'reference'
        ? 'Generate Reference Images'
        : 'Generate Images'
    }

    it('should return "Generate Prompts" in plan mode regardless of output type', () => {
      expect(getButtonLabel('plan', 'normal')).toBe('Generate Prompts')
      expect(getButtonLabel('plan', 'reference')).toBe('Generate Prompts')
    })

    it('should return "Generate Images" in auto mode with normal output', () => {
      expect(getButtonLabel('auto', 'normal')).toBe('Generate Images')
    })

    it('should return "Generate Reference Images" in auto mode with reference output', () => {
      expect(getButtonLabel('auto', 'reference')).toBe('Generate Reference Images')
    })
  })

  describe('skip optimization behavior', () => {
    it('should only apply skip optimization in auto mode', () => {
      // Replicate the logic that determines if skip optimization is used
      const shouldApplySkipOptimization = (
        generationMode: GenerationMode,
        skipOptimization: boolean
      ): boolean => {
        // Skip optimization only applies in auto mode
        return generationMode === 'auto' && skipOptimization
      }

      // In plan mode, skip optimization is never applied
      expect(shouldApplySkipOptimization('plan', true)).toBe(false)
      expect(shouldApplySkipOptimization('plan', false)).toBe(false)

      // In auto mode, it follows the checkbox state
      expect(shouldApplySkipOptimization('auto', true)).toBe(true)
      expect(shouldApplySkipOptimization('auto', false)).toBe(false)
    })

    it('should determine generation path based on mode and output type', () => {
      type GenerationPath = 'generateVariations' | 'generate'

      const getGenerationPath = (
        generationMode: GenerationMode,
        outputType: OutputType
      ): GenerationPath => {
        if (generationMode === 'plan') {
          return 'generateVariations'
        }
        // Auto mode with reference still uses variations
        if (outputType === 'reference') {
          return 'generateVariations'
        }
        return 'generate'
      }

      // Plan mode always uses generateVariations
      expect(getGenerationPath('plan', 'normal')).toBe('generateVariations')
      expect(getGenerationPath('plan', 'reference')).toBe('generateVariations')

      // Auto mode with normal uses generate (direct path)
      expect(getGenerationPath('auto', 'normal')).toBe('generate')

      // Auto mode with reference still uses generateVariations
      expect(getGenerationPath('auto', 'reference')).toBe('generateVariations')
    })
  })

  describe('localStorage persistence', () => {
    it('should correctly parse boolean from localStorage string', () => {
      const parseStoredBoolean = (stored: string | null): boolean => {
        return stored === 'true'
      }

      expect(parseStoredBoolean('true')).toBe(true)
      expect(parseStoredBoolean('false')).toBe(false)
      expect(parseStoredBoolean(null)).toBe(false)
      expect(parseStoredBoolean('')).toBe(false)
    })
  })

  describe('keyboard shortcuts', () => {
    it('should detect Shift+Enter for direct generation', () => {
      // Replicate the keyboard event detection logic
      const shouldTriggerGenerate = (
        key: string,
        shiftKey: boolean,
        metaKey: boolean,
        ctrlKey: boolean
      ): boolean => {
        return key === 'Enter' && shiftKey && !metaKey && !ctrlKey
      }

      // Shift+Enter should trigger
      expect(shouldTriggerGenerate('Enter', true, false, false)).toBe(true)

      // Plain Enter should not trigger (allows newlines)
      expect(shouldTriggerGenerate('Enter', false, false, false)).toBe(false)

      // Cmd+Enter should not trigger
      expect(shouldTriggerGenerate('Enter', false, true, false)).toBe(false)

      // Ctrl+Enter should not trigger
      expect(shouldTriggerGenerate('Enter', false, false, true)).toBe(false)

      // Shift+Cmd+Enter should not trigger
      expect(shouldTriggerGenerate('Enter', true, true, false)).toBe(false)

      // Other keys should not trigger
      expect(shouldTriggerGenerate('Space', true, false, false)).toBe(false)
    })
  })
})

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

/**
 * Tests for Feeling Lucky functionality.
 *
 * Feeling Lucky fills context with random images and keywords without auto-generating.
 * It supports two scopes:
 * - 'session': Sample from current session only
 * - 'all': Sample from all sessions
 */
describe('Feeling Lucky functionality', () => {
  type LuckyScope = 'session' | 'all'

  describe('scope selection', () => {
    it('should have session as default scope', () => {
      const defaultScope: LuckyScope = 'session'
      expect(defaultScope).toBe('session')
    })

    it('should toggle between session and all scopes', () => {
      let scope: LuckyScope = 'session'

      // Set to 'all'
      scope = 'all'
      expect(scope).toBe('all')

      // Set back to 'session'
      scope = 'session'
      expect(scope).toBe('session')
    })
  })

  describe('image sampling logic', () => {
    interface MockImage {
      id: string
      image_path: string
    }

    interface MockGeneration {
      id: string
      images: MockImage[]
      session_id?: string
    }

    const filterGenerationsByScope = (
      generations: MockGeneration[],
      scope: LuckyScope,
      currentSessionId: string | null
    ): MockGeneration[] => {
      if (scope === 'all') {
        return generations
      }
      return currentSessionId
        ? generations.filter(g => g.session_id === currentSessionId)
        : generations.filter(g => !g.session_id)
    }

    it('should return all generations when scope is "all"', () => {
      const generations: MockGeneration[] = [
        { id: 'g1', images: [{ id: 'img1', image_path: 'path1' }], session_id: 'session-1' },
        { id: 'g2', images: [{ id: 'img2', image_path: 'path2' }], session_id: 'session-2' },
        { id: 'g3', images: [{ id: 'img3', image_path: 'path3' }] },
      ]

      const result = filterGenerationsByScope(generations, 'all', 'session-1')
      expect(result).toHaveLength(3)
    })

    it('should filter to current session when scope is "session"', () => {
      const generations: MockGeneration[] = [
        { id: 'g1', images: [{ id: 'img1', image_path: 'path1' }], session_id: 'session-1' },
        { id: 'g2', images: [{ id: 'img2', image_path: 'path2' }], session_id: 'session-2' },
        { id: 'g3', images: [{ id: 'img3', image_path: 'path3' }], session_id: 'session-1' },
      ]

      const result = filterGenerationsByScope(generations, 'session', 'session-1')
      expect(result).toHaveLength(2)
      expect(result.every(g => g.session_id === 'session-1')).toBe(true)
    })

    it('should filter to generations without session when currentSessionId is null', () => {
      const generations: MockGeneration[] = [
        { id: 'g1', images: [{ id: 'img1', image_path: 'path1' }], session_id: 'session-1' },
        { id: 'g2', images: [{ id: 'img2', image_path: 'path2' }] },
        { id: 'g3', images: [{ id: 'img3', image_path: 'path3' }] },
      ]

      const result = filterGenerationsByScope(generations, 'session', null)
      expect(result).toHaveLength(2)
      expect(result.every(g => !g.session_id)).toBe(true)
    })
  })

  describe('prompt building from keywords', () => {
    const buildPromptFromKeywords = (keywords: string[]): string => {
      return keywords.length > 0
        ? keywords.join(', ')
        : 'creative artistic composition'
    }

    it('should join keywords with commas', () => {
      const keywords = ['sunset', 'ocean', 'vibrant']
      const result = buildPromptFromKeywords(keywords)
      expect(result).toBe('sunset, ocean, vibrant')
    })

    it('should return fallback when no keywords', () => {
      const result = buildPromptFromKeywords([])
      expect(result).toBe('creative artistic composition')
    })

    it('should handle single keyword', () => {
      const result = buildPromptFromKeywords(['sunset'])
      expect(result).toBe('sunset')
    })
  })

  describe('library image extraction', () => {
    interface MockToken {
      id: string
      concept_image_path?: string
      concept_image_id?: string
    }

    const extractLibraryImages = (
      tokens: MockToken[]
    ): Array<{ id: string; image_path: string }> => {
      return tokens
        .filter(t => t.concept_image_path)
        .map(t => ({
          id: t.concept_image_id || t.id,
          image_path: t.concept_image_path!,
        }))
    }

    it('should extract images from tokens with concept_image_path', () => {
      const tokens: MockToken[] = [
        { id: 't1', concept_image_path: 'path1.jpg', concept_image_id: 'img-1' },
        { id: 't2' }, // No concept image
        { id: 't3', concept_image_path: 'path3.jpg' }, // Uses token id as image id
      ]

      const result = extractLibraryImages(tokens)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ id: 'img-1', image_path: 'path1.jpg' })
      expect(result[1]).toEqual({ id: 't3', image_path: 'path3.jpg' })
    })

    it('should return empty array when no tokens have concept images', () => {
      const tokens: MockToken[] = [
        { id: 't1' },
        { id: 't2' },
      ]

      const result = extractLibraryImages(tokens)
      expect(result).toEqual([])
    })
  })

  describe('tooltip display', () => {
    it('should show correct mode in tooltip', () => {
      const getTooltipMode = (scope: LuckyScope): string => {
        return scope === 'session' ? 'This Session' : 'All Images'
      }

      expect(getTooltipMode('session')).toBe('This Session')
      expect(getTooltipMode('all')).toBe('All Images')
    })
  })
})
