# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pageant is an image generation studio built on Google's Gemini API. It provides an interface for generating, organizing, tagging, and managing AI-generated images with features like collections, favorites, batch operations, and keyboard shortcuts.

## Development Commands

```bash
make dev          # Start frontend (5173) + backend (8765) together
make restart      # Kill and restart both servers
make stop         # Stop both servers
make frontend     # Frontend only
make backend      # Backend only
make install      # Install Bun + uv dependencies
```

**Testing:**
```bash
bun run test          # Vitest watch mode
bun run test:run      # Single test run
bun run test:coverage # Coverage report
```

**Linting/Building:**
```bash
bun run lint      # ESLint
bun run build     # TypeScript check + Vite bundle
```

**Backend testing:**
```bash
uv run pytest backend/tests/
```

## Architecture

### Frontend (React + Zustand)
- **Store** (`src/store/`): Zustand store with slices for generation, selection, session, navigation, and library state
- **API Layer** (`src/api/`): 27 endpoint handlers with generic fetcher utilities
- **Three-pane layout**: Left sidebar (prompts, collections, favorites, templates, library, sessions) → Main stage (single/grid/compare views) → Right panel (generate, info, settings)

### Backend (FastAPI)
- **server.py**: FastAPI app with all routes, serves static files and proxies `/api` and `/images`
- **gemini_service.py**: Google Generative AI SDK wrapper for image/text generation
- **metadata_manager.py**: JSON-based persistence to `metadata.json`

### Data Flow
- Frontend proxies API calls through Vite dev server to backend at :8765
- Images stored in `generated_images/` directory
- All metadata persisted to single `metadata.json` file

## Key Patterns

### Two-Phase Generation
1. `POST /api/generate-prompts` - Generate prompt variations from a single prompt
2. User edits/refines variations
3. `POST /api/generate-images` - Batch generate images from refined variations

### Design Axis System
Images can be tagged on multiple design axes (colors, composition, mood, layout, aesthetic). The system tracks user preferences via the `liked_axes` field on images.

### Store Slices
State is organized into modular slices in `src/store/slices/`:
- `generationSlice` - generation status, pending prompts
- `selectionSlice` - selection mode, selected IDs
- `sessionSlice` - current session tracking
- `navigationSlice` - current prompt/image, view modes
- `librarySlice` - library items management

## GitHub Issues Workflow

All development tasks are tracked in GitHub Issues. This is the single source of truth.

### Size Labels
- `size:small` - Quick fixes, renames, single-file changes
- `size:medium` - Multi-file features, moderate refactors
- `size:large` - Architectural changes, major features

### Working on Issues
```bash
gh issue list                     # See open issues
gh issue view 123                 # Read issue details
gh issue develop 123 --checkout   # Create branch and start work
```

### Completing Issues
When you finish an issue, state:
1. The issue number
2. What was done (brief)
3. The commit hash that resolves it

Example:
> Completed #5: Renamed 'Caption' to 'Annotation' across UI.
> Commit: `abc1234`

The commit message should include `Fixes #123` to auto-close the issue.

### Creating Issues
Claude can create issues when the user identifies bugs or features:
```bash
gh issue create --title "..." --label "bug,size:small" --body "..."
```

### Documenting Design Decisions
GitHub Issues is the unified hub for all design decisions. Claude must document major plans and feature changes on GitHub:

- **Existing issue**: If work stems from an existing issue, add comments there with design decisions, trade-offs considered, and implementation approach
- **New work**: Create a new issue to track the feature/change and document decisions as the work progresses
- **Plan files**: When creating detailed plans (e.g., in `.claude/plans/`), summarize key decisions in the related GitHub issue

This ensures all design rationale is traceable and can be referenced later.

### Quick Reference
```bash
gh issue list --label "size:small"    # Filter by size
gh issue close 123                     # Close manually
gh issue edit 123 --add-label "..."   # Add labels
```

## Configuration

Gemini API key location (checked in order):
1. `~/.gemini/apikey.txt`
2. `GEMINI_API_KEY` environment variable
3. `GEMINI_API_KEY_PATH` pointing to key file
