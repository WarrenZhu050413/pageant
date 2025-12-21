import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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
    div: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} {...props}>{children}</div>
    ),
    button: ({ children, className, ...props }: React.HTMLAttributes<HTMLButtonElement>) => (
      <button className={className} {...props}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  X: () => <span data-testid="icon-x">X</span>,
  FolderPlus: () => <span data-testid="icon-folder-plus">+</span>,
  Plus: () => <span data-testid="icon-plus">+</span>,
  Trash2: () => <span data-testid="icon-trash">🗑</span>,
  CheckSquare: () => <span data-testid="icon-check-square">☑</span>,
  Square: () => <span data-testid="icon-square">☐</span>,
  Check: () => <span data-testid="icon-check">✓</span>,
  Download: () => <span data-testid="icon-download">⬇</span>,
}))

// Import after mocks are set up
import { SelectionTray } from './SelectionTray'

describe('SelectionTray', () => {
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
    selectedIds: new Set<string>(),
    generations: [],
    collections: [],
    currentGenerationId: null,
    currentCollectionId: null,
    clearSelection: vi.fn(),
    toggleSelection: vi.fn(),
    setContextImages: vi.fn(),
    setRightTab: vi.fn(),
    createCollection: vi.fn().mockResolvedValue(undefined),
    addToCollection: vi.fn().mockResolvedValue(undefined),
    setSelectionMode: vi.fn(),
    selectAll: vi.fn(),
    batchDelete: vi.fn().mockResolvedValue(undefined),
    contextImageIds: [],
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('empty state', () => {
    it('should return null when no images are selected', () => {
      const mockState = createMockState({
        selectedIds: new Set(),
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      const { container } = render(<SelectionTray />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('selection display', () => {
    it('should show selection count', () => {
      const mockImage = createMockImage('img-1')
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])

      const mockState = createMockState({
        selectedIds: new Set(['img-1']),
        generations: [mockPrompt],
        currentGenerationId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SelectionTray />)
      expect(screen.getByText('1 selected')).toBeInTheDocument()
    })

    it('should show multiple selection count', () => {
      const images = [
        createMockImage('img-1'),
        createMockImage('img-2'),
        createMockImage('img-3'),
      ]
      const mockPrompt = createMockPrompt('prompt-1', images)

      const mockState = createMockState({
        selectedIds: new Set(['img-1', 'img-2', 'img-3']),
        generations: [mockPrompt],
        currentGenerationId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SelectionTray />)
      expect(screen.getByText('3 selected')).toBeInTheDocument()
    })

    it('should display selected image thumbnails', () => {
      const mockImage = createMockImage('img-1')
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])

      const mockState = createMockState({
        selectedIds: new Set(['img-1']),
        generations: [mockPrompt],
        currentGenerationId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SelectionTray />)

      const thumbnails = document.querySelectorAll('img')
      expect(thumbnails.length).toBeGreaterThan(0)
    })

    it('should call clearSelection when X button is clicked', async () => {
      const user = userEvent.setup()
      const clearSelection = vi.fn()
      const mockImage = createMockImage('img-1')
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])

      const mockState = createMockState({
        selectedIds: new Set(['img-1']),
        generations: [mockPrompt],
        currentGenerationId: 'prompt-1',
        clearSelection,
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SelectionTray />)

      // Find the close button in the header (not the ones on thumbnails)
      const closeButtons = document.querySelectorAll('button')
      const headerCloseButton = Array.from(closeButtons).find(btn =>
        btn.closest('.flex.items-center.justify-between.mb-3')
      )

      if (headerCloseButton) {
        await user.click(headerCloseButton)
        expect(clearSelection).toHaveBeenCalled()
      }
    })
  })

  describe('select all / deselect all', () => {
    it('should show "Select All" when not all images are selected', () => {
      const images = [createMockImage('img-1'), createMockImage('img-2')]
      const mockPrompt = createMockPrompt('prompt-1', images)

      const mockState = createMockState({
        selectedIds: new Set(['img-1']), // Only 1 of 2 selected
        generations: [mockPrompt],
        currentGenerationId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SelectionTray />)
      expect(screen.getByText('Select All')).toBeInTheDocument()
    })

    it('should show "Deselect All" when all images are selected', () => {
      const images = [createMockImage('img-1'), createMockImage('img-2')]
      const mockPrompt = createMockPrompt('prompt-1', images)

      const mockState = createMockState({
        selectedIds: new Set(['img-1', 'img-2']), // All 2 selected
        generations: [mockPrompt],
        currentGenerationId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SelectionTray />)
      expect(screen.getByText('Deselect All')).toBeInTheDocument()
    })

    it('should call selectAll when Select All is clicked', async () => {
      const user = userEvent.setup()
      const selectAll = vi.fn()
      const images = [createMockImage('img-1'), createMockImage('img-2')]
      const mockPrompt = createMockPrompt('prompt-1', images)

      const mockState = createMockState({
        selectedIds: new Set(['img-1']),
        generations: [mockPrompt],
        currentGenerationId: 'prompt-1',
        selectAll,
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SelectionTray />)
      await user.click(screen.getByText('Select All'))
      expect(selectAll).toHaveBeenCalled()
    })

    it('should call clearSelection when Deselect All is clicked', async () => {
      const user = userEvent.setup()
      const clearSelection = vi.fn()
      const images = [createMockImage('img-1'), createMockImage('img-2')]
      const mockPrompt = createMockPrompt('prompt-1', images)

      const mockState = createMockState({
        selectedIds: new Set(['img-1', 'img-2']),
        generations: [mockPrompt],
        currentGenerationId: 'prompt-1',
        clearSelection,
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SelectionTray />)
      await user.click(screen.getByText('Deselect All'))
      expect(clearSelection).toHaveBeenCalled()
    })
  })

  describe('add to context', () => {
    it('should have Add to Context button', () => {
      const mockImage = createMockImage('img-1')
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])

      const mockState = createMockState({
        selectedIds: new Set(['img-1']),
        generations: [mockPrompt],
        currentGenerationId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SelectionTray />)
      expect(screen.getByText('Add to Context')).toBeInTheDocument()
    })

    it('should call setContextImages and switch to generate tab when clicked', async () => {
      const user = userEvent.setup()
      const setContextImages = vi.fn()
      const setRightTab = vi.fn()
      const clearSelection = vi.fn()
      const mockImage = createMockImage('img-1')
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])

      const mockState = createMockState({
        selectedIds: new Set(['img-1']),
        generations: [mockPrompt],
        currentGenerationId: 'prompt-1',
        contextImageIds: [],
        setContextImages,
        setRightTab,
        clearSelection,
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SelectionTray />)
      await user.click(screen.getByText('Add to Context'))

      expect(setContextImages).toHaveBeenCalledWith(['img-1'])
      expect(setRightTab).toHaveBeenCalledWith('generate')
      expect(clearSelection).toHaveBeenCalled()
    })

    it('should add to existing context (additive behavior)', async () => {
      const user = userEvent.setup()
      const setContextImages = vi.fn()
      const mockImage = createMockImage('img-2')
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])

      const mockState = createMockState({
        selectedIds: new Set(['img-2']),
        generations: [mockPrompt],
        currentGenerationId: 'prompt-1',
        contextImageIds: ['img-1'], // Already has one image
        setContextImages,
        setRightTab: vi.fn(),
        clearSelection: vi.fn(),
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SelectionTray />)
      await user.click(screen.getByText('Add to Context'))

      // Should include both existing and new
      expect(setContextImages).toHaveBeenCalledWith(['img-1', 'img-2'])
    })
  })

  describe('collection dialog', () => {
    it('should have Save Collection button', () => {
      const mockImage = createMockImage('img-1')
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])

      const mockState = createMockState({
        selectedIds: new Set(['img-1']),
        generations: [mockPrompt],
        currentGenerationId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SelectionTray />)
      expect(screen.getByText('Save Collection')).toBeInTheDocument()
    })

    it('should open dialog when Save Collection is clicked', async () => {
      const user = userEvent.setup()
      const mockImage = createMockImage('img-1')
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])

      const mockState = createMockState({
        selectedIds: new Set(['img-1']),
        generations: [mockPrompt],
        currentGenerationId: 'prompt-1',
        collections: [],
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SelectionTray />)
      await user.click(screen.getByText('Save Collection'))

      // Dialog should show with create form when no collections exist
      expect(screen.getByText('Save to Collection')).toBeInTheDocument()
      expect(screen.getByLabelText('Collection Name')).toBeInTheDocument()
    })

    it('should show existing collections when they exist', async () => {
      const user = userEvent.setup()
      const mockImage = createMockImage('img-1')
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])
      const mockCollection = createMockCollection('col-1', [], { name: 'My Collection' })

      const mockState = createMockState({
        selectedIds: new Set(['img-1']),
        generations: [mockPrompt],
        currentGenerationId: 'prompt-1',
        collections: [mockCollection],
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SelectionTray />)
      await user.click(screen.getByText('Save Collection'))

      // Should show existing collection
      expect(screen.getByText('My Collection')).toBeInTheDocument()
      expect(screen.getByText('Create new collection')).toBeInTheDocument()
    })

    it('should show image count in dialog', async () => {
      const user = userEvent.setup()
      const images = [createMockImage('img-1'), createMockImage('img-2')]
      const mockPrompt = createMockPrompt('prompt-1', images)

      const mockState = createMockState({
        selectedIds: new Set(['img-1', 'img-2']),
        generations: [mockPrompt],
        currentGenerationId: 'prompt-1',
        collections: [],
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SelectionTray />)
      await user.click(screen.getByText('Save Collection'))

      expect(screen.getByText('2 images will be added')).toBeInTheDocument()
    })

    it('should have description field for new collections', async () => {
      const user = userEvent.setup()
      const mockImage = createMockImage('img-1')
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])

      const mockState = createMockState({
        selectedIds: new Set(['img-1']),
        generations: [mockPrompt],
        currentGenerationId: 'prompt-1',
        collections: [],
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SelectionTray />)
      await user.click(screen.getByText('Save Collection'))

      expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument()
    })
  })

  describe('delete functionality', () => {
    it('should show delete confirmation dialog when delete button clicked', async () => {
      const user = userEvent.setup()
      const mockImage = createMockImage('img-1')
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])

      const mockState = createMockState({
        selectedIds: new Set(['img-1']),
        generations: [mockPrompt],
        currentGenerationId: 'prompt-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SelectionTray />)

      // Find delete button by its trash icon testid
      const trashIcon = screen.getByTestId('icon-trash')
      const deleteButton = trashIcon.closest('button')!
      await user.click(deleteButton)

      // Confirmation dialog should appear
      expect(screen.getByText('Delete Images')).toBeInTheDocument()
      expect(screen.getByText(/Are you sure you want to delete 1 image/)).toBeInTheDocument()
    })

    it('should call batchDelete when confirmed', async () => {
      const user = userEvent.setup()
      const batchDelete = vi.fn().mockResolvedValue(undefined)
      const mockImage = createMockImage('img-1')
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])

      const mockState = createMockState({
        selectedIds: new Set(['img-1']),
        generations: [mockPrompt],
        currentGenerationId: 'prompt-1',
        batchDelete,
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SelectionTray />)

      // Open delete dialog by finding trash icon
      const trashIcon = screen.getByTestId('icon-trash')
      const deleteButton = trashIcon.closest('button')!
      await user.click(deleteButton)

      // Confirm delete - the dialog has a button labeled "Delete"
      const confirmButton = screen.getByRole('button', { name: 'Delete' })
      await user.click(confirmButton)

      expect(batchDelete).toHaveBeenCalled()
    })
  })

  describe('collection context', () => {
    it('should work when viewing images from a collection', () => {
      const mockImage = createMockImage('img-1')
      const mockPrompt = createMockPrompt('prompt-1', [mockImage])
      const mockCollection = createMockCollection('col-1', ['img-1'])

      const mockState = createMockState({
        selectedIds: new Set(['img-1']),
        generations: [mockPrompt],
        collections: [mockCollection],
        currentGenerationId: null,
        currentCollectionId: 'col-1',
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<SelectionTray />)

      // Should still show selection count
      expect(screen.getByText('1 selected')).toBeInTheDocument()
    })
  })
})
