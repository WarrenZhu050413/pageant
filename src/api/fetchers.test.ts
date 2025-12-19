/**
 * Tests for generic API fetcher utilities
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
;(globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = mockFetch

// Import after mocking
import {
  request,
  makeListFetcher,
  makeItemFetcher,
  makeDeleteFetcher,
  makeMutationFetcher,
} from './fetchers'

describe('fetchers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('request', () => {
    it('should make GET request by default', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      })

      const result = await request('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        })
      )
      expect(result).toEqual({ data: 'test' })
    })

    it('should include custom headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await request('/test', {
        headers: { Authorization: 'Bearer token' },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token',
          },
        })
      )
    })

    it('should throw on non-ok response with error text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Resource not found'),
      })

      await expect(request('/test')).rejects.toThrow('Resource not found')
    })

    it('should throw generic error when no error text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve(''),
      })

      await expect(request('/test')).rejects.toThrow('Request failed: 500')
    })

    it('should handle POST requests with body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      await request('/test', {
        method: 'POST',
        body: JSON.stringify({ key: 'value' }),
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ key: 'value' }),
        })
      )
    })
  })

  describe('makeListFetcher', () => {
    it('should create fetcher that extracts array by key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [{ id: '1' }, { id: '2' }] }),
      })

      const fetchItems = makeListFetcher<{ id: string }>('/items', 'items')
      const result = await fetchItems()

      expect(mockFetch).toHaveBeenCalledWith('/api/items', expect.any(Object))
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('1')
    })

    it('should return empty array when key is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      const fetchItems = makeListFetcher<{ id: string }>('/items', 'items')
      const result = await fetchItems()

      expect(result).toEqual([])
    })

    it('should return empty array when response is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      })

      const fetchItems = makeListFetcher<{ id: string }>('/items', 'items')
      const result = await fetchItems()

      expect(result).toEqual([])
    })
  })

  describe('makeItemFetcher', () => {
    it('should create fetcher for single item with id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '123', name: 'Test' }),
      })

      const fetchItem = makeItemFetcher<{ id: string; name: string }>('/items')
      const result = await fetchItem('123')

      expect(mockFetch).toHaveBeenCalledWith('/api/items/123', expect.any(Object))
      expect(result.id).toBe('123')
      expect(result.name).toBe('Test')
    })

    it('should create fetcher without id for singleton endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ setting: 'value' }),
      })

      const fetchSettings = makeItemFetcher<{ setting: string }>('/settings')
      const result = await fetchSettings()

      expect(mockFetch).toHaveBeenCalledWith('/api/settings', expect.any(Object))
      expect(result.setting).toBe('value')
    })
  })

  describe('makeDeleteFetcher', () => {
    it('should create fetcher that calls DELETE', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      const deleteItem = makeDeleteFetcher('/items')
      await deleteItem('123')

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/items/123',
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    it('should throw on delete failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Item not found'),
      })

      const deleteItem = makeDeleteFetcher('/items')
      await expect(deleteItem('123')).rejects.toThrow('Item not found')
    })
  })

  describe('makeMutationFetcher', () => {
    it('should create POST fetcher with body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new', name: 'Created' }),
      })

      const createItem = makeMutationFetcher<{ name: string }, { id: string; name: string }>(
        '/items',
        'POST'
      )
      const result = await createItem({ name: 'New Item' })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'New Item' }),
        })
      )
      expect(result.name).toBe('Created')
    })

    it('should create PUT fetcher with id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '123', name: 'Updated' }),
      })

      const updateItem = makeMutationFetcher<{ name: string }, { id: string; name: string }>(
        '/items',
        'PUT'
      )
      const result = await updateItem({ name: 'Updated Item' }, '123')

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/items/123',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated Item' }),
        })
      )
      expect(result.name).toBe('Updated')
    })

    it('should create DELETE fetcher without body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      const removeItem = makeMutationFetcher<undefined, void>('/items', 'DELETE')
      await removeItem(undefined, '123')

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/items/123',
        expect.objectContaining({
          method: 'DELETE',
          body: undefined,
        })
      )
    })
  })
})
