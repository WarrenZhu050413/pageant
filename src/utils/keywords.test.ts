import { describe, it, expect } from 'vitest'
import { extractKeywords, sampleKeywordsFromPrompts, randomInt, sampleArray } from './keywords'

describe('keywords utility', () => {
  describe('extractKeywords', () => {
    it('should extract meaningful words from text', () => {
      const keywords = extractKeywords('a beautiful sunset over the ocean')
      expect(keywords).toContain('beautiful')
      expect(keywords).toContain('sunset')
      expect(keywords).toContain('ocean')
    })

    it('should filter out common stop words', () => {
      const keywords = extractKeywords('the quick brown fox jumps over the lazy dog')
      expect(keywords).not.toContain('the')
      expect(keywords).not.toContain('over')
      expect(keywords).toContain('quick')
      expect(keywords).toContain('brown')
      expect(keywords).toContain('fox')
    })

    it('should filter out image-generation-specific stop words', () => {
      const keywords = extractKeywords('create an image showing a beautiful landscape')
      expect(keywords).not.toContain('create')
      expect(keywords).not.toContain('image')
      expect(keywords).not.toContain('showing')
      expect(keywords).toContain('beautiful')
      expect(keywords).toContain('landscape')
    })

    it('should convert to lowercase', () => {
      const keywords = extractKeywords('Beautiful SUNSET')
      expect(keywords).toContain('beautiful')
      expect(keywords).toContain('sunset')
      expect(keywords).not.toContain('Beautiful')
      expect(keywords).not.toContain('SUNSET')
    })

    it('should filter out very short words (<=2 chars)', () => {
      const keywords = extractKeywords('a to be or not to be')
      expect(keywords.every(k => k.length > 2)).toBe(true)
    })

    it('should filter out pure numbers', () => {
      const keywords = extractKeywords('year 2024 version 3')
      expect(keywords).not.toContain('2024')
      expect(keywords).not.toContain('3')
      expect(keywords).toContain('year')
      expect(keywords).toContain('version')
    })

    it('should return unique keywords', () => {
      const keywords = extractKeywords('sunset sunset beautiful sunset')
      const sunsetCount = keywords.filter(k => k === 'sunset').length
      expect(sunsetCount).toBe(1)
    })

    it('should handle empty string', () => {
      const keywords = extractKeywords('')
      expect(keywords).toEqual([])
    })

    it('should preserve hyphenated words', () => {
      const keywords = extractKeywords('well-designed high-quality artwork')
      expect(keywords).toContain('well-designed')
      expect(keywords).toContain('high-quality')
      expect(keywords).toContain('artwork')
    })
  })

  describe('sampleKeywordsFromPrompts', () => {
    it('should extract keywords from multiple prompts', () => {
      const prompts = [
        'vibrant sunset over mountains',
        'peaceful ocean waves',
        'colorful autumn forest'
      ]
      const keywords = sampleKeywordsFromPrompts(prompts, 10)
      expect(keywords.length).toBeLessThanOrEqual(10)
      expect(keywords.length).toBeGreaterThan(0)
    })

    it('should return all keywords if count exceeds available', () => {
      const prompts = ['sunset ocean']
      const keywords = sampleKeywordsFromPrompts(prompts, 100)
      expect(keywords.length).toBeLessThanOrEqual(2) // 'sunset' and 'ocean'
    })

    it('should handle empty prompts array', () => {
      const keywords = sampleKeywordsFromPrompts([], 10)
      expect(keywords).toEqual([])
    })

    it('should handle prompts with only stop words', () => {
      const prompts = ['the a an is are']
      const keywords = sampleKeywordsFromPrompts(prompts, 10)
      expect(keywords).toEqual([])
    })

    it('should favor more frequent keywords', () => {
      const prompts = [
        'sunset sunset sunset ocean',
        'sunset mountains',
        'sunset forest'
      ]
      // 'sunset' appears 5 times, should be included in top results
      const keywords = sampleKeywordsFromPrompts(prompts, 3)
      expect(keywords).toContain('sunset')
    })
  })

  describe('randomInt', () => {
    it('should return integer within range (inclusive)', () => {
      for (let i = 0; i < 100; i++) {
        const result = randomInt(5, 10)
        expect(result).toBeGreaterThanOrEqual(5)
        expect(result).toBeLessThanOrEqual(10)
        expect(Number.isInteger(result)).toBe(true)
      }
    })

    it('should return min when min equals max', () => {
      expect(randomInt(5, 5)).toBe(5)
    })

    it('should work with negative numbers', () => {
      for (let i = 0; i < 50; i++) {
        const result = randomInt(-5, 5)
        expect(result).toBeGreaterThanOrEqual(-5)
        expect(result).toBeLessThanOrEqual(5)
      }
    })
  })

  describe('sampleArray', () => {
    it('should return specified number of items', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const sampled = sampleArray(arr, 3)
      expect(sampled).toHaveLength(3)
    })

    it('should return all items if count >= array length', () => {
      const arr = [1, 2, 3]
      const sampled = sampleArray(arr, 5)
      expect(sampled).toHaveLength(3)
      expect(sampled.sort()).toEqual([1, 2, 3])
    })

    it('should return empty array for empty input', () => {
      expect(sampleArray([], 5)).toEqual([])
    })

    it('should return items from original array', () => {
      const arr = ['a', 'b', 'c', 'd', 'e']
      const sampled = sampleArray(arr, 3)
      sampled.forEach(item => {
        expect(arr).toContain(item)
      })
    })

    it('should not modify original array', () => {
      const arr = [1, 2, 3, 4, 5]
      const original = [...arr]
      sampleArray(arr, 3)
      expect(arr).toEqual(original)
    })

    it('should preserve type', () => {
      const objects = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const sampled = sampleArray(objects, 2)
      sampled.forEach(item => {
        expect(typeof item.id).toBe('number')
      })
    })
  })
})
