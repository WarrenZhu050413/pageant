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
  const createMockState = (overrides = {}) => ({
    prompts: [],
    collections: [],
    currentPromptId: null,
    currentCollectionId: null,
    currentImageIndex: 0,
    setCurrentImageIndex: vi.fn(),
    nextImage: vi.fn(),
    prevImage: vi.fn(),
    toggleFavorite: vi.fn(),
    isImageFavorite: vi.fn(() => false),
    iterate: vi.fn(),
    deleteImage: vi.fn(),
    removeFromCurrentCollection: vi.fn(),
    selectionMode: 'none',
    toggleSelection: vi.fn(),
    selectedIds: new Set(),
    setContextImages: vi.fn(),
    contextImageIds: [],
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
})
