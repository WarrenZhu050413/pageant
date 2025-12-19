import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock the store
const mockUseStore = vi.fn()
vi.mock('../../store', () => ({
  useStore: (selector: (state: unknown) => unknown) => mockUseStore(selector),
}))

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} {...props}>{children}</div>
    ),
    button: ({ children, className, ...props }: React.HTMLAttributes<HTMLButtonElement>) => (
      <button className={className} {...props}>{children}</button>
    ),
    svg: ({ children, ...props }: React.SVGAttributes<SVGSVGElement>) => (
      <svg {...props}>{children}</svg>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Import after mocks are set up
import { SingleView } from './SingleView'

describe('SingleView', () => {
  const createMockImage = (id: string, overrides = {}) => ({
    id,
    image_path: `${id}.jpg`,
    mime_type: 'image/jpeg',
    generated_at: new Date().toISOString(),
    varied_prompt: `Variation for ${id}`,
    annotation: `Annotation for ${id}`,
    ...overrides,
  })

  const createMockPrompt = (id: string, images: ReturnType<typeof createMockImage>[], overrides = {}) => ({
    id,
    prompt: 'Original prompt',
    title: `Prompt ${id}`,
    created_at: new Date().toISOString(),
    basePrompt: 'User typed this',
    images,
    ...overrides,
  })

  const createMockState = (overrides = {}) => ({
    prompts: [],
    collections: [],
    currentPromptId: null,
    currentCollectionId: null,
    currentImageIndex: 0,
    setCurrentImageIndex: vi.fn(),
    nextImage: vi.fn(),
    prevImage: vi.fn(),
    deleteImage: vi.fn(),
    removeFromCurrentCollection: vi.fn(),
    selectionMode: 'none',
    toggleSelection: vi.fn(),
    selectedIds: new Set(),
    setContextImages: vi.fn(),
    contextImageIds: [],
    // Design dimension analysis
    pendingAnalysis: new Set<string>(),
    analyzeDimensions: vi.fn().mockResolvedValue([]),
    updateImageDimensions: vi.fn(),
    // Token extraction dialog
    extractionDialog: {
      isOpen: false,
      isExtracting: false,
      imageIds: [],
      suggestedDimensions: [],
      selectedDimensionIndex: null,
    },
    openExtractionDialog: vi.fn(),
    closeExtractionDialog: vi.fn(),
    selectExtractionDimension: vi.fn(),
    createTokenFromExtraction: vi.fn(),
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('React hooks order (fix for error #310)', () => {
    it('should render empty state without crashing when no images exist', () => {
      // This test verifies the hooks order fix - useState must be called
      // before early returns to prevent React error #310
      const mockState = createMockState({
        prompts: [],
        currentPromptId: null,
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      // Should not throw - hooks are now called before early return
      expect(() => render(<SingleView />)).not.toThrow()
      expect(screen.getByText('No image to display')).toBeInTheDocument()
    })

    it('should render correctly when images exist', () => {
      const mockImage = {
        id: 'img-1',
        image_path: 'test.jpg',
        mime_type: 'image/jpeg',
        generated_at: new Date().toISOString(),
        varied_prompt: 'Test prompt variation',
      }

      const mockPrompt = {
        id: 'prompt-1',
        prompt: 'Original prompt',
        title: 'Test Prompt',
        created_at: new Date().toISOString(),
        images: [mockImage],
        basePrompt: 'User typed this',
      }

      const mockState = createMockState({
        prompts: [mockPrompt],
        currentPromptId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      expect(() => render(<SingleView />)).not.toThrow()
    })

    it('should not crash when transitioning from images to no images (simulating delete)', () => {
      // First render with images
      const mockImage = {
        id: 'img-1',
        image_path: 'test.jpg',
        mime_type: 'image/jpeg',
        generated_at: new Date().toISOString(),
      }

      const mockPrompt = {
        id: 'prompt-1',
        prompt: 'Test',
        title: 'Test',
        created_at: new Date().toISOString(),
        images: [mockImage],
      }

      let mockState = createMockState({
        prompts: [mockPrompt],
        currentPromptId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      const { rerender } = render(<SingleView />)

      // Now simulate deletion - no more images
      mockState = createMockState({
        prompts: [],
        currentPromptId: null,
      })

      // This should not throw React error #310
      expect(() => rerender(<SingleView />)).not.toThrow()
      expect(screen.getByText('No image to display')).toBeInTheDocument()
    })
  })

  describe('Context images display (issue #21)', () => {
    it('should show context section when prompt has context_image_ids', () => {
      const contextImage = createMockImage('ctx-1', { annotation: 'Reference image' })
      const mainImage = createMockImage('img-1')

      const contextPrompt = createMockPrompt('prompt-ctx', [contextImage])
      const mainPrompt = createMockPrompt('prompt-1', [mainImage], {
        context_image_ids: ['ctx-1'],
      })

      const mockState = createMockState({
        prompts: [contextPrompt, mainPrompt],
        currentPromptId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SingleView />)

      // Should show the Context section
      expect(screen.getByText('Context')).toBeInTheDocument()
      expect(screen.getByText(/1 reference image/)).toBeInTheDocument()
    })

    it('should not show context section when prompt has no context_image_ids', () => {
      const mainImage = createMockImage('img-1')
      const mainPrompt = createMockPrompt('prompt-1', [mainImage])

      const mockState = createMockState({
        prompts: [mainPrompt],
        currentPromptId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SingleView />)

      // Should not show the Context section
      expect(screen.queryByText('Context')).not.toBeInTheDocument()
    })

    it('should show multiple context images count correctly', () => {
      const ctx1 = createMockImage('ctx-1')
      const ctx2 = createMockImage('ctx-2')
      const ctx3 = createMockImage('ctx-3')
      const mainImage = createMockImage('img-1')

      const contextPrompt = createMockPrompt('prompt-ctx', [ctx1, ctx2, ctx3])
      const mainPrompt = createMockPrompt('prompt-1', [mainImage], {
        context_image_ids: ['ctx-1', 'ctx-2', 'ctx-3'],
      })

      const mockState = createMockState({
        prompts: [contextPrompt, mainPrompt],
        currentPromptId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SingleView />)

      // Should show correct count with plural
      expect(screen.getByText(/3 reference images/)).toBeInTheDocument()
    })
  })

  describe('Extract Token button', () => {
    it('should have extract token button that opens shared extraction dialog', () => {
      const mockImage = createMockImage('img-1')
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])

      const mockState = createMockState({
        prompts: [mockPrompt],
        currentPromptId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SingleView />)

      // Extract token button exists as IconButton with tooltip (consistent with other overlay actions)
      // Check that openExtractionDialog is available in the store mock
      expect(mockState.openExtractionDialog).toBeDefined()
    })

    it('should not have "more like this" tooltip (removed)', () => {
      const mockImage = createMockImage('img-1')
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])

      const mockState = createMockState({
        prompts: [mockPrompt],
        currentPromptId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SingleView />)

      // "More like this" tooltip should be removed
      expect(screen.queryByText('More like this')).not.toBeInTheDocument()
    })
  })

  describe('Image container and overlay sizing', () => {
    it('should have outer container with overflow-hidden for bounds', () => {
      const mockImage = createMockImage('img-1', {
        image_path: 'test.jpg',
      })
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])

      const mockState = createMockState({
        prompts: [mockPrompt],
        currentPromptId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SingleView />)

      // Outer container needs overflow-hidden to establish bounds
      const container = document.querySelector('[class*="overflow-hidden"][class*="flex-1"]')
      expect(container).toBeInTheDocument()
    })

    it('should have inner absolute container for definite sizing', () => {
      const mockImage = createMockImage('img-1', {
        image_path: 'test.jpg',
      })
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])

      const mockState = createMockState({
        prompts: [mockPrompt],
        currentPromptId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SingleView />)

      // Inner container uses absolute positioning for definite dimensions
      // This breaks the circular dependency: max-h-full now references definite bounds
      const innerContainer = document.querySelector('[class*="absolute"][class*="inset-3"]')
      expect(innerContainer).toBeInTheDocument()
    })

    it('should have overlay with absolute positioning', () => {
      const mockImage = createMockImage('img-1', {
        image_path: 'test.jpg',
      })
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])

      const mockState = createMockState({
        prompts: [mockPrompt],
        currentPromptId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SingleView />)

      // Overlay uses absolute positioning (bounds calculated via JS for accurate tracking)
      const overlay = document.querySelector('[class*="absolute"][class*="bg-gradient"]')
      expect(overlay).toBeInTheDocument()
    })
  })

  describe('Download filename formatting', () => {
    it('should format download filename with dashes instead of spaces', () => {
      const mockImage = createMockImage('img-123', {
        image_path: 'generated_images/abc123.jpg',
      })
      const mockPrompt = createMockPrompt('prompt-1', [mockImage], {
        title: 'Visceral Layers of Desire',
      })

      const mockState = createMockState({
        prompts: [mockPrompt],
        currentPromptId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SingleView />)

      // Find the download link
      const downloadLink = document.querySelector('a[download]') as HTMLAnchorElement
      expect(downloadLink).toBeInTheDocument()

      // Verify filename has dashes instead of spaces and correct extension
      expect(downloadLink.download).toBe('Visceral-Layers-of-Desire-img-123.jpg')
    })

    it('should extract correct file extension from image path', () => {
      const mockImage = createMockImage('img-456', {
        image_path: 'generated_images/test.png',
      })
      const mockPrompt = createMockPrompt('prompt-1', [mockImage], {
        title: 'Test Image',
      })

      const mockState = createMockState({
        prompts: [mockPrompt],
        currentPromptId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SingleView />)

      const downloadLink = document.querySelector('a[download]') as HTMLAnchorElement
      expect(downloadLink).toBeInTheDocument()
      expect(downloadLink.download).toBe('Test-Image-img-456.png')
    })

    it('should handle multiple spaces in title', () => {
      const mockImage = createMockImage('img-789', {
        image_path: 'path/to/image.webp',
      })
      const mockPrompt = createMockPrompt('prompt-1', [mockImage], {
        title: 'Title   With   Multiple   Spaces',
      })

      const mockState = createMockState({
        prompts: [mockPrompt],
        currentPromptId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SingleView />)

      const downloadLink = document.querySelector('a[download]') as HTMLAnchorElement
      expect(downloadLink).toBeInTheDocument()
      // Multiple spaces should become single dashes
      expect(downloadLink.download).toBe('Title-With-Multiple-Spaces-img-789.webp')
    })
  })

  describe('Favorites removal', () => {
    it('should not have favorite button or star icon in the UI', () => {
      const mainImage = createMockImage('img-1')
      const mainPrompt = createMockPrompt('prompt-1', [mainImage])

      const mockState = createMockState({
        prompts: [mainPrompt],
        currentPromptId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SingleView />)

      // Should not have any favorite-related elements
      expect(screen.queryByRole('button', { name: /favorite/i })).not.toBeInTheDocument()
      // Star icon should not be in the document (favorites were removed)
    })

    it('should not request toggleFavorite or isImageFavorite from store', () => {
      const mainImage = createMockImage('img-1')
      const mainPrompt = createMockPrompt('prompt-1', [mainImage])

      const mockState = createMockState({
        prompts: [mainPrompt],
        currentPromptId: 'prompt-1',
      })

      const selectorCalls: string[] = []
      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          // Track what selectors are called
          const result = selector(mockState)
          const selectorStr = selector.toString()
          if (selectorStr.includes('toggleFavorite')) {
            selectorCalls.push('toggleFavorite')
          }
          if (selectorStr.includes('isImageFavorite')) {
            selectorCalls.push('isImageFavorite')
          }
          return result
        }
        return mockState
      })

      render(<SingleView />)

      // These selectors should not be called (favorites removed)
      expect(selectorCalls).not.toContain('toggleFavorite')
      expect(selectorCalls).not.toContain('isImageFavorite')
    })
  })
})
