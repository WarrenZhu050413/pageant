import { describe, it, expect, beforeEach } from 'vitest'
import { createLibrarySlice, type LibrarySlice } from './librarySlice'
import type { DesignToken, Collection } from '../../types'

// Helper to create valid mock tokens with current schema
const createMockToken = (overrides: Partial<DesignToken> = {}): DesignToken => ({
  id: 'token-1',
  name: 'Test Token',
  description: 'A test token',
  created_at: new Date().toISOString(),
  use_count: 0,
  images: [],
  prompts: [],
  creation_method: 'manual',
  ...overrides,
})

describe('librarySlice', () => {
  let slice: LibrarySlice

  beforeEach(() => {
    const set = (partial: Partial<LibrarySlice> | ((state: LibrarySlice) => Partial<LibrarySlice>)) => {
      const update = typeof partial === 'function' ? partial(slice) : partial
      Object.assign(slice, update)
    }
    const get = () => slice
    slice = createLibrarySlice(set as never, get as never, {} as never)
  })

  describe('initial state', () => {
    it('has empty designTokens array', () => {
      expect(slice.designTokens).toEqual([])
    })

    it('has empty collections array', () => {
      expect(slice.collections).toEqual([])
    })
  })

  describe('setDesignTokens', () => {
    it('sets designTokens to provided array', () => {
      const tokens: DesignToken[] = [
        createMockToken({ id: 'token-1', name: 'Minimalist Style' }),
        createMockToken({ id: 'token-2', name: 'Warm Colors' }),
      ]

      slice.setDesignTokens(tokens)
      expect(slice.designTokens).toEqual(tokens)
      expect(slice.designTokens.length).toBe(2)
    })

    it('replaces existing tokens', () => {
      const initialTokens: DesignToken[] = [
        createMockToken({ id: 'token-old', name: 'Old Token' }),
      ]
      slice.setDesignTokens(initialTokens)

      const newTokens: DesignToken[] = [
        createMockToken({ id: 'token-new', name: 'New Token' }),
      ]
      slice.setDesignTokens(newTokens)

      expect(slice.designTokens).toEqual(newTokens)
      expect(slice.designTokens.length).toBe(1)
      expect(slice.designTokens[0].id).toBe('token-new')
    })

    it('can set empty array to clear tokens', () => {
      slice.designTokens = [createMockToken()]

      slice.setDesignTokens([])
      expect(slice.designTokens).toEqual([])
    })
  })

  describe('setCollections', () => {
    it('sets collections to provided array', () => {
      const collections: Collection[] = [
        {
          id: 'col-1',
          name: 'Favorites',
          description: 'My favorites',
          image_ids: ['img-1', 'img-2'],
          created_at: new Date().toISOString(),
        },
        {
          id: 'col-2',
          name: 'Inspiration',
          image_ids: [],
          created_at: new Date().toISOString(),
        },
      ]

      slice.setCollections(collections)
      expect(slice.collections).toEqual(collections)
      expect(slice.collections.length).toBe(2)
    })
  })
})
