import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock the store
const mockUseStore = vi.fn()
vi.mock('../../store', () => ({
  useStore: (selector: (state: unknown) => unknown) => mockUseStore(selector),
}))

// Import after mocks are set up
import { DesignAnnotation } from './DesignAnnotation'

describe('DesignAnnotation', () => {
  const createMockImage = (id: string, overrides = {}) => ({
    id,
    image_path: `${id}.jpg`,
    mime_type: 'image/jpeg',
    generated_at: new Date().toISOString(),
    annotation: '',
    notes: '',
    annotations: {} as Record<string, string[]>,
    liked_axes: {} as Record<string, string[]>,
    design_dimensions: undefined,
    liked_dimension_axes: [] as string[],
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
    toggleAxisLike: vi.fn(),
    toggleDimensionLike: vi.fn(),
    updateImageNotes: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('empty state', () => {
    it('should return null when no current image', () => {
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

      const { container } = render(<DesignAnnotation />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('fixed height layout', () => {
    it('should have fixed height h-52 (208px) to prevent layout shifts', () => {
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

      render(<DesignAnnotation />)

      // Container should have h-52 class for fixed height
      const container = document.querySelector('[class*="h-52"]')
      expect(container).toBeInTheDocument()
    })

    it('should have overflow-y-auto for scrolling when content exceeds height', () => {
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

      render(<DesignAnnotation />)

      const container = document.querySelector('[class*="overflow-y-auto"]')
      expect(container).toBeInTheDocument()
    })
  })

  describe('notes textarea', () => {
    it('should render textarea with placeholder', () => {
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

      render(<DesignAnnotation />)

      const textarea = screen.getByPlaceholderText('What stands out in this image?')
      expect(textarea).toBeInTheDocument()
    })

    it('should sync textarea value with current image annotation', () => {
      const mockImage = createMockImage('img-1', {
        annotation: 'Existing annotation text',
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

      render(<DesignAnnotation />)

      const textarea = screen.getByPlaceholderText('What stands out in this image?') as HTMLTextAreaElement
      expect(textarea.value).toBe('Existing annotation text')
    })

    it('should show save button when annotation changes', () => {
      const mockImage = createMockImage('img-1', {
        annotation: 'Original text',
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

      render(<DesignAnnotation />)

      const textarea = screen.getByPlaceholderText('What stands out in this image?')
      fireEvent.change(textarea, { target: { value: 'New annotation' } })

      // Save button should appear
      expect(screen.getByText('↵ save')).toBeInTheDocument()
    })

    it('should call updateImageNotes when Enter is pressed (without Shift)', () => {
      const updateImageNotes = vi.fn().mockResolvedValue(undefined)
      const mockImage = createMockImage('img-1', {
        annotation: 'Original',
        notes: '',
      })
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])

      const mockState = createMockState({
        prompts: [mockPrompt],
        currentPromptId: 'prompt-1',
        updateImageNotes,
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<DesignAnnotation />)

      const textarea = screen.getByPlaceholderText('What stands out in this image?')
      fireEvent.change(textarea, { target: { value: 'New text' } })

      // Press Enter (without Shift)
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

      expect(updateImageNotes).toHaveBeenCalledWith('img-1', '', 'New text')
    })

    it('should not save when Shift+Enter is pressed (new line)', () => {
      const updateImageNotes = vi.fn().mockResolvedValue(undefined)
      const mockImage = createMockImage('img-1', {
        annotation: 'Original',
      })
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])

      const mockState = createMockState({
        prompts: [mockPrompt],
        currentPromptId: 'prompt-1',
        updateImageNotes,
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<DesignAnnotation />)

      const textarea = screen.getByPlaceholderText('What stands out in this image?')
      fireEvent.change(textarea, { target: { value: 'New text' } })

      // Press Shift+Enter (should insert newline, not save)
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

      expect(updateImageNotes).not.toHaveBeenCalled()
    })
  })

  describe('design tags display', () => {
    it('should show placeholder when no annotations exist', () => {
      const mockImage = createMockImage('img-1', {
        annotations: {},
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

      render(<DesignAnnotation />)

      expect(screen.getByText('Design tags will appear on new generations')).toBeInTheDocument()
    })

    it('should display tags grouped by axis', () => {
      const mockImage = createMockImage('img-1', {
        annotations: {
          style: ['minimalist', 'clean'],
          mood: ['calm', 'serene'],
        },
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

      render(<DesignAnnotation />)

      // Should show axis labels
      expect(screen.getByText('style')).toBeInTheDocument()
      expect(screen.getByText('mood')).toBeInTheDocument()

      // Should show tags
      expect(screen.getByText('minimalist')).toBeInTheDocument()
      expect(screen.getByText('clean')).toBeInTheDocument()
      expect(screen.getByText('calm')).toBeInTheDocument()
      expect(screen.getByText('serene')).toBeInTheDocument()
    })

    it('should toggle tag like state when clicked', () => {
      const toggleAxisLike = vi.fn()
      const mockImage = createMockImage('img-1', {
        annotations: {
          style: ['minimalist'],
        },
        liked_axes: {},
      })
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])

      const mockState = createMockState({
        prompts: [mockPrompt],
        currentPromptId: 'prompt-1',
        toggleAxisLike,
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<DesignAnnotation />)

      const tagButton = screen.getByText('minimalist')
      fireEvent.click(tagButton)

      expect(toggleAxisLike).toHaveBeenCalledWith('img-1', 'style', 'minimalist', true)
    })

    it('should show heart symbol on liked tags', () => {
      const mockImage = createMockImage('img-1', {
        annotations: {
          style: ['minimalist'],
        },
        liked_axes: {
          style: ['minimalist'],
        },
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

      render(<DesignAnnotation />)

      // Liked tag should have heart symbol
      const tagButton = screen.getByText(/minimalist/)
      expect(tagButton.textContent).toContain('♥')
    })
  })

  describe('design dimensions display', () => {
    it('should show placeholder when no dimensions exist', () => {
      const mockImage = createMockImage('img-1', {
        design_dimensions: undefined,
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

      render(<DesignAnnotation />)

      expect(screen.getByText('Dimensions appear on new generations')).toBeInTheDocument()
    })

    it('should display dimension names (limited to 3)', () => {
      const mockImage = createMockImage('img-1', {
        design_dimensions: {
          visual_weight: { name: 'Visual Weight', description: 'Heavy elements at bottom' },
          color_harmony: { name: 'Color Harmony', description: 'Complementary palette' },
          rhythm: { name: 'Rhythm', description: 'Repeating patterns' },
          texture: { name: 'Texture', description: 'Smooth surfaces' }, // 4th - should not show
        },
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

      render(<DesignAnnotation />)

      // First 3 dimensions should show
      expect(screen.getByText('Visual Weight')).toBeInTheDocument()
      expect(screen.getByText('Color Harmony')).toBeInTheDocument()
      expect(screen.getByText('Rhythm')).toBeInTheDocument()

      // 4th dimension should NOT show (limited to 3)
      expect(screen.queryByText('Texture')).not.toBeInTheDocument()
    })

    it('should expand dimension description when clicked', () => {
      const mockImage = createMockImage('img-1', {
        design_dimensions: {
          visual_weight: { name: 'Visual Weight', description: 'Heavy elements create grounding' },
        },
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

      render(<DesignAnnotation />)

      // Description should not be visible initially
      expect(screen.queryByText('Heavy elements create grounding')).not.toBeInTheDocument()

      // Click dimension name to expand
      const dimensionButton = screen.getByText('Visual Weight')
      fireEvent.click(dimensionButton)

      // Description should now be visible
      expect(screen.getByText('Heavy elements create grounding')).toBeInTheDocument()
    })

    it('should toggle dimension like state when heart is clicked', () => {
      const toggleDimensionLike = vi.fn()
      const mockImage = createMockImage('img-1', {
        design_dimensions: {
          visual_weight: { name: 'Visual Weight', description: 'Test' },
        },
        liked_dimension_axes: [],
      })
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])

      const mockState = createMockState({
        prompts: [mockPrompt],
        currentPromptId: 'prompt-1',
        toggleDimensionLike,
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<DesignAnnotation />)

      // Find and click the heart button (first button before dimension name)
      const heartButtons = document.querySelectorAll('button')
      const heartButton = Array.from(heartButtons).find(btn => btn.querySelector('svg'))
      expect(heartButton).toBeInTheDocument()

      if (heartButton) {
        fireEvent.click(heartButton)
        expect(toggleDimensionLike).toHaveBeenCalledWith('img-1', 'visual_weight', true)
      }
    })
  })

  describe('three-column layout', () => {
    it('should have three columns: notes, tags, dimensions', () => {
      const mockImage = createMockImage('img-1', {
        annotations: { style: ['modern'] },
        design_dimensions: {
          balance: { name: 'Balance', description: 'Symmetric layout' },
        },
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

      render(<DesignAnnotation />)

      // All three sections should be present
      expect(screen.getByPlaceholderText('What stands out in this image?')).toBeInTheDocument() // Notes
      expect(screen.getByText('modern')).toBeInTheDocument() // Tags
      expect(screen.getByText('Balance')).toBeInTheDocument() // Dimensions
    })
  })

  describe('collection context', () => {
    it('should work when viewing image from collection', () => {
      const mockImage = createMockImage('img-1', {
        annotation: 'Collection image annotation',
      })
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])
      const mockCollection = {
        id: 'collection-1',
        name: 'Test Collection',
        image_ids: ['img-1'],
      }

      const mockState = createMockState({
        prompts: [mockPrompt],
        collections: [mockCollection],
        currentPromptId: null,
        currentCollectionId: 'collection-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<DesignAnnotation />)

      const textarea = screen.getByPlaceholderText('What stands out in this image?') as HTMLTextAreaElement
      expect(textarea.value).toBe('Collection image annotation')
    })
  })
})
