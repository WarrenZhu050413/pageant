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

GitHub Issues is the **single source of truth** for tracking bugs, features, and improvements. It serves as persistent memory across sessions and a first place to check when problems arise.

### Core Principle

**Every identified problem or feature MUST have a GitHub issue.** Before starting any work, check if an issue already exists. If not, create one.

### Workflow

#### 1. Identify & Create Issue
When you identify a bug, new feature, or improvement:
```bash
# Check existing issues first
gh issue list
gh issue list --state all | grep -i "keyword"

# Create new issue if none exists
gh issue create --title "Short description" --label "bug,size:small" --body "..."
```

**Issue body contains:**
- Description of the problem/feature
- Current behavior (for bugs)
- Expected/desired behavior
- Relevant context (files, screenshots, error messages)

**Issue body does NOT contain:**
- The fix or implementation plan (that goes in comments)

#### 2. Plan in Comments
Add the fix/implementation plan as **comments** on the issue:
```bash
gh issue comment 123 --body "## Plan
1. Update X in file Y
2. Add tests for Z
3. ..."
```

Multiple comments are fine as the plan evolves.

#### 3. Implement & Test
- Write tests that verify the fix/feature
- Implement the solution
- Ensure `bun run build` passes

#### 4. Commit & Close
Commit with issue reference:
```bash
git commit -m "Short description

- Detail 1
- Detail 2
- Tests: src/path/to/test.ts

Fixes #123"
```

Then close with a summary comment:
```bash
gh issue comment 123 --body "Fixed in commit abc1234. Tests added in src/path/to/test.ts"
# Issue auto-closes from "Fixes #123" in commit message
```

### Size Labels
- `size:small` - Quick fixes, renames, single-file changes
- `size:medium` - Multi-file features, moderate refactors
- `size:large` - Architectural changes, major features

### Quick Reference
```bash
gh issue list                         # Open issues
gh issue list --state all             # All issues (check for regressions)
gh issue view 123                     # Read issue details
gh issue comment 123 --body "..."     # Add plan/update
gh issue close 123                    # Close manually
gh issue reopen 123                   # Reopen if regression found
```

### When to Check Issues First
- Before starting new work → existing issue?
- When encountering a bug → was it reported before?
- When something regresses → find the original fix

## Configuration

Gemini API key location (checked in order):
1. `~/.gemini/apikey.txt`
2. `GEMINI_API_KEY` environment variable
3. `GEMINI_API_KEY_PATH` pointing to key file
