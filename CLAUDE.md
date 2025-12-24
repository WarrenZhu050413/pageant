# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pageant is an image generation studio built on Google's Gemini API. It provides context engineering for image models (auto-selected references, annotations that travel with images, design tokens) and batch experimentation (prompt variations → parallel generation).

## Development Commands

```bash
make dev          # Start frontend (5180) + backend (8765) together
make stop         # Stop all servers
make frontend     # Frontend only
make backend      # Backend only
make install      # Install Bun + uv dependencies
```

**Testing:**
```bash
bun run test                           # Vitest watch mode
bun run test:run                       # Single test run
bun run test src/store/slices/foo.ts   # Run specific test file
bun run test:coverage                  # Coverage report
uv run pytest backend/tests/           # Backend tests
```

**Linting/Building:**
```bash
bun run lint      # ESLint
bun run build     # TypeScript check + Vite bundle
```

## Architecture

### Terminology Convention
**Frontend uses "Generation", backend uses "Prompt"** - these refer to the same entity. The API layer (`src/api/`) bridges this: it calls `/api/prompts` endpoints but the store treats results as `Generation[]`. See comments at top of `src/store/index.ts` and `src/api/index.ts`.

### Frontend (React + Zustand)
- **Store** (`src/store/`): Zustand with modular slices (generation, selection, session, navigation, library)
- **API Layer** (`src/api/`): Fetcher utilities with snake_case→camelCase transformation
- **Prompts** (`src/prompts/`): Frontend builds full prompts from templates before sending to backend
- **Three-pane layout**: Left sidebar → Main stage (single/grid views) → Right panel (generate, info, settings)

### Backend (FastAPI)
- **server.py**: All routes, serves static files and proxies `/api` and `/images`
- **gemini_service.py**: Google Generative AI SDK wrapper
- **metadata_manager.py**: JSON-based persistence to `generated_images/metadata.json`

### Data Flow
- Vite dev server proxies `/api` and `/images` to backend at :8765
- Images stored in `generated_images/` directory with metadata in `metadata.json`

## Key Patterns

### Two-Phase Generation
1. User enters prompt + selects context images → frontend builds full prompt from template (`src/prompts/`)
2. `POST /api/generate-prompts` → returns prompt variations with recommended context images per variation
3. User edits/refines variations in UI
4. `POST /api/generate-images` → batch generate images from refined variations (supports streaming via SSE)

### Design Axis System
Images tagged on extensible axes (colors, composition, layout, aesthetic). See `src/types/index.ts` for `SUGGESTED_TAGS` - the system accepts any tag string, not just predefined ones. User preferences tracked via `liked_axes` field.

### Design Tokens
Extract reusable visual concepts from images. Tokens have `design_dimensions` (structured AI analysis) and `generation_prompt` for applying the concept to new generations. See `DesignToken` type.

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
**IMPORTANT: Always commit BEFORE closing the issue.** Never close an issue without first committing the related changes.

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
