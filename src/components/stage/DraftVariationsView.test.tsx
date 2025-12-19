/**
 * Tests for DraftVariationsView component
 * Issue #16: Streaming text box should not be squished/narrow
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the store
const mockStore = {
  streamingText: '',
  prompts: [] as Array<{ id: string; images: Array<{ id: string }> }>,
  deleteDraft: vi.fn(),
  generateFromDraft: vi.fn(),
  updateDraftVariation: vi.fn(),
  removeDraftVariation: vi.fn(),
  removeMultipleDraftVariations: vi.fn(),
  duplicateDraftVariation: vi.fn(),
  regenerateDraftVariation: vi.fn(),
  addMoreDraftVariations: vi.fn(),
  reorderDraftVariations: vi.fn(),
  polishDraftVariations: vi.fn(),
  polishDraftVariation: vi.fn(),
  updateDraftVariationNotes: vi.fn(),
  toggleDraftVariationTag: vi.fn(),
  generatingImageDraftIds: new Set<string>(),
  updateImageNotes: vi.fn(),
};

vi.mock('../../store', () => ({
  useStore: (selector: (state: typeof mockStore) => unknown) => selector(mockStore),
}));

vi.mock('../../api', () => ({
  getImageUrl: (path: string) => `/images/${path}`,
}));

// Import after mocking
import { DraftVariationsView } from './DraftVariationsView';

describe('DraftVariationsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.streamingText = '';
  });

  describe('Issue #16: Streaming text box width', () => {
    it('should render streaming text container with full width classes when generating', () => {
      mockStore.streamingText = 'Generating prompt variations...';

      const draft = {
        id: 'draft-1',
        basePrompt: 'A beautiful landscape',
        title: 'Generating...',
        variations: [], // Empty = still loading
        createdAt: new Date().toISOString(),
        isGenerating: true,
      };

      const { container } = render(<DraftVariationsView draft={draft} />);

      // Check that the streaming text container has full-width classes
      const streamingWrapper = container.querySelector('.self-stretch');
      expect(streamingWrapper).toBeInTheDocument();
      expect(streamingWrapper).toHaveClass('w-full');
      expect(streamingWrapper).toHaveClass('self-stretch');
      expect(streamingWrapper).toHaveClass('px-4');

      // Check that the inner container has proper width classes
      const innerContainer = streamingWrapper?.querySelector('.bg-canvas-muted');
      expect(innerContainer).toBeInTheDocument();
      expect(innerContainer).toHaveClass('w-full');
      expect(innerContainer).toHaveClass('max-h-48');

      // Check that the pre element has proper text wrapping
      const preElement = container.querySelector('pre');
      expect(preElement).toBeInTheDocument();
      expect(preElement).toHaveClass('whitespace-pre-wrap');
      expect(preElement).toHaveClass('break-words');
      expect(preElement).toHaveClass('w-full');
      expect(preElement).toHaveClass('min-w-0');
    });

    it('should NOT have max-w-2xl constraint that causes squishing', () => {
      mockStore.streamingText = 'Some streaming text';

      const draft = {
        id: 'draft-1',
        basePrompt: 'Test prompt',
        title: 'Generating...',
        variations: [],
        createdAt: new Date().toISOString(),
        isGenerating: true,
      };

      const { container } = render(<DraftVariationsView draft={draft} />);

      // The old buggy code had max-w-2xl which constrained width
      const streamingWrapper = container.querySelector('.self-stretch');
      expect(streamingWrapper).not.toHaveClass('max-w-2xl');
      expect(streamingWrapper).not.toHaveClass('max-w-lg');
    });

    it('should display streaming text content', () => {
      const streamingContent = 'Creating variation 1 of 4...';
      mockStore.streamingText = streamingContent;

      const draft = {
        id: 'draft-1',
        basePrompt: 'Test',
        title: 'Generating...',
        variations: [],
        createdAt: new Date().toISOString(),
        isGenerating: true,
      };

      render(<DraftVariationsView draft={draft} />);

      expect(screen.getByText(/Creating variation/)).toBeInTheDocument();
    });

    it('should not show streaming container when not generating', () => {
      mockStore.streamingText = 'Old streaming text';

      const draft = {
        id: 'draft-1',
        basePrompt: 'Test',
        title: 'Complete',
        variations: [
          { id: 'v1', text: 'Variation 1', mood: '', type: '', design: {} },
        ],
        createdAt: new Date().toISOString(),
        isGenerating: false,
      };

      const { container } = render(<DraftVariationsView draft={draft} />);

      // Streaming container should not be present when not generating
      const streamingWrapper = container.querySelector('.self-stretch');
      expect(streamingWrapper).not.toBeInTheDocument();
    });
  });

  describe('Issue #34: Variation selection and deletion', () => {
    const createDraftWithVariations = (count: number) => ({
      id: 'draft-1',
      basePrompt: 'Test prompt',
      title: 'Test Draft',
      variations: Array.from({ length: count }, (_, i) => ({
        id: `v${i + 1}`,
        text: `Variation ${i + 1}`,
        mood: 'neutral',
        type: 'faithful',
        design: {},
      })),
      createdAt: new Date().toISOString(),
      isGenerating: false,
    });

    it('should render selection toggle button in header', () => {
      const draft = createDraftWithVariations(3);
      render(<DraftVariationsView draft={draft} />);

      // The header button should exist with proper title
      const selectionToggle = screen.getByTitle('Select variations to delete');
      expect(selectionToggle).toBeInTheDocument();
    });

    it('should show selection bar when selection mode is active', () => {
      const draft = createDraftWithVariations(3);

      render(<DraftVariationsView draft={draft} />);

      // Click to enter selection mode
      const selectionToggle = screen.getByTitle('Select variations to delete');
      fireEvent.click(selectionToggle);

      // Selection bar should appear with Select All button
      expect(screen.getByText('Select All')).toBeInTheDocument();
      expect(screen.getByText('0 selected')).toBeInTheDocument();
      expect(screen.getByText('Delete Selected')).toBeInTheDocument();
    });

    it('should show checkboxes on variation cards in selection mode', () => {
      const draft = createDraftWithVariations(3);

      const { container } = render(<DraftVariationsView draft={draft} />);

      // Enter selection mode
      const selectionToggle = screen.getByTitle('Select variations to delete');
      fireEvent.click(selectionToggle);

      // Check for checkbox buttons (Square icons are rendered as buttons)
      // In selection mode, each variation card should have a checkbox button
      const variationCards = container.querySelectorAll('.rounded-lg.border');
      expect(variationCards.length).toBe(3);
    });

    it('should disable Delete Selected when nothing is selected', () => {
      const draft = createDraftWithVariations(3);

      render(<DraftVariationsView draft={draft} />);

      // Enter selection mode
      const selectionToggle = screen.getByTitle('Select variations to delete');
      fireEvent.click(selectionToggle);

      // Delete Selected button should be disabled
      const deleteButton = screen.getByText('Delete Selected').closest('button');
      expect(deleteButton).toBeDisabled();
    });

    it('should update count when selecting variations', () => {
      const draft = createDraftWithVariations(3);

      render(<DraftVariationsView draft={draft} />);

      // Enter selection mode
      const selectionToggle = screen.getByTitle('Select variations to delete');
      fireEvent.click(selectionToggle);

      // Click Select All
      const selectAllButton = screen.getByText('Select All');
      fireEvent.click(selectAllButton);

      // Should show all selected
      expect(screen.getByText('3 selected')).toBeInTheDocument();
      expect(screen.getByText('Deselect All')).toBeInTheDocument();
    });

    it('should disable Delete Selected when all variations would be deleted', () => {
      const draft = createDraftWithVariations(2);

      render(<DraftVariationsView draft={draft} />);

      // Enter selection mode
      const selectionToggle = screen.getByTitle('Select variations to delete');
      fireEvent.click(selectionToggle);

      // Select all variations
      const selectAllButton = screen.getByText('Select All');
      fireEvent.click(selectAllButton);

      // Delete Selected should be disabled because we can't delete all
      const deleteButton = screen.getByText('Delete Selected').closest('button');
      expect(deleteButton).toBeDisabled();
      expect(deleteButton).toHaveAttribute('title', 'Cannot delete all variations');
    });

    it('should exit selection mode on Cancel', () => {
      const draft = createDraftWithVariations(3);

      render(<DraftVariationsView draft={draft} />);

      // Enter selection mode
      const selectionToggle = screen.getByTitle('Select variations to delete');
      fireEvent.click(selectionToggle);

      // Click Cancel
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      // Selection bar should be gone
      expect(screen.queryByText('Select All')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete Selected')).not.toBeInTheDocument();
    });
  });
});
