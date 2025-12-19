import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock the store
const mockUseStore = vi.fn()
vi.mock('../../store', () => ({
  useStore: (selector: (state: unknown) => unknown) => mockUseStore(selector),
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Loader2: ({ className }: { className?: string }) => (
    <span data-testid="icon-loader" className={className}>⟳</span>
  ),
  Check: () => <span data-testid="icon-check">✓</span>,
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
import { ExtractionDialog } from './ExtractionDialog'

describe('ExtractionDialog', () => {
  const createMockDimension = (index: number, overrides = {}) => ({
    axis: 'style',
    name: `Dimension ${index}`,
    description: `Description for dimension ${index}`,
    tags: ['tag1', 'tag2', 'tag3'],
    prompt_fragment: `prompt fragment ${index}`,
    ...overrides,
  })

  const createMockState = (overrides = {}) => ({
    extractionDialog: {
      isOpen: false,
      isExtracting: false,
      imageIds: [],
      suggestedDimensions: [],
      selectedDimensionIndex: null,
    },
    closeExtractionDialog: vi.fn(),
    selectExtractionDimension: vi.fn(),
    createTokenFromExtraction: vi.fn(),
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('dialog visibility', () => {
    it('should not render content when dialog is closed', () => {
      const mockState = createMockState({
        extractionDialog: {
          isOpen: false,
          isExtracting: false,
          imageIds: [],
          suggestedDimensions: [],
          selectedDimensionIndex: null,
        },
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<ExtractionDialog />)

      // Dialog title should not be visible when closed
      expect(screen.queryByText('Extract Design Token')).not.toBeInTheDocument()
    })

    it('should render content when dialog is open', () => {
      const mockState = createMockState({
        extractionDialog: {
          isOpen: true,
          isExtracting: false,
          imageIds: ['img-1'],
          suggestedDimensions: [],
          selectedDimensionIndex: null,
        },
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<ExtractionDialog />)

      expect(screen.getByText('Extract Design Token')).toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('should show loading spinner when extracting', () => {
      const mockState = createMockState({
        extractionDialog: {
          isOpen: true,
          isExtracting: true,
          imageIds: ['img-1', 'img-2'],
          suggestedDimensions: [],
          selectedDimensionIndex: null,
        },
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<ExtractionDialog />)

      // May have multiple loaders (centered one + button)
      const loaders = screen.getAllByTestId('icon-loader')
      expect(loaders.length).toBeGreaterThan(0)
      expect(screen.getByText(/Analyzing 2 images/)).toBeInTheDocument()
    })

    it('should show singular "image" for single image', () => {
      const mockState = createMockState({
        extractionDialog: {
          isOpen: true,
          isExtracting: true,
          imageIds: ['img-1'],
          suggestedDimensions: [],
          selectedDimensionIndex: null,
        },
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<ExtractionDialog />)

      expect(screen.getByText(/Analyzing 1 image for/)).toBeInTheDocument()
    })
  })

  describe('suggested dimensions', () => {
    it('should display dimension suggestions when available', () => {
      const dimensions = [
        createMockDimension(1, { name: 'Visual Balance', axis: 'composition' }),
        createMockDimension(2, { name: 'Color Harmony', axis: 'palette' }),
      ]

      const mockState = createMockState({
        extractionDialog: {
          isOpen: true,
          isExtracting: false,
          imageIds: ['img-1'],
          suggestedDimensions: dimensions,
          selectedDimensionIndex: null,
        },
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<ExtractionDialog />)

      expect(screen.getByText('Visual Balance')).toBeInTheDocument()
      expect(screen.getByText('Color Harmony')).toBeInTheDocument()
      expect(screen.getByText('composition')).toBeInTheDocument()
      expect(screen.getByText('palette')).toBeInTheDocument()
    })

    it('should show dimension count in message', () => {
      const dimensions = [createMockDimension(1), createMockDimension(2), createMockDimension(3)]

      const mockState = createMockState({
        extractionDialog: {
          isOpen: true,
          isExtracting: false,
          imageIds: ['img-1', 'img-2'],
          suggestedDimensions: dimensions,
          selectedDimensionIndex: null,
        },
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<ExtractionDialog />)

      expect(screen.getByText(/Found 3 design dimensions from 2 images/)).toBeInTheDocument()
    })

    it('should display tags on dimension cards', () => {
      const dimensions = [
        createMockDimension(1, { tags: ['minimal', 'clean', 'modern', 'elegant', 'simple'] }),
      ]

      const mockState = createMockState({
        extractionDialog: {
          isOpen: true,
          isExtracting: false,
          imageIds: ['img-1'],
          suggestedDimensions: dimensions,
          selectedDimensionIndex: null,
        },
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<ExtractionDialog />)

      expect(screen.getByText('minimal')).toBeInTheDocument()
      expect(screen.getByText('clean')).toBeInTheDocument()
      expect(screen.getByText('modern')).toBeInTheDocument()
    })

    it('should show +N more when more than 5 tags', () => {
      const dimensions = [
        createMockDimension(1, { tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7'] }),
      ]

      const mockState = createMockState({
        extractionDialog: {
          isOpen: true,
          isExtracting: false,
          imageIds: ['img-1'],
          suggestedDimensions: dimensions,
          selectedDimensionIndex: null,
        },
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<ExtractionDialog />)

      expect(screen.getByText('+2 more')).toBeInTheDocument()
    })
  })

  describe('dimension selection', () => {
    it('should call selectExtractionDimension when dimension clicked', () => {
      const selectExtractionDimension = vi.fn()
      const dimensions = [createMockDimension(1)]

      const mockState = createMockState({
        extractionDialog: {
          isOpen: true,
          isExtracting: false,
          imageIds: ['img-1'],
          suggestedDimensions: dimensions,
          selectedDimensionIndex: null,
        },
        selectExtractionDimension,
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<ExtractionDialog />)

      fireEvent.click(screen.getByText('Dimension 1'))

      expect(selectExtractionDimension).toHaveBeenCalledWith(0)
    })

    it('should show check icon on selected dimension', () => {
      const dimensions = [createMockDimension(1), createMockDimension(2)]

      const mockState = createMockState({
        extractionDialog: {
          isOpen: true,
          isExtracting: false,
          imageIds: ['img-1'],
          suggestedDimensions: dimensions,
          selectedDimensionIndex: 0,
        },
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<ExtractionDialog />)

      expect(screen.getByTestId('icon-check')).toBeInTheDocument()
    })

    it('should apply selected styling to chosen dimension', () => {
      const dimensions = [createMockDimension(1)]

      const mockState = createMockState({
        extractionDialog: {
          isOpen: true,
          isExtracting: false,
          imageIds: ['img-1'],
          suggestedDimensions: dimensions,
          selectedDimensionIndex: 0,
        },
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<ExtractionDialog />)

      const selectedButton = document.querySelector('[class*="border-brass"][class*="bg-brass-muted"]')
      expect(selectedButton).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('should show empty message when no dimensions and not extracting', () => {
      const mockState = createMockState({
        extractionDialog: {
          isOpen: true,
          isExtracting: false,
          imageIds: ['img-1'],
          suggestedDimensions: [],
          selectedDimensionIndex: null,
        },
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<ExtractionDialog />)

      expect(screen.getByText(/No design dimensions could be detected/)).toBeInTheDocument()
    })
  })

  describe('action buttons', () => {
    it('should have Cancel and Create Token buttons', () => {
      const mockState = createMockState({
        extractionDialog: {
          isOpen: true,
          isExtracting: false,
          imageIds: ['img-1'],
          suggestedDimensions: [createMockDimension(1)],
          selectedDimensionIndex: 0,
        },
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<ExtractionDialog />)

      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByText('Create Token')).toBeInTheDocument()
    })

    it('should call closeExtractionDialog when Cancel clicked', () => {
      const closeExtractionDialog = vi.fn()

      const mockState = createMockState({
        extractionDialog: {
          isOpen: true,
          isExtracting: false,
          imageIds: ['img-1'],
          suggestedDimensions: [],
          selectedDimensionIndex: null,
        },
        closeExtractionDialog,
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<ExtractionDialog />)

      fireEvent.click(screen.getByText('Cancel'))

      expect(closeExtractionDialog).toHaveBeenCalled()
    })

    it('should disable Create Token when no dimension selected', () => {
      const mockState = createMockState({
        extractionDialog: {
          isOpen: true,
          isExtracting: false,
          imageIds: ['img-1'],
          suggestedDimensions: [createMockDimension(1)],
          selectedDimensionIndex: null,
        },
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<ExtractionDialog />)

      const createButton = screen.getByText('Create Token').closest('button')
      expect(createButton).toBeDisabled()
    })

    it('should enable Create Token when dimension is selected', () => {
      const mockState = createMockState({
        extractionDialog: {
          isOpen: true,
          isExtracting: false,
          imageIds: ['img-1'],
          suggestedDimensions: [createMockDimension(1)],
          selectedDimensionIndex: 0,
        },
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<ExtractionDialog />)

      const createButton = screen.getByText('Create Token').closest('button')
      expect(createButton).not.toBeDisabled()
    })

    it('should call createTokenFromExtraction when Create Token clicked', () => {
      const createTokenFromExtraction = vi.fn()

      const mockState = createMockState({
        extractionDialog: {
          isOpen: true,
          isExtracting: false,
          imageIds: ['img-1'],
          suggestedDimensions: [createMockDimension(1)],
          selectedDimensionIndex: 0,
        },
        createTokenFromExtraction,
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<ExtractionDialog />)

      fireEvent.click(screen.getByText('Create Token'))

      expect(createTokenFromExtraction).toHaveBeenCalled()
    })

    it('should show "Creating..." when extracting with selection', () => {
      const mockState = createMockState({
        extractionDialog: {
          isOpen: true,
          isExtracting: true,
          imageIds: ['img-1'],
          suggestedDimensions: [createMockDimension(1)],
          selectedDimensionIndex: 0,
        },
      })

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockState
      })

      render(<ExtractionDialog />)

      expect(screen.getByText('Creating...')).toBeInTheDocument()
    })
  })
})
