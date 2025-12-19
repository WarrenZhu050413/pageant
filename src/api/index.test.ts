/**
 * Tests for API layer transformations and endpoint coverage
 * Issue #20: base_prompt to basePrompt transformation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally for comprehensive API tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the request function to test transformations (only for transformation tests)
const mockRequest = vi.fn();

vi.mock('./fetchers', () => ({
  request: (...args: unknown[]) => mockRequest(...args),
  makeListFetcher: vi.fn((endpoint: string, key: string) => {
    return async () => {
      const response = await mockFetch(`/api${endpoint}`, expect.any(Object));
      const data = await response.json();
      return data[key] || [];
    };
  }),
  makeItemFetcher: vi.fn((endpoint: string) => {
    return async (id?: string) => {
      const url = id ? `/api${endpoint}/${id}` : `/api${endpoint}`;
      const response = await mockFetch(url, expect.any(Object));
      return response.json();
    };
  }),
  makeDeleteFetcher: vi.fn((endpoint: string) => {
    return async (id: string) => {
      await mockFetch(`/api${endpoint}/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
    };
  }),
  makeMutationFetcher: vi.fn(),
}));

// Import after mocking
import { fetchPrompts, fetchPrompt, fetchPromptsForSession } from './index';

describe('API transformations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Issue #20: base_prompt to basePrompt transformation', () => {
    it('fetchPrompts should transform base_prompt to basePrompt', async () => {
      mockRequest.mockResolvedValueOnce({
        prompts: [
          {
            id: 'prompt-1',
            prompt: 'Generated variation text',
            title: 'Test Prompt',
            base_prompt: 'Original user input', // snake_case from backend
            images: [],
            created_at: '2025-01-01T00:00:00Z',
          },
        ],
      });

      const prompts = await fetchPrompts();

      expect(prompts).toHaveLength(1);
      expect(prompts[0].basePrompt).toBe('Original user input'); // camelCase in frontend
      expect((prompts[0] as unknown as Record<string, unknown>).base_prompt).toBeUndefined();
    });

    it('fetchPrompts should handle prompts without base_prompt', async () => {
      mockRequest.mockResolvedValueOnce({
        prompts: [
          {
            id: 'prompt-1',
            prompt: 'Direct generation prompt',
            title: 'No Base',
            images: [],
            created_at: '2025-01-01T00:00:00Z',
          },
        ],
      });

      const prompts = await fetchPrompts();

      expect(prompts).toHaveLength(1);
      expect(prompts[0].basePrompt).toBeUndefined();
    });

    it('fetchPrompt should transform base_prompt for single prompt', async () => {
      mockRequest.mockResolvedValueOnce({
        id: 'prompt-1',
        prompt: 'Generated text',
        title: 'Single',
        base_prompt: 'User typed this',
        images: [],
        created_at: '2025-01-01T00:00:00Z',
      });

      const prompt = await fetchPrompt('prompt-1');

      expect(prompt.basePrompt).toBe('User typed this');
    });

    it('fetchPromptsForSession should transform base_prompt', async () => {
      mockRequest.mockResolvedValueOnce({
        prompts: [
          {
            id: 'prompt-1',
            prompt: 'Session prompt',
            title: 'Session Test',
            base_prompt: 'Session base input',
            session_id: 'session-1',
            images: [],
            created_at: '2025-01-01T00:00:00Z',
          },
        ],
      });

      const prompts = await fetchPromptsForSession('session-1');

      expect(prompts).toHaveLength(1);
      expect(prompts[0].basePrompt).toBe('Session base input');
    });

    it('should preserve existing basePrompt if base_prompt is not present', async () => {
      mockRequest.mockResolvedValueOnce({
        prompts: [
          {
            id: 'prompt-1',
            prompt: 'Test',
            title: 'Test',
            basePrompt: 'Already camelCase', // Already transformed
            images: [],
            created_at: '2025-01-01T00:00:00Z',
          },
        ],
      });

      const prompts = await fetchPrompts();

      expect(prompts[0].basePrompt).toBe('Already camelCase');
    });
  });
});

describe('URL helpers', () => {
  // These don't need mocking - they're pure functions
  it('getExportGalleryUrl should return correct URL', async () => {
    const { getExportGalleryUrl } = await import('./index');
    expect(getExportGalleryUrl()).toBe('/api/export/gallery');
  });

  it('getImageUrl should return correct path', async () => {
    const { getImageUrl } = await import('./index');
    expect(getImageUrl('test.jpg')).toBe('/images/test.jpg');
    expect(getImageUrl('subdir/image.png')).toBe('/images/subdir/image.png');
  });
});

describe('Upload functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploadImages should POST FormData and return response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ prompt_id: 'p1', count: 2 }),
    });

    const { uploadImages } = await import('./index');
    const files = [
      new File(['test'], 'test1.jpg', { type: 'image/jpeg' }),
      new File(['test'], 'test2.png', { type: 'image/png' }),
    ];

    const result = await uploadImages(files);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/upload',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.count).toBe(2);
  });

  it('uploadImages should throw on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { uploadImages } = await import('./index');
    const files = [new File(['test'], 'test.jpg', { type: 'image/jpeg' })];

    await expect(uploadImages(files)).rejects.toThrow('Upload failed');
  });
});

describe('transformPrompt function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle empty prompts array', async () => {
    mockRequest.mockResolvedValueOnce({ prompts: [] });

    const prompts = await fetchPrompts();
    expect(prompts).toEqual([]);
  });

  it('should handle missing prompts field', async () => {
    mockRequest.mockResolvedValueOnce({});

    const prompts = await fetchPrompts();
    expect(prompts).toEqual([]);
  });

  it('should transform multiple prompts', async () => {
    mockRequest.mockResolvedValueOnce({
      prompts: [
        { id: 'p1', prompt: 'Test 1', base_prompt: 'Base 1', images: [] },
        { id: 'p2', prompt: 'Test 2', base_prompt: 'Base 2', images: [] },
        { id: 'p3', prompt: 'Test 3', base_prompt: 'Base 3', images: [] },
      ],
    });

    const prompts = await fetchPrompts();
    expect(prompts).toHaveLength(3);
    expect(prompts[0].basePrompt).toBe('Base 1');
    expect(prompts[1].basePrompt).toBe('Base 2');
    expect(prompts[2].basePrompt).toBe('Base 3');
  });
});
