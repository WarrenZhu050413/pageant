import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock the store
const mockUseStore = vi.fn()
vi.mock('../../store', () => ({
  useStore: (selector: (state: unknown) => unknown) => mockUseStore(selector),
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  FolderOpen: () => <span data-testid="icon-folder">📁</span>,
  Star: () => <span data-testid="icon-star">⭐</span>,
  Trash2: () => <span data-testid="icon-trash">🗑</span>,
  X: () => <span data-testid="icon-x">×</span>,
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

// Import after mocks
import { CollectionEditModal } from './CollectionEditModal'

describe('CollectionEditModal', () => {
  const createMockCollection = (id: string, overrides = {}) => ({
    id,
    name: `Collection ${id}`,
    description: '',
    image_ids: ['img-1', 'img-2'],
    created_at: new Date().toISOString(),
    ...overrides,
  })

  const createMockState = (overrides = {}) => ({
    createCollection: vi.fn().mockResolvedValue(undefined),
    updateCollection: vi.fn().mockResolvedValue(undefined),
    deleteCollection: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('create mode', () => {
    it('should show "Create Collection" title when no collection provided', () => {
      mockUseStore.mockImplementation((selector) => selector(createMockState()))

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
        />
      )

      expect(screen.getByText('Create Collection')).toBeInTheDocument()
    })

    it('should show empty form in create mode', () => {
      mockUseStore.mockImplementation((selector) => selector(createMockState()))

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
        />
      )

      const nameInput = screen.getByLabelText('Name') as HTMLInputElement
      const descInput = screen.getByLabelText('Description (optional)') as HTMLTextAreaElement

      expect(nameInput.value).toBe('')
      expect(descInput.value).toBe('')
    })

    it('should show "Create" button text in create mode', () => {
      mockUseStore.mockImplementation((selector) => selector(createMockState()))

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
        />
      )

      expect(screen.getByText('Create')).toBeInTheDocument()
    })

    it('should disable Create button when name is empty', () => {
      mockUseStore.mockImplementation((selector) => selector(createMockState()))

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
        />
      )

      const createButton = screen.getByText('Create').closest('button')
      expect(createButton).toBeDisabled()
    })

    it('should enable Create button when name is entered', async () => {
      const user = userEvent.setup()
      mockUseStore.mockImplementation((selector) => selector(createMockState()))

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
        />
      )

      const nameInput = screen.getByLabelText('Name')
      await user.type(nameInput, 'My New Collection')

      const createButton = screen.getByText('Create').closest('button')
      expect(createButton).not.toBeDisabled()
    })

    it('should call createCollection with name and description', async () => {
      const user = userEvent.setup()
      const createCollection = vi.fn().mockResolvedValue(undefined)
      mockUseStore.mockImplementation((selector) => selector(createMockState({ createCollection })))

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
        />
      )

      const nameInput = screen.getByLabelText('Name')
      const descInput = screen.getByLabelText('Description (optional)')

      await user.type(nameInput, 'Test Collection')
      await user.type(descInput, 'Test Description')
      await user.click(screen.getByText('Create'))

      expect(createCollection).toHaveBeenCalledWith('Test Collection', 'Test Description', [])
    })

    it('should pass imageIds when creating collection with images', async () => {
      const user = userEvent.setup()
      const createCollection = vi.fn().mockResolvedValue(undefined)
      mockUseStore.mockImplementation((selector) => selector(createMockState({ createCollection })))

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
          imageIds={['img-1', 'img-2', 'img-3']}
        />
      )

      const nameInput = screen.getByLabelText('Name')
      await user.type(nameInput, 'New Collection')
      await user.click(screen.getByText('Create'))

      expect(createCollection).toHaveBeenCalledWith('New Collection', undefined, ['img-1', 'img-2', 'img-3'])
    })

    it('should show image count when creating with images', () => {
      mockUseStore.mockImplementation((selector) => selector(createMockState()))

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
          imageIds={['img-1', 'img-2']}
        />
      )

      expect(screen.getByText('Adding 2 images')).toBeInTheDocument()
    })

    it('should show "Empty collection" when no images', () => {
      mockUseStore.mockImplementation((selector) => selector(createMockState()))

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
          imageIds={[]}
        />
      )

      expect(screen.getByText('Empty collection')).toBeInTheDocument()
    })
  })

  describe('edit mode', () => {
    it('should show "Edit Collection" title when collection provided', () => {
      mockUseStore.mockImplementation((selector) => selector(createMockState()))
      const collection = createMockCollection('col-1', { name: 'My Collection' })

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
          collection={collection}
        />
      )

      expect(screen.getByText('Edit Collection')).toBeInTheDocument()
    })

    it('should pre-fill form with collection data', () => {
      mockUseStore.mockImplementation((selector) => selector(createMockState()))
      const collection = createMockCollection('col-1', {
        name: 'Existing Collection',
        description: 'Existing description',
      })

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
          collection={collection}
        />
      )

      const nameInput = screen.getByLabelText('Name') as HTMLInputElement
      const descInput = screen.getByLabelText('Description (optional)') as HTMLTextAreaElement

      expect(nameInput.value).toBe('Existing Collection')
      expect(descInput.value).toBe('Existing description')
    })

    it('should show "Save" button text in edit mode', () => {
      mockUseStore.mockImplementation((selector) => selector(createMockState()))
      const collection = createMockCollection('col-1')

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
          collection={collection}
        />
      )

      expect(screen.getByText('Save')).toBeInTheDocument()
    })

    it('should disable Save button when no changes made', () => {
      mockUseStore.mockImplementation((selector) => selector(createMockState()))
      const collection = createMockCollection('col-1', { name: 'Original Name' })

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
          collection={collection}
        />
      )

      const saveButton = screen.getByText('Save').closest('button')
      expect(saveButton).toBeDisabled()
    })

    it('should enable Save button when changes are made', async () => {
      const user = userEvent.setup()
      mockUseStore.mockImplementation((selector) => selector(createMockState()))
      const collection = createMockCollection('col-1', { name: 'Original Name' })

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
          collection={collection}
        />
      )

      const nameInput = screen.getByLabelText('Name')
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Name')

      const saveButton = screen.getByText('Save').closest('button')
      expect(saveButton).not.toBeDisabled()
    })

    it('should call updateCollection with changes', async () => {
      const user = userEvent.setup()
      const updateCollection = vi.fn().mockResolvedValue(undefined)
      mockUseStore.mockImplementation((selector) => selector(createMockState({ updateCollection })))
      const collection = createMockCollection('col-1', { name: 'Original', description: '' })

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
          collection={collection}
        />
      )

      const nameInput = screen.getByLabelText('Name')
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Name')
      await user.click(screen.getByText('Save'))

      expect(updateCollection).toHaveBeenCalledWith('col-1', {
        name: 'Updated Name',
        description: undefined,
      })
    })

    it('should show image count in edit mode', () => {
      mockUseStore.mockImplementation((selector) => selector(createMockState()))
      const collection = createMockCollection('col-1', { image_ids: ['a', 'b', 'c'] })

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
          collection={collection}
        />
      )

      expect(screen.getByText('3 images')).toBeInTheDocument()
    })
  })

  describe('delete functionality', () => {
    it('should show Delete button in edit mode', () => {
      mockUseStore.mockImplementation((selector) => selector(createMockState()))
      const collection = createMockCollection('col-1')

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
          collection={collection}
        />
      )

      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('should NOT show Delete button in create mode', () => {
      mockUseStore.mockImplementation((selector) => selector(createMockState()))

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
        />
      )

      expect(screen.queryByText('Delete')).not.toBeInTheDocument()
    })

    it('should show confirmation when Delete clicked', async () => {
      const user = userEvent.setup()
      mockUseStore.mockImplementation((selector) => selector(createMockState()))
      const collection = createMockCollection('col-1')

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
          collection={collection}
        />
      )

      await user.click(screen.getByText('Delete'))

      expect(screen.getByText('Delete?')).toBeInTheDocument()
      expect(screen.getByText('Yes')).toBeInTheDocument()
      expect(screen.getByText('No')).toBeInTheDocument()
    })

    it('should call deleteCollection when confirmed', async () => {
      const user = userEvent.setup()
      const deleteCollection = vi.fn().mockResolvedValue(undefined)
      mockUseStore.mockImplementation((selector) => selector(createMockState({ deleteCollection })))
      const collection = createMockCollection('col-1')

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
          collection={collection}
        />
      )

      await user.click(screen.getByText('Delete'))
      await user.click(screen.getByText('Yes'))

      expect(deleteCollection).toHaveBeenCalledWith('col-1')
    })

    it('should cancel delete confirmation when No clicked', async () => {
      const user = userEvent.setup()
      mockUseStore.mockImplementation((selector) => selector(createMockState()))
      const collection = createMockCollection('col-1')

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
          collection={collection}
        />
      )

      await user.click(screen.getByText('Delete'))
      await user.click(screen.getByText('No'))

      // Confirmation should be hidden
      expect(screen.queryByText('Delete?')).not.toBeInTheDocument()
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
  })

  describe('favorites collection protection', () => {
    it('should NOT show Delete button for Favorites collection', () => {
      mockUseStore.mockImplementation((selector) => selector(createMockState()))
      const collection = createMockCollection('col-1', { name: '⭐ Favorites' })

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
          collection={collection}
        />
      )

      expect(screen.queryByText('Delete')).not.toBeInTheDocument()
    })

    it('should disable name input for Favorites collection', () => {
      mockUseStore.mockImplementation((selector) => selector(createMockState()))
      const collection = createMockCollection('col-1', { name: '⭐ Favorites' })

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
          collection={collection}
        />
      )

      const nameInput = screen.getByLabelText('Name') as HTMLInputElement
      expect(nameInput).toBeDisabled()
    })

    it('should show Star icon for Favorites collection', () => {
      mockUseStore.mockImplementation((selector) => selector(createMockState()))
      const collection = createMockCollection('col-1', { name: '⭐ Favorites' })

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
          collection={collection}
        />
      )

      expect(screen.getByTestId('icon-star')).toBeInTheDocument()
    })
  })

  describe('callbacks', () => {
    it('should call onClose when Cancel clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      mockUseStore.mockImplementation((selector) => selector(createMockState()))

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={onClose}
        />
      )

      await user.click(screen.getByText('Cancel'))

      expect(onClose).toHaveBeenCalled()
    })

    it('should call onSaved after successful save', async () => {
      const user = userEvent.setup()
      const onSaved = vi.fn()
      const createCollection = vi.fn().mockResolvedValue(undefined)
      mockUseStore.mockImplementation((selector) => selector(createMockState({ createCollection })))

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
          onSaved={onSaved}
        />
      )

      const nameInput = screen.getByLabelText('Name')
      await user.type(nameInput, 'Test')
      await user.click(screen.getByText('Create'))

      // Wait for async operation
      await vi.waitFor(() => {
        expect(onSaved).toHaveBeenCalled()
      })
    })
  })

  describe('keyboard shortcuts', () => {
    it('should show keyboard shortcut hint', () => {
      mockUseStore.mockImplementation((selector) => selector(createMockState()))

      render(
        <CollectionEditModal
          isOpen={true}
          onClose={vi.fn()}
        />
      )

      expect(screen.getByText('⌘↵')).toBeInTheDocument()
      expect(screen.getByText(/to save/)).toBeInTheDocument()
    })
  })
})
