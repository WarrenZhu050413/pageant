import { describe, it, expect } from 'vitest'
import type { LikedAxes } from '../../types'

/**
 * Tests for InfoTab "Save as Concept" functionality.
 *
 * The "Save as Concept" button appears when an image has liked design tags.
 * It extracts those tags into a reusable design concept in the Library.
 */
describe('InfoTab Save as Concept', () => {
  describe('hasDesignData detection', () => {
    // Replicate the hasDesignData logic from InfoTab
    const hasDesignData = (likedAxes: LikedAxes | undefined): boolean => {
      if (!likedAxes) return false
      return Object.values(likedAxes).some((tags) => tags && tags.length > 0)
    }

    it('should return false when liked_axes is undefined', () => {
      expect(hasDesignData(undefined)).toBe(false)
    })

    it('should return false when liked_axes is empty object', () => {
      expect(hasDesignData({})).toBe(false)
    })

    it('should return false when all axes have empty arrays', () => {
      expect(hasDesignData({
        colors: [],
        mood: [],
        composition: [],
      })).toBe(false)
    })

    it('should return true when at least one axis has tags', () => {
      expect(hasDesignData({
        colors: ['warm'],
        mood: [],
      })).toBe(true)
    })

    it('should return true with multiple axes having tags', () => {
      expect(hasDesignData({
        colors: ['warm', 'golden'],
        mood: ['dramatic'],
        composition: [],
      })).toBe(true)
    })
  })

  describe('tag extraction for concept', () => {
    // Replicate the tag flattening logic from InfoTab
    const extractTagsForConcept = (likedAxes: LikedAxes | undefined): string[] => {
      if (!likedAxes) return []
      return Object.values(likedAxes).flat()
    }

    it('should return empty array when liked_axes is undefined', () => {
      expect(extractTagsForConcept(undefined)).toEqual([])
    })

    it('should flatten tags from all axes', () => {
      const result = extractTagsForConcept({
        colors: ['warm', 'golden'],
        mood: ['dramatic'],
      })
      expect(result).toContain('warm')
      expect(result).toContain('golden')
      expect(result).toContain('dramatic')
      expect(result.length).toBe(3)
    })

    it('should skip empty axes', () => {
      const result = extractTagsForConcept({
        colors: ['warm'],
        mood: [],
        composition: [],
      })
      expect(result).toEqual(['warm'])
    })
  })
})
