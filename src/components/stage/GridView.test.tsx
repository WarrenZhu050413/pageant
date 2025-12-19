import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock the store
const mockUseStore = vi.fn()
vi.mock('../../store', () => ({
  useStore: (selector: (state: unknown) => unknown) => mockUseStore(selector),
}))

// Mock the API
vi.mock('../../api', () => ({
  getImageUrl: (path: string) => `/images/${path}`,
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, onClick, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} onClick={onClick} {...props}>{children}</div>
    ),
  },
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Check: () => <span data-testid="icon-check">✓</span>,
  FolderMinus: () => <span data-testid="icon-folder-minus">-</span>,
}))

// Import after mocks
import { GridView } from './GridView'

describe('GridView', () => {
  const createMockImage = (id: string, overrides = {}) => ({
    id,
    image_path: `${id}.jpg`,
    mime_type: 'image/jpeg',
    generated_at: new Date().toISOString(),
    ...overrides,
  })

  const createMockPrompt = (id: string, images: ReturnType<typeof createMockImage>[], overrides = {}) => ({
    id,
    prompt: 'Test prompt',
    title: `Prompt ${id}`,
    created_at: new Date().toISOString(),
    images,
    ...overrides,
  })

  const createMockCollection = (id: string, imageIds: string[], overrides = {}) => ({
    id,
    name: `Collection ${id}`,
    description: '',
    image_ids: imageIds,
    created_at: new Date().toISOString(),
    ...overrides,
  })

  const createMockState = (overrides = {}) => ({
    prompts: [],
    collections: [],
    currentPromptId: null,
    currentCollectionId: null,
    setCurrentImageIndex: vi.fn(),
    setViewMode: vi.fn(),
    removeFromCurrentCollection: vi.fn(),
    selectionMode: 'none',
    toggleSelection: vi.fn(),
    selectedIds: new Set<string>(),
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('empty state', () => {
    it('should show "No prompt selected" when no prompt or collection', () => {
      const mockState = createMockState({
        prompts: [],
        currentPromptId: null,
        currentCollectionId: null,
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<GridView />)
      expect(screen.getByText('No prompt selected')).toBeInTheDocument()
    })

    it('should show "Empty collection" when viewing empty collection', () => {
      const mockCollection = createMockCollection('col-1', [])
      const mockState = createMockState({
        prompts: [],
        collections: [mockCollection],
        currentPromptId: null,
        currentCollectionId: 'col-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<GridView />)
      expect(screen.getByText('Empty collection')).toBeInTheDocument()
    })
  })

  describe('image grid rendering', () => {
    it('should render images from current prompt', () => {
      const images = [
        createMockImage('img-1'),
        createMockImage('img-2'),
        createMockImage('img-3'),
      ]
      const mockPrompt = createMockPrompt('prompt-1', images, { title: 'Test Title' })

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

      render(<GridView />)

      // Should render all 3 images
      const imgElements = screen.getAllByRole('img')
      expect(imgElements.length).toBe(3)
    })

    it('should render images from collection', () => {
      const images = [createMockImage('img-1'), createMockImage('img-2')]
      const mockPrompt = createMockPrompt('prompt-1', images)
      const mockCollection = createMockCollection('col-1', ['img-1', 'img-2'])

      const mockState = createMockState({
        prompts: [mockPrompt],
        collections: [mockCollection],
        currentPromptId: null,
        currentCollectionId: 'col-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<GridView />)

      const imgElements = screen.getAllByRole('img')
      expect(imgElements.length).toBe(2)
    })

    it('should show image number badges', () => {
      const images = [createMockImage('img-1'), createMockImage('img-2')]
      const mockPrompt = createMockPrompt('prompt-1', images)

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

      render(<GridView />)

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('should show variation title badge when present', () => {
      const images = [
        createMockImage('img-1', { variation_title: 'Minimalist' }),
      ]
      const mockPrompt = createMockPrompt('prompt-1', images)

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

      render(<GridView />)

      expect(screen.getByText('Minimalist')).toBeInTheDocument()
    })
  })

  describe('click behavior', () => {
    it('should navigate to single view when clicking image (not in selection mode)', () => {
      const setCurrentImageIndex = vi.fn()
      const setViewMode = vi.fn()
      const images = [createMockImage('img-1'), createMockImage('img-2')]
      const mockPrompt = createMockPrompt('prompt-1', images)

      const mockState = createMockState({
        prompts: [mockPrompt],
        currentPromptId: 'prompt-1',
        selectionMode: 'none',
        setCurrentImageIndex,
        setViewMode,
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<GridView />)

      // Click second image
      const imgElements = screen.getAllByRole('img')
      fireEvent.click(imgElements[1].closest('div[class*="group"]')!)

      expect(setCurrentImageIndex).toHaveBeenCalledWith(1)
      expect(setViewMode).toHaveBeenCalledWith('single')
    })

    it('should toggle selection when clicking image in selection mode', () => {
      const toggleSelection = vi.fn()
      const setCurrentImageIndex = vi.fn()
      const images = [createMockImage('img-1')]
      const mockPrompt = createMockPrompt('prompt-1', images)

      const mockState = createMockState({
        prompts: [mockPrompt],
        currentPromptId: 'prompt-1',
        selectionMode: 'select',
        toggleSelection,
        setCurrentImageIndex,
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<GridView />)

      const imgElement = screen.getByRole('img')
      fireEvent.click(imgElement.closest('div[class*="group"]')!)

      expect(toggleSelection).toHaveBeenCalledWith('img-1')
      expect(setCurrentImageIndex).not.toHaveBeenCalled()
    })
  })

  describe('selection mode', () => {
    it('should show selection indicator when in selection mode', () => {
      const images = [createMockImage('img-1')]
      const mockPrompt = createMockPrompt('prompt-1', images)

      const mockState = createMockState({
        prompts: [mockPrompt],
        currentPromptId: 'prompt-1',
        selectionMode: 'select',
        selectedIds: new Set<string>(),
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<GridView />)

      // Selection circle should be present (as a div with specific classes)
      const selectionCircle = document.querySelector('[class*="rounded-full"][class*="border-2"]')
      expect(selectionCircle).toBeInTheDocument()
    })

    it('should show check icon when image is selected', () => {
      const images = [createMockImage('img-1')]
      const mockPrompt = createMockPrompt('prompt-1', images)

      const mockState = createMockState({
        prompts: [mockPrompt],
        currentPromptId: 'prompt-1',
        selectionMode: 'select',
        selectedIds: new Set(['img-1']),
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<GridView />)

      expect(screen.getByTestId('icon-check')).toBeInTheDocument()
    })

    it('should apply selection styling to selected images', () => {
      const images = [createMockImage('img-1')]
      const mockPrompt = createMockPrompt('prompt-1', images)

      const mockState = createMockState({
        prompts: [mockPrompt],
        currentPromptId: 'prompt-1',
        selectionMode: 'select',
        selectedIds: new Set(['img-1']),
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<GridView />)

      // Selected image should have ring-4 ring-brass class
      const selectedCard = document.querySelector('[class*="ring-4"][class*="ring-brass"]')
      expect(selectedCard).toBeInTheDocument()
    })
  })

  describe('collection view features', () => {
    it('should show remove from collection button when viewing collection', () => {
      const images = [createMockImage('img-1')]
      const mockPrompt = createMockPrompt('prompt-1', images)
      const mockCollection = createMockCollection('col-1', ['img-1'])

      const mockState = createMockState({
        prompts: [mockPrompt],
        collections: [mockCollection],
        currentPromptId: null,
        currentCollectionId: 'col-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<GridView />)

      expect(screen.getByTestId('icon-folder-minus')).toBeInTheDocument()
    })

    it('should call removeFromCurrentCollection when remove button clicked', () => {
      const removeFromCurrentCollection = vi.fn()
      const images = [createMockImage('img-1')]
      const mockPrompt = createMockPrompt('prompt-1', images)
      const mockCollection = createMockCollection('col-1', ['img-1'])

      const mockState = createMockState({
        prompts: [mockPrompt],
        collections: [mockCollection],
        currentPromptId: null,
        currentCollectionId: 'col-1',
        removeFromCurrentCollection,
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<GridView />)

      const removeButton = screen.getByTestId('icon-folder-minus').closest('button')!
      fireEvent.click(removeButton)

      expect(removeFromCurrentCollection).toHaveBeenCalledWith('img-1')
    })

    it('should NOT show remove button when viewing prompt', () => {
      const images = [createMockImage('img-1')]
      const mockPrompt = createMockPrompt('prompt-1', images)

      const mockState = createMockState({
        prompts: [mockPrompt],
        currentPromptId: 'prompt-1',
        currentCollectionId: null,
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<GridView />)

      expect(screen.queryByTestId('icon-folder-minus')).not.toBeInTheDocument()
    })
  })

  describe('responsive grid', () => {
    it('should have responsive grid classes', () => {
      const images = [createMockImage('img-1')]
      const mockPrompt = createMockPrompt('prompt-1', images)

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

      render(<GridView />)

      // Grid should have responsive column classes
      const grid = document.querySelector('[class*="grid-cols-2"][class*="md:grid-cols-3"][class*="lg:grid-cols-4"]')
      expect(grid).toBeInTheDocument()
    })
  })
})
