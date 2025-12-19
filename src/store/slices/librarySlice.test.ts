import { describe, it, expect, beforeEach } from 'vitest'
import { createLibrarySlice, type LibrarySlice } from './librarySlice'
import type { DesignToken, Collection } from '../../types'

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
        {
          id: 'token-1',
          name: 'Minimalist Style',
          type: 'style',
          description: 'Clean and simple',
          prompt_fragment: 'minimalist, clean lines',
          source_image_ids: ['img-1'],
          created_at: new Date().toISOString(),
        },
        {
          id: 'token-2',
          name: 'Warm Colors',
          type: 'palette',
          description: 'Warm color scheme',
          prompt_fragment: 'warm tones, orange, red',
          source_image_ids: ['img-2'],
          created_at: new Date().toISOString(),
        },
      ]

      slice.setDesignTokens(tokens)
      expect(slice.designTokens).toEqual(tokens)
      expect(slice.designTokens.length).toBe(2)
    })

    it('replaces existing tokens', () => {
      const initialTokens: DesignToken[] = [
        {
          id: 'token-old',
          name: 'Old Token',
          type: 'style',
          description: 'Old',
          prompt_fragment: 'old',
          source_image_ids: [],
          created_at: new Date().toISOString(),
        },
      ]
      slice.setDesignTokens(initialTokens)

      const newTokens: DesignToken[] = [
        {
          id: 'token-new',
          name: 'New Token',
          type: 'palette',
          description: 'New',
          prompt_fragment: 'new',
          source_image_ids: [],
          created_at: new Date().toISOString(),
        },
      ]
      slice.setDesignTokens(newTokens)

      expect(slice.designTokens).toEqual(newTokens)
      expect(slice.designTokens.length).toBe(1)
      expect(slice.designTokens[0].id).toBe('token-new')
    })

    it('can set empty array to clear tokens', () => {
      slice.designTokens = [
        {
          id: 'token-1',
          name: 'Token',
          type: 'style',
          description: '',
          prompt_fragment: '',
          source_image_ids: [],
          created_at: new Date().toISOString(),
        },
      ]

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
          description: 'My favorite images',
          image_ids: ['img-1', 'img-2'],
          created_at: new Date().toISOString(),
        },
        {
          id: 'col-2',
          name: 'Portfolio',
          description: 'Best work',
          image_ids: ['img-3'],
          created_at: new Date().toISOString(),
        },
      ]

      slice.setCollections(collections)
      expect(slice.collections).toEqual(collections)
      expect(slice.collections.length).toBe(2)
    })

    it('replaces existing collections', () => {
      const initial: Collection[] = [
        {
          id: 'col-old',
          name: 'Old Collection',
          description: '',
          image_ids: [],
          created_at: new Date().toISOString(),
        },
      ]
      slice.setCollections(initial)

      const updated: Collection[] = [
        {
          id: 'col-new',
          name: 'New Collection',
          description: 'Fresh',
          image_ids: ['img-new'],
          created_at: new Date().toISOString(),
        },
      ]
      slice.setCollections(updated)

      expect(slice.collections).toEqual(updated)
      expect(slice.collections.length).toBe(1)
      expect(slice.collections[0].id).toBe('col-new')
    })

    it('can set empty array to clear collections', () => {
      slice.collections = [
        {
          id: 'col-1',
          name: 'Collection',
          description: '',
          image_ids: [],
          created_at: new Date().toISOString(),
        },
      ]

      slice.setCollections([])
      expect(slice.collections).toEqual([])
    })
  })
})
